// =====================================================================
// Flex Work — Internal Help Center · Onboarding guides
//   Five implementation playbooks, one per common program shape.
//   Each playbook lays out phases (with day-counts), a configuration
//   checklist, and the pitfalls implementations actually hit.
//   Loaded into window.HC_ONBOARDING; consumed by help-center.jsx.
// =====================================================================

window.HC_ONBOARDING = [
  // ---- 1. Frontline-only program (6-week launch) ---------------------
  {
    id: "frontline-only",
    name: "Frontline-only program",
    duration: "6-week launch",
    audience: "Hospitality, retail, light industrial, warehousing",
    owner: "Marcus Bell · Implementation, frontline",
    updated: "2026-05-18",
    summary: "The fastest program shape we ship. Pure shift work, one or two job classes per location, supplier-attested workers, weekly bill cycle. The 6-week shape assumes a single country, a single legal entity, fewer than 50 supplier accounts, and a manager population already trained on a previous VMS or staffing system. Add a week per country and per legal entity beyond the first.",
    phases: [
      {
        label: "Week 1",
        title: "Discovery + data load",
        body: "Org-tree import (locations, divisions, cost centers), job-class catalog, rate-card v1, manager + supplier user list. Kick off the supplier paperwork track in parallel — MSAs are the long pole.",
      },
      {
        label: "Week 2",
        title: "Configuration",
        body: "Engagement type = Frontline. Distribution rule = tiered (Tier 1 / Tier 2 / Tier 3, 15-min / 30-min holds). Timesheet template = single-approver site. Approval workflow = manager-only under $X, manager + director above. Pay rules from Dayforce HCM if available, otherwise from the rate-card.",
      },
      {
        label: "Week 3",
        title: "Pilot site",
        body: "One location goes live. Sized to be 5–10% of program volume. Manager training runs in parallel — 45 min for shift creation, 30 min for timesheet approval. Supplier onboarding finishes for that location's tier-1 suppliers only.",
      },
      {
        label: "Week 4",
        title: "Pilot adjust",
        body: "Real-world tuning: tier-hold timings (usually too long on first config), distribution rule edge cases, approval bottlenecks. Pull a fill-rate / time-to-fill report at end-of-week; if either is materially worse than the pre-VMS baseline, do not advance.",
      },
      {
        label: "Week 5",
        title: "Rollout wave 1",
        body: "Remaining locations on. Stagger by 5-location waves with a 24-hour gap so the support desk can absorb question volume. Tier 2/3 suppliers onboard during this week.",
      },
      {
        label: "Week 6",
        title: "Cutover + hypercare",
        body: "Legacy system goes read-only. First full invoice cycle runs end-to-end. Hypercare staffing for two weeks post-cutover — daily standup with the customer's program lead, 4-hour SLA on any reported defect.",
      },
    ],
    checklist: [
      "Org tree imported and approved by the customer's HR data steward",
      "Job-class catalog mapped to existing JIB / SIC / SOC codes",
      "Rate-card v1 signed off by sourcing AND finance",
      "Distribution rule v1 reviewed by every site's lead supplier",
      "Approval workflow tested against four real historical requisitions",
      "Supplier MSAs signed for tier-1 suppliers at the pilot location",
      "Manager training delivered to >90% of the pilot population",
      "Pre-VMS baseline numbers captured for fill rate, time-to-fill, no-show",
      "Hypercare on-call rotation confirmed for cutover week + 2",
    ],
    pitfalls: [
      "Rate-card sign-off is the most-cited cause of slippage. Get sourcing + finance into the same room in week 1, not week 3.",
      "Distribution rule v1 is usually too generous to the customer's incumbent supplier. Plan for a re-tune in week 4.",
      "Manager training delivered as a recording instead of live. Live is 3x better for adoption.",
      "Supplier tier-2 onboarding deferred to 'after cutover'. They will not onboard; you will be re-broadcasting manually for months.",
      "Pilot location chosen for political reasons (the loudest manager) instead of operational reasons (mid-volume, average complexity).",
    ],
  },

  // ---- 2. Professional + SOW program (10-week launch) ---------------
  {
    id: "professional-sow",
    name: "Professional + SOW program",
    duration: "10-week launch",
    audience: "Consulting, engineering, IT services, agency creative",
    owner: "Ines Aleko · Implementation, professional",
    updated: "2026-05-08",
    summary: "Slower than frontline because the work itself is more complex — submittals, panels, contracts, milestone billing, IP terms. The 10-week shape assumes a buyer with an existing professional-services SOW catalog, a finance team already running an ERP, and fewer than 200 active engagements at cutover. Pure-SOW programs (no time-and-materials assignments) can run a 2-week shorter shape.",
    phases: [
      {
        label: "Weeks 1–2",
        title: "Discovery + paperwork",
        body: "MSA / SOW template inventory, IP-clause review, skills catalog (skills, levels, certifications), rate bands by skill level, approval matrix (legal + finance + sponsor). Engage legal early — IP terms are the long pole in professional, not commercial terms.",
      },
      {
        label: "Weeks 3–4",
        title: "Configuration",
        body: "Engagement type = Professional + SOW. Intake = multi-step (skills, screening questions, rate band, panel). Distribution = submittal queue (no auto-broadcast). Timesheet = project-coded with milestone optional. Approval = legal + finance + sponsor in parallel for SOW; manager + finance sequential for assignments.",
      },
      {
        label: "Weeks 5–6",
        title: "Supplier + worker pilot",
        body: "Three to five preferred suppliers onboard. They run 5–10 real submittals against test requisitions to validate the panel + scoring flow end-to-end. Existing in-flight engagements DO NOT move yet — they finish on the legacy system.",
      },
      {
        label: "Weeks 7–8",
        title: "Cutover by category",
        body: "Move one professional category at a time (e.g. 'IT contractors' first, then 'Marketing creatives', then 'Engineering consultants'). Each category gets a 1-week cutover window with the prior category as hypercare. New engagements go to Flex Work; in-flight engagements stay on legacy until natural end.",
      },
      {
        label: "Week 9",
        title: "SOW + milestone billing",
        body: "First SOW invoices run through Flex Work end-to-end — milestone acceptance, IP-clause attestation, finance approval, ERP post. This is where most programs find the gap between the SOW template they designed and the SOW template their suppliers actually use.",
      },
      {
        label: "Week 10",
        title: "Reconciliation + hypercare",
        body: "Reconcile any cross-system spend (legacy in-flight + Flex Work new) against the customer's finance close. Hypercare for the first full close cycle.",
      },
    ],
    checklist: [
      "MSA + SOW templates approved by customer legal",
      "IP-clause variants catalogued (work-for-hire, joint-IP, license-back)",
      "Skills catalog mapped to the customer's existing competency model",
      "Rate bands by skill level signed off by sourcing + finance",
      "Submittal queue routing tested with 5 historical reqs per category",
      "Three preferred suppliers committed to the pilot — paperwork done",
      "Panel-scoring rubric customized per category",
      "ERP integration tested with milestone + T&M invoice samples",
      "Legacy in-flight engagement count documented (no migration)",
    ],
    pitfalls: [
      "Legal pushed to week 4 instead of week 1. Legal is the longest pole on every professional program.",
      "Skills catalog imported from an HR competency model that was never used. Validate by walking 10 real submittals before going live.",
      "Pilot suppliers chosen for relationship instead of for category fit. The IT consulting champion supplier is the wrong pilot for a marketing-creative category.",
      "Forcing in-flight engagements to migrate at cutover. Let them finish on legacy; the political cost outweighs the operational benefit.",
      "Finance not invited to the SOW template review. The supplier's invoice will reveal a template gap that legal already signed off on.",
    ],
  },

  // ---- 3. MSP-managed transition (12-week cutover) ------------------
  {
    id: "msp-transition",
    name: "MSP-managed transition",
    duration: "12-week cutover",
    audience: "Programs moving from another VMS to Flex Work with an MSP partner",
    owner: "Marcus Bell · Implementation, frontline",
    updated: "2026-05-14",
    summary: "Replacing an incumbent VMS in a live program is the highest-risk shape we ship. Suppliers have to re-onboard, workers' time has to bridge the cutover cleanly, and the MSP partner has its own service-level commitments to the buyer that don't pause for our convenience. The 12-week shape assumes a single MSP, a single program, and an incumbent VMS we have spec for (Beeline, Fieldglass, VNDLY, or a custom build).",
    phases: [
      {
        label: "Weeks 1–2",
        title: "MSP alignment",
        body: "The MSP is co-owner of this implementation, not a stakeholder. Establish the joint steering committee (Dayforce + MSP + customer program lead), the joint runbook, and the dispute path. Confirm which SLAs survive cutover and which renegotiate.",
      },
      {
        label: "Weeks 3–4",
        title: "Data migration design",
        body: "Map every entity in the incumbent VMS to a Flex Work entity. Spec the migration cuts: open requisitions (always migrate), in-flight bookings (migrate if scheduled past cutover), worker records (always migrate), historical timesheets (migrate read-only).",
      },
      {
        label: "Weeks 5–6",
        title: "Supplier re-onboarding",
        body: "Every supplier on the incumbent migrates with a paperwork-light path — Flex Work account + MSA-by-reference if their existing MSA covers it. Suppliers who refuse to re-onboard get a 60-day notice; they are not blockers.",
      },
      {
        label: "Weeks 7–8",
        title: "Parallel-run setup",
        body: "Configure Flex Work with the migrated data; run it shadow against the incumbent for 2 weeks. Compare fill rate, time-to-fill, and invoice totals daily. If parallel-run reveals a delta >5%, do not advance.",
      },
      {
        label: "Weeks 9–10",
        title: "Cutover",
        body: "Hard cutover. Incumbent goes read-only at end of business Friday; Flex Work goes live Monday morning. Saturday + Sunday for data integrity checks. MSP runs joint hypercare with Dayforce for the first 48 hours.",
      },
      {
        label: "Weeks 11–12",
        title: "Stabilize + close-out",
        body: "Two-week hypercare with daily standup. End-of-period reconciliation against the incumbent's final-week numbers. MSP signs off on go-forward, incumbent contract terminates per the 60-day notice.",
      },
    ],
    checklist: [
      "MSP signed onto a joint implementation runbook",
      "Incumbent VMS export validated (open reqs, bookings, workers, invoices)",
      "Migration mapping signed off by both Dayforce + MSP",
      "Supplier re-onboarding paperwork prepped (MSA-by-reference template)",
      "Parallel-run dashboard built — fill rate, TTF, invoice total per day",
      "Cutover weekend on-call rotation locked (Dayforce + MSP + customer)",
      "Incumbent 60-day termination notice queued (don't send early)",
      "Worker communications plan approved by the MSP",
      "Hypercare SLA agreed in writing — 1-hour first response, 4-hour resolution",
    ],
    pitfalls: [
      "Treating the MSP as a vendor instead of a co-owner. They will throttle cutover if you do.",
      "Suppliers told to 'just log into the new system' without paperwork support. They won't.",
      "Parallel-run skipped to save 2 weeks. The 5% delta you would have caught will show up as a $200k invoice reconciliation in week 13.",
      "Cutover scheduled at quarter-end. Don't.",
      "Termination notice to the incumbent sent in week 5. They lose motivation to support migration; cutover slips.",
    ],
  },

  // ---- 4. Agency tenant onboarding (4-week launch) ------------------
  {
    id: "agency-tenant",
    name: "Agency tenant onboarding",
    duration: "4-week launch",
    audience: "Staffing agencies operating Flex Work themselves",
    owner: "Anika Sundqvist · CS, EMEA",
    updated: "2026-04-30",
    summary: "An agency tenant is the supplier side of the platform run as a system of record for the agency itself. They sit on the supplier side of every transaction but use Flex Work to manage their own workforce, schedule their workers across buyer programs, and bill out to multiple buyers. The 4-week shape is fast because the configuration surface is smaller — no buyer-side approval workflows, no internal org-tree, no in-house pay rules.",
    phases: [
      {
        label: "Week 1",
        title: "Tenant + identity setup",
        body: "Provision the agency tenant, configure SSO against the agency's IDP, load their internal staff as users (dispatchers, account managers, finance, ops leads). Configure the buyer-program list — every buyer they bill out to is a 'program' in the tenant.",
      },
      {
        label: "Week 2",
        title: "Worker + skill data load",
        body: "Import the agency's existing worker roster with skills, certifications, location preferences, availability defaults. Map their internal job-class taxonomy to the Flex Work standard taxonomy so cross-program reporting works.",
      },
      {
        label: "Week 3",
        title: "Buyer integrations",
        body: "Connect to each buyer program's Flex Work tenant via the supplier-distribution channel. For non-Flex-Work buyers, configure inbound feeds (email-parse, API, or manual entry). Test with 3 real requisitions per buyer.",
      },
      {
        label: "Week 4",
        title: "Go-live + first bill cycle",
        body: "Agency staff stop using their legacy system; all new work routes through Flex Work. First full bill cycle runs at end of week. Reconcile against the legacy system's parallel-run for the same period.",
      },
    ],
    checklist: [
      "SSO configured against the agency's IDP",
      "User list loaded with role-appropriate permissions",
      "Worker roster imported and validated (no duplicate IDs, no missing certs)",
      "Skill + job-class mapping signed off",
      "Buyer-program list complete (every billable buyer represented)",
      "At least one test booking flowed end-to-end per buyer",
      "Invoice templates configured per buyer's required format",
      "Legacy system flagged for read-only after cutover (don't decommission yet)",
    ],
    pitfalls: [
      "Worker roster imported with stale availability defaults. Run a refresh cycle in week 2.",
      "Skill mapping done by IT instead of by the dispatchers who actually use the skills. Get dispatchers in the room.",
      "Buyer integrations done in sequence instead of in parallel. Parallelize from day one.",
      "Legacy system decommissioned in week 4. Keep it read-only for 90 days as the audit fallback.",
    ],
  },

  // ---- 5. Multi-country rollout (16-week sequence) ------------------
  {
    id: "multi-country",
    name: "Multi-country rollout",
    duration: "16-week sequence",
    audience: "Programs going live in 2+ countries with country-specific tax, pay, and compliance",
    owner: "Anika Sundqvist · CS, EMEA (with Wei Tan · APAC)",
    updated: "2026-04-15",
    summary: "Each country adds compliance weight, currency, and language. The 16-week sequence assumes one program shape (frontline OR professional, not both) replicating across 3–6 countries with one anchor country at week 0. The anchor country runs a normal launch shape on weeks 1–6; subsequent countries layer in at 2-week intervals from week 8.",
    phases: [
      {
        label: "Weeks 1–6",
        title: "Anchor country",
        body: "Pick the country with the most volume and the simplest regulatory profile as the anchor. Run a normal 6-week frontline launch (or 10-week professional shape, scaled). The anchor's configuration becomes the template subsequent countries inherit-and-override.",
      },
      {
        label: "Weeks 7–8",
        title: "Country 2 configuration",
        body: "Clone the anchor configuration; layer country-2 specifics — currency, tax engine (Vertex / Avalara), pay rules (overtime, holiday calendar, predictive scheduling), language (UI + supplier-facing copy), local compliance (right-to-work documents, data-residency).",
      },
      {
        label: "Weeks 9–10",
        title: "Country 2 go-live",
        body: "Compressed launch — discovery+config done, so it's pilot site + rollout in two weeks. Hypercare runs in parallel with the anchor's continuing hypercare.",
      },
      {
        label: "Weeks 11–12",
        title: "Country 3 + 4 in parallel",
        body: "If the country-2 launch held, countries 3 and 4 launch in parallel with shared discovery sessions. This is where multi-country programs find their stride — the configuration template is proven, the data-migration toolkit is hardened.",
      },
      {
        label: "Weeks 13–14",
        title: "Country 5 + 6",
        body: "Same shape as 3+4. By this point the customer's program team is running the launches themselves with Dayforce in advisory.",
      },
      {
        label: "Weeks 15–16",
        title: "Cross-country consolidation",
        body: "Spin up the consolidated reporting layer — one dashboard, multi-country fill rate, FX-normalized spend, diversity by country, compliance-event log. This is the deliverable the executive sponsor signed the contract for.",
      },
    ],
    checklist: [
      "Anchor country identified (highest volume + simplest regulatory profile)",
      "Tax engine selected — Vertex OR Avalara, not both",
      "Data-residency map drawn (which data lives where; cross-border allowances documented)",
      "Per-country pay-rule research completed (predictive scheduling, OT, holiday)",
      "Language pack scoped — UI + supplier-facing copy + worker-app copy",
      "Local legal contacts identified per country",
      "FX-normalized reporting target currency agreed (usually USD or EUR)",
      "Right-to-work document checklist per country",
      "Country-launch runbook proven on country 2 before paralleling",
    ],
    pitfalls: [
      "Anchor country picked for political reasons (HQ country) instead of operational (volume + simplicity). HQ is usually the wrong anchor.",
      "Single tax engine assumed to work in all 6 countries. Always test.",
      "Data-residency treated as a checkbox. It's the highest-risk legal exposure on the program.",
      "Local-language UI translated by central CS instead of by in-country CSMs. Quality is visibly different.",
      "Cross-country consolidation deferred to 'phase 2'. The executive sponsor will not see ROI without it.",
    ],
  },
];
