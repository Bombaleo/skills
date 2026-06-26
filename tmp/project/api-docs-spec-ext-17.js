/* =====================================================================
   Flex Work API · spec extension (part 17 — rate engine preview)
   ---------------------------------------------------------------------
   Closes the Rate Engine Recommendations P2 task "Document the engine
   in the API spec — POST /rate-engine/preview".

   Exposes the in-product computeBillRate(row, config, ctx) engine as a
   documented endpoint so procurement analytics and finance ETL can
   recompute a bill rate without copying the staged math. Takes a row
   (id or inline), a pricing-config id, and a context object; returns
   the same { pay, components[], bill, thresholds } shape the engine
   produces in-app — components[] ordered, running-subtotalled,
   visibility-tagged.

   No new schema tables — the engine reads JobRequisition / Position
   pay data and the bound PricingConfiguration's typed rule set. Loads
   AFTER ext-16; adds one endpoint under the existing "pricing" tag.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }

  add(
    { id: "rate_engine_preview", tag: "pricing",
      method: "POST", path: "/rate-engine/preview",
      name: "Preview a computed bill rate",
      summary: "Run the bill-rate engine against a rate-card row and a pricing configuration without writing anything. Returns the resolved pay, the ordered component build-up with a running subtotal at each step, the final bill rate, and any program-threshold breach.",
      detail:
        "This is the documented face of the in-product engine (computeBillRate). The engine stacks, in order: base pay → time/day/holiday premiums → employer contributions (NI, pension, FICA) → skill premiums (filtered by the row's skillIds) → tenure band (resolved against ctx.workerTenureDays) → markup (honoring the rule's `basis`: pay vs subtotal vs running) → taxes on the final bill. Each component carries a `visibility` of \"shared\" or \"internal\" — supplier-facing integrations should request role=agency to strip the internal markup and tax layers. Rate-types are honored: a `coefficient` row multiplies pay by a stored factor, a `derivedFrom` row bases off a named sibling row × a factor (holiday = regular × 1.5) so differentials are never authored as duplicates. When the bound configuration carries a `threshold` ({ ceilingBill, marginFloor }), the response's `thresholds` block reports any breach. Effective-dated rules resolve to the version active at ctx.date.",
      body: {
        schema: [
          { name: "rowId",   type: "string<ulid>", required: false, desc: "Rate-card row (Position) to price. Provide this OR `row`." },
          { name: "row",     type: "object",       required: false, desc: "Inline row when no stored id exists: { payRate, payRatePref?, classification?, skillIds?[], positionMarkup?, rateType?, coefficient?, derivedFrom? }." },
          { name: "configId", type: "string<ulid>", required: true, desc: "Pricing configuration to apply (pc-001 … pc-006). The engine reads its live typed rule set." },
          { name: "ctx",     type: "object",       required: false, desc: "Calc context: { date?, shift?: regular|night|weekend|holiday, isHoliday?, country?, currency?, workerTenureDays?, districtMarkup? }. Defaults: today, regular, no holiday." },
          { name: "role",    type: "enum",         required: false, desc: "Viewer role. agency strips internal (markup/tax) components.", enum: ["buyer", "agency"] }
        ],
        example: {
          row: { payRate: 28, payRatePref: 28, skillIds: ["icu"], positionMarkup: 0 },
          configId: "pc-005",
          ctx: { date: "2026-06-01", shift: "night", country: "GB", currency: "GBP", workerTenureDays: 30, districtMarkup: 25 },
          role: "buyer"
        }
      },
      responses: [
        { status: 200, schema: "RateEnginePreview", desc: "Resolved pay, ordered components, final bill, and threshold status." },
        { status: 404, schema: "Error", desc: "Row id or configuration not found." },
        { status: 422, schema: "Error", desc: "Neither rowId nor row supplied, or the configuration has no active rules." }
      ],
      responseExample: {
        pay: 28,
        bill: 56.98,
        currency: "GBP",
        components: [
          { id: "base-0",         stage: "base",         label: "Base pay",                     pct: null, amount: 28.00, runningSubtotal: 28.00, basis: "pay",      visibility: "shared" },
          { id: "premium-1",      stage: "premium",      label: "Night shift premium",          pct: 15,   amount: 4.20,  runningSubtotal: 32.20, basis: "pay",      visibility: "shared" },
          { id: "contribution-2", stage: "contribution", label: "Employer national insurance",  pct: 13.8, amount: 4.44,  runningSubtotal: 36.64, basis: "pay",      visibility: "shared" },
          { id: "contribution-3", stage: "contribution", label: "Pension contribution",         pct: 3,    amount: 1.10,  runningSubtotal: 37.74, basis: "pay",      visibility: "shared" },
          { id: "skill-4",        stage: "skill",        label: "ICU certification",            pct: 8,    amount: 2.24,  runningSubtotal: 39.98, basis: "pay",      visibility: "shared" },
          { id: "tenure-5",       stage: "tenure",       label: "First 90 days adjustment",     pct: -5,   amount: -2.00, runningSubtotal: 37.98, basis: "pay",      visibility: "shared" },
          { id: "markup-6",       stage: "markup",       label: "District markup",              pct: 25,   amount: 9.50,  runningSubtotal: 47.48, basis: "subtotal", visibility: "internal" },
          { id: "tax-7",          stage: "tax",          label: "VAT",                          pct: 20,   amount: 9.50,  runningSubtotal: 56.98, basis: "running",  visibility: "internal" }
        ],
        thresholds: { breached: false, by: null, ceilingBill: 72, marginFloor: 14 }
      } }
  );

  /* Register the response schemas so the renderer's schema index resolves
     the RateEnginePreview / RateComponent references. `spec.schemas` is a
     keyed object map, not an array. */
  if (spec.schemas && !spec.schemas.RateEnginePreview) {
    spec.schemas.RateEnginePreview = {
      description: "Output of POST /rate-engine/preview — the engine's resolved bill rate with its ordered component build-up.",
      fields: [
        { name: "pay",        type: "number",          required: true,  desc: "Resolved base pay before any layer." },
        { name: "bill",       type: "number",          required: true,  desc: "Final bill rate after every stage." },
        { name: "currency",   type: "string<ISO4217>", required: false, desc: "Currency the rate is expressed in." },
        { name: "components", type: "RateComponent[]", required: true,  desc: "Ordered build-up; each carries a running subtotal." },
        { name: "thresholds", type: "object",          required: false, desc: "{ breached, by, ceilingBill, marginFloor, overBy?, marginPct? } from the bound configuration." }
      ]
    };
    spec.schemas.RateComponent = {
      description: "One layer of a computed bill rate.",
      fields: [
        { name: "id",              type: "string",  required: true,  desc: "Stable per-result component id (stage + index)." },
        { name: "stage",           type: "enum",    required: true,  desc: "Engine stage.", enum: ["base", "premium", "contribution", "skill", "tenure", "markup", "tax"] },
        { name: "label",           type: "string",  required: true,  desc: "Human label from the rule that produced the layer." },
        { name: "pct",             type: "number",  required: false, desc: "Percentage applied, or null for the base amount." },
        { name: "amount",          type: "number",  required: true,  desc: "Currency delta this layer added." },
        { name: "runningSubtotal", type: "number",  required: true,  desc: "Cumulative rate through this layer." },
        { name: "basis",           type: "enum",    required: true,  desc: "What the layer applies to.", enum: ["pay", "subtotal", "running"] },
        { name: "visibility",      type: "enum",    required: true,  desc: "shared layers show to suppliers; internal (markup, tax) are buyer-only.", enum: ["shared", "internal"] }
      ]
    };
  }
})();
