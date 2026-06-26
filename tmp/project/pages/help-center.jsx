// =====================================================================
// Flex Work — Internal Help Center
//   Reached via the avatar menu: Help & support → Internal.
//   The "Customer" sibling opens the external customer help portal in a
//   new tab. This page is the *internal* knowledge base — written for
//   Dayforce employees (CS, AEs, SEs, support, product, eng) who need
//   to brief themselves on what Flex Work does, why a feature exists,
//   how it varies in the wild, and how it stacks up against the rest
//   of the VMS market.
//
//   The first section is **Features**. Each feature gets a dedicated
//   page covering:
//     1. Overview — what it does, end to end
//     2. Why it matters for VMS — the program-level reason it exists
//     3. Variations — how different customers use it
//     4. Competitive landscape — how it stacks up vs. Beeline,
//        Fieldglass, VNDLY, Magnit, Coupa CCWM
//     5. Roadmap — what's next, in priority order
//
//   Voice: enterprise-pragmatic. Sentence case. No emoji. The voice
//   matches the Everest content guidelines — direct, calm, respectful
//   of expertise. Use cases and competitor notes are written for
//   internal eyes — opinionated, not marketing copy.
// =====================================================================

const { useState: useStateHC, useMemo: useMemoHC, useEffect: useEffectHC } = React;

// ---------- Sections (left-rail navigation) -----------------------------
const HC_SECTIONS = [
  { id: "features",     label: "Features",            icon: "Stack",                 desc: "What every module does, end-to-end." },
  { id: "onboarding",   label: "Onboarding guides",   icon: "ClipboardCircleCheck",  desc: "Implementation playbooks by program shape." },
  { id: "playbooks",    label: "Field playbooks",     icon: "Notes",                 desc: "Common configurations and the trade-offs." },
  { id: "release",      label: "Release notes",       icon: "Bolt",                  desc: "What shipped, what's behind a flag, what's pending." },
  { id: "competitive",  label: "Competitive briefs", icon: "BarChart",              desc: "Battlecards by competitor — full landscape view." },
  { id: "glossary",     label: "Glossary",            icon: "File",                  desc: "VMS, MSP, RPO, SOW — defined." },
];

// ---------- Competitor name table (used by competitor rows) -------------
const HC_COMPETITORS = {
  beeline:     "Beeline",
  fieldglass:  "SAP Fieldglass",
  vndly:       "Workday VNDLY",
  magnit:      "Magnit",
  coupa:       "Coupa CCWM",
  prism:       "Prism HR / Greenfield",
};

// ---------- Roadmap priority tags ---------------------------------------
const HC_PRIO = {
  now:   { label: "Now",       tone: "warning",     desc: "In flight this quarter" },
  next:  { label: "Next",      tone: "informative", desc: "Committed for the following quarter" },
  later: { label: "Later",     tone: "neutral",     desc: "Backlog — sequenced, not scheduled" },
  watch: { label: "Watching",  tone: "muted",       desc: "Tracked signal; no commitment" },
};

