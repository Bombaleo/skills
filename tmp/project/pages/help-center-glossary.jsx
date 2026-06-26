// =====================================================================
// Flex Work — Internal Help Center · Glossary
//   Terms a Dayforce employee on a Flex Work call should never have to
//   look up mid-meeting. Grouped into categories so the page scans
//   well; terms link from feature prose via the auto-linker (T-08).
//   Loaded into window.HC_GLOSSARY.
// =====================================================================

window.HC_GLOSSARY = {
  owner: "Priya Anand · CS, NA",
  updated: "2026-05-25",
  groups: [
    // ---- Program shapes -------------------------------------------
    {
      id: "program-shapes",
      title: "Program shapes",
      summary: "The named ways a contingent program can be structured. Most enterprise programs are a hybrid; the shape names below describe the dominant pattern.",
      terms: [
        { term: "VMS", expansion: "Vendor Management System", body: "The software category Flex Work competes in. Manages the requisition, distribution, schedule, timesheet, and invoice lifecycle for non-employee work." },
        { term: "MSP", expansion: "Managed Services Provider", body: "A third party that administers a contingent program on behalf of a buyer — supplier governance, scorecards, sometimes day-of ops. The MSP can be a Dayforce partner or a competing service like Magnit." },
        { term: "RPO", expansion: "Recruitment Process Outsourcing", body: "Adjacent to but distinct from a VMS — an RPO sources permanent hires. Some programs blend RPO + VMS into a 'total talent' offering." },
        { term: "EOR", expansion: "Employer of Record", body: "The legal entity that employs a worker — important for global hires where the buyer doesn't have an in-country entity. Flex Work supports buyer-as-EOR, supplier-as-EOR, and Dayforce-as-EOR patterns." },
        { term: "AOR", expansion: "Agent of Record", body: "A staffing agency that holds the relationship with the worker on behalf of the buyer. Less common in modern programs; mostly a 1099-IC concept." },
        { term: "Total talent", expansion: null, body: "A program shape that unifies permanent and contingent hiring under one operating model. Often paired with an HRIS + RPO + VMS stack." },
        { term: "Direct sourcing", expansion: null, body: "The buyer sources their own workers (alumni, boomerangs, referrals) without an agency intermediary. Workers are managed in a talent pool inside the VMS." },
      ],
    },

    // ---- Engagement types -----------------------------------------
    {
      id: "engagement-types",
      title: "Engagement types",
      summary: "The legal and operational shape of a worker's relationship to the buyer.",
      terms: [
        { term: "Agency worker", expansion: null, body: "A W-2 employee of a staffing agency placed at a buyer site. Most common engagement type in frontline programs." },
        { term: "IC / 1099", expansion: "Independent contractor", body: "A worker who is their own legal entity. Tax form is a W-9 (US) or W-8BEN (non-US). Subject to IC-classification rules (AB-5 in California, similar elsewhere)." },
        { term: "EOR worker", expansion: null, body: "A worker employed by a third-party EOR; the buyer engages the EOR commercially. Used for global hires without an in-country buyer entity." },
        { term: "SOW resource", expansion: null, body: "A worker named on a Statement of Work. Time + expense rolls up to the SOW invoice; the SOW (not the worker) is the unit of contracting." },
        { term: "Direct-source worker", expansion: null, body: "A worker the buyer sourced without an agency — alumni, boomerang, referral. Onboarded directly into the talent pool." },
      ],
    },

    // ---- Contracting + paperwork --------------------------------
    {
      id: "contracting",
      title: "Contracting & paperwork",
      summary: "The documents that govern who can work, on what terms, and who owes whom what.",
      terms: [
        { term: "SOW", expansion: "Statement of Work", body: "A contract for a defined piece of professional work — deliverables, milestones, IP terms, fixed-fee or time-and-materials schedule. The unit of contracting on the SOW shape." },
        { term: "MSA", expansion: "Master Services Agreement", body: "The umbrella commercial agreement between the buyer and a supplier. Specific engagements are governed by SOWs or work orders under the MSA." },
        { term: "NTE", expansion: "Not-to-exceed", body: "A spend cap on a SOW. Time + materials engagements often run as 'T&M not to exceed $X'." },
        { term: "W-9", expansion: null, body: "US tax form collected from independent contractors to capture taxpayer ID. Required before paying an IC; gates onboarding in Flex Work." },
        { term: "W-8BEN", expansion: null, body: "Non-US equivalent of W-9. Collected from non-US ICs being paid by a US buyer; required for tax withholding compliance." },
        { term: "I-9", expansion: null, body: "US employment-eligibility form. Workers (not ICs) need a verified I-9 before they can work. E-Verify integrates here." },
      ],
    },

    // ---- Operational mechanics --------------------------------
    {
      id: "operational",
      title: "Operational mechanics",
      summary: "How work moves through the program.",
      terms: [
        { term: "Tier-and-hold", expansion: null, body: "A distribution pattern that gives top-tier suppliers an exclusive window on each requisition before lower tiers see it. The hold duration (typically 15–30 minutes) is the lever programs tune." },
        { term: "Broadcast", expansion: null, body: "Sending an open requisition to a set of suppliers. Can be flat (all at once) or tiered (sequential)." },
        { term: "Submittal", expansion: null, body: "A candidate a supplier proposes for an open requisition. Standard in professional programs; rare in frontline." },
        { term: "Clopen", expansion: null, body: "A shift that closes a location followed by a shift that opens the location — often the same worker on back-to-back shifts with insufficient rest. Subject to fair-workweek rules in several jurisdictions." },
        { term: "No-show", expansion: null, body: "A worker accepted for a shift who doesn't appear. No-show rate is one of the three operational KPIs frontline programs track (alongside fill rate and time-to-fill)." },
        { term: "Fill rate", expansion: null, body: "The percentage of approved requisitions filled within the program's SLA. The dominant operational KPI for frontline programs." },
        { term: "Time-to-fill", expansion: null, body: "Median elapsed time from requisition approval to shift accept. Tracked by job class and by supplier." },
        { term: "Tenure cap", expansion: null, body: "The maximum days a contingent worker can be on a program before a conversion-to-perm decision is required. Limits co-employment exposure." },
        { term: "Redeployment", expansion: null, body: "Re-engaging a worker who has worked the program before, instead of sourcing fresh. Highest-leverage operational lever — every percentage point of redeployment cuts time-to-fill ~10%." },
      ],
    },

    // ---- Compliance + risk --------------------------------------
    {
      id: "compliance",
      title: "Compliance & risk",
      summary: "Concepts that matter for audit, legal, and regulatory exposure.",
      terms: [
        { term: "Co-employment", expansion: null, body: "The legal risk that a worker engaged through a supplier is treated as a joint employee of the buyer. Tenure caps + careful engagement-type management limit exposure." },
        { term: "Predictive scheduling", expansion: null, body: "City / state laws requiring advance notice of shifts and premium pay when shifts change last-minute. Active in Seattle, NYC, Philly, Oregon, others. Flex Work auto-detects and applies premiums." },
        { term: "Prevailing wage", expansion: null, body: "Federally-mandated minimum wage for public-sector and federally-funded construction projects. Davis-Bacon Act in the US. Card type ships in our Q4 roadmap." },
        { term: "Fair workweek", expansion: null, body: "The broader category of predictive-scheduling laws — covers schedule-change premiums, right-to-rest, clopen restrictions." },
        { term: "Right-to-work", expansion: null, body: "Employment-eligibility verification — I-9 in the US, equivalent documents in other countries. Hard block at booking time in Flex Work." },
        { term: "Primary-source verification", expansion: null, body: "Verifying a clinical credential directly with the issuing authority (NPDB, state board), not with a supplier-attested PDF. Required in clinical programs." },
        { term: "NPDB", expansion: "National Practitioner Data Bank", body: "Federal clearinghouse for clinical credential information. Direct pulls are part of our Q3 roadmap for clinical primary-source verification." },
      ],
    },

    // ---- Money + finance ---------------------------------------
    {
      id: "money",
      title: "Money & finance",
      summary: "How the program prices, bills, and accounts for work.",
      terms: [
        { term: "Bill rate", expansion: null, body: "The amount the buyer pays the supplier per hour of work. Set on the rate-card." },
        { term: "Pay rate", expansion: null, body: "The amount the supplier pays the worker. Lower than the bill rate; the gap is the supplier's markup." },
        { term: "Markup", expansion: null, body: "Bill rate minus pay rate, expressed as a percentage. Programs negotiate markup per supplier tier and per job class." },
        { term: "Pass-through", expansion: null, body: "A program where Flex Work runs the audit + compliance layer but applies no markup. Billed as a SaaS fee separately." },
        { term: "Credit note", expansion: null, body: "An invoice adjustment — most often issued when a timesheet is retroactively edited. Auto-generation is on our Q4 roadmap." },
        { term: "VAT", expansion: "Value-added tax", body: "Consumption tax applied in most non-US countries. Multi-country programs need a tax engine (Vertex / Avalara) to handle the long tail; our native engine is in the Q3 roadmap." },
        { term: "FX", expansion: "Foreign exchange", body: "Currency conversion for multi-currency programs. Best practice locks the FX rate at invoice generation, not at payment." },
      ],
    },

    // ---- People + supply ----------------------------------------
    {
      id: "supply",
      title: "People & supply",
      summary: "How the program governs its supplier base and its worker population.",
      terms: [
        { term: "Tier 1 / 2 / 3", expansion: null, body: "The performance tiers suppliers sit in. Tier 1 gets preferred distribution; Tier 3 is the long tail. Tiering is empirical (scorecard-driven) in mature programs." },
        { term: "Scorecard", expansion: null, body: "The metric set a supplier is graded on — fill rate, time-to-fill, no-show, dispute rate, diversity certification, contract status. Drives tier assignment." },
        { term: "Talent pool", expansion: null, body: "A saved set of workers a buyer can offer work to directly. Bypasses supplier broadcast for redeployment shifts." },
        { term: "QBR", expansion: "Quarterly Business Review", body: "The cadence at which suppliers and the buyer review program performance. Our Q4 roadmap auto-generates the QBR pack." },
        { term: "Diversity classification", expansion: null, body: "Certifications like MBE, WBE, DBE, VBE that mark a supplier as diverse-owned. Often paired with a spend-share target." },
      ],
    },
  ],
};
