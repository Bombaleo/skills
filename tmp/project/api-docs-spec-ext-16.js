/* =====================================================================
   Flex Work API · spec extension (part 16 — contractor lifecycle events)
   ---------------------------------------------------------------------
   Registers the nine contractor-lifecycle event types on the existing
   webhook event catalog so external systems (Dayforce HR for the
   convert-to-employee handoff, AP / Procurement for invoice paid,
   IC Compliance for classification changes) can subscribe.

   No new endpoint, no new schema — these are spec entries on top of
   the existing /webhooks and /webhooks/events surfaces shipped in
   api-docs-spec.js + api-docs-spec-ext-2.js. The contractor-config.jsx
   surface in Settings → Configuration → IC program already advertises
   these events as "always on" outbound webhooks; this extension makes
   the same statement true in the developer-facing API reference.

   Closes the last open task in
   `Flex Work - Contractors parity tasks.html` (Shared infrastructure →
   Webhook catalog · contractor lifecycle).
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  function findEp(id) { return (spec.paths || []).find(function (p) { return p.id === id; }); }

  /* ------ 1 · Extend /webhooks/events responseExample -------------- */
  // The events_list endpoint ships in api-docs-spec-ext-2.js with a
  // hand-picked list of the most common subscriptions. Append the
  // contractor lifecycle so an integrator browsing the catalog sees
  // them alongside the rest.
  var CONTRACTOR_EVENTS = [
    { type: "contractor.created",                payloadSchema: "Contractor",          retryUpToHours: 72,
      desc: "A new independent contractor was added via the Add Contractor wizard or imported via /contractors POST. Fires after onboarding step 6 (Review) commits." },
    { type: "contractor.invited",                payloadSchema: "ContractorAgreement", retryUpToHours: 72,
      desc: "The contractor was sent their first engagement invite. Payload includes the draft agreement so downstream systems can pre-stage workspace access." },
    { type: "contractor.classification_changed", payloadSchema: "Contractor",          retryUpToHours: 72,
      desc: "The IRS 20-factor / ABC test re-emitted a different risk score, or an IC Compliance Officer manually re-classified. Fires on any movement across the 35 (review) or 60 (at-risk) thresholds." },
    { type: "contractor.agreement_signed",       payloadSchema: "ContractorAgreement", retryUpToHours: 72,
      desc: "Contractor countersigned the MSA + SOW packet (or a renewal) through the e-Sig connector. Sets agreement.status = 'Countersigned' and agreement.signed = today." },
    { type: "contractor.agreement_expiring",     payloadSchema: "ContractorAgreement", retryUpToHours: 72,
      desc: "Daily sweep — fires for every agreement crossing the 60 / 30 / 7-day windows. Subscribers can drive automated renewal nudges or upstream pre-approval." },
    { type: "contractor.invoice_submitted",      payloadSchema: "ContractorInvoice",   retryUpToHours: 72,
      desc: "Contractor submitted a new invoice through the portal (typed, uploaded, or auto-generated from approved time). Approval routing runs server-side after the webhook fires." },
    { type: "contractor.invoice_paid",           payloadSchema: "ContractorInvoice",   retryUpToHours: 72,
      desc: "Approved invoice was disbursed through the configured mass-payment connector. Payload carries the payout reference and the settled currency / amount pair." },
    { type: "contractor.year_end_filed",         payloadSchema: "ContractorTaxFiling", retryUpToHours: 72,
      desc: "Year-end Tax Wizard submitted a per-contractor 1099-NEC / 1042-S / T4A via the 1099 e-file connector. Payload includes the filingId returned by the provider." },
    { type: "contractor.converted_to_employee",  payloadSchema: "Contractor",          retryUpToHours: 72,
      desc: "Convert-to-employee workflow completed. Subscribers (Dayforce HR onboarding) can pre-fill the employee record from identity, address, banking, and tax form already on file." }
  ];

  var eventsList = findEp("events_list");
  if (eventsList && Array.isArray(eventsList.responseExample)) {
    var existing = eventsList.responseExample.map(function (e) { return e.type; });
    CONTRACTOR_EVENTS.forEach(function (ev) {
      if (existing.indexOf(ev.type) === -1) eventsList.responseExample.push(ev);
    });
    // Detail block on the same endpoint so the docs page surfaces a
    // pointer to the contractor lifecycle without making readers
    // scroll the example.
    eventsList.detail = (eventsList.detail || "")
      + "\n\nThe contractor lifecycle (`contractor.*`) emits nine events covering create / invite / classification / signature / expiry / invoice / payment / year-end / conversion. These are auto-registered on every tenant that has the `contractors` feature flag on — no per-event opt-in required.";
  }

  /* ------ 2 · Add a sample contractor-lifecycle subscription ------- */
  // The hk_list endpoint ships an example response that's purely
  // requisition-oriented today. Append a second row so an integrator
  // copy-pasting from the docs gets a working contractor template.
  var hkList = findEp("hk_list");
  if (hkList && hkList.responseExample) {
    var rows = Array.isArray(hkList.responseExample)
      ? hkList.responseExample
      : (Array.isArray(hkList.responseExample.data) ? hkList.responseExample.data : null);
    if (rows && !rows.some(function (r) { return (r.events || []).indexOf("contractor.created") !== -1; })) {
      rows.push({
        id: "01HZXHK002CONTRACTORLIFECYCLE",
        url: "https://api.dayforce.com/integrations/flexwork/contractor-hooks",
        events: [
          "contractor.created",
          "contractor.invited",
          "contractor.classification_changed",
          "contractor.agreement_signed",
          "contractor.agreement_expiring",
          "contractor.invoice_submitted",
          "contractor.invoice_paid",
          "contractor.year_end_filed",
          "contractor.converted_to_employee"
        ],
        active: true,
        secretLastRotatedAt: "2026-05-01T08:00:00Z",
        lastDeliveryAt: "2026-05-28T09:14:22Z",
        lastDeliveryStatus: 200
      });
    }
  }

  /* ------ 3 · Schema stubs for the two payload shapes -------------- */
  // ContractorTaxFiling is referenced by contractor.year_end_filed but
  // doesn't otherwise exist in the schema catalog. Ship a lightweight
  // entry so the docs page renders a payload preview when a reader
  // expands the event row.
  if (spec.schemas && !spec.schemas.ContractorTaxFiling) {
    spec.schemas.ContractorTaxFiling = {
      description: "A single year-end tax filing emitted by the IC Compliance Hub's Year-end Tax Wizard. One row per contractor per form per year.",
      fields: [
        { name: "id",            type: "string<ulid>", required: true,  desc: "Filing identifier." },
        { name: "contractorId",  type: "string<ulid>", required: true,  desc: "The contractor this filing is for." },
        { name: "year",          type: "integer",       required: true,  desc: "Tax year (e.g. 2025)." },
        { name: "form",          type: "enum",          required: true,  desc: "Tax form filed.", enum: ["1099-NEC", "1099-MISC", "1042-S", "T4A"] },
        { name: "amount",        type: "number<money>", required: true,  desc: "Reportable compensation (Box 1 for 1099-NEC)." },
        { name: "currency",      type: "string<currency>", required: true, desc: "ISO 4217 currency code." },
        { name: "provider",      type: "enum",          required: true,  desc: "Year-end e-file connector that submitted the filing.", enum: ["Track1099", "Tax1099", "Avalara 1099", "Native Dayforce Tax"] },
        { name: "filingId",      type: "string",        required: true,  desc: "Confirmation id returned by the provider." },
        { name: "filedAt",       type: "string<datetime>", required: true, desc: "When the provider acknowledged receipt." },
        { name: "sentToContractor", type: "boolean",    required: false, desc: "Whether a copy was emailed to the contractor (matches sendCopyToContractor setting)." }
      ]
    };
  }

  /* ------ 4 · Enrich the wf_list seeded workflows with one IC chain  */
  // Workflow definitions in ext-8 list approval chains for
  // requisitions / timesheets / expenses. Add a one-row note that the
  // contractor approval router shipped via /config — purely
  // documentation so a developer doesn't write a custom chain
  // unaware of the built-in.
  var wfList = findEp("wf_list");
  if (wfList && wfList.responseExample && Array.isArray(wfList.responseExample.data)) {
    var hasIc = wfList.responseExample.data.some(function (w) { return w.id && String(w.id).indexOf("CONTRACTOR") !== -1; });
    if (!hasIc) {
      wfList.responseExample.data.push({
        id: "01HZXWF000CONTRACTORINVITE0001",
        name: "Contractor invite — risk + spend router",
        triggers: ["contractor.created", "contractor.invited"],
        stages: [
          { role: "Hiring manager",        sla: "auto",   autoApprove: true },
          { role: "IC Compliance Officer", sla: "2 days", condition: "riskScore >= 35" },
          { role: "Finance",               sla: "3 days", condition: "annualSpend >= $50,000" },
          { role: "Legal",                 sla: "5 days", condition: "annualSpend >= $100,000" }
        ],
        managedBy: "platform",
        owner: "Settings → Configuration → IC program → Approval"
      });
    }
  }
})();
