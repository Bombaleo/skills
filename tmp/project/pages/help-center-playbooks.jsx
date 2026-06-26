// =====================================================================
// Flex Work — Internal Help Center · Field playbooks
//   Pattern-level guidance for the configurations CSMs run into in the
//   field. Each playbook covers when to use it, the trade-offs it
//   commits you to, and the failure modes that put a program in
//   recovery. Loaded into window.HC_PLAYBOOKS.
// =====================================================================

window.HC_PLAYBOOKS = [
  // ---- 1. Exception-only timesheet approval --------------------------
  {
    id: "exception-only-timesheets",
    name: "Exception-only timesheet approval",
    intent: "Cut approval load 70–90% without losing audit integrity.",
    audience: "Site supervisors, payroll, finance, operations",
    owner: "Rae Ortiz · Platform engineering",
    updated: "2026-05-20",
    summary: "Timesheets that match the booked shift within a tolerance band auto-approve; only the exceptions hit a human reviewer's queue. Mature frontline programs land here within 6–12 months of launch. The pattern only works if the booked-shift data and the clocked time can be reliably compared — geofenced clock-ins, supplier-supplied punch feeds, or Dayforce time clocks all qualify.",
    whenToUse: [
      "Approval queue is consistently >30 minutes per supervisor per day",
      "Time data quality is high (geofence or clock-attestation in place)",
      "Volume is high enough that approvers stop reading carefully (>20 timesheets / approver / day)",
      "Pay rules are deterministic — no judgement calls per shift",
    ],
    tradeoffs: [
      { left: "Approval load drops 70–90%", right: "Supervisors stop seeing the full shift surface; tribal knowledge erodes" },
      { left: "Time-to-pay drops materially (often 1–2 days)", right: "Errors caught later — at invoice or payroll, not at approval" },
      { left: "Dispute rate drops (less rubber-stamping)", right: "Tolerance-band design becomes the highest-leverage governance lever" },
    ],
    failureModes: [
      "Tolerance band copied from one site to all sites. Predictive-scheduling cities (Seattle, NYC, Philly, Oregon) need tighter bands.",
      "Auto-approval rolled out before geofence + clock attestation. The tolerance window becomes a fraud window.",
      "No retrospective on the exception queue. After 90 days, the exceptions are a different set than they were at launch; tune.",
      "Tolerance band set per job class, not per pay rule. A union step-up rate needs a different band than a flat hourly.",
    ],
    config: [
      "Set tolerance bands per job class AND per pay rule (start ±15 min on duration, ±$0.50 on hourly equivalent).",
      "Require geofence OR supplier punch feed before flipping a job class to exception-only.",
      "Retain a 5% random-sample audit even after auto-approval — surfaces drift.",
      "Build a daily exception-queue heatmap: which sites, which suppliers, which shift patterns produce the most exceptions.",
    ],
    related: [
      "Tier-and-hold tuning — both reflect 'how much trust is the program willing to extend'.",
      "Credentialing matrix — both push verification earlier in the lifecycle.",
    ],
  },

  // ---- 2. Tier-and-hold tuning ---------------------------------------
  {
    id: "tier-and-hold-tuning",
    name: "Tier-and-hold timing for fill rate vs. supplier share",
    intent: "Find the hold duration that maximizes fill rate without starving tier-2 + tier-3 suppliers.",
    audience: "Program managers, MSPs, sourcing",
    owner: "Mira Sato · Product, frontline",
    updated: "2026-05-25",
    summary: "Tier-and-hold gives the top tier of suppliers an exclusive window on every new requisition before lower tiers see it. Tune the hold too long and tier-2/3 suppliers starve and exit the program; tune it too short and tier-1 doesn't earn the preferred status they negotiated for. The right hold is empirical, not theoretical — pull it from your own fill-rate-by-tier-hold data.",
    whenToUse: [
      "Program has 3+ active suppliers per job class",
      "Tier-1 suppliers have a contracted preferred status (rate, allocation %)",
      "Fill rate is the dominant operational KPI (frontline programs)",
    ],
    tradeoffs: [
      { left: "Long holds — tier-1 maximally honored", right: "Tier-2/3 supplier engagement drops; they exit within 2 quarters" },
      { left: "Short holds — broad supplier participation", right: "Tier-1 preferred status feels symbolic; renegotiation pressure" },
      { left: "Variable holds by shift criticality", right: "Distribution rule becomes harder to explain to suppliers" },
    ],
    failureModes: [
      "Hold set on supplier-negotiation logic instead of fill-rate logic. The 30-minute Tier-1 hold the supplier asked for may starve the shift.",
      "Same hold for all job classes. A nurse req has a different urgency profile than a warehouse picker req.",
      "No re-evaluation cadence. The tier list changes every quarter; holds usually do not.",
      "Auto-escalation off. A shift sitting in tier-1 hold past expiry should auto-unlock; manual unlock is the fastest way to a no-show.",
    ],
    config: [
      "Start at 15-minute Tier 1 / 30-minute Tier 2 / open Tier 3.",
      "Pull the per-tier fill-rate report at week 4; tune in 5-minute increments.",
      "Enable auto-escalation by default; supervisor opt-out per req if needed.",
      "Quarterly: review fill-rate-by-tier-hold against supplier-share target; re-tune.",
    ],
    related: [
      "Score-driven tiering — feeds the tier assignment that holds operate against.",
      "Distribution simulator (Now on the roadmap) — preview a tune before saving.",
    ],
  },

  // ---- 3. Supplier-submitted → auto-generated invoices ----------------
  {
    id: "invoice-migration",
    name: "Migrating from supplier-submitted to auto-generated invoices",
    intent: "Cut dispute volume 60%+ by eliminating the supplier-typed invoice step.",
    audience: "Finance, AP, supplier accounting",
    owner: "Devon Ojo · Product, professional + finance",
    updated: "2026-05-18",
    summary: "Supplier-submitted invoices are the largest single source of dispute volume on most enterprise programs. Auto-generation builds the invoice from approved timesheets + rate-cards, so the invoice always matches what the buyer authorized. The migration is straightforward technically — the politics are the work.",
    whenToUse: [
      "Approved-timesheet data is clean (post-exception-only-approval pattern)",
      "Rate-cards are managed in Flex Work, not in a sidecar spreadsheet",
      "Dispute rate is materially impacting days-to-pay",
      "Supplier contract allows for system-generated invoices (most do)",
    ],
    tradeoffs: [
      { left: "Dispute rate drops sharply (typically 60–80% reduction)", right: "Suppliers lose the invoice as a place to apply judgement; cooperation matters" },
      { left: "Days-to-pay drops (no supplier-typing latency)", right: "Rate-card hygiene becomes critical — every off-card hour is a problem" },
      { left: "AP team load drops", right: "Supplier-accounting load may rise if they have to reconcile differently" },
    ],
    failureModes: [
      "Suppliers not told before flip. They assume their invoice is being silently rewritten; trust drops.",
      "Off-card rates handled by exception. Some always exist; build a process before flipping, not after.",
      "Credit-note flow not configured. When a timesheet is retroactively edited, the system needs to auto-issue a credit note.",
      "FX rules ignored. Multi-currency programs need to lock the FX rate at invoice generation, not at payment.",
    ],
    config: [
      "Run 30 days of dual-track (auto-generated + supplier-submitted; flag discrepancies) before flipping.",
      "Configure credit-note auto-generation on retroactive timesheet edits.",
      "Send suppliers a 60-day notice with sample auto-generated invoices for their own work.",
      "Maintain off-card rate handling as an explicit workflow, not a backdoor.",
    ],
    related: [
      "Exception-only timesheet approval — clean timesheet data is the input.",
      "Rate-card simulator (Now on the roadmap) — preview rate changes before they hit invoices.",
    ],
  },

  // ---- 4. Credentialing matrix for regulated industries -------------
  {
    id: "credentialing-matrix",
    name: "Credentialing matrix for a regulated industry",
    intent: "Design a credential set that prevents the bad booking without choking the fill pipeline.",
    audience: "Compliance officers, site managers, MSPs",
    owner: "Devon Ojo · Product, compliance",
    updated: "2026-05-14",
    summary: "Regulated industries — healthcare, food handling, security, construction — require a credential set that's both deep (every regulator-required document) and operationally usable (a booking can't take 20 minutes to verify). The matrix lays out which credential is required for which job class at which site, with which renewal cadence, and what happens at expiry. Done right, the matrix is the runtime guard the program lives behind.",
    whenToUse: [
      "Industry is regulated (clinical, food, security, construction, transportation)",
      "Workers move between job classes within a single program",
      "Compliance officer is a named role on the customer side",
      "Audit risk is a stated executive concern",
    ],
    tradeoffs: [
      { left: "Deep matrix — bad bookings prevented at clock-in", right: "Fill rate drops in the short term while suppliers catch up on credentials" },
      { left: "Shallow matrix — fast fill, broad eligibility", right: "Audit risk is on the customer's general ledger" },
      { left: "Site-scoped credentials (per-location training)", right: "Cross-site redeployment friction increases" },
    ],
    failureModes: [
      "Matrix designed in a spreadsheet; never matches the runtime config. Build it inside Flex Work.",
      "Renewal cadence set globally. Different credentials renew at different rhythms (annual safety, 2-year clinical license, monthly TB screen).",
      "Background-check provider not integrated. Workers wait days; manager works around the system.",
      "Site-scoped trainings managed by a central admin who doesn't know the site. Site supervisors should own their site's training requirements.",
    ],
    config: [
      "Per-job-class credential list signed off by the customer's compliance + legal.",
      "Site-scoped overlay for location-specific training (delegated to site supervisors).",
      "Renewal cadence with day-30 / day-15 / day-3 escalation, automated.",
      "Runtime block at clock-in (not just booking-time) for expired creds.",
      "Background-check provider integrated (Sterling / Checkr / HireRight) so renewals route automatically.",
    ],
    related: [
      "Worker tenure caps as policy — sibling pattern that also runs at booking time.",
      "Direct-to-payroll route — clean credential data makes payroll routing safer.",
    ],
  },

  // ---- 5. Stitching the org tree to a Workday HCM source -----------
  {
    id: "workday-org-tree",
    name: "Stitching the org tree to a Workday HCM source",
    intent: "Keep the Flex Work org tree in lockstep with Workday so approvals don't break when the org chart changes.",
    audience: "Customer IT, integrations team, program admins",
    owner: "Rae Ortiz · Platform engineering",
    updated: "2026-05-08",
    summary: "Almost every enterprise customer with Dayforce HCM also runs Workday for parts of the org. The Flex Work org tree is the substrate that approval routing, cost-center attribution, location-scoping, and reporting all join against — if it drifts from the HCM source, approvals route to people who don't exist anymore. The stitching pattern is a daily sync from Workday with a documented authority model: HCM owns the tree; Flex Work owns the contingent-only additions (sites that don't exist in HCM).",
    whenToUse: [
      "Customer has Workday HCM as the source of truth for the org chart",
      "Approvals route by org node (cost center, sector, division)",
      "Location count is large enough that manual sync is impractical (>50 locations)",
      "Org chart changes monthly or faster",
    ],
    tradeoffs: [
      { left: "Daily sync — minimal drift", right: "Sync failures during business hours require an escalation path" },
      { left: "Push from Workday (Workday-driven)", right: "Workday team controls cadence; we depend on their SLA" },
      { left: "Pull from Workday (Flex Work-driven)", right: "Higher resource cost; better recovery story" },
    ],
    failureModes: [
      "Two-way sync configured. The contingent-only additions get overwritten by Workday's authoritative push.",
      "No deletion policy. Org nodes deleted in Workday don't get deleted in Flex Work; approvals route to ghosts.",
      "Sync failure detection silent. The first signal is an approval bottleneck a week later.",
      "Cost-center mapping diverges. Workday changes a cost-center code; Flex Work invoices keep using the old one; finance reconciliation breaks.",
    ],
    config: [
      "One-way sync, Workday → Flex Work, daily at 04:00 customer timezone.",
      "Authority model documented: HCM owns nodes; Flex Work owns contingent-only sites.",
      "Sync failure paging routes to both Dayforce ops and the customer's Workday team.",
      "Cost-center change events route a notification to AP before the next invoice cycle.",
      "90-day audit: walk a sample of approval paths to confirm they resolve to live users.",
    ],
    related: [
      "Cross-program worker identity (Now on the roadmap) — extends the same sync substrate to workers.",
      "Workflow templates — depend on the org tree being current.",
    ],
  },
];
