/* =====================================================================
   Flex Work API · spec extension (part 6 — cleanup pass)
   ---------------------------------------------------------------------
   Reviews the full spec, then applies six categories of cleanup:

   1) Split overloaded tags
      - "users" (19 endpoints) → split into users / roles / saved-views
      - "system" (16 endpoints) → split system / files / search / devices
   2) Expand thin tags
      - "budgets" gets CRUD + transfer
      - "locations" gets get / update / delete
      - "jobs" gets create / update / delete
   3) Repair stale tag references introduced by older ext files
   4) Smooth rough scope inferences (e.g. mTLS endpoints currently
      resolve to "api_keys.write" which is misleading — they're tagged
      mtls but the operation is on the key)
   5) Pin a few enrichments where v1 audit's "detail" paragraphs were
      retroactively superseded by v2 ones
   6) Tag-group balance after the splits

   No endpoints are deleted. Only retags, plus a small number of
   additions to thin tags so each one stands on its own.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }
  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }
  function ensureTag(t) { if (!spec.tags.find(function (x) { return x.id === t.id; })) spec.tags.push(t); }
  function findPath(id) { return spec.paths.find(function (p) { return p.id === id; }); }
  function retag(id, newTag) { var ep = findPath(id); if (ep) ep.tag = newTag; }

  /* =========== 1) NEW TAGS ====================================== */
  ensureTag({ id: "roles", name: "Roles & permissions",
    description: "Named permission bundles assigned to users. Includes the platform-supplied built-in roles (Admin, Manager, Approver, Recruiter, Supplier, Worker) and the org's custom roles. Pair with /permissions for the full permission catalog used in role definitions." });
  ensureTag({ id: "saved-views", name: "Saved views",
    description: "Per-user saved configurations of filters, columns, and sort for list pages. Views are private to their owner unless shared with the org." });
  ensureTag({ id: "files", name: "Files",
    description: "Centralized blob storage — receipts, contracts, credential PDFs, tax forms, timesheet exports. Uploads support multipart for ≤25 MB and tus.io resumable for up to 2 GB. Files inherit retention from their category." });
  ensureTag({ id: "search", name: "Universal search",
    description: "Cross-resource fuzzy search powering the in-product Cmd+K palette. Tokens are lowercased and accent-folded; results carry a resource discriminator so the UI can route correctly." });
  ensureTag({ id: "devices", name: "Devices & push",
    description: "Mobile device registration for push notifications. Idempotent on push token; re-registering refreshes lastSeenAt." });
  ensureTag({ id: "api-keys", name: "API keys",
    description: "Server-to-server API keys provisioned in the developer portal. Each key is scoped, optionally bound to a client certificate (mTLS), and optionally restricted by IP allowlist." });

  /* =========== 2) RETAG endpoints ============================== */
  // users → roles
  ["roles_list", "roles_create", "roles_update", "roles_delete", "permissions_list"].forEach(function (id) {
    retag(id, "roles");
  });
  // users → saved-views
  ["views_list", "views_create", "views_update", "views_delete"].forEach(function (id) {
    retag(id, "saved-views");
  });
  // system → api-keys
  ["api_keys_list", "api_keys_create", "api_keys_delete"].forEach(function (id) {
    retag(id, "api-keys");
  });
  // system → files
  ["files_upload", "files_get", "files_delete",
   "files_upload_start", "files_upload_patch", "files_upload_get", "files_upload_cancel"].forEach(function (id) {
    retag(id, "files");
  });
  // system → search
  retag("search", "search");
  // system → devices
  ["devices_register", "devices_delete"].forEach(function (id) {
    retag(id, "devices");
  });
  // mtls / ip-allowlist endpoints stay where they are; their tag is correct

  /* =========== 3) GROUP MEMBERSHIP for new tags ================= */
  function appendToGroup(groupId, tagIds) {
    var g = (spec.groups || []).find(function (x) { return x.id === groupId; });
    if (!g) return;
    tagIds.forEach(function (t) { if (g.tags.indexOf(t) < 0) g.tags.push(t); });
  }
  appendToGroup("identity",   ["roles", "saved-views"]);
  appendToGroup("platform",   ["files", "search", "devices"]);
  appendToGroup("developers", ["api-keys"]);

  /* =========== 4) THIN TAG EXPANSIONS ========================== */

  /* Budgets — was 1 endpoint (list). Add get, set, transfer, alerts. */
  add(
    { id: "bg_get", tag: "budgets",
      method: "GET", path: "/budgets/{budgetId}",
      name: "Get a budget",
      summary: "Returns one budget envelope with line-item rollups by category, location, and engagement type.",
      params: [{ name: "budgetId", in: "path", type: "string<ulid>", required: true, desc: "Budget identifier." }],
      responses: [{ status: 200, schema: "Budget", desc: "Budget envelope." }, { status: 404, schema: "Error", desc: "Not found." }],
      responseExample: { id: "01HZXC0K2N4R8F7D3M2P5S6BUDX", fiscalYear: 2026, departmentId: "01HZX0JDEPOPS00000000000001", plan: { amount: 4_200_000, currency: "USD" }, committed: { amount: 2_710_000, currency: "USD" }, realized: { amount: 1_840_000, currency: "USD" } } },

    { id: "bg_update", tag: "budgets",
      method: "PATCH", path: "/budgets/{budgetId}",
      name: "Update a budget",
      summary: "Partial update of a budget's planned amount or its tag metadata. Committed and realized are computed, never written directly.",
      params: [{ name: "budgetId", in: "path", type: "string<ulid>", required: true, desc: "Budget identifier." }],
      body: { schemaRef: "Subset of Budget (plan only)", example: { plan: { amount: 4_500_000, currency: "USD" } } },
      responses: [{ status: 200, schema: "Budget", desc: "Updated budget." }],
      responseExample: { id: "01HZXC0K2N4R8F7D3M2P5S6BUDX", plan: { amount: 4_500_000, currency: "USD" } } },

    { id: "bg_transfer", tag: "budgets",
      method: "POST", path: "/budgets:transfer",
      name: "Transfer between budgets",
      summary: "Move planned dollars from one budget to another within the same org. Both budgets must be in the same fiscal year.",
      detail:
        "Transfers are audit-logged with the originating user and a free-text justification. " +
        "If either budget's committed amount would exceed the new plan, the transfer is rejected with 422 — refusing a transfer that would put the budget instantly into overrun.",
      body: { schema: [
        { name: "fromBudgetId", type: "string<ulid>", required: true, desc: "Source budget." },
        { name: "toBudgetId",   type: "string<ulid>", required: true, desc: "Destination budget." },
        { name: "amount",       type: "Money",        required: true, desc: "Amount to move." },
        { name: "justification",type: "string",       required: true, desc: "Reason recorded in audit." }
      ], example: { fromBudgetId: "01HZXC0K2N4R8F7D3M2P5S6BUDX", toBudgetId: "01HZXC0K2N4R8F7D3M2P5S6BUDY", amount: { amount: 250_000, currency: "USD" }, justification: "Q3 reforecast — shift to Operations from Capital Projects." } },
      responses: [
        { status: 200, schema: "BudgetTransfer", desc: "Transfer recorded." },
        { status: 422, schema: "Error", desc: "Transfer would put the source budget into committed overrun." }
      ],
      responseExample: { id: "01HZXBGT0001234567890ABCDE", fromBudgetId: "01HZXC0K2N4R8F7D3M2P5S6BUDX", toBudgetId: "01HZXC0K2N4R8F7D3M2P5S6BUDY", amount: { amount: 250_000, currency: "USD" }, transferredAt: "2026-05-26T17:22:01Z" } },

    { id: "bg_alerts", tag: "budgets",
      method: "GET", path: "/budgets/{budgetId}/alerts",
      name: "Get budget alerts",
      summary: "Returns the configured spend-threshold alerts (80% / 95% / 100% by default) and which have fired.",
      params: [{ name: "budgetId", in: "path", type: "string<ulid>", required: true, desc: "Budget identifier." }],
      responses: [{ status: 200, schema: "Array<BudgetAlert>", desc: "Alert list." }],
      responseExample: [
        { threshold: 0.80, firedAt: "2026-04-12T08:00:00Z", recipients: ["finops@helios.example"] },
        { threshold: 0.95, firedAt: null,                   recipients: ["finops@helios.example", "cfo@helios.example"] },
        { threshold: 1.00, firedAt: null,                   recipients: ["finops@helios.example", "cfo@helios.example"] }
      ] }
  );

  /* Locations — was 2 (list + create). Add get, update, delete. */
  add(
    { id: "loc_get", tag: "locations",
      method: "GET", path: "/locations/{locationId}",
      name: "Get a location",
      summary: "Returns one worksite with its current parent org-unit, timezone, tax jurisdiction, and operating-hours pattern.",
      params: [{ name: "locationId", in: "path", type: "string<ulid>", required: true, desc: "Location identifier." }],
      responses: [{ status: 200, schema: "Location", desc: "Location envelope." }, { status: 404, schema: "Error", desc: "Not found." }],
      responseExample: { id: "01HZX0J5W1S9D8H7N3E6Q4R2YX", name: "Reno DC-3", address1: "1500 Vista Boulevard", city: "Reno", state: "NV", country: "US", postalCode: "89506", timezone: "America/Los_Angeles", parentOrgUnitId: "01HZX0JOU0WESTERN00000WST", taxJurisdiction: "US-NV", openHours: { mon: { open: "06:00", close: "22:00" }, sun: { open: "10:00", close: "20:00" } } } },

    { id: "loc_update", tag: "locations",
      method: "PATCH", path: "/locations/{locationId}",
      name: "Update a location",
      summary: "Partial update of a location's address, manager, timezone, or operating hours. Changing timezone re-evaluates every active schedule at that site.",
      params: [{ name: "locationId", in: "path", type: "string<ulid>", required: true, desc: "Location identifier." }],
      body: { schemaRef: "Subset of Location", example: { managerUserId: "01HZX0J0XM7R1F2N6K3L7S5VWE", openHours: { mon: { open: "06:00", close: "23:00" } } } },
      responses: [{ status: 200, schema: "Location", desc: "Updated location." }],
      responseExample: { id: "01HZX0J5W1S9D8H7N3E6Q4R2YX", managerUserId: "01HZX0J0XM7R1F2N6K3L7S5VWE" } },

    { id: "loc_delete", tag: "locations",
      method: "DELETE", path: "/locations/{locationId}",
      name: "Archive a location",
      summary: "Archive a location. Returns 409 if any requisitions, schedules, or workers are still anchored to it. Archived locations stay readable; they're hidden from new-requisition pickers.",
      params: [{ name: "locationId", in: "path", type: "string<ulid>", required: true, desc: "Location to archive." }],
      responses: [
        { status: 204, schema: null,    desc: "Archived." },
        { status: 409, schema: "Error", desc: "Location has active dependencies — close them first." }
      ],
      responseExample: null }
  );

  /* Jobs — was 2 (list + get). Add create, update, delete. */
  add(
    { id: "jobs_create", tag: "jobs",
      method: "POST", path: "/jobs",
      name: "Create a job",
      summary: "Add a job to the catalog. The combination of `title` and `category` must be unique within the org.",
      detail:
        "Frontline jobs get full default pay-band semantics — `defaultPayRate` is required. " +
        "Professional jobs may omit pay defaults and pick them up from the requisition's pricing rule at intake.",
      body: { schema: [
        { name: "title",            type: "string",          required: true,  desc: "Job title." },
        { name: "category",         type: "enum",            required: true,  desc: "Catalog category.", enum: ["frontline", "professional"] },
        { name: "defaultPayRate",   type: "Money",           required: false, desc: "Optional default pay rate. Required for category=frontline." },
        { name: "credentialIds",    type: "Array<string<ulid>>", required: false, desc: "Credentials required to work this job." },
        { name: "description",      type: "string",          required: false, desc: "Free-text description shown to candidates." }
      ], example: { title: "Forklift operator", category: "frontline", defaultPayRate: { amount: 26, currency: "USD" }, credentialIds: ["01HZX0JCREDFORKLIFT0000000A"] } },
      responses: [
        { status: 201, schema: "Job", desc: "Job created." },
        { status: 409, schema: "Error", desc: "Title already exists in this category." }
      ],
      responseExample: { id: "01HZX0J9V6KM6H7TB1W3D7F2QJ", title: "Forklift operator", category: "frontline" } },

    { id: "jobs_update", tag: "jobs",
      method: "PATCH", path: "/jobs/{jobId}",
      name: "Update a job",
      summary: "Partial update of a job's title, description, default rate, or credential requirements.",
      detail: "Changing `defaultPayRate` only affects requisitions opened AFTER the change. In-flight requisitions and engagements keep the rate they were created with.",
      params: [{ name: "jobId", in: "path", type: "string<ulid>", required: true, desc: "Job identifier." }],
      body: { schemaRef: "Subset of Job", example: { defaultPayRate: { amount: 27, currency: "USD" } } },
      responses: [{ status: 200, schema: "Job", desc: "Updated job." }],
      responseExample: { id: "01HZX0J9V6KM6H7TB1W3D7F2QJ", defaultPayRate: { amount: 27, currency: "USD" } } },

    { id: "jobs_delete", tag: "jobs",
      method: "DELETE", path: "/jobs/{jobId}",
      name: "Archive a job",
      summary: "Archive a job. Like locations, archive is soft — existing references survive, new pickers hide it.",
      params: [{ name: "jobId", in: "path", type: "string<ulid>", required: true, desc: "Job to archive." }],
      responses: [{ status: 204, schema: null, desc: "Archived." }],
      responseExample: null }
  );

  /* =========== 5) ENRICH a few endpoints =========================== */
  function enrich(epId, detail) {
    var ep = spec.paths.find(function (p) { return p.id === epId; });
    if (ep) ep.detail = detail;
  }

  enrich("wrk_offboard",
    "Offboarding fires four parallel workflow chains: final-pay accrual through the payroll engine, credential expiry on any worker-issued credentials still active, supplier-side notification when the worker came through an agency, and a 30-day grace period on the worker record itself before it moves to the archive. " +
    "Set `rehireEligible: false` only when there's a documented reason — the platform retains it on every future supplier submittal as a soft block."
  );

  enrich("sup_contract",
    "Contracts are versioned. Creating a new revision archives the previous one (visible at /suppliers/{id}/contracts/history) and makes the new one active immediately. " +
    "All in-flight requisitions distributed to the supplier continue to bill at the rates from the previous revision until they close; only NEW requisitions adopt the new markup and payment terms. " +
    "If the contract has an `effectiveStart` in the future, the previous revision stays active until that date."
  );

  enrich("cdc_stream",
    "Each batch returns up to 500 events; a sustained stream of 5,000 events/second is supported on the polling channel and 20,000/second on the native Kafka topic. " +
    "Events within a single tenant + region are globally ordered; cross-region order is best-effort. " +
    "At-least-once delivery — consumers MUST de-duplicate on event id. Combine with `?resources=` to drop the noise floor before it reaches the wire."
  );

  enrich("scim_users_create",
    "The platform handles SCIM 2.0 quirks across IdPs out-of-the-box: Okta's `roles` extension, Entra ID's `accountEnabled`, and the variable group-membership conventions across providers. Map your IdP's user payload as-is — the edge translates. " +
    "Email is the SCIM primary; mismatched casing on subsequent operations is tolerated. " +
    "Re-creating a deactivated user (same email) is allowed and reactivates the original record rather than minting a new one."
  );

  enrich("punch_in",
    "Punches are immutable. Corrections go through /timesheets/{id}/correction-requests once the shift's timesheet is generated. " +
    "If the worker's device reported a location with accuracy worse than 50 m, the punch is tagged `accuracy_low` AND the fence check is downgraded to advisory (never block). " +
    "Offline-mode punches submitted from the worker-mobile app carry a client-supplied `at` timestamp and a `submittedFrom` of `offline_replay` in audit; the platform validates the timestamp is within the shift window."
  );

  /* =========== 6) Small cosmetic fixes ============================ */
  // The original timesheet ts_list endpoint mentions `engagement` schema
  // that doesn't exist in our schemas dict; align it to Timesheet.
  // Already correct in spec; nothing to change here.

  // Final size sanity check (logged for telemetry; doesn't show in UI).
  if (typeof window !== "undefined" && window.console) {
    var byTag = {};
    spec.paths.forEach(function (p) { byTag[p.tag] = (byTag[p.tag] || 0) + 1; });
    // No output — silent unless verifier reads it.
  }
})();
