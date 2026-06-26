/* =====================================================================
   Dayforce Flex Work — Sales Content Library
   CANONICAL CATALOG. Single source of truth for the report dashboard,
   the live library (Content Library Live.html) AND the per-asset pages.
   Pure JSON object (no functions, no comments inside the braces) so any
   consumer can parse it. Each item:
     id, slug, fam, format, status, updated, title, desc, use, outline[]
     built (optional, true once the asset is a real deliverable)
   Derived paths: folder = "assets/<slug>", file = "<title>.html".
   The ROI calculator is external — it ships at its own folder.
   Status: "ready" = a real, openable deliverable; "soon" = scope only.
   "updated" (YYYY-MM-DD) drives the "recently updated" sort.
   ===================================================================== */
window.LIBRARY_DATA = {
  "stages": [
    {
      "n": 1,
      "eyebrow": "Stage 1 · Awareness",
      "title": "There is a problem worth fixing",
      "mindset": "I have not connected my staffing headaches to a category of software.",
      "goal": "Name the problem, quantify the cost of doing nothing, earn a first conversation.",
      "items": [
        {
          "id": "state-of-contingent-labor",
          "slug": "state-of-contingent-labor",
          "fam": "proof",
          "format": "Annual report",
          "status": "ready",
          "built": true,
          "updated": "2026-06-03",
          "title": "State of contingent labor report",
          "desc": "A data-led annual on contingent workforce growth, leakage and compliance risk that positions Flex Work in the category.",
          "use": "Open a cold conversation with credible data and reframe staffing spend as a board-level problem.",
          "outline": [
            "Market sizing and growth of contingent and flexible labor",
            "Where spend leaks today: rogue spend, tenure and co-employment risk",
            "Benchmarks by industry, each sourced and dated",
            "The shift toward consolidated VMS programs"
          ]
        },
        {
          "id": "hidden-cost-infographic",
          "slug": "hidden-cost-infographic",
          "fam": "doc",
          "format": "Infographic",
          "status": "ready",
          "built": true,
          "updated": "2026-06-03",
          "title": "The hidden cost of unmanaged staffing",
          "desc": "One-screen visual on rogue spend, tenure risk, invoice errors and manual rekeying across a typical program.",
          "use": "Share on social or in cold outreach to make the pain concrete in five seconds.",
          "outline": [
            "Manual rekeying and invoice error rates",
            "Maverick and off-program spend",
            "Compliance and worker-classification exposure",
            "One headline number: total leakage on a typical program"
          ]
        },
        {
          "id": "what-is-a-vms",
          "slug": "what-is-a-vms",
          "fam": "video",
          "format": "90-second animation",
          "status": "ready",
          "built": true,
          "updated": "2026-06-03",
          "title": "What is a VMS, and why now",
          "desc": "Short animated explainer that defines the category and frames Flex Work as the modern answer.",
          "use": "Create awareness at scale with buyers who will watch 90 seconds before reading a page.",
          "outline": [
            "The problem in 15 seconds",
            "What a VMS does across suppliers, requisitions, workforce and invoices",
            "Where Flex Work fits",
            "A single, clear call to action"
          ]
        }
      ]
    },
    {
      "n": 2,
      "eyebrow": "Stage 2 · Education & interest",
      "title": "Tell me what this does",
      "mindset": "I am curious. Show me the category and your take without making me sit a demo.",
      "goal": "Educate the buyer, frame our differentiators, qualify fit and intent.",
      "items": [
        {
          "id": "solution-overview",
          "slug": "solution-overview",
          "fam": "doc",
          "format": "One-pager",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Flex Work solution overview",
          "desc": "The single-page leave-behind: the problem, the four pillars and the outcome.",
          "use": "Forward as the default first attachment after any intro call.",
          "outline": [
            "The problem and the four pillars: suppliers, requisitions, workforce, invoices",
            "Headline outcomes and proof points",
            "Who it is for",
            "Next step and contact"
          ]
        },
        {
          "id": "capabilities-deck",
          "slug": "capabilities-deck",
          "fam": "deck",
          "format": "Slide deck",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Capabilities pitch deck",
          "desc": "The core narrative deck reps present in a first or second meeting, modular so it flexes by audience.",
          "use": "Present the strongest, most consistent version of the story in a live meeting.",
          "outline": [
            "Narrative: problem, stakes, approach",
            "Platform walkthrough by pillar",
            "Proof: outcomes and customers",
            "Modular appendix slides by audience"
          ]
        },
        {
          "id": "buyers-guide",
          "slug": "buyers-guide",
          "fam": "doc",
          "format": "Buyer's guide",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "How to evaluate a VMS",
          "desc": "A vendor-neutral checklist of what to look for, quietly built around the criteria where Flex Work is strong.",
          "use": "Position as the trusted advisor and shape requirements before the RFP is written.",
          "outline": [
            "The evaluation criteria that matter",
            "Questions to ask every vendor",
            "Red flags and hidden costs",
            "A scoring worksheet"
          ]
        },
        {
          "id": "product-walkthrough",
          "slug": "product-walkthrough",
          "fam": "video",
          "format": "Recorded demo",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "On-demand product walkthrough",
          "desc": "A tight recorded tour of the live product the buyer can watch async and share internally.",
          "use": "Let interested buyers self-serve a demo and pull in colleagues without booking time.",
          "outline": [
            "Post a requisition",
            "Onboard and manage a supplier",
            "Approve a timesheet and invoice",
            "The reporting view"
          ]
        },
        {
          "id": "roi-calculator",
          "slug": "roi-calculator",
          "fam": "interactive",
          "format": "Interactive web tool",
          "status": "ready",
          "built": true,
          "updated": "2026-05-20",
          "external": true,
          "href": "../ROI Calculator/ROI Calculator.html",
          "title": "Contingent labor ROI calculator",
          "desc": "Model hard and soft savings against annual contingent spend, tune every assumption, share a client summary.",
          "use": "Turn interest into a quantified case the buyer co-builds with you.",
          "outline": []
        }
      ]
    },
    {
      "n": 3,
      "eyebrow": "Stage 3 · Evaluation",
      "title": "Does it fit my world?",
      "mindset": "I am comparing options. Prove you handle my industry, my systems and my risk.",
      "goal": "Differentiate, prove fit and integration, de-risk the decision.",
      "items": [
        {
          "id": "product-tour",
          "slug": "product-tour",
          "fam": "interactive",
          "format": "Clickable demo",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Self-guided interactive product tour",
          "desc": "A guided, clickable walkthrough of the real flows: post a requisition, onboard a supplier, approve a timesheet.",
          "use": "Let evaluation-stage buyers drive the product themselves instead of booking another demo.",
          "outline": [
            "Guided, clickable core flows",
            "Tooltip narration at each step",
            "Sandbox data the buyer can poke",
            "Resumable and drop-off safe"
          ]
        },
        {
          "id": "industry-solution-sheets",
          "slug": "industry-solution-sheets",
          "fam": "doc",
          "format": "One-pager set",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Industry solution sheets",
          "desc": "Tailored one-pagers for healthcare, manufacturing, light industrial and retail.",
          "use": "Prove fit by reflecting the buyer's own world back at them.",
          "outline": [
            "Healthcare, manufacturing, light industrial, retail",
            "Roles, terminology and metrics per sector",
            "Sector-specific compliance notes",
            "Matching customer proof"
          ]
        },
        {
          "id": "comparison-matrix",
          "slug": "comparison-matrix",
          "fam": "doc",
          "format": "Comparison",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Capability comparison matrix",
          "desc": "Flex Work versus spreadsheets, point tools and legacy VMS across the criteria that decide the deal.",
          "use": "Arm the champion with a side-by-side they can paste into an internal recommendation.",
          "outline": [
            "Flex Work vs spreadsheets, point tools, legacy VMS",
            "Criteria that decide the deal",
            "Honest scope notes",
            "Paste-ready for internal recommendations"
          ]
        },
        {
          "id": "integration-overview",
          "slug": "integration-overview",
          "fam": "doc",
          "format": "One-pager",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Integration & ecosystem overview",
          "desc": "How Flex Work connects to Dayforce payroll, ATS, ERP and HRIS, with the data flows drawn out.",
          "use": "Answer the integration doubt that IT and ops use to kill deals.",
          "outline": [
            "Dayforce payroll, ATS, ERP and HRIS connections",
            "Data flows drawn out",
            "Security of the integration layer",
            "Implementation effort by system"
          ]
        },
        {
          "id": "security-data-sheet",
          "slug": "security-data-sheet",
          "fam": "doc",
          "format": "Data sheet",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Security, compliance & data sheet",
          "desc": "Certifications, data residency, access controls and worker-classification compliance in one reference.",
          "use": "Keep procurement and security reviews moving instead of stalled.",
          "outline": [
            "Certifications and audits",
            "Data residency and access controls",
            "Worker-classification compliance",
            "Sub-processor and uptime detail"
          ]
        }
      ]
    },
    {
      "n": 4,
      "eyebrow": "Stage 4 · Justification & decision",
      "title": "Help me get this approved",
      "mindset": "I am sold. Now I have to convince finance, procurement and my exec.",
      "goal": "Build the business case, satisfy procurement, remove the last barriers to signature.",
      "items": [
        {
          "id": "case-studies",
          "slug": "case-studies",
          "fam": "proof",
          "format": "Case study set",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Customer case studies",
          "desc": "Named-customer stories with the before, the change and the measured result, sliced by industry and program size.",
          "use": "Give the champion peer proof to sell internally.",
          "outline": [
            "Before, change and measured result",
            "Sliced by industry and program size",
            "Named quotes and metrics",
            "Linkable one-page format"
          ]
        },
        {
          "id": "business-case-template",
          "slug": "business-case-template",
          "fam": "doc",
          "format": "Template",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Executive business case template",
          "desc": "A fill-in-the-blanks proposal that pairs the ROI calculator output with timeline, risk and ask.",
          "use": "Hand the champion the exact document their CFO expects.",
          "outline": [
            "Problem and cost of inaction",
            "ROI calculator output embedded",
            "Timeline, risk and the ask",
            "CFO-ready summary"
          ]
        },
        {
          "id": "implementation-plan",
          "slug": "implementation-plan",
          "fam": "doc",
          "format": "Template",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Implementation & onboarding plan",
          "desc": "A realistic phased rollout showing time-to-value, responsibilities and milestones.",
          "use": "Answer how hard it is to switch, the fear that most delays a yes.",
          "outline": [
            "Phased rollout with milestones",
            "Responsibilities and dependencies",
            "Time-to-value markers",
            "Risk and mitigation"
          ]
        },
        {
          "id": "rfp-response-library",
          "slug": "rfp-response-library",
          "fam": "doc",
          "format": "Answer toolkit",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "RFP / RFI response library",
          "desc": "A maintained bank of approved answers to the questions that recur in every formal procurement.",
          "use": "Cut RFP turnaround from days to hours with consistent, winning answers.",
          "outline": [
            "Approved answers by category",
            "Security and compliance bank",
            "Reusable boilerplate",
            "Maintained and versioned"
          ]
        },
        {
          "id": "pricing-summary",
          "slug": "pricing-summary",
          "fam": "doc",
          "format": "One-pager",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Pricing & packaging summary",
          "desc": "A clear, shareable view of how Flex Work is packaged and priced, with what is included at each tier.",
          "use": "Give late-stage buyers something concrete to circulate internally.",
          "outline": [
            "Packaging and tiers",
            "What is included at each tier",
            "Typical program sizing",
            "How to request a quote"
          ]
        }
      ]
    },
    {
      "n": 5,
      "eyebrow": "Stage 5 · Onboarding & expansion",
      "title": "Make me successful, then grow with me",
      "mindset": "I signed. Get me live fast, prove the value, and show me what is next.",
      "goal": "Drive adoption, demonstrate realised value, open expansion and advocacy.",
      "items": [
        {
          "id": "onboarding-playbook",
          "slug": "onboarding-playbook",
          "fam": "doc",
          "format": "Playbook",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Onboarding quick-start playbook",
          "desc": "A first-90-days guide for the new customer team: setup, supplier onboarding and early wins.",
          "use": "Drive fast time-to-value that turns a signature into a renewal and a reference.",
          "outline": [
            "First 90 days plan",
            "Setup and supplier onboarding",
            "Early-win checklist",
            "Support and escalation paths"
          ]
        },
        {
          "id": "qbr-template",
          "slug": "qbr-template",
          "fam": "deck",
          "format": "Template",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Quarterly business review template",
          "desc": "A reusable QBR that ties usage and savings back to the ROI case the customer bought.",
          "use": "Keep realised value visible to the budget holder ahead of renewal.",
          "outline": [
            "Usage and adoption snapshot",
            "Realised savings vs the original ROI case",
            "Roadmap and asks",
            "Expansion opportunities"
          ]
        },
        {
          "id": "expansion-one-pagers",
          "slug": "expansion-one-pagers",
          "fam": "doc",
          "format": "One-pager set",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Expansion one-pagers",
          "desc": "Targeted sheets for adding suppliers, new regions, or an MSP layer to an existing program.",
          "use": "Introduce the next purchase cleanly at the right moment.",
          "outline": [
            "Add suppliers",
            "Add regions",
            "Add an MSP layer",
            "The business case for each"
          ]
        },
        {
          "id": "advocacy-kit",
          "slug": "advocacy-kit",
          "fam": "proof",
          "format": "Kit",
          "status": "soon",
          "updated": "2026-06-02",
          "title": "Customer advocacy & referral kit",
          "desc": "Everything to turn a happy customer into a reference, case study or referral source.",
          "use": "Convert today's success into tomorrow's awareness and decision-stage proof.",
          "outline": [
            "Reference call guidelines",
            "Case study consent and template",
            "Referral program details",
            "Awards and speaking opportunities"
          ]
        }
      ]
    }
  ]
};
