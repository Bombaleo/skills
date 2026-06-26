// =====================================================================
// Flex Work — Internal Help Center · Competitive briefs
//   Six battlecards covering the named competitors in the market.
//   Each card runs the same shape: positioning summary, strongest
//   module, weakest module, the deals we win, the deals they win,
//   the talk track for head-to-head conversations.
//   Loaded into window.HC_BATTLECARDS.
// =====================================================================

window.HC_BATTLECARDS = [
  // ---- 1. Beeline ----------------------------------------------------
  {
    id: "beeline",
    name: "Beeline",
    tagline: "The mature incumbent.",
    owner: "Priya Anand · CS, NA",
    updated: "2026-05-25",
    positioning: "Beeline is the longest-tenured pure-play VMS in the market. Strongest on professional + SOW, mature on AP, deeply configurable, slow to use day-of. Most enterprise customers have used Beeline at some point and have an opinion — usually 'it works but it's a slog'.",
    strongest: "Reporting + analytics. Beeline ships the deepest canned-report catalog in the market and the most-developed scheduled-export tooling. Procurement teams that joined from a prior Beeline program lobby hard to keep the report library.",
    weakest: "Day-of operating surface. Beeline does not own scheduling — they hand off to a sister operational tool, which means the manager who actually fills shifts can't do it in Beeline. We win every frontline shop on this point alone.",
    weWin: [
      "Pure-frontline programs (hospitality, retail, warehousing) where day-of speed matters",
      "Programs where the buyer wants AI-assist as a year-1 capability, not a roadmap promise",
      "Customers already on Dayforce HCM, on the Dayforce-native pay-rule integration",
      "Mid-size programs (<$50M annual contingent spend) where Beeline's configurability is overkill",
    ],
    theyWin: [
      "Pure-professional + SOW programs at enterprise scale (>$500M)",
      "Programs with a heavy custom-reporting requirement at launch",
      "Procurement-led RFPs where the buyer benchmarks on configurability and lineage",
      "Customers with deep Beeline-using team continuity (the switching cost is staff, not software)",
    ],
    talkTrack: [
      "Don't argue Beeline on configurability. They win that fight.",
      "Pivot to time-to-decision: how fast can a manager fill a Tuesday-afternoon callout, end-to-end. Show the schedule console; have a real manager walk it.",
      "On reporting, acknowledge Beeline's depth and offer the AI-narrative dashboards + embedded tiles as the modern shape. Both ship together in our Now roadmap.",
      "If the customer is currently on Beeline, focus on the operational pain (slow loads, hand-off to sister tools) over the architectural pain.",
    ],
  },

  // ---- 2. SAP Fieldglass -------------------------------------------
  {
    id: "fieldglass",
    name: "SAP Fieldglass",
    tagline: "The SOW + global-VAT champion.",
    owner: "Anika Sundqvist · CS, EMEA",
    updated: "2026-05-25",
    positioning: "Fieldglass is the SAP-stack standard for contingent labor at multinational scale. Strongest on SOW, rate cards, multi-country VAT, supplier QBR tooling. Weakest on mobile, on intake speed, on day-of operating surfaces. The structural competitor for upmarket and global deals.",
    strongest: "SOW + multi-country VAT. Fieldglass has the deepest SOW primitives in the market (not-to-exceed caps, milestone reconciliation, currency-conversion holds, country-floor markups) and the most country-specific tax configurations. Programs spanning 10+ countries gravitate to Fieldglass on this strength.",
    weakest: "Mobile + day-of operating. Fieldglass intake is rigorous and configurable but legendarily slow to load. Mobile intake is a long-standing weakness. They have no schedule console.",
    weWin: [
      "Programs with mixed frontline + professional work where day-of speed matters",
      "Mid-market and lower-enterprise programs where Fieldglass configurability is friction, not value",
      "Customers prioritizing AI-assist and modern UX",
      "Programs already on Dayforce HCM",
    ],
    theyWin: [
      "Enterprise SOW programs at $500M+ scale, especially global / multi-country",
      "SAP-stack customers where the procurement team is already on SAP Ariba + Concur",
      "Programs with deep configurability requirements (parallel multi-conditional gates, delegated-by-dollar approval)",
      "Public-sector and Davis-Bacon programs (until our prevailing-wage card type ships)",
    ],
    talkTrack: [
      "On global VAT, acknowledge Fieldglass leads today; cite the Vertex/Avalara native engine in our Q3 roadmap.",
      "On SOW, segment the conversation by scale. Mid-market doesn't need Fieldglass's depth; enterprise global does.",
      "On the operational surface (intake speed, mobile, scheduling), bring screenshots. Demo a real Tuesday-afternoon flow.",
      "On workflows, don't promise the complexity ceiling fight; acknowledge it and pivot to AI-suggested chains as the modern UX.",
    ],
  },

  // ---- 3. Workday VNDLY -------------------------------------------
  {
    id: "vndly",
    name: "Workday VNDLY",
    tagline: "The Workday-stack defender.",
    owner: "Priya Anand · CS, NA",
    updated: "2026-05-25",
    positioning: "VNDLY is the contingent module bolted into the Workday HCM stack. Strongest on professional intake (clean, modern UI) and candidate matching. Weakest on frontline, on invoice/ERP integration, on workforce records, on reporting. Their structural play is 'you're already on Workday'.",
    strongest: "Professional intake UI. VNDLY's intake form for assignments is the cleanest in the market; the candidate-matching surface is genuinely good. Workday-native customers find this a low-friction add.",
    weakest: "Invoice + ERP integration is their most-cited RFP gap. Frontline support is shallow. Worker records are thin. Reporting is light. Their differentiator depends on Workday adjacency, not on standalone capability.",
    weWin: [
      "Any program with material frontline volume — VNDLY treats frontline as out-of-scope",
      "Programs with heavy AP / ERP integration requirements (NetSuite, SAP S/4)",
      "Mixed-supplier programs needing day-of operating tooling",
      "Customers on non-Workday HCM (Dayforce, Oracle HCM, Ceridian, ADP)",
    ],
    theyWin: [
      "Pure-Workday-stack customers where consolidating on Workday is a stated executive goal",
      "Light-touch professional-only programs at small scale",
      "Programs where the buyer values candidate matching above operational depth",
    ],
    talkTrack: [
      "VNDLY's only structural moat is the Workday relationship. Lead with whether the customer is genuinely all-in on Workday — if not, VNDLY is shallow on every axis.",
      "On candidate matching, acknowledge VNDLY's strength and pivot to our skill-graph + auto-match work in the Workforce roadmap (Q4).",
      "On invoice + ERP, bring our direct-ERP-webhook roadmap (NetSuite, SAP S/4) and the Vertex/Avalara VAT engine.",
      "On frontline, bring the schedule console and the no-show / fill-rate dashboards. VNDLY has no answer.",
    ],
  },

  // ---- 4. Magnit ----------------------------------------------------
  {
    id: "magnit",
    name: "Magnit",
    tagline: "The MSP-services bundle.",
    owner: "Priya Anand · CS, NA",
    updated: "2026-05-25",
    positioning: "Magnit is a hybrid MSP + technology play. The technology stack underneath is Beeline-class; the differentiator is the human program-services wrap. Strongest on direct-source / alumni pool and on operational maturity. Weakest as a pure software comparison — the tooling alone doesn't win the deal.",
    strongest: "Direct-source / alumni pool. Magnit's direct-source pool is one of the most-cited differentiators in the market — they've built it as a service offering, not as a product feature. Buyers value the talent inventory, not the software around it.",
    weakest: "As a pure-tech comparison, Magnit doesn't differentiate. The tooling is middle-of-pack; the program-services team is the actual product.",
    weWin: [
      "Customers who want a technology-led program (not a managed-service program)",
      "Programs where the buyer's program team is already strong and doesn't want a Magnit-style wrap",
      "Mid-market customers priced out of Magnit's services model",
      "Customers focused on the modern UX and AI-assist",
    ],
    theyWin: [
      "Enterprise programs that explicitly want a managed service in addition to the software",
      "Buyers with thin internal program teams who need the Magnit ops layer",
      "Programs heavy on direct-source pool depth (clinical, niche-skill engineering)",
      "Customers with an existing Magnit MSP relationship",
    ],
    talkTrack: [
      "Don't compete with Magnit on services if the customer wants services. Refer them to a Dayforce partner who can wrap our platform with a service layer instead.",
      "On direct-source, lead with our Talent Pool revamp + cross-program worker identity (Q3 roadmap). Verify the customer's pool requirements against our actual capability before committing.",
      "On software depth, the comparison is favorable everywhere except direct-source. Bring real demos of schedule, distribution, AI assist.",
      "On price, Magnit programs cost materially more all-in because services are the bundle. Lead with TCO.",
    ],
  },

  // ---- 5. Coupa CCWM ------------------------------------------------
  {
    id: "coupa",
    name: "Coupa CCWM",
    tagline: "The finance-led play.",
    owner: "Devon Ojo · Product, finance",
    updated: "2026-05-25",
    positioning: "Coupa Contingent Workforce Management (CCWM) is the contingent module of the Coupa procurement suite. Strongest on AP, on procurement-DNA forms, on Coupa-stack adjacency. Weakest on day-of operating, on shift work, on candidate-side experiences. The structural competitor when the deal is finance-led.",
    strongest: "Invoice + procurement integration. CCWM inherits Coupa's contract, sourcing, and Analyze layer — that's a powerful asset in finance-led RFPs where the buyer is on Coupa already.",
    weakest: "Day-of operating, shift work, candidate-side experiences. CCWM intake leans on Coupa's procurement-form patterns — fine for SOW, awkward for shift work. There's no schedule console; supplier tiering is preference, not tier-and-hold.",
    weWin: [
      "Programs with material frontline / shift volume",
      "Customers with limited Coupa adjacency (no existing Coupa procurement or sourcing seats)",
      "Programs that need an operationally-rich VMS, not a finance-rich one",
      "AI-assist-forward customers",
    ],
    theyWin: [
      "Coupa-stack customers where consolidating on Coupa is a stated finance goal",
      "Pure-SOW programs at enterprise scale led by procurement",
      "Programs where the AP team is the dominant decision-maker",
      "Public-sector and finance-heavy programs",
    ],
    talkTrack: [
      "On AP and ERP integration, acknowledge Coupa's strength and pivot to our direct-ERP-webhook + Vertex/Avalara VAT roadmap.",
      "On finance-led workflows, bring our finance-led workflow template pack (Q3 roadmap) and the visual workflow canvas + AI suggestions.",
      "On operations, lead with the schedule console and the no-show dashboards. Coupa has no answer.",
      "On Coupa adjacency, ask explicitly — if the customer isn't already on Coupa Sourcing or Analyze, the adjacency argument collapses.",
    ],
  },

  // ---- 6. Prism HR / greenfield -----------------------------------
  {
    id: "prism",
    name: "Prism HR / greenfield",
    tagline: "The build-it-yourself default.",
    owner: "Priya Anand · CS, NA",
    updated: "2026-04-30",
    positioning: "Most mid-market customers without a current VMS run their contingent labor on a custom build — a Prism HR config, a Smartsheet web of automations, an Airtable cobbled together by a sourcing analyst, plus email. 'Greenfield' covers all of that. Strongest on flexibility and zero per-seat cost. Weakest on everything else.",
    strongest: "Flexibility, no licensing cost, fits any process the customer can describe. The org's tribal knowledge is the system.",
    weakest: "Audit, scale, reporting, compliance, mobile, day-of operations. Every operational metric a real VMS measures is uncaptured.",
    weWin: [
      "Mid-market customers crossing the $20M annual contingent spend threshold",
      "Customers under regulatory pressure (healthcare, finance, public-sector) where audit trail matters",
      "Customers losing key staff who held the tribal knowledge",
      "Customers whose contingent program is growing >40% YoY",
    ],
    theyWin: [
      "Very small programs (<$5M annual spend) where the per-seat cost of any VMS exceeds the savings",
      "Customers where the executive sponsor explicitly wants to avoid platform commitments",
    ],
    talkTrack: [
      "Lead with operational KPIs the greenfield can't produce (fill rate, time-to-fill, no-show, dispute rate). Then show how those numbers move on Flex Work.",
      "On price, compare against the all-in cost of greenfield: the analyst's salary, the spreadsheet license, the email and Slack support, the audit consulting bill.",
      "On audit, walk a real regulator scenario. Greenfield has no recovery.",
      "Be patient. Greenfield customers often need 2-3 conversations before the value clicks.",
    ],
  },
];