// ---------- Feature catalog (the real data) -----------------------------
// Each entry is the source of one full Feature detail page. Order here
// drives both the catalog grid and the per-feature next/prev nav.
const HC_FEATURES = [
  // ---- 1. Requisitions ------------------------------------------------
  {
    id: "requisitions",
    icon: "Briefcase",
    name: "Requisitions",
    tagline: "How work enters the program.",
    audience: "Hiring managers, MSPs, suppliers",
    maturity: "GA",
    owner: "Mira Sato · Product, frontline",
    updated: "2026-05-25",
    summary: "Requisitions are the single entry point for non-employee work — frontline shifts, professional assignments, SOW projects, and contractor engagements all originate here. Intake captures the job, scope, rate, location, dates, and approvals; once approved the requisition either auto-broadcasts to suppliers (frontline) or routes to a submittal queue (professional).",
    why: [
      "Every line of contingent spend traces back to a requisition. Without consistent intake you can't enforce rate cards, can't audit who approved what, and can't reconcile invoices to work that was actually authorized.",
      "Frontline programs need intake fast enough that a manager will use it during a Tuesday afternoon callout (under 90 seconds). Professional programs need intake rigorous enough to support a 6-week SOW negotiation. The same module has to do both.",
      "Requisitions are also the unit that finance budgets against, that MSPs SLA against, and that suppliers compete on. Get the intake wrong and the entire downstream program is mis-shaped.",
    ],
    variations: [
      { title: "Templated frontline shift", body: "Manager picks a job from a saved template, fills three fields (date, headcount, location), and submits. Auto-broadcasts to the supplier tier 1 list with a 15-minute Tier 1 hold." },
      { title: "Multi-step professional assignment", body: "Intake captures skills, screening questions, rate band, and a hiring panel. Routes to a sourcing queue; an MSP curates submittals before the manager sees candidates." },
      { title: "SOW / project intake", body: "Long-form intake covering deliverables, milestones, IP terms, and a fixed-fee schedule. Approvals stack legal + finance + executive sponsor." },
      { title: "Contractor onboard (IC / 1099)", body: "Triggered from a worker the manager already knows. Skips submittals; goes straight to compliance checks, MSA + SOW templating, and tax form collection." },
      { title: "Import / bulk intake", body: "CSV or API push from an ATS, ERP, or a parent platform. Used for migrations and for programs where intake is fully system-of-record elsewhere." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline's intake is deepest for professional + SOW. Frontline is bolted on; the intake takes 3–4 minutes per shift, which is too slow for true frontline volume." },
      { id: "fieldglass", pos: "behind", note: "Fieldglass intake is rigorous and configurable but legendarily slow to load. Mobile intake is a long-standing weakness." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY's intake is the clearest in the market for professional. We win on frontline speed and on cross-type (a single requisition that can flex from shift to assignment to SOW)." },
      { id: "magnit",     pos: "ahead",  note: "Magnit's strength is the program-services wrap, not the intake UI. Their self-service form is dated." },
      { id: "coupa",      pos: "ahead",  note: "CCWM intake leans on Coupa's procurement form patterns — fine for SOW, awkward for shift work." },
    ],
    roadmap: [
      { prio: "now",   title: "AI-assisted intake from email or chat",                detail: "Paste a callout email or Slack thread; we extract job, location, headcount, dates and pre-fill the form. Manager confirms in under 30 seconds." },
      { prio: "now",   title: "Recurring requisitions (no copy-paste)",                detail: "First-class recurrence on shift requisitions — weekday patterns, exception calendars, batch edit. Replaces the customer-built copies from templates." },
      { prio: "next",  title: "Mobile-first intake for managers",                      detail: "Native gestures, location autopick, voice-to-text for the description field. Targeting parity with the desktop form for shift + assignment intakes." },
      { prio: "next",  title: "Org-tree-aware approval routing",                       detail: "Approvals can target a node in the org tree (Sector, Division, Cost Center) rather than a fixed user list. Routes automatically as the org tree changes." },
      { prio: "later", title: "Cross-program intake (shared services)",                detail: "One intake that can fan out to multiple buyer programs from a single shared services org. Needed by Helios and other multi-tenant operators." },
      { prio: "watch", title: "Conversational intake on Teams / Slack",                detail: "Tracking enterprise demand. Most buyers want the data in Dayforce, not in chat — we don't lead with this." },
    ],
  },

  // ---- 2. Schedule & shifts ------------------------------------------
  {
    id: "schedule",
    icon: "Calendar",
    name: "Schedule & shifts",
    tagline: "Fill the work that's been approved.",
    audience: "Schedulers, site managers, suppliers, workers",
    maturity: "GA",
    owner: "Mira Sato · Product, frontline",
    updated: "2026-05-25",
    summary: "The schedule console turns approved requisitions into concrete shift bookings against named workers. It owns the broadcast pipeline (which suppliers see which shifts at what time), the booking lifecycle (offered → accepted → confirmed → started → completed), and the day-of console schedulers actually live in.",
    why: [
      "Fill rate, time-to-fill, and no-show rate are the three numbers a frontline VMS lives or dies on. Schedule is where all three are won or lost.",
      "Without a fast schedule console, customers fall back to texting supervisors and managing a spreadsheet. That breaks audit trails, breaks rate enforcement, and breaks compliance.",
      "Schedule is the surface that workers and supplier dispatchers touch most often — it's the single biggest driver of perceived program quality on the supply side.",
    ],
    variations: [
      { title: "Pure broadcast (open market)",     body: "Shift goes to all approved suppliers at once; first to accept wins. Common in light-industrial, common in markets with deep supply." },
      { title: "Tiered broadcast",                  body: "Tier 1 suppliers get a 15- or 30-minute exclusive window; if they don't fill, Tier 2 unlocks, then Tier 3. The default for most enterprise programs." },
      { title: "Sole-source / preferred",           body: "Specific supplier owns the booking outright; no broadcast. Used for high-trust clinical and skilled-trade programs." },
      { title: "Direct-to-worker (talent pool)",    body: "Booking goes straight to a known worker the manager picks from a saved talent pool. Bypasses suppliers entirely for redeployment shifts." },
      { title: "Self-schedule (worker-pull)",       body: "Eligible workers see open shifts in a marketplace view and self-claim them. Used by larger hospitality and warehouse programs." },
    ],
    competitors: [
      { id: "beeline",    pos: "ahead",  note: "Beeline does not own day-of scheduling — they hand off to operational tools. We win every frontline shop on this point alone." },
      { id: "fieldglass", pos: "ahead",  note: "Fieldglass has no real schedule console. Reqs and timesheets, no day-of operating surface." },
      { id: "vndly",      pos: "ahead",  note: "Same as Beeline / Fieldglass — VNDLY treats scheduling as out-of-scope." },
      { id: "magnit",     pos: "even",   note: "Magnit ships day-of tooling as part of program services, but it's a separate operational team using separate software." },
      { id: "coupa",      pos: "ahead",  note: "CCWM has no day-of operating surface." },
    ],
    roadmap: [
      { prio: "now",   title: "Console v2 — drag to fill",                             detail: "Drag a worker onto an open shift; we resolve eligibility, distance, fatigue rules, and rate in flight. Replaces the modal-heavy current flow." },
      { prio: "now",   title: "Late-fill auto-escalation",                              detail: "Shifts inside their tier-2 window without an accept get auto-escalated to tier 3 with manager opt-out, instead of a manual nudge." },
      { prio: "next",  title: "Fatigue + clopen detection at booking time",             detail: "Reject or warn on a booking that violates rest minimums or creates a clopen for the worker — before the offer reaches the worker's phone." },
      { prio: "next",  title: "Worker-side acceptance from SMS",                        detail: "Single SMS thread that handles offer, accept, decline, swap, and confirm. Native-app fallback retained." },
      { prio: "later", title: "Predictive recommendations from booking history",        detail: "When a manager opens schedule on a Monday morning, surface the three workers most likely to accept their open shifts based on history + current availability." },
      { prio: "watch", title: "Bidding marketplaces (worker quotes rate)",              detail: "We're not pursuing this — it pushes wage volatility onto the worker, and most enterprise buyers are explicitly anti-auction." },
    ],
  },

  // ---- 3. Timesheets --------------------------------------------------
  {
    id: "timesheets",
    icon: "PersonClock",
    name: "Timesheets & approvals",
    tagline: "Capture hours, prove they happened, route them to payroll.",
    audience: "Workers, site supervisors, payroll, finance",
    maturity: "GA",
    owner: "Mira Sato · Product, frontline (with Rae Ortiz · Platform)",
    updated: "2026-05-20",
    summary: "Timesheets receive clock data (Dayforce time clock, supplier punch feeds, manual entry), apply pay rules (overtime, premiums, meal breaks, geofence checks), and route the result through one or more approval levels before becoming an invoice line and a payroll record.",
    why: [
      "Timesheet error is the single largest source of invoice disputes and worker re-pay events. Every percentage point of clean-on-first-submit is worth real money.",
      "Compliance lives in the timesheet — California meal-break premiums, predictive-scheduling penalties, union step-up rates, geofence-required clock-ins. A weak timesheet engine pushes those costs back onto the customer's general ledger.",
      "Auditability matters: every state has its own retention rule, every customer's finance team will eventually ask 'who approved this hour?'. The answer needs to be one click away.",
    ],
    variations: [
      { title: "Single-approver site",        body: "Site supervisor approves the day's hours each morning. ~80% of small-program timesheet flow." },
      { title: "Two-step (supplier + buyer)", body: "Supplier dispatcher verifies their worker's hours; buyer manager approves. Standard for tiered MSP programs." },
      { title: "Exception-only approval",      body: "Hours auto-approve when they match the booked shift inside a tolerance band; the supervisor only sees the exceptions. The pattern most mature programs land on." },
      { title: "Crew / batch approval",        body: "Foreman approves an entire crew's day in one action with a per-row override list. Used in construction and warehousing." },
      { title: "Project-coded time (assignment / SOW)", body: "Hours allocate against a project code or milestone, not a shift. Used for professional assignments and time-and-materials SOWs." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline has a strong professional timesheet, weaker exception handling, no real shift-clock model." },
      { id: "fieldglass", pos: "ahead",  note: "Fieldglass timesheet UX is the slowest in the market — multi-screen, modal-heavy, especially on mobile. We're materially faster on every common path." },
      { id: "vndly",      pos: "even",   note: "VNDLY's timesheet is clean and modern but biased to professional. Our Dayforce-native pay rule engine is a structural advantage they can't replicate." },
      { id: "magnit",     pos: "ahead",  note: "Magnit uses Beeline under the hood; same limitations." },
      { id: "coupa",      pos: "ahead",  note: "CCWM's timesheet is procurement-style — fine for SOW T&M, awkward for shift workers." },
    ],
    roadmap: [
      { prio: "now",   title: "Geofence + selfie clock-in on the worker app",          detail: "Pin the clock-in to the booked location and the worker's face. Replaces customer-built workarounds with paper sign-in sheets." },
      { prio: "now",   title: "Exception-only approval as the default",                detail: "Today this is a per-program toggle; we're flipping it on by default with a per-job-class tolerance band." },
      { prio: "next",  title: "Predictive-scheduling premium auto-detection",          detail: "Detect Seattle / NYC / Oregon / Philly fair-workweek violations at booking time and apply the premium automatically to the timesheet line." },
      { prio: "next",  title: "Direct-to-payroll route for Dayforce customers",        detail: "Approved timesheets post straight to Dayforce Payroll without the intermediate invoice step, with rate reconciliation pre-baked." },
      { prio: "later", title: "Worker-initiated dispute flow",                          detail: "If a worker disagrees with an approved timesheet, they can open a structured dispute (not an email) that routes to the supplier and the buyer." },
      { prio: "watch", title: "Biometric attestation (palm / retina)",                  detail: "Following a handful of healthcare RFPs. Not pursuing until two named accounts commit." },
    ],
  },

  // ---- 4. Invoices ----------------------------------------------------
  {
    id: "invoices",
    icon: "Pay",
    name: "Invoices",
    tagline: "Turn approved work into clean money movement.",
    audience: "AP, finance, supplier accounting, MSPs",
    maturity: "GA",
    owner: "Devon Ojo · Product, finance",
    updated: "2026-05-18",
    summary: "Invoices are the system of record for what's owed to whom. They aggregate approved timesheets and milestones into supplier-billable units, apply tax + markup + fees, route through customer AP approval, and post to the ERP. Disputes, credit notes, and consolidated billing all live here.",
    why: [
      "The invoice surface is the only one finance touches every day. If invoices reconcile cleanly, the program scales; if they don't, you're stuck in a quarterly dispute cycle that drains margin.",
      "Most VMS deals close on AP efficiency, not on intake elegance. Days-to-pay, dispute rate, and consolidated-billing maturity are what enterprise procurement actually benchmarks.",
      "Invoices are also where multi-currency, multi-entity, and sales-tax rules become real. A program that supports one country is six months from supporting six.",
    ],
    variations: [
      { title: "Auto-generated from approved time", body: "Standard for frontline programs. Approved timesheets aggregate into a weekly or biweekly supplier invoice. Manager sees the invoice; doesn't write it." },
      { title: "Supplier-submitted",                body: "Supplier uploads or types the invoice; we reconcile against approved work and flag exceptions. Used in professional + SOW programs and any program with a legacy supplier mix." },
      { title: "Milestone-billed (SOW)",            body: "Invoice posts on milestone acceptance, not on hours. Includes the milestone description and acceptance evidence." },
      { title: "Consolidated buyer invoice",         body: "Customer receives one invoice covering all suppliers for the period. Common in MSP programs; the MSP issues a single rolled-up bill." },
      { title: "Pass-through (no markup)",           body: "Some programs route invoices through Flex Work for compliance and audit but apply no markup. We bill a SaaS fee separately." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline AP is mature. We compete on the timesheet→invoice reconciliation being tighter and on multi-entity tax being faster to configure." },
      { id: "fieldglass", pos: "even",   note: "Fieldglass invoice + tax engine is the gold standard for SOW. We're behind on the long tail of country-specific VAT but ahead on shift-based fast paths." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY's invoice + ERP integration is the most-cited gap in their RFP responses." },
      { id: "magnit",     pos: "even",   note: "Magnit's MSP services wrap the invoice — the underlying tooling is Beeline-class." },
      { id: "coupa",      pos: "behind", note: "CCWM is a Coupa-native invoice; the procurement DNA is an advantage in finance-led RFPs." },
    ],
    roadmap: [
      { prio: "now",   title: "Multi-entity supplier billing",                          detail: "One supplier billing multiple buyer legal entities from one program, with separate tax IDs and remit-to addresses per entity." },
      { prio: "now",   title: "Native sales-tax + VAT engine (Vertex/Avalara)",         detail: "Replace the per-country lookup table with a real tax engine. Closes the long tail of European VAT scenarios." },
      { prio: "next",  title: "Auto-credit-note for retroactive timesheet edits",       detail: "Approved invoice + retroactive timesheet edit = automatic credit note + corrected re-invoice, with finance approval gate." },
      { prio: "next",  title: "Direct ERP webhook posting (NetSuite, SAP S/4)",         detail: "Replace the nightly export with real-time posting and reconciliation. Reduces days-to-pay materially." },
      { prio: "later", title: "AI-assisted dispute triage",                              detail: "Categorize incoming disputes by type and pre-fill the recommended resolution with cited timesheet evidence." },
      { prio: "watch", title: "Crypto / stablecoin payouts for cross-border suppliers",  detail: "Not actively pursuing. Useful for IC + global payouts; revisit when stablecoin AP rails are bank-blessed." },
    ],
  },

  // ---- 5. Supplier management ----------------------------------------
  {
    id: "suppliers",
    icon: "Building",
    name: "Supplier management",
    tagline: "Score, rank, and govern the supply base.",
    audience: "Program managers, MSPs, sourcing, procurement",
    maturity: "GA",
    owner: "Devon Ojo · Product, professional + SOW",
    updated: "2026-05-14",
    summary: "Supplier management is the program-governance layer: who's on the program, what tier they sit in, what they can submit on, how they're scored, how the contract reads, when it renews, and when it should be exited. Every other module reads from this layer.",
    why: [
      "Without an honest scorecard, tiering is political. With one, the program self-balances — strong suppliers get more allocation, weak ones get coached or exited.",
      "Supplier governance is the most common reason a buyer brings a VMS in. The intake and the timesheet can be tolerated as spreadsheets; the supplier list can't, especially in regulated industries.",
      "The supplier surface is also the M&A target most likely to differentiate Flex Work — every enterprise has a strong opinion on what supplier scoring should weight.",
    ],
    variations: [
      { title: "Internal-only (no MSP)",        body: "The buyer manages their own supplier list. Scorecards roll up to the program manager." },
      { title: "MSP-managed",                    body: "An MSP partner administers the supplier list on behalf of the buyer; the buyer sees the same data with a different action set." },
      { title: "Direct-source pool",              body: "Buyer pre-vetted suppliers for specific job classes; they always win distribution for those classes." },
      { title: "Hybrid (staff agency tenant)",   body: "The supplier IS the customer — staffing agencies operate Flex Work from a tenant where they sit on the supplier side of every transaction. Different KPIs, different reports." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline's scorecards are configurable but bureaucratic to set up. We're materially faster on time-to-first-scorecard." },
      { id: "fieldglass", pos: "behind", note: "Fieldglass scorecards are the most mature in the market; we're behind on the long tail of supplier QBR tooling." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY scorecards are minimal — they treat governance as an MSP responsibility." },
      { id: "magnit",     pos: "even",   note: "Magnit's strength is in the human program services, not the tooling. The underlying scorecards are middle-of-pack." },
      { id: "coupa",      pos: "ahead",  note: "CCWM supplier scorecards mostly inherit from Coupa SIM — fine for procurement metrics, weak for fill-rate / time-to-fill operational metrics." },
    ],
    roadmap: [
      { prio: "now",   title: "Score-driven tiering automation",                        detail: "Suppliers move tiers based on their scorecard with a manager approval gate, instead of an annual review cycle. Closes the gap between performance and allocation." },
      { prio: "now",   title: "Per-job-class scorecards",                                detail: "Scorecards weighted differently for clinical RN vs. light-industrial picker. Same supplier, different positions in the ranking, depending on what's being filled." },
      { prio: "next",  title: "Supplier QBR pack auto-generation",                      detail: "One-click export of the supplier's quarter — fill rate, score breakdown, dispute log, contract status, action items. Replaces the customer-built deck." },
      { prio: "next",  title: "Diversity + spend-share dashboards",                     detail: "Real-time diversity-classification spend share with target thresholds and a corrective-action workflow." },
      { prio: "later", title: "Supplier coaching workflow",                              detail: "When a supplier drops below threshold, automatically open a structured coaching engagement with milestones and a re-evaluation date." },
      { prio: "watch", title: "Supplier-to-supplier marketplace",                        detail: "Tier-1 supplier sub-contracts to a tier-3 supplier inside the platform. Demand is real but governance is complex; tracking signal." },
    ],
  },

  // ---- 6. Supplier distribution --------------------------------------
  {
    id: "distribution",
    icon: "Broadcast",
    name: "Supplier distribution",
    tagline: "Decide which suppliers see which work, when.",
    audience: "Program managers, schedulers, MSPs",
    maturity: "GA",
    owner: "Mira Sato · Product, frontline",
    updated: "2026-05-20",
    summary: "Distribution is the rules engine that decides how an approved requisition or open shift reaches the supplier base. It owns tier-and-hold logic, eligibility filters (job class, location, certification, diversity), and re-broadcast escalation. It's also the surface that decides when work falls into a talent pool versus the open market.",
    why: [
      "Distribution is the lever programs adjust most often — every quarter a buyer wants to shift allocation toward a preferred supplier, a diverse supplier, or away from a chronic under-performer. The settings have to be easy to reason about under pressure.",
      "The wrong distribution rule pumps fill rate and crashes diversity. Or vice versa. The model has to expose the trade-off, not hide it.",
      "Distribution is also the most-mistaken-for-static surface — it should be a continuously tuned thing, but most VMS products treat it as a configure-once form.",
    ],
    variations: [
      { title: "Flat (all suppliers, no tiers)",     body: "Every approved supplier sees every requisition at the same time. Simple, fast, but bad for preferred-supplier programs." },
      { title: "Tier 1 / 2 / 3 with timed holds",    body: "Tier 1 gets a 15-minute exclusive, then Tier 2, then Tier 3. The default. Knobs are the hold duration and the eligibility filters per tier." },
      { title: "Slot-share guarantee",                body: "Tier 1 gets a guaranteed % share of monthly volume regardless of fill speed. Used in deeply preferred-supplier programs." },
      { title: "Talent-pool-first",                   body: "Saved worker pools receive the offer before any supplier sees it. Promotes redeployment over acquisition." },
      { title: "Diverse-supplier-first",              body: "Eligible certified diverse suppliers receive an exclusive window in front of Tier 1. Common in healthcare and public-sector programs." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline supports tiering well; the editor is more configurable but less explainable to a frontline manager." },
      { id: "fieldglass", pos: "even",   note: "Fieldglass tiering is rigorous; the trade-off visualization is non-existent." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY tiering is basic. Their differentiator is candidate matching, not supplier matching." },
      { id: "magnit",     pos: "even",   note: "Magnit's distribution decisions are partly human — their program services tune the rules quarterly." },
      { id: "coupa",      pos: "ahead",  note: "CCWM has supplier preference but not real tier-and-hold." },
    ],
    roadmap: [
      { prio: "now",   title: "Distribution simulator",                                 detail: "Preview a proposed rule change against the last 30 days of requisitions before saving — show projected fill rate, time-to-fill, and supplier-share deltas." },
      { prio: "now",   title: "Per-job-class distribution rules",                       detail: "One program can have completely different rules for RN shifts and warehouse shifts. Today this is a workaround; we're making it first-class." },
      { prio: "next",  title: "Auto-tier suggestions from scorecards",                   detail: "Program manager opens distribution and we suggest tier moves with cited reasoning from the supplier scorecards." },
      { prio: "next",  title: "Talent-pool eligibility inside distribution",             detail: "Same rule-builder grammar for pools and supplier tiers. Today they're separate trees." },
      { prio: "later", title: "Diversity-spend-aware distribution",                      detail: "Rule engine factors in YTD diversity-spend share when ordering tier reveal — pulls forward diverse-supplier exclusivity if the program is behind target." },
      { prio: "watch", title: "Per-shift dynamic auctions",                              detail: "We're explicitly not pursuing this — see the schedule roadmap note on bidding marketplaces." },
    ],
  },

  // ---- 7. Workforce ---------------------------------------------------
  {
    id: "workforce",
    icon: "Employees",
    name: "Workforce",
    tagline: "The system of record for every non-employee.",
    audience: "Managers, supplier dispatchers, compliance, HR",
    maturity: "GA",
    owner: "Devon Ojo · Product, professional + SOW",
    updated: "2026-05-08",
    summary: "Workforce is the canonical record for every worker who's ever been on the program — agency labor, EOR employees, independent contractors, professional consultants, SOW resources. It owns identity, eligibility, skills, certifications, tenure, and history. Every other module joins back to this record.",
    why: [
      "A program that doesn't know its workers can't redeploy them. Redeployment rate is the single highest-leverage program metric — every percentage point cuts time-to-fill by ~10% and lifts retention.",
      "Worker data is also the legal substrate for co-employment exposure, tenure caps, and converting from contingent to permanent. Get the record wrong and audit risk compounds.",
      "Worker records are the gravity well that pulls candidates back to the program — a contractor with a clean Flex Work profile is dramatically more likely to take a future engagement.",
    ],
    variations: [
      { title: "Agency worker (W-2 of the supplier)",   body: "Most common in frontline. The supplier is the employer of record; Flex Work tracks the engagement, not the employment." },
      { title: "Independent contractor (IC / 1099)",     body: "Worker is their own legal entity. We capture MSA, SOW, tax forms (W-9 / W-8BEN), and run periodic IC-classification checks." },
      { title: "EOR / global worker",                    body: "Flex Work or a partner is the legal employer of record in-country. Used for international hires where the buyer doesn't have an entity." },
      { title: "Direct-source (alumni / boomerang)",     body: "Buyer-sourced workers managed without an agency intermediary. Onboarded directly into the talent pool." },
      { title: "Professional consultant (SOW resource)", body: "Named on a SOW, not on a shift. Time + expense rolls up to the SOW invoice." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline's worker record is comprehensive; the redeployment UX lags." },
      { id: "fieldglass", pos: "even",   note: "Fieldglass is strongest on the compliance + tenure-cap side, weakest on day-to-day worker engagement." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY does not have a strong worker record on the frontline side." },
      { id: "magnit",     pos: "behind", note: "Magnit's direct-source pool is one of the most-cited differentiators in the market. We're closing the gap with the Talent Pool revamp." },
      { id: "coupa",      pos: "ahead",  note: "CCWM treats workers as a thinner concept than an employee — fine for SOW, weak for shift." },
    ],
    roadmap: [
      { prio: "now",   title: "Worker tenure caps as policy, not a manual check",       detail: "Cap is enforced at booking time, with an MSP override gate and an automatic conversion-to-perm referral when the cap is hit." },
      { prio: "now",   title: "Cross-program worker identity",                          detail: "One worker, one profile, multiple buyer programs. Today the worker re-onboards for each program; we're consolidating to a portable identity." },
      { prio: "next",  title: "Skill graph + auto-match to open work",                  detail: "Skills declared once on the worker profile and weighted by completed work history; surfaces the worker on matching requisitions automatically." },
      { prio: "next",  title: "Alumni / boomerang ATS bridge",                          detail: "Two-way sync between Workforce and the buyer's ATS so terminated workers stay accessible and conversion-to-perm doesn't lose the work history." },
      { prio: "later", title: "Worker-owned profile portability",                       detail: "Worker exports their verified work history (W-2s, ratings, completed certs) and re-imports it at a different employer." },
      { prio: "watch", title: "DEI self-identification surveys",                         detail: "Reviewing — legal posture varies by region; we'll lead with a no-strings reporting capability if we ship." },
    ],
  },

  // ---- 8. Credentialing & compliance ---------------------------------
  {
    id: "compliance",
    icon: "ClipboardCircleCheck",
    name: "Credentialing & compliance",
    tagline: "Make sure the right worker stands at the right door.",
    audience: "Compliance officers, site managers, suppliers",
    maturity: "GA",
    owner: "Devon Ojo · Product, compliance",
    updated: "2026-04-30",
    summary: "Credentialing is the surface that proves a worker is allowed to be on a shift — licenses, certifications, background checks, drug screens, location-specific training, immunization records, and right-to-work documents. The engine watches expiration dates, blocks ineligible bookings, and routes renewal workflows.",
    why: [
      "Credentialing is non-negotiable in healthcare and most regulated industries. A program without an honest cred engine is a fine generator on the day a regulator visits.",
      "Most VMS programs treat compliance as a tagged data point. We treat it as a runtime check at booking time and at clock-in. That's the only way to actually prevent the bad booking, instead of recording it after the fact.",
      "Credentialing also has the highest cross-sell into Dayforce HR — credential renewal can route to the same learning + compliance flows the perm side already uses.",
    ],
    variations: [
      { title: "License-based (clinical)",       body: "RN, LPN, CNA, MD licenses with state-level expiration checks. Often paired with primary-source verification (NPDB)." },
      { title: "Site-required training",         body: "Each location can require a per-site safety orientation; cred status is location-scoped, not global." },
      { title: "Background + drug screen",        body: "Pre-engagement, renewed on a schedule. Provider integrations (Sterling, Checkr, HireRight)." },
      { title: "Equipment + skill certifications", body: "Forklift, OSHA-10, MEWP, sterile processing — typically supplier-attested with periodic spot-audit." },
      { title: "Right-to-work / I-9",             body: "Hard block at booking time if the document is expired. Photo + remote E-Verify on the worker app." },
    ],
    competitors: [
      { id: "beeline",    pos: "ahead",  note: "Beeline credentialing is tagged-data; runtime enforcement is weak. We win every clinical / regulated RFP on this point." },
      { id: "fieldglass", pos: "even",   note: "Fieldglass is even on enterprise, behind on healthcare-specific (no primary-source verification)." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY credentialing is minimal. Often paired with a partner like ShiftWise for clinical." },
      { id: "magnit",     pos: "even",   note: "Magnit's clinical practice is mature operationally; the underlying tooling is similar to ours." },
      { id: "coupa",      pos: "ahead",  note: "CCWM has no clinical credentialing posture." },
    ],
    roadmap: [
      { prio: "now",   title: "Runtime block at clock-in",                              detail: "Expired credential at clock-in time blocks the punch with a supervisor override gate and an auto-routed renewal task. Today the block is at booking time only." },
      { prio: "now",   title: "Primary-source verification (clinical)",                  detail: "Direct NPDB / state board pulls instead of supplier-attested PDFs for clinical credentials." },
      { prio: "next",  title: "Credential auto-renewal task routing",                    detail: "Expiring credentials route a structured renewal task to the worker + supplier on day-30, day-15, day-3, with escalation when missed." },
      { prio: "next",  title: "Per-site training matrix",                                 detail: "Site managers can manage their own training requirements list without engineering. Includes a builder for the renewal cadence." },
      { prio: "later", title: "Cross-program credential portability",                     detail: "A cred verified on Program A is presumed valid on Program B if both programs accept the same source. Reduces re-credentialing time-to-fill drag." },
      { prio: "watch", title: "On-chain verifiable credentials",                          detail: "Worker holds a wallet of verified creds. Following standards work; not pursuing until enterprise issuers settle." },
    ],
  },

  // ---- 9. Pricing & rate cards ---------------------------------------
  {
    id: "pricing",
    icon: "Wallet",
    name: "Pricing & rate cards",
    tagline: "Govern what work costs before it's ordered.",
    audience: "Sourcing, finance, MSPs, suppliers",
    maturity: "GA",
    owner: "Devon Ojo · Product, finance",
    updated: "2026-04-24",
    summary: "Pricing config is the rate-card engine. It owns bill rates, pay rates, markups, premium definitions (OT, holiday, hazard, weekend), supplier-specific overrides, location modifiers, and the lookup logic the rest of the system uses. Every requisition, timesheet, and invoice resolves a rate through this engine.",
    why: [
      "Rate sprawl is the single largest source of leakage in a contingent program — every off-card hire costs 10–20% more on average. A strong rate-card engine pays for itself.",
      "Rate cards are also where compliance lives: union step-up rates, prevailing wage, predictive-scheduling premiums, minimum-wage updates by jurisdiction. These have to apply automatically or the customer is one audit from a penalty.",
      "Rate is the single most-edited program object — sourcing and finance need to be able to change rates without an engineering ticket.",
    ],
    variations: [
      { title: "Flat per-job-class",          body: "One rate per job class, possibly with a location multiplier. The most common starting point." },
      { title: "Skills-based banding",         body: "Rate flexes by skill level within a job class (junior / mid / senior consultant). Standard in professional programs." },
      { title: "Supplier-specific overrides",  body: "A preferred supplier negotiates a lower markup; the override applies only to their lines." },
      { title: "Project-fixed (SOW)",          body: "Not-to-exceed cap or fixed milestone billing instead of an hourly rate. Lives alongside the hourly engine, not separately." },
      { title: "Dynamic / market-indexed",     body: "Rate floats against a market index (BLS, supplier-quoted average). Rare today; trending up with talent-shortage roles." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline rate cards are powerful and slow to configure. Our edit-and-preview surface is faster." },
      { id: "fieldglass", pos: "behind", note: "Fieldglass rate cards are the gold standard for SOW + multi-country VAT. We're improving global parity but trailing today." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY rate cards are clean for professional, weak for premium / shift-pay rule combinations." },
      { id: "magnit",     pos: "even",   note: "Magnit's strength is the human rate benchmarking service, not the underlying tooling." },
      { id: "coupa",      pos: "ahead",  note: "CCWM rates inherit from Coupa contracts — fine for SOW, awkward for shift work." },
    ],
    roadmap: [
      { prio: "now",   title: "Rate-card simulator",                                    detail: "Preview a rate-card change against the last 30 days of activity — see total spend delta, supplier-by-supplier delta, and worker take-home delta before saving." },
      { prio: "now",   title: "Automatic minimum-wage tracking",                        detail: "Subscribe to a wage-floor feed; flag (and optionally auto-update) cards that fall below the local minimum on the effective date." },
      { prio: "next",  title: "Prevailing-wage card type",                              detail: "First-class support for public-sector and Davis-Bacon programs — wage determination by job + location + funding source." },
      { prio: "next",  title: "Supplier-tier-based markup",                              detail: "Tier 1 markup, Tier 2 markup, Tier 3 markup applied automatically as suppliers move tiers." },
      { prio: "later", title: "Rate-card versioning + scheduled rollouts",               detail: "Schedule a rate change for the next pay period rather than applying immediately, with a diff view and an approval gate." },
      { prio: "watch", title: "Worker pay transparency surface",                          detail: "Show the worker what their effective pay is including all premiums. Tracking — depends on state-level pay-transparency rules normalizing." },
    ],
  },

  // ---- 10. Workflows --------------------------------------------------
  {
    id: "workflows",
    icon: "Bolt",
    name: "Workflows & approvals",
    tagline: "Automate the gates between intake and action.",
    audience: "Program admins, finance, IT",
    maturity: "GA",
    owner: "Rae Ortiz · Platform engineering",
    updated: "2026-02-20",
    summary: "Workflows is the no-code automation engine: approval chains, escalation timers, conditional routing, and trigger-based actions (notifications, ERP posts, status changes). It's the surface program admins live in when adapting the system to their org chart.",
    why: [
      "Every program has a different approval shape; the system has to be configurable without a custom build. Workflows is the difference between a 6-week customization and a 6-minute configuration.",
      "Workflows is also the lever for time-to-value — a well-set escalation policy turns a 3-day approval bottleneck into a 3-hour one.",
      "On the back end, workflows is the substrate every AI-assisted feature plugs into. The same rule engine that escalates an approval also triggers the AI summary action.",
    ],
    variations: [
      { title: "Linear approval chain",        body: "Requisition → manager → director → finance. The default and most common shape." },
      { title: "Threshold-based branching",    body: "Under $X auto-approves; over $X requires director; over $Y adds CFO. Standard in mature programs." },
      { title: "Parallel approvals",            body: "Legal + finance approve in parallel rather than sequentially. Common in SOW intake." },
      { title: "Delegation + out-of-office",   body: "Approver delegates to a peer for a date range; auto-route during the window." },
      { title: "Conditional auto-action",       body: "On approval, auto-trigger a broadcast OR a Slack post OR an ERP webhook. Composable, multi-step." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline workflow editor is mature, dense, and not particularly approachable. We're materially friendlier to non-technical admins." },
      { id: "fieldglass", pos: "behind", note: "Fieldglass workflow is industry-leading on complexity ceiling. We win on simple programs and on the configuration speed." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY workflow is minimal. Most VNDLY programs supplement with a third-party automation tool." },
      { id: "magnit",     pos: "ahead",  note: "Magnit programs lean on human workflow (program services) rather than software workflow." },
      { id: "coupa",      pos: "behind", note: "CCWM inherits Coupa's powerful approval engine — strong in finance-led RFPs." },
    ],
    roadmap: [
      { prio: "now",   title: "Visual workflow canvas",                                 detail: "Replace the form-based editor with a drag-and-drop canvas. Same rule grammar, much easier to reason about." },
      { prio: "now",   title: "AI-suggested approval chains",                            detail: "Inspect the org tree, intake type, and dollar amount; suggest a starting workflow with confidence-scored alternatives." },
      { prio: "next",  title: "Cross-program workflow templates",                        detail: "Share a workflow template across buyer programs in the same parent org with controlled overrides." },
      { prio: "next",  title: "Workflow run-history + replay",                           detail: "Every workflow execution is a record; admins can replay against an updated workflow to validate a change before publishing." },
      { prio: "later", title: "Workflow telemetry — bottleneck heatmap",                 detail: "Surface which approval step is slowest, by approver, by hour-of-day. Drives the case for changing the workflow shape." },
      { prio: "watch", title: "External workflow runner (Zapier / n8n)",                  detail: "Following adoption. Today most customers want the workflow inside Dayforce; we'll add bridges if multi-tool adoption normalizes." },
    ],
  },

  // ---- 11. Analytics --------------------------------------------------
  {
    id: "analytics",
    icon: "BarChart",
    name: "Analytics & insights",
    tagline: "Turn program data into program decisions.",
    audience: "Program leads, finance, executives",
    maturity: "GA",
    owner: "Rae Ortiz · Platform engineering",
    updated: "2026-02-15",
    summary: "Analytics is the reporting + dashboard surface and the underlying data warehouse. It covers operational dashboards (fill rate, time-to-fill, no-show, dispute rate), financial dashboards (spend, markup, savings, accrual), and ad-hoc reporting against the full program data set.",
    why: [
      "Analytics is the surface that justifies the program internally — without it, the next budget cycle is a fight you can't win.",
      "The data layer underneath analytics is also the substrate for benchmarking — most enterprise buyers want to see how their program compares to peer programs. Owning the data layer is the moat.",
      "AI-assisted insight generation is one of the highest-leverage uses of the Dayforce AI investment. The same data that powers a dashboard powers a 'what changed this week' narrative.",
    ],
    variations: [
      { title: "Operational dashboard (program manager)",   body: "Today, this week, this month — fill rate, time-to-fill, open requisitions, late approvals." },
      { title: "Financial dashboard (finance)",              body: "Spend by category, accrual, invoice aging, markup distribution, savings vs. budget." },
      { title: "Executive dashboard (VP / CFO)",             body: "Quarter-over-quarter trends, program ROI, diverse-supplier share, conversion-to-perm pipeline." },
      { title: "Self-serve report builder",                  body: "Pivot any program object against any dimension; save and schedule." },
      { title: "Embedded analytics (in-context tiles)",       body: "Module pages show their own KPI tiles (e.g. Suppliers shows fill rate; Schedule shows no-show)." },
    ],
    competitors: [
      { id: "beeline",    pos: "behind", note: "Beeline reporting is mature, deep, and slow. We're behind on the long tail of canned reports." },
      { id: "fieldglass", pos: "behind", note: "Fieldglass reporting is the most-loved feature in their product. We have ground to cover." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY reporting is light. They differentiate on intake, not on analytics." },
      { id: "magnit",     pos: "even",   note: "Magnit's analytics value is in the benchmarking service, not the in-product tooling." },
      { id: "coupa",      pos: "behind", note: "CCWM inherits Coupa Analyze — a strong asset in finance-led RFPs." },
    ],
    roadmap: [
      { prio: "now",   title: "AI narrative summaries on dashboards",                   detail: "Every dashboard surfaces a 'what changed this week and why' narrative with cited data points. The first dashboards land in Q3." },
      { prio: "now",   title: "Embedded analytics in every list page",                   detail: "Suppliers, Workforce, Schedule, Invoices — each gets a KPI tile band derived from the same warehouse." },
      { prio: "next",  title: "Benchmarking against the program graph",                  detail: "Anonymized peer comparison — 'your fill rate is at the 73rd percentile of programs your size in your industry'. Opt-in." },
      { prio: "next",  title: "Self-serve report builder v2",                            detail: "Friendlier pivot UI; alias-free join across requisitions / timesheets / workers / invoices; saved + scheduled exports." },
      { prio: "later", title: "Predictive forecasting",                                  detail: "Project next-quarter fill rate and headcount under different distribution and pricing scenarios. Tied to the workflow + pricing simulators." },
      { prio: "watch", title: "BYO BI tool federation",                                   detail: "Tracking — most enterprise customers eventually want to land data in Tableau / Looker / Power BI. We've got an export path; not pursuing federation until volume builds." },
    ],
  },

  // ---- 12. AI Assist --------------------------------------------------
  {
    id: "ai-assist",
    icon: "Bolt",
    name: "AI assist",
    tagline: "An assistant embedded in every module.",
    audience: "Every role",
    maturity: "Beta",
    owner: "Sam Hwang · Product, AI + worker-app",
    updated: "2026-05-25",
    summary: "AI assist is the persistent chat dock and the cross-module action layer. It answers questions about the program, drafts intake from natural-language input, summarizes long-running requisitions, triages disputes, and triggers safe actions on the user's behalf with explicit confirmation.",
    why: [
      "Every VMS competitor is shipping an assistant. The bar is moving from 'has chat' to 'can take action safely'. Owning the action layer is what differentiates a serious assistant from a chat widget.",
      "Most program admins spend the majority of their day in low-value triage work — approving routine timesheets, chasing late suppliers, answering 'where's my candidate?' emails. The assistant compresses that work without changing the audit trail.",
      "The assistant is also the surface that moves us from a static product to one that improves week over week — every interaction is training signal for the next pattern.",
    ],
    variations: [
      { title: "Q&A on program data",         body: "'How many open shifts at the Sacramento site?' 'Who approved invoice 5128?' Read-only, cited." },
      { title: "Action assistance",            body: "'Re-broadcast req 7211 to all Tier 2 suppliers' — assistant proposes the action, user confirms before execution." },
      { title: "Intake drafting",              body: "Paste an email; assistant produces a draft requisition. Manager edits and submits." },
      { title: "Summary + briefing",           body: "Open a long requisition; assistant summarizes the audit trail, distribution history, and current state." },
      { title: "Cross-module workflow",         body: "'Onboard this contractor for the Helios SOW, kicking off cred checks and contract draft'. Single instruction, multi-module orchestration." },
    ],
    competitors: [
      { id: "beeline",    pos: "ahead",  note: "Beeline shipped a chat in 2024; light on action. We're aiming for the action-layer differentiation." },
      { id: "fieldglass", pos: "ahead",  note: "Fieldglass + Joule integration is in market but currently read-mostly." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY + Workday Illuminate is on the roadmap; nothing in market." },
      { id: "magnit",     pos: "ahead",  note: "Magnit's AI surface is partner-built. Not a structural moat." },
      { id: "coupa",      pos: "even",   note: "Coupa Sourcing AI is mature in adjacent areas; CCWM-specific assistant is light." },
    ],
    roadmap: [
      { prio: "now",   title: "Safe-action confirmation layer",                          detail: "Every destructive or financial action proposed by the assistant runs through a confirmation modal with a rollback path. No 'silent' actions." },
      { prio: "now",   title: "Intake-from-email (end-to-end)",                          detail: "Paste an email; full requisition draft with location, job, headcount, dates. Targeting >75% accuracy without manager edits on the common cases." },
      { prio: "next",  title: "Briefing card on every detail page",                      detail: "Open a requisition / supplier / worker / invoice; a sticky brief summarizes recent activity and recommends the next action." },
      { prio: "next",  title: "Multi-step orchestration with named plans",               detail: "'Onboard this contractor' produces a plan card with named steps; user can edit before execution and watch the steps run." },
      { prio: "later", title: "Voice mode on worker app",                                detail: "Worker says 'pick me up a shift this Saturday afternoon'; assistant proposes options, books on confirmation." },
      { prio: "watch", title: "External-LLM federation",                                  detail: "Tracking enterprise demand for BYO model. We default to Dayforce-hosted; will add federation when buyers committedly need it for data residency." },
    ],
  },

  // ---- 13. Custom Fields ----------------------------------------------
  {
    id: "custom-fields",
    icon: "Shapes",
    name: "Custom fields",
    tagline: "Extend any object with fields specific to the program.",
    audience: "Program admins, AEs scoping deals, implementation managers",
    maturity: "Beta · behind the customFields flag",
    owner: "Devon Ojo · Product, finance + platform",
    updated: "2026-05-27",
    summary: "Custom fields let an admin attach tenant-specific data to any first-class object — Requisitions, Workers, Engagements, Timesheets, Invoices, Suppliers, SOWs, Projects, Candidates, Locations. Each field carries a typed shape (text, number, currency, date, pick list, multi-select, cascade, cost code, person reference, URL), a visibility scope (buyer / supplier / worker / internal), required-for-state flags, conditional visibility, an optional sync target (Dayforce Core or SAP ERP), and a PII flag. The capability is behind the customFields feature flag — default off everywhere, on by default for Helios Power Generation. Settings → Custom Fields is the management surface.",
    why: [
      "Every enterprise VMS deal eventually surfaces three to ten fields the buyer needs to attach to a requisition / worker / invoice that no off-the-shelf schema covers — capital project codes, NERC CIP tiers, BLS expiry dates, DOT med card expirations, FERC recoverability flags. Without custom fields the answer is either a customization (expensive, slow) or 'park it in the description' (loses reportability).",
      "Custom fields are the table-stakes capability the market expects. Fieldglass and VNDLY both ship rich custom-field surfaces; not having one shows up as a gap in every RFP scorecard.",
      "Custom fields turn the platform into a configurable record system rather than a fixed-schema product. Once a buyer has put their own fields on the platform, the switching cost compounds — reports, integrations, and downstream workflows all consume those fields.",
      "Self-serve custom fields keep implementation costs predictable. The alternative — every new field needing a support ticket, a sprint, and a release — kills program velocity once the tenant is past go-live.",
    ],
    variations: [
      { title: "Helios Power Generation — energy / utility", body: "The seeded reference tenant. Custom fields cover outage windows on requisitions, NERC CIP tier (Low / Medium / High impact), plant unit cascade (Station → Unit), capital project codes (CAP-#####), confined-space flag, radiation worker cleared, HAZWOPER 40 expiry, security clearance level, OFAC sanctions screening, cyber-security tier on suppliers, capital vs O&M classification on SOWs, FERC recoverable, and a PO-line reference on invoices. Around 17 fields seeded out of the box." },
      { title: "Mercy Health System — healthcare",            body: "Workers carry BLS expiry, vaccination status (PII-flagged, internal-only), and HIPAA training date. Requisitions add unit type (Med-Surg / ICU / ED / OR / PACU / Float) and a charge-RN flag. The pattern: tight credential expiry tracking on the worker, clinical-context filtering on the requisition." },
      { title: "Fleetwind Logistics",                          body: "Workers carry CDL class (A / B / C), DOT medical card expiry, and TWIC clearance. Requisitions add load type (Dry van / Reefer / Flatbed / Tanker / Intermodal). Common shape for transportation programs across the customer base." },
      { title: "Aurora Hotels & Resorts — hospitality",        body: "Requisitions tag property brand and service segment (Rooms / F&B / Banquet / Concierge); workers carry F&B service cert expiry and brand-standard training. The pattern: brand-and-segment tagging on the requisition, training-status tracking on the worker." },
      { title: "Atlas Manufacturing",                          body: "Worker forklift cert class, safety card number. Requisitions tag plant cost center and shift differential code. Smaller seeded set — typical of programs that lean on the standard schema with a handful of plant-specific tags." },
      { title: "Northwind Retail Group",                       body: "Requisitions tag store class (Flagship / Standard / Express / Outlet) and holiday-surge flag. Workers carry POS-trained status. Used to drive rate-card tiers and worker matching." },
      { title: "StaffWise — staffing agency",                  body: "Agency tenant; custom fields are mostly internal — internal recruiter assignment, onboarding cohort tags on workers, buyer-side PO reference on engagements. Demonstrates the supplier-side use of the same capability." },
    ],
    competitors: [
      { id: "beeline",    pos: "even",   note: "Beeline has a configurable-fields surface but it's biased to professional / SOW objects; weak on frontline timesheet / shift custom fields. Per-state-transition requirements (Beeline's 'gated fields') are mature." },
      { id: "fieldglass", pos: "even",   note: "Fieldglass is the depth leader. Module + entered-by + sequence + section + PII flag + dependent (cascading) fields + linked-module references — the model the industry copies. Configuration is admin-heavy and slow; the UI hasn't moved in a decade." },
      { id: "vndly",      pos: "ahead",  note: "VNDLY is the closest in spirit — self-serve, rules-based, scoped by job category / location / approval workflow. Their pitch is exactly 'no support tickets'. We match the self-serve model and add explicit sync-target wiring (Dayforce / ERP) that they don't expose this cleanly." },
      { id: "magnit",     pos: "ahead",  note: "Magnit's custom-field surface is partner-built (Beeline under the hood). Same limitations as Beeline; not a structural moat." },
      { id: "coupa",      pos: "ahead",  note: "CCWM lets you add fields via Coupa's procurement form patterns. Fine for SOW + invoice; thin coverage on workers, schedules, and worker-app surfaces." },
    ],
    roadmap: [
      { prio: "now",   title: "Surface custom fields on detail-page accordions",         detail: "Each custom field's `section` ('Overview', 'Compliance', 'Finance', 'Allocation', etc.) maps to the matching accordion on the consuming detail page. Today admins can configure fields; next, the configured fields actually render on the requisition / worker / timesheet / invoice / SOW detail pages." },
      { prio: "now",   title: "Custom fields as filter chips + columns on every list",   detail: "Once a field is defined, it's available in the column picker and as a filter chip on the matching list page. Pulls the operational benefit of having defined the field through to the list surface in the same release." },
      { prio: "next",  title: "Conditional visibility runtime",                          detail: "A field configured with `conditional: { field, op, value }` only renders on the detail page when its predicate is satisfied. Today the metadata is captured; next, the form layer respects it." },
      { prio: "next",  title: "Cost-code validation against the GL master",              detail: "Cost-code fields validate against the synced GL master at save time, not just at write-back. Matches the Fieldglass dependent-field pattern but resolves against the live ERP feed." },
      { prio: "next",  title: "Bulk import of custom-field values",                      detail: "Per-object CSV / JSON upload to backfill custom-field values across existing records — needed at every implementation handoff." },
      { prio: "later", title: "Field-level audit trail",                                  detail: "Every value change captured with timestamp, actor, and prior value. Surfaces on the detail-page activity log and in the audit export." },
      { prio: "later", title: "Custom-field reports in the report builder",              detail: "Custom fields become first-class metrics + dimensions in the report builder, including for cascade and cost-code types." },
      { prio: "watch", title: "Worker-app custom-field entry",                            detail: "Surface worker-facing custom fields (e.g. 'Outage ID' on a timesheet) in the worker app. Following pilot customer demand; not pursuing until two named accounts commit." },
      { prio: "watch", title: "Field-level access by user role",                          detail: "Granular per-role read/write on each custom field beyond the four visibility scopes. Tracking — most programs are well-served by the scope model; we'd add this if compliance teams push for it." },
    ],
  },
];

// ---------- Tiny presentation primitives --------------------------------
function HcChip({ tone = "neutral", children, icon }) {
  return (
    <span className={`hc-chip hc-chip--${tone}`}>
      {icon && <Icon name={icon} size={12} />}
      <span>{children}</span>
    </span>
  );
}

function HcMaturityChip({ value }) {
  if (!value) return null;
  const tone =
    value === "GA"      ? "success" :
    value === "Beta"    ? "informative" :
    value === "Preview" ? "warning" :
    "neutral";
  return <HcChip tone={tone}>{value}</HcChip>;
}

function HcCompetitorRow({ entry }) {
  const name = HC_COMPETITORS[entry.id] || entry.id;
  const tone =
    entry.pos === "ahead"  ? "success" :
    entry.pos === "behind" ? "warning" :
                              "neutral";
  const label =
    entry.pos === "ahead"  ? "We're ahead" :
    entry.pos === "behind" ? "We trail" :
                              "Even";
  return (
    <tr className="hc-comp-row">
      <th scope="row">{name}</th>
      <td><HcChip tone={tone}>{label}</HcChip></td>
      <td className="hc-comp-note">{entry.note}</td>
    </tr>
  );
}

function HcRoadmapRow({ item }) {
  const meta = HC_PRIO[item.prio] || HC_PRIO.later;
  return (
    <li className={`hc-rm-row hc-rm-row--${item.prio}`}>
      <span className="hc-rm-prio">
        <span className="hc-rm-prio-dot" aria-hidden="true" />
        <span className="hc-rm-prio-label">{meta.label}</span>
      </span>
      <div className="hc-rm-body">
        <p className="hc-rm-title">{item.title}</p>
        <p className="hc-rm-detail">{item.detail}</p>
      </div>
    </li>
  );
}

// ---------- Feature catalog grid (the landing for "Features") -----------
function HcFeaturesCatalog({ onOpen }) {
  return (
    <section className="hc-catalog">
      <header className="hc-catalog-head">
        <h2 className="hc-catalog-title">Features</h2>
        <p className="hc-catalog-sub">
          Every shipping module, end to end — what it does, why it matters, how it's used, and where it's headed.
          Pages are written for Dayforce-internal eyes; share verbatim with customers at your discretion.
        </p>
      </header>
      <ol className="hc-feature-grid">
        {HC_FEATURES.map((f, i) => (
          <li key={f.id} className="hc-feature-card">
            <button
              type="button"
              className="hc-feature-card-btn"
              onClick={() => onOpen(f.id)}
              aria-label={`Open the ${f.name} reference page`}
            >
              <span className="hc-feature-card-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="hc-feature-card-ico" aria-hidden="true">
                <Icon name={f.icon} size={22} />
              </span>
              <span className="hc-feature-card-body">
                <span className="hc-feature-card-title">{f.name}</span>
                <span className="hc-feature-card-tag">{f.tagline}</span>
                <span className="hc-feature-card-meta">
                  <HcMaturityChip value={f.maturity} />
                  <span className="hc-feature-card-aud">{f.audience}</span>
                </span>
              </span>
              <span className="hc-feature-card-go" aria-hidden="true">
                <Icon name="ArrowRight" size={16} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- One feature detail page -------------------------------------
function HcFeatureDetail({ featureId, onBack, onOpen }) {
  const idx = HC_FEATURES.findIndex((f) => f.id === featureId);
  const f = idx >= 0 ? HC_FEATURES[idx] : null;
  if (!f) return null;
  const prev = idx > 0 ? HC_FEATURES[idx - 1] : null;
  const next = idx < HC_FEATURES.length - 1 ? HC_FEATURES[idx + 1] : null;

  return (
    <article className="hc-feat" aria-labelledby="hc-feat-title">
      {/* Crumb */}
      <nav className="hc-crumb" aria-label="Breadcrumb">
        <button type="button" className="hc-crumb-link" onClick={onBack}>
          <Icon name="ArrowLeftSmall" size={14} />Features
        </button>
        <span className="hc-crumb-sep" aria-hidden="true">/</span>
        <span className="hc-crumb-cur">{f.name}</span>
      </nav>

      {/* Hero */}
      <header className="hc-feat-hero">
        <div className="hc-feat-hero-ico" aria-hidden="true">
          <Icon name={f.icon} size={28} />
        </div>
        <div className="hc-feat-hero-body">
          <div className="hc-feat-hero-chips">
            <HcMaturityChip value={f.maturity} />
            <HcChip tone="muted" icon="PersonLines">{f.audience}</HcChip>
            <HcChip tone="muted" icon="Stack">Section · Features</HcChip>
          </div>
          <h1 id="hc-feat-title" className="hc-feat-hero-title">{f.name}</h1>
          <p className="hc-feat-hero-tag">{f.tagline}</p>
          {window.HcsStamp && <window.HcsStamp owner={f.owner} updated={f.updated} />}
        </div>
      </header>

      {/* Section: overview */}
      <section className="hc-feat-section" id="overview">
        <h2 className="hc-feat-h">
          <span className="hc-feat-h-num">01</span>
          <span>Overview</span>
        </h2>
        <p className="hc-feat-lede">{f.summary}</p>
      </section>

      {/* Section: why it matters */}
      <section className="hc-feat-section" id="why">
        <h2 className="hc-feat-h">
          <span className="hc-feat-h-num">02</span>
          <span>Why it matters for VMS</span>
        </h2>
        <ul className="hc-why-list">
          {f.why.map((line, i) => (
            <li key={i} className="hc-why-item">
              <span className="hc-why-bullet" aria-hidden="true" />
              <p>{line}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Section: variations */}
      <section className="hc-feat-section" id="variations">
        <h2 className="hc-feat-h">
          <span className="hc-feat-h-num">03</span>
          <span>Variations in the wild</span>
          <span className="hc-feat-h-count">{f.variations.length}</span>
        </h2>
        <ul className="hc-var-list">
          {f.variations.map((v, i) => (
            <li key={i} className="hc-var-item">
              <p className="hc-var-title">
                <span className="hc-var-num">{String(i + 1).padStart(2, "0")}</span>
                {v.title}
              </p>
              <p className="hc-var-body">{v.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Section: competitive */}
      <section className="hc-feat-section" id="competitive">
        <h2 className="hc-feat-h">
          <span className="hc-feat-h-num">04</span>
          <span>Competitive landscape</span>
        </h2>
        <div className="hc-comp-tablewrap" role="region" aria-label={`Competitive landscape for ${f.name}`} tabIndex={0}>
          <table className="hc-comp-table">
            <thead>
              <tr>
                <th scope="col">Competitor</th>
                <th scope="col">Position</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {f.competitors.map((c) => <HcCompetitorRow key={c.id} entry={c} />)}
            </tbody>
          </table>
        </div>
        <p className="hc-comp-foot">
          Positioning is internal-only and updated quarterly by the product marketing team. Don't share these labels verbatim with customers.
        </p>
      </section>

      {/* Section: roadmap */}
      <section className="hc-feat-section" id="roadmap">
        <h2 className="hc-feat-h">
          <span className="hc-feat-h-num">05</span>
          <span>Roadmap</span>
        </h2>
        <div className="hc-rm-legend" role="list">
          {Object.entries(HC_PRIO).map(([k, v]) => (
            <span key={k} role="listitem" className={`hc-rm-legend-item hc-rm-legend-item--${k}`}>
              <span className="hc-rm-prio-dot" aria-hidden="true" />
              <span className="hc-rm-legend-label">{v.label}</span>
              <span className="hc-rm-legend-desc">{v.desc}</span>
            </span>
          ))}
        </div>
        <ol className="hc-rm-list">
          {f.roadmap.map((item, i) => <HcRoadmapRow key={i} item={item} />)}
        </ol>
      </section>

      {/* Footer pager */}
      <nav className="hc-feat-pager" aria-label="Feature pager">
        {prev ? (
          <button type="button" className="hc-feat-pager-btn hc-feat-pager-btn--prev" onClick={() => onOpen(prev.id)}>
            <Icon name="ArrowLeft" size={16} />
            <span>
              <span className="hc-feat-pager-lab">Previous</span>
              <span className="hc-feat-pager-name">{prev.name}</span>
            </span>
          </button>
        ) : <span aria-hidden="true" />}
        {next ? (
          <button type="button" className="hc-feat-pager-btn hc-feat-pager-btn--next" onClick={() => onOpen(next.id)}>
            <span>
              <span className="hc-feat-pager-lab">Next</span>
              <span className="hc-feat-pager-name">{next.name}</span>
            </span>
            <Icon name="ArrowRight" size={16} />
          </button>
        ) : <span aria-hidden="true" />}
      </nav>
    </article>
  );
}

// ---------- Stub content for non-Features sections ----------------------
function HcSectionStub({ section }) {
  // Coming-soon empty states. Honest copy — these will fill in over time.
  const stubs = {
    onboarding: {
      title: "Onboarding guides",
      body:  "Implementation playbooks by program shape — frontline-only, professional-only, mixed, MSP-managed, agency tenant. Each playbook covers the 30/60/90 day plan, the configuration checklist, and the common pitfalls.",
      bullets: [
        "Frontline-only program · 6-week launch",
        "Professional + SOW program · 10-week launch",
        "MSP-managed transition · 12-week cutover",
        "Agency tenant onboarding · 4-week launch",
        "Multi-country rollout · 16-week sequence",
      ],
    },
    playbooks: {
      title: "Field playbooks",
      body:  "Pattern-level guidance for the configurations CSMs run into in the field. Each playbook covers the trade-offs and the failure modes.",
      bullets: [
        "When to use exception-only timesheet approval",
        "How to set tier-and-hold timings for fill-rate vs. supplier-share",
        "Migrating from supplier-submitted to auto-generated invoices",
        "Building a credentialing matrix for a regulated industry",
        "Stitching the org tree to a Workday HCM source",
      ],
    },
    release: {
      title: "Release notes",
      body:  "What shipped, what's behind a flag, what's pending. Mirrors the public changelog with internal-only context (escalation owners, known issues, flag-default policy).",
      bullets: [
        "v0.84 · Internal Help Center launched (this surface)",
        "v0.83 · Engagement types config moved out of Feature Flags",
        "v0.82 · Talent pools merged into distribution",
        "v0.81 · Worker tenure caps as policy",
        "v0.80 · Frontline / Professional category split",
      ],
    },
    competitive: {
      title: "Competitive briefs",
      body:  "Full battlecards for every named competitor. Each card covers their strongest module, their weakest, the deals we win, the deals they win, and the talk track for the head-to-head.",
      bullets: [
        "Beeline · The mature incumbent",
        "SAP Fieldglass · The SOW + global-VAT champion",
        "Workday VNDLY · The Workday-stack defender",
        "Magnit · The MSP-services bundle",
        "Coupa CCWM · The finance-led play",
      ],
    },
    glossary: {
      title: "Glossary",
      body:  "Terms a Dayforce employee on a Flex Work call should never have to look up mid-meeting.",
      bullets: [
        "VMS · Vendor Management System",
        "MSP · Managed Services Provider",
        "RPO · Recruitment Process Outsourcing",
        "EOR · Employer of Record",
        "SOW · Statement of Work",
        "IC / 1099 · Independent contractor",
        "Co-employment · Joint legal-employer exposure",
        "Tenure cap · Maximum days a contingent worker can be on a program",
      ],
    },
    contacts: {
      title: "Internal contacts",
      body:  "Escalation paths by domain. Use Slack #flexwork-cs for first-tier triage; named owners below for escalations.",
      bullets: [
        "Product · Mira Sato (frontline), Devon Ojo (professional + SOW)",
        "Engineering · Rae Ortiz (platform), Sam Hwang (mobile + worker)",
        "Customer Success · Priya Anand (NA), Anika Sundqvist (EMEA), Wei Tan (APAC)",
        "Implementation · Marcus Bell (frontline), Ines Aleko (professional)",
        "Support · #flexwork-cs (Slack), flexwork-support@dayforce.com",
      ],
    },
  };
  const s = stubs[section] || { title: "Coming soon", body: "This section is on the help-center roadmap.", bullets: [] };
  return (
    <section className="hc-stub">
      <header className="hc-stub-head">
        <h2 className="hc-stub-title">{s.title}</h2>
        <p className="hc-stub-sub">{s.body}</p>
      </header>
      {s.bullets.length > 0 && (
        <ul className="hc-stub-list">
          {s.bullets.map((b, i) => (
            <li key={i} className="hc-stub-item">
              <span className="hc-stub-bullet" aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="hc-stub-foot">
        <Icon name="Information" size={14} />
        <span>This section is still being built out. Use the Features tab for fully-published content.</span>
      </p>
    </section>
  );
}

// ---------- Page-level config (F-16) -----------------------------------
// External destinations exposed in the Omnibar. Pointing these at real
// URLs makes the chrome honest. If the URL is genuinely TBD, change the
// flag to false to hide the button instead of lying about its behavior.
const HC_LINKS = {
  customerPortal: { href: "https://help.dayforce.com/flex-work", enabled: true },
};

// ---------- Hashroute helpers (F-09) -----------------------------------
// URL contract:
//   #features                           → Features catalog
//   #features/requisitions              → Open the Requisitions feature page
//   #onboarding / #playbooks / #release →
//   #competitive / #glossary / #contacts→ Stub-section view
//   #search?q=msp                       → Cross-section search results
// Hash is the only URL state — the app's main router already owns the
// route, so the help center sits below /helpCenter and uses # for its
// own internal state.
const HC_SECTION_IDS = new Set(["features","onboarding","playbooks","release","competitive","glossary","search"]);

function parseHash(hash) {
  // Returns { section, featureId, q } from a location.hash string.
  const raw = (hash || "").replace(/^#/, "");
  if (!raw) return { section: "features", featureId: null, q: "" };
  // search?q=...
  if (raw.startsWith("search")) {
    const m = raw.match(/^search\?q=(.*)$/);
    return { section: "search", featureId: null, q: m ? decodeURIComponent(m[1]) : "" };
  }
  // section[/featureId]
  const [sec, ...rest] = raw.split("/");
  if (!HC_SECTION_IDS.has(sec)) return { section: "features", featureId: null, q: "" };
  if (sec === "features") return { section: "features", featureId: rest[0] || null, q: "" };
  return { section: sec, featureId: null, q: "" };
}

function buildHash({ section, featureId, q }) {
  if (section === "search" && q) return `#search?q=${encodeURIComponent(q)}`;
  if (section === "features" && featureId) return `#features/${featureId}`;
  return `#${section || "features"}`;
}

// ---------- Cross-section search index (F-08) --------------------------
// Builds a flat list of searchable hits across every HC_PAGES source.
// Returns an array of { sectionId, sectionLabel, title, body, onOpen }.
function buildSearchIndex() {
  const hits = [];

  // Features
  HC_FEATURES.forEach((f) => {
    hits.push({
      sectionId: "features",
      sectionLabel: "Features",
      title: f.name,
      body: f.tagline + " · " + f.summary,
      target: { section: "features", featureId: f.id },
      icon: f.icon || "Stack",
    });
  });

  // Onboarding
  (window.HC_ONBOARDING || []).forEach((p) => {
    hits.push({
      sectionId: "onboarding",
      sectionLabel: "Onboarding guides",
      title: p.name,
      body: (p.duration ? p.duration + " · " : "") + (p.summary || ""),
      target: { section: "onboarding" },
      icon: "ClipboardCircleCheck",
    });
  });

  // Playbooks
  (window.HC_PLAYBOOKS || []).forEach((p) => {
    hits.push({
      sectionId: "playbooks",
      sectionLabel: "Field playbooks",
      title: p.name,
      body: (p.intent || "") + " · " + (p.summary || ""),
      target: { section: "playbooks" },
      icon: "Notes",
    });
  });

  // Battlecards
  (window.HC_BATTLECARDS || []).forEach((b) => {
    hits.push({
      sectionId: "competitive",
      sectionLabel: "Competitive briefs",
      title: b.name,
      body: (b.tagline || "") + " · " + (b.positioning || ""),
      target: { section: "competitive" },
      icon: "BarChart",
    });
  });

  // Glossary — one hit per term
  if (window.HC_GLOSSARY && window.HC_GLOSSARY.groups) {
    window.HC_GLOSSARY.groups.forEach((g) => {
      g.terms.forEach((t) => {
        hits.push({
          sectionId: "glossary",
          sectionLabel: "Glossary",
          title: t.term + (t.expansion ? " · " + t.expansion : ""),
          body: t.body,
          target: { section: "glossary" },
          icon: "File",
        });
      });
    });
  }

  return hits;
}

function runSearch(index, q) {
  const query = (q || "").trim().toLowerCase();
  if (!query) return [];
  return index.filter((h) =>
    h.title.toLowerCase().includes(query) ||
    (h.body || "").toLowerCase().includes(query) ||
    h.sectionLabel.toLowerCase().includes(query)
  );
}

// ---------- Page shell --------------------------------------------------
function HelpCenterPage({ onGoTo, initialFeatureId }) {
  // Read the hash on mount — gives us deep-linkability without leaning
  // on the host app's router. If the hash is empty, default to Features.
  const initial = parseHash(typeof location !== "undefined" ? location.hash : "");
  const [section, setSection] = useStateHC(initialFeatureId ? "features" : initial.section);
  const [featureId, setFeatureId] = useStateHC(initialFeatureId || initial.featureId);
  const [query, setQuery] = useStateHC(initial.q || "");

  // Reset feature view when the user switches to a non-Features section.
  useEffectHC(() => {
    if (section !== "features" && section !== "search") setFeatureId(null);
  }, [section]);

  // Sync state → location.hash so refresh, share, and back-button work.
  useEffectHC(() => {
    if (typeof location === "undefined") return;
    const next = buildHash({ section, featureId, q: query });
    if (location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }, [section, featureId, query]);

  // Sync location.hash → state on browser back/forward.
  useEffectHC(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const p = parseHash(location.hash);
      setSection(p.section);
      setFeatureId(p.featureId);
      setQuery(p.q);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Cross-section search (F-08). Index rebuilds when the underlying data
  // loads — that happens once on mount in practice.
  const searchIndex = useMemoHC(() => buildSearchIndex(), []);
  const searchHits = useMemoHC(
    () => runSearch(searchIndex, query),
    [searchIndex, query]
  );
  const hitsBySection = useMemoHC(() => {
    const grouped = new Map();
    searchHits.forEach((h) => {
      if (!grouped.has(h.sectionId)) grouped.set(h.sectionId, { label: h.sectionLabel, items: [] });
      grouped.get(h.sectionId).items.push(h);
    });
    return [...grouped.entries()].map(([id, v]) => ({ id, ...v }));
  }, [searchHits]);

  // Helper used by search-result clicks to navigate to a target.
  const openTarget = (target) => {
    setSection(target.section);
    setFeatureId(target.featureId || null);
    setQuery("");
  };

  const activeSection = HC_SECTIONS.find((s) => s.id === section) || HC_SECTIONS[0];

  return (
    <React.Fragment>
      <Omnibar
        icon="Help"
        title="Internal help center"
        subtitle="Dayforce-internal reference for every Flex Work module — what it does, why it matters, and what's next."
      >
        {HC_LINKS.customerPortal.enabled && (
          <a
            className="iconbtn"
            aria-label="Open the customer-facing help portal in a new tab"
            title="Customer help portal"
            href={HC_LINKS.customerPortal.href}
            target="_blank"
            rel="noopener"
          >
            <Icon name="LinkNewWindow" size={18} />
          </a>
        )}
      </Omnibar>

      <div className="hc-page" data-screen-label="Internal help center">
        {/* Left rail — section nav */}
        <aside className="hc-rail" aria-label="Help center sections">
          <div className="hc-search">
            <Icon name="Search" size={14} />
            <input
              type="search"
              className="hc-search-input"
              placeholder="Search the help center"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                // Entering search mode switches the main pane to results.
                if (v) {
                  setSection("search");
                  setFeatureId(null);
                } else if (section === "search") {
                  // Empty query — return to Features catalog.
                  setSection("features");
                }
              }}
              aria-label="Search the help center"
            />
            {query && (
              <button
                type="button"
                className="hc-gl-search-clear"
                onClick={() => { setQuery(""); setSection("features"); }}
                aria-label="Clear search"
              >
                <Icon name="X" size={12} />
              </button>
            )}
          </div>
          <ul className="hc-rail-list">
            {HC_SECTIONS.map((s) => {
              const isActive = s.id === section;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`hc-rail-item${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => { setSection(s.id); setFeatureId(null); setQuery(""); }}
                  >
                    <span className="hc-rail-ico" aria-hidden="true">
                      <Icon name={s.icon} size={16} />
                    </span>
                    <span className="hc-rail-body">
                      <span className="hc-rail-label">{s.label}</span>
                      <span className="hc-rail-desc">{s.desc}</span>
                    </span>
                    {s.id === "features" && (
                      <span className="hc-rail-count" aria-hidden="true">{HC_FEATURES.length}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* If we're inside a feature, show the per-feature mini-toc */}
          {section === "features" && featureId && (
            <nav className="hc-rail-toc" aria-label="Section anchors">
              <p className="hc-rail-toc-title">On this page</p>
              <ol className="hc-rail-toc-list">
                <li><a href={`#features/${featureId}/overview`}><span>01</span>Overview</a></li>
                <li><a href={`#features/${featureId}/why`}><span>02</span>Why it matters</a></li>
                <li><a href={`#features/${featureId}/variations`}><span>03</span>Variations</a></li>
                <li><a href={`#features/${featureId}/competitive`}><span>04</span>Competitive</a></li>
                <li><a href={`#features/${featureId}/roadmap`}><span>05</span>Roadmap</a></li>
              </ol>
            </nav>
          )}
        </aside>

        {/* Right column — content */}
        <main className="hc-main" key={`${section}:${featureId || "catalog"}:${query ? "q" : ""}`}>
          {/* Cross-section search results */}
          {section === "search" && (
            <section className="hc-search-results">
              <header className="hc-catalog-head">
                <h2 className="hc-catalog-title">
                  {searchHits.length === 0
                    ? `No matches for "${query}"`
                    : `${searchHits.length} ${searchHits.length === 1 ? "result" : "results"} for "${query}"`}
                </h2>
                <p className="hc-catalog-sub">
                  Across all {HC_SECTIONS.length} sections of the help center.
                  {" "}
                  <button type="button" className="hc-link" onClick={() => { setQuery(""); setSection("features"); }}>Clear search</button>
                </p>
              </header>
              {hitsBySection.map((g) => (
                <section key={g.id} className="hc-search-group">
                  <h3 className="hc-search-group-title">
                    <span>{g.label}</span>
                    <span className="hc-search-group-count">{g.items.length}</span>
                  </h3>
                  <ul className="hc-search-list">
                    {g.items.map((h, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="hc-search-hit"
                          onClick={() => openTarget(h.target)}
                        >
                          <span className="hc-search-hit-ico" aria-hidden="true">
                            <Icon name={h.icon} size={16} />
                          </span>
                          <span className="hc-search-hit-body">
                            <span className="hc-search-hit-title">{h.title}</span>
                            <span className="hc-search-hit-snip">{h.body}</span>
                          </span>
                          <Icon name="ArrowRight" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          )}

          {section === "features" && !featureId && (
            <HcFeaturesCatalog onOpen={setFeatureId} />
          )}

          {section === "features" && featureId && (
            <HcFeatureDetail
              featureId={featureId}
              onBack={() => setFeatureId(null)}
              onOpen={(id) => setFeatureId(id)}
            />
          )}

          {section !== "features" && section !== "search" && (
            window.HcSectionRouter
              ? <window.HcSectionRouter section={section} />
              : <HcSectionStub section={section} />
          )}
        </main>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { HelpCenterPage });
