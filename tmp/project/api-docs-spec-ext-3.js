/* =====================================================================
   Flex Work API · spec extension (part 3 — coverage, polish, groups)
   ---------------------------------------------------------------------
   Adds:
     · spec.groups — top-level sections that bundle related tags so the
       sidebar / home page have fewer top-level cells.
     · Net-new endpoints discovered by auditing pages/ and chrome.jsx:
         - /auth/login, /auth/refresh, /auth/sso/*, /auth/mfa/*
         - /expenses (Professional engagement type)
         - /views (saved per-user list views)
         - /files (centralized blob upload + retrieval)
         - /search (cross-resource search powering ⌘K)
         - /devices (push token registration for mobile apps)
         - /msp/programs + cross-program scope helpers (MSP mode)
         - /workers/{id}/availability and per-day holds
         - /users/me/preferences (theme, density, locale, timezone)
         - /suppliers:broadcast (bulk message to a supplier set)
         - /config/worker-types (Frontline / Professional / Contractor / SOW)
         - /reference/permissions:resolve (compute caller's effective perms)
         - /scopes (catalog of OAuth scopes)
     · Enriched long-form descriptions on the highest-traffic endpoints
       so each page reads as a real reference, not a stub.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  /* ---------- groups (top-level sidebar sections) ----------------- */
  // Each tag is assigned to exactly one group. The renderer consumes
  // this to render a 2-level sidebar: Group → Tag → Endpoint.
  spec.groups = [
    {
      id: "get-started",
      name: "Get started",
      summary: "Auth, error handling, pagination, idempotency, rate limits, and the conventions every Flex Work request follows.",
      tags: []   // get-started has its own info pages, no endpoint tags
    },
    {
      id: "identity",
      name: "Identity & access",
      summary: "Who can use Flex Work and what they can see — orgs, users, roles, the org hierarchy, and platform configuration.",
      tags: ["organization", "users", "org-tree", "config"]
    },
    {
      id: "demand",
      name: "Demand",
      summary: "How work enters Flex Work — requisitions, templates, supplier distribution, candidates, and Statements of Work.",
      tags: ["requisitions", "requisition-templates", "distribution", "candidates", "sow"]
    },
    {
      id: "workforce",
      name: "Workforce",
      summary: "The people doing the work — frontline workers, contractors, credentials, and reusable talent pools.",
      tags: ["workers", "contractors", "credentials", "talent-pools"]
    },
    {
      id: "operations",
      name: "Time & attendance",
      summary: "Schedules and shifts, time-off requests, timesheets, expenses, and the workflows that hand them off to payroll.",
      tags: ["schedules", "time-off", "timesheets", "expenses"]
    },
    {
      id: "money",
      name: "Money",
      summary: "Where the spend goes — invoices, pricing rules, supplier funding, sales tax, and the budgets that fence them in.",
      tags: ["invoices", "pricing", "budgets"]
    },
    {
      id: "suppliers",
      name: "Suppliers",
      summary: "Staffing agencies, EOR partners, and SOW vendors — onboarding, contracts, scorecards, and cross-supplier broadcasts.",
      tags: ["suppliers"]
    },
    {
      id: "platform",
      name: "Platform",
      summary: "The structural pieces of a Flex Work tenant — locations, jobs catalog, policies, approval workflows, notifications.",
      tags: ["locations", "jobs", "policies", "workflows", "notifications"]
    },
    {
      id: "insights",
      name: "Insights",
      summary: "Reads of the platform's state — metrics, ad-hoc queries, dashboards, generated insights, and the audit log.",
      tags: ["analytics", "dashboards", "audit"]
    },
    {
      id: "developers",
      name: "Developers",
      summary: "Programmatic surface for integrators — webhooks, the event catalog, API keys, system health, MSP cross-tenant routing, and the AI / Labs endpoints.",
      tags: ["webhooks", "events", "system", "msp", "ai"]
    }
  ];

  // Pin "auth" tag to get-started so its endpoints surface under the
  // first group. Same for any tags we haven't placed yet.
  spec.groups[0].tags.unshift("auth");

  /* ---------- additional reference tags --------------------------- */
  function ensureTag(t) {
    if (!spec.tags.find(function (x) { return x.id === t.id; })) spec.tags.push(t);
  }
  ensureTag({
    id: "expenses",
    name: "Expenses",
    description:
      "Receipt-backed expense lines submitted by Professional-tier workers and reimbursed alongside their timesheet pay. " +
      "Each expense rolls up to a category from the org's expense policy and is reconciled against the engagement's spend cap."
  });
  ensureTag({
    id: "msp",
    name: "MSP mode",
    description:
      "Cross-tenant routing for managed-service partners. MSP users hold seats on multiple programs and need both a per-program " +
      "view and a panoramic across-program view; these endpoints power the program switcher and the cross-tenant scope filter."
  });

  /* ---------- extra schemas --------------------------------------- */
  Object.assign(spec.schemas, {
    Expense: {
      description: "A reimbursable expense line submitted by a worker.",
      fields: [
        { name: "id",            type: "string<ulid>",     required: true,  desc: "Expense identifier." },
        { name: "workerId",      type: "string<ulid>",     required: true,  desc: "Worker who incurred the cost." },
        { name: "requisitionId", type: "string<ulid>",     required: true,  desc: "Requisition the expense was incurred against." },
        { name: "category",      type: "enum",             required: true,  desc: "Expense category from the org's policy.", enum: ["airfare", "lodging", "ground", "meals", "supplies", "other"] },
        { name: "incurredOn",    type: "string<date>",     required: true,  desc: "Date the expense was incurred." },
        { name: "amount",        type: "Money",            required: true,  desc: "Total amount, including taxes." },
        { name: "merchant",      type: "string",           required: false, desc: "Vendor name from the receipt." },
        { name: "receiptUrl",    type: "string<uri>",      required: false, desc: "Link to the receipt image in file storage." },
        { name: "status",        type: "enum",             required: true,  desc: "Lifecycle state.", enum: ["draft", "submitted", "approved", "rejected", "reimbursed"] },
        { name: "approvedBy",    type: "string<ulid>",     required: false, desc: "User who approved the expense." },
        { name: "approvedAt",    type: "string<datetime>", required: false, desc: "When the expense was approved." },
        { name: "rejectionReason", type: "string",         required: false, desc: "Reason the expense was rejected, if any." }
      ]
    },
    SavedView: {
      description: "A per-user saved configuration of filters, columns, and sort for a list view.",
      fields: [
        { name: "id",        type: "string<ulid>", required: true,  desc: "View identifier." },
        { name: "userId",    type: "string<ulid>", required: true,  desc: "Owning user. A view is private to its owner unless `shared` is true." },
        { name: "resource",  type: "enum",         required: true,  desc: "Resource type the view applies to.", enum: ["requisitions", "workers", "timesheets", "invoices", "candidates", "schedules", "suppliers"] },
        { name: "name",      type: "string",       required: true,  desc: "User-facing name." },
        { name: "filters",   type: "object",       required: true,  desc: "Filter map keyed by field name." },
        { name: "columns",   type: "Array<string>",required: true,  desc: "Ordered column visibility." },
        { name: "sort",      type: "object",       required: false, desc: "Sort spec — `{field, direction}`." },
        { name: "shared",    type: "boolean",      required: true,  desc: "Whether the view is shared org-wide." },
        { name: "default",   type: "boolean",      required: true,  desc: "Whether the view is the owner's default for the resource." }
      ]
    },
    File: {
      description: "A blob stored in the platform's file service (receipts, contracts, credential PDFs, etc.).",
      fields: [
        { name: "id",        type: "string<ulid>", required: true, desc: "File identifier." },
        { name: "filename",  type: "string",       required: true, desc: "Original filename at upload time." },
        { name: "mimeType",  type: "string",       required: true, desc: "MIME type, e.g. `application/pdf`." },
        { name: "sizeBytes", type: "integer",      required: true, desc: "Size in bytes." },
        { name: "category",  type: "enum",         required: true, desc: "What the file is used for.", enum: ["receipt", "contract", "credential", "id_document", "timesheet_export", "other"] },
        { name: "url",       type: "string<uri>",  required: true, desc: "Signed download URL, valid for 15 minutes." },
        { name: "uploadedBy",type: "string<ulid>", required: true, desc: "User who uploaded the file." },
        { name: "uploadedAt",type: "string<datetime>", required: true, desc: "When the file was uploaded." }
      ]
    },
    Device: {
      description: "A registered mobile device able to receive push notifications.",
      fields: [
        { name: "id",        type: "string<ulid>", required: true, desc: "Device record identifier." },
        { name: "userId",    type: "string<ulid>", required: true, desc: "User the device belongs to." },
        { name: "platform",  type: "enum",         required: true, desc: "OS platform.", enum: ["ios", "android"] },
        { name: "pushToken", type: "string",       required: true, desc: "Vendor push token (APNs / FCM)." },
        { name: "appVersion",type: "string",       required: true, desc: "Installed app version, semver." },
        { name: "lastSeenAt",type: "string<datetime>", required: true, desc: "Most recent active sign-in." }
      ]
    },
    UserPreferences: {
      description: "Per-user UI preferences. Replace via PUT, partial-update via PATCH.",
      fields: [
        { name: "theme",      type: "enum",  required: true, desc: "Color theme preference.", enum: ["system", "light", "dark"] },
        { name: "density",    type: "enum",  required: true, desc: "List density.", enum: ["comfortable", "compact"] },
        { name: "locale",     type: "string", required: true, desc: "Preferred locale, e.g. `en-US`. Overrides org default." },
        { name: "timezone",   type: "string", required: true, desc: "IANA timezone, e.g. `America/Toronto`." },
        { name: "weekStarts", type: "enum",   required: true, desc: "First day of the week shown in calendars.", enum: ["monday", "sunday", "saturday"] },
        { name: "homeTab",    type: "string", required: false, desc: "Last-used home tab id, used to restore state across sessions." }
      ]
    }
  });

  /* ---------- helper -------------------------------------------- */
  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }

  /* ===== Auth: full sign-in flow ================================ */
  add(
    { id: "auth_login", tag: "auth",
      method: "POST", path: "/auth/login",
      name: "Sign in with email + password",
      summary:
        "Exchanges an email and password for a session token. " +
        "The platform-native flow; SSO clients should use /auth/sso/* instead.",
      detail:
        "If the user has MFA enrolled, a 200 with mfaRequired=true is returned instead of a token; the caller must then exchange the mfaToken for a real session via /auth/mfa/verify.",
      body: { schema: [
        { name: "email",    type: "string<email>", required: true,  desc: "Account email." },
        { name: "password", type: "string",        required: true,  desc: "Account password. Never logged; rejected if leaked credential lists match." },
        { name: "deviceId", type: "string<ulid>",  required: false, desc: "Optional registered device id; binds the session to a known device." }
      ], example: { email: "amy.chen@helios.example", password: "•••••••••••" } },
      responses: [
        { status: 200, schema: "AuthResponse", desc: "Sign-in succeeded; bearer token returned." },
        { status: 202, schema: "MfaChallenge", desc: "MFA is required. Follow up with /auth/mfa/verify." },
        { status: 401, schema: "Error",        desc: "Wrong email or password." },
        { status: 423, schema: "Error",        desc: "Account locked. Caller must reset via /auth/reset-password." }
      ],
      responseExample: { access_token: "eyJraWQiOiJmd2tpZF8wMSIs…", token_type: "Bearer", expires_in: 3600, refresh_token: "rft_a08c3d…", user: { id: "01HZX0J0XM7R1F2N6K3L7S5VWE", email: "amy.chen@helios.example", name: "Amy Chen" } } },

    { id: "auth_refresh", tag: "auth",
      method: "POST", path: "/auth/refresh",
      name: "Refresh an access token",
      summary: "Exchanges a long-lived refresh token for a fresh access token without re-prompting the user.",
      detail:
        "Refresh tokens are single-use; the response contains both a new access token AND a new refresh token. Discard the old refresh token immediately to avoid reuse-detection blocking the next refresh.",
      body: { schema: [
        { name: "refresh_token", type: "string", required: true, desc: "Refresh token returned by the previous /auth/login or /auth/refresh." }
      ], example: { refresh_token: "rft_a08c3d…" } },
      responses: [
        { status: 200, schema: "AuthResponse", desc: "New token pair." },
        { status: 401, schema: "Error",        desc: "Refresh token expired, reused, or revoked." }
      ],
      responseExample: { access_token: "eyJraWQiOiJmd2tpZF8wMSIs…", token_type: "Bearer", expires_in: 3600, refresh_token: "rft_b19d4e…" } },

    { id: "auth_sso_init", tag: "auth",
      method: "POST", path: "/auth/sso/initiate",
      name: "Start an SSO sign-in",
      summary:
        "Begins an SSO handshake for the supplied IdP. Returns a redirect URL the caller should navigate the user to.",
      detail:
        "Flex Work supports SAML 2.0 and OIDC. The redirect URL carries a state nonce that must be passed back to /auth/sso/callback exactly once.",
      body: { schema: [
        { name: "domain", type: "string", required: true, desc: "Email domain that maps to an IdP, e.g. \"helios.example\"." },
        { name: "returnTo", type: "string<uri>", required: false, desc: "Where to send the user after sign-in." }
      ], example: { domain: "helios.example", returnTo: "https://flex.dayforce.com/home" } },
      responses: [{ status: 200, schema: "SsoInitiateResponse", desc: "IdP redirect URL + state nonce." }],
      responseExample: { redirectUrl: "https://idp.helios.example/sso?SAMLRequest=PHNhbWxw…&state=ssoabc123", state: "ssoabc123", expiresAt: "2026-05-26T17:32:00Z" } },

    { id: "auth_sso_callback", tag: "auth",
      method: "POST", path: "/auth/sso/callback",
      name: "Complete SSO sign-in",
      summary: "Validates the IdP assertion and issues a Flex Work session token.",
      body: { schema: [
        { name: "state",        type: "string", required: true,  desc: "State nonce from /auth/sso/initiate." },
        { name: "samlResponse", type: "string", required: false, desc: "Base64 SAMLResponse, required for SAML IdPs." },
        { name: "idToken",      type: "string", required: false, desc: "OIDC id_token, required for OIDC IdPs." }
      ], example: { state: "ssoabc123", samlResponse: "PHNhbWxwOlJlc3BvbnNl…" } },
      responses: [
        { status: 200, schema: "AuthResponse", desc: "Session token issued." },
        { status: 401, schema: "Error",        desc: "IdP assertion failed validation." }
      ],
      responseExample: { access_token: "eyJraWQiOiJmd2tpZF8wMSIs…", token_type: "Bearer", expires_in: 3600 } },

    { id: "auth_mfa_verify", tag: "auth",
      method: "POST", path: "/auth/mfa/verify",
      name: "Verify an MFA challenge",
      summary:
        "Exchanges a TOTP / WebAuthn assertion for a session token. Used after /auth/login returns 202.",
      body: { schema: [
        { name: "mfaToken", type: "string", required: true, desc: "Token from the 202 MfaChallenge body." },
        { name: "method",   type: "enum",   required: true, desc: "MFA method used.", enum: ["totp", "sms", "webauthn", "backup_code"] },
        { name: "code",     type: "string", required: false, desc: "TOTP / SMS code; omit for webauthn." },
        { name: "assertion",type: "string", required: false, desc: "WebAuthn assertion, base64; required when method=webauthn." }
      ], example: { mfaToken: "mfat_a08c3d…", method: "totp", code: "421983" } },
      responses: [
        { status: 200, schema: "AuthResponse", desc: "Session token issued." },
        { status: 401, schema: "Error",        desc: "Code invalid or expired." }
      ],
      responseExample: { access_token: "eyJraWQiOiJmd2tpZF8wMSIs…", token_type: "Bearer", expires_in: 3600 } },

    { id: "auth_reset_pw", tag: "auth",
      method: "POST", path: "/auth/reset-password",
      name: "Request a password reset",
      summary:
        "Sends a password-reset email to the address (if it matches an account). Always returns 202 to avoid leaking which emails are real.",
      body: { schema: [{ name: "email", type: "string<email>", required: true, desc: "Account email." }], example: { email: "amy.chen@helios.example" } },
      responses: [{ status: 202, schema: null, desc: "Reset email queued (or silently dropped if no account)." }],
      responseExample: null },

    { id: "scopes_list", tag: "auth",
      method: "GET", path: "/auth/scopes",
      name: "List OAuth scopes",
      summary: "Returns every OAuth scope the platform understands, with human-readable descriptions, grouped by the resource they govern.",
      detail:
        "Scope codes follow `resource.verb` and inherit hierarchically — granting `requisitions.write` implies `requisitions.read`. Use this endpoint to render scope-picker UIs on developer-portal pages.",
      responses: [{ status: 200, schema: "Array<Scope>", desc: "Scope catalog." }],
      responseExample: [
        { code: "requisitions.read",  description: "Read requisitions visible to the caller." },
        { code: "requisitions.write", description: "Create, update, and distribute requisitions." },
        { code: "timesheets.read",    description: "Read worker timesheets." },
        { code: "timesheets.approve", description: "Approve or reject submitted timesheets." },
        { code: "invoices.read",      description: "Read invoices." },
        { code: "invoices.approve",   description: "Approve issued invoices." }
      ] }
  );

  /* ===== User profile + preferences =============================== */
  add(
    { id: "me_prefs_get", tag: "users",
      method: "GET", path: "/users/me/preferences",
      name: "Get my preferences",
      summary: "Returns the UI preferences for the calling user (theme, density, locale, timezone, week start).",
      responses: [{ status: 200, schema: "UserPreferences", desc: "Preferences envelope." }],
      responseExample: { theme: "system", density: "comfortable", locale: "en-US", timezone: "America/Toronto", weekStarts: "monday", homeTab: "home" } },

    { id: "me_prefs_set", tag: "users",
      method: "PATCH", path: "/users/me/preferences",
      name: "Update my preferences",
      summary: "Partial update of UI preferences for the calling user.",
      body: { schemaRef: "Subset of UserPreferences", example: { theme: "dark", density: "compact" } },
      responses: [{ status: 200, schema: "UserPreferences", desc: "Updated preferences." }],
      responseExample: { theme: "dark", density: "compact", locale: "en-US", timezone: "America/Toronto", weekStarts: "monday" } },

    { id: "me_perms_resolve", tag: "users",
      method: "GET", path: "/users/me/permissions",
      name: "Resolve my effective permissions",
      summary:
        "Returns the full, flattened set of scopes the calling user holds — useful for client-side feature gating without round-tripping role definitions.",
      detail:
        "Permissions are resolved at request time so role changes show up immediately; clients can safely cache the result for the lifetime of a session.",
      responses: [{ status: 200, schema: "ResolvedPermissions", desc: "Flat list of scopes + scope context." }],
      responseExample: { scopes: ["requisitions.write", "workers.write", "timesheets.approve", "invoices.read"], orgUnits: ["*"], locations: ["*"] } }
  );

  /* ===== Worker availability ====================================== */
  add(
    { id: "wrk_availability_get", tag: "workers",
      method: "GET", path: "/workers/{workerId}/availability",
      name: "Get a worker's availability",
      summary: "Returns weekly availability windows for a worker.",
      detail:
        "Availability is captured as a list of `{dayOfWeek, startsAt, endsAt}` rows in the location's timezone. Combine with /workers/{id}/time-off to compute openings for shift-pickup eligibility.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to fetch." }],
      responses: [{ status: 200, schema: "Array<AvailabilityWindow>", desc: "Availability rows." }],
      responseExample: [
        { dayOfWeek: "monday",    startsAt: "08:00", endsAt: "18:00" },
        { dayOfWeek: "tuesday",   startsAt: "08:00", endsAt: "18:00" },
        { dayOfWeek: "wednesday", startsAt: "08:00", endsAt: "18:00" },
        { dayOfWeek: "thursday",  startsAt: "08:00", endsAt: "18:00" }
      ] },

    { id: "wrk_availability_set", tag: "workers",
      method: "PUT", path: "/workers/{workerId}/availability",
      name: "Replace a worker's availability",
      summary: "Replaces the worker's full weekly availability set in one call.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to update." }],
      body: { schemaRef: "Array<AvailabilityWindow>", example: [
        { dayOfWeek: "monday",   startsAt: "08:00", endsAt: "18:00" },
        { dayOfWeek: "saturday", startsAt: "10:00", endsAt: "14:00" }
      ] },
      responses: [{ status: 200, schema: "Array<AvailabilityWindow>", desc: "Saved availability." }],
      responseExample: [
        { dayOfWeek: "monday",   startsAt: "08:00", endsAt: "18:00" },
        { dayOfWeek: "saturday", startsAt: "10:00", endsAt: "14:00" }
      ] }
  );

  /* ===== Expenses ================================================= */
  add(
    { id: "exp_list", tag: "expenses",
      method: "GET", path: "/expenses",
      name: "List expenses",
      summary: "Paginated list of expense lines, filterable by worker, requisition, status, or week.",
      params: [
        { name: "workerId",      in: "query", type: "string<ulid>", required: false, desc: "One worker's expenses." },
        { name: "requisitionId", in: "query", type: "string<ulid>", required: false, desc: "Expenses against one requisition." },
        { name: "status",        in: "query", type: "enum",         required: false, desc: "Lifecycle filter.", enum: ["draft", "submitted", "approved", "rejected", "reimbursed"] },
        { name: "incurredAfter", in: "query", type: "string<date>", required: false, desc: "Only expenses incurred on or after this date." },
        { name: "incurredBefore",in: "query", type: "string<date>", required: false, desc: "Only expenses incurred before this date." },
        { name: "cursor",        in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Expense>", desc: "Expense page." }],
      responseExample: { data: [
        { id: "01HZXEXP00012345670000ABC1", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", category: "lodging", incurredOn: "2026-05-21", amount: { amount: 318.42, currency: "USD" }, merchant: "Aloft Hotel · Reno", status: "submitted" }
      ], nextCursor: null } },

    { id: "exp_submit", tag: "expenses",
      method: "POST", path: "/expenses",
      name: "Submit an expense",
      summary:
        "Worker-side: submit a receipt-backed expense line. The receipt PDF or photo should be uploaded to /files first and referenced here by id.",
      body: { schema: [
        { name: "requisitionId", type: "string<ulid>",required: true,  desc: "Requisition this expense is incurred against." },
        { name: "category",      type: "enum",         required: true,  desc: "Expense category.", enum: ["airfare", "lodging", "ground", "meals", "supplies", "other"] },
        { name: "incurredOn",    type: "string<date>", required: true,  desc: "When the expense was incurred." },
        { name: "amount",        type: "Money",        required: true,  desc: "Total amount, taxes included." },
        { name: "merchant",      type: "string",       required: false, desc: "Merchant name." },
        { name: "receiptFileId", type: "string<ulid>", required: false, desc: "ID of an uploaded /files record." },
        { name: "note",          type: "string",       required: false, desc: "Worker-supplied note. Visible to the approving manager." }
      ], example: { requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", category: "lodging", incurredOn: "2026-05-21", amount: { amount: 318.42, currency: "USD" }, merchant: "Aloft Hotel · Reno", receiptFileId: "01HZXFILE0001234567890ABCD" } },
      responses: [{ status: 201, schema: "Expense", desc: "Expense submitted." }],
      responseExample: { id: "01HZXEXP00012345670000ABC1", status: "submitted" } },

    { id: "exp_approve", tag: "expenses",
      method: "POST", path: "/expenses/{expenseId}:approve",
      name: "Approve an expense",
      summary: "Approve an expense for reimbursement. Adds the amount to the next payroll export for that worker.",
      params: [{ name: "expenseId", in: "path", type: "string<ulid>", required: true, desc: "Expense to approve." }],
      responses: [{ status: 200, schema: "Expense", desc: "Expense approved." }],
      responseExample: { id: "01HZXEXP00012345670000ABC1", status: "approved" } },

    { id: "exp_reject", tag: "expenses",
      method: "POST", path: "/expenses/{expenseId}:reject",
      name: "Reject an expense",
      summary: "Reject an expense. Reason is shown to the worker in the mobile app.",
      params: [{ name: "expenseId", in: "path", type: "string<ulid>", required: true, desc: "Expense to reject." }],
      body: { schema: [{ name: "reason", type: "string", required: true, desc: "Why the expense was rejected." }], example: { reason: "Over per-diem cap — please resubmit with itemized receipt." } },
      responses: [{ status: 200, schema: "Expense", desc: "Expense rejected." }],
      responseExample: { id: "01HZXEXP00012345670000ABC1", status: "rejected" } }
  );

  /* ===== Saved views ============================================== */
  add(
    { id: "views_list", tag: "users",
      method: "GET", path: "/views",
      name: "List saved views",
      summary: "Returns the caller's saved list-views, plus any views shared org-wide by other users.",
      params: [
        { name: "resource", in: "query", type: "enum",   required: false, desc: "Filter by resource.", enum: ["requisitions", "workers", "timesheets", "invoices", "candidates", "schedules", "suppliers"] },
        { name: "shared",   in: "query", type: "boolean",required: false, desc: "If true, return only shared views; if false, only the caller's private views; omit for both." }
      ],
      responses: [{ status: 200, schema: "Array<SavedView>", desc: "Saved view list." }],
      responseExample: [
        { id: "01HZXVW00012345670000ABCDE", resource: "requisitions", name: "Open · Frontline · Reno", filters: { status: "open", sourcingChannel: "agency", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX" }, columns: ["code", "title", "headcount", "status", "createdAt"], sort: { field: "createdAt", direction: "desc" }, shared: false, default: true }
      ] },

    { id: "views_create", tag: "users",
      method: "POST", path: "/views",
      name: "Create a saved view",
      summary: "Save the current filter set and column layout for fast recall.",
      body: { schemaRef: "SavedView (without id, userId)", example: { resource: "requisitions", name: "Open · Frontline · Reno", filters: { status: "open" }, columns: ["code", "title", "headcount", "status", "createdAt"], shared: false } },
      responses: [{ status: 201, schema: "SavedView", desc: "View created." }],
      responseExample: { id: "01HZXVW00012345670000ABCDE", name: "Open · Frontline · Reno" } },

    { id: "views_update", tag: "users",
      method: "PATCH", path: "/views/{viewId}",
      name: "Update a saved view",
      summary: "Partial update of a saved view. Only the owner can update private views; admins can update shared ones.",
      params: [{ name: "viewId", in: "path", type: "string<ulid>", required: true, desc: "View to update." }],
      body: { schemaRef: "Subset of SavedView", example: { default: true } },
      responses: [{ status: 200, schema: "SavedView", desc: "Updated view." }],
      responseExample: { id: "01HZXVW00012345670000ABCDE", default: true } },

    { id: "views_delete", tag: "users",
      method: "DELETE", path: "/views/{viewId}",
      name: "Delete a saved view",
      summary: "Permanently delete a saved view.",
      params: [{ name: "viewId", in: "path", type: "string<ulid>", required: true, desc: "View to delete." }],
      responses: [{ status: 204, schema: null, desc: "View deleted." }],
      responseExample: null }
  );

  /* ===== Files ==================================================== */
  add(
    { id: "files_upload", tag: "system",
      method: "POST", path: "/files",
      name: "Upload a file",
      summary:
        "Uploads a file to platform-managed storage. Returns a File record with a short-lived signed URL for immediate download.",
      detail:
        "Send as `multipart/form-data` with a single `file` field. Max upload size is 25 MB. Files inherit retention from their category — receipts and contracts are kept for 7 years, miscellaneous uploads for 90 days.",
      body: { schema: [
        { name: "file",     type: "binary",required: true, desc: "The file payload. multipart/form-data only." },
        { name: "category", type: "enum",  required: true, desc: "What the file is used for.", enum: ["receipt", "contract", "credential", "id_document", "timesheet_export", "other"] }
      ], example: { file: "@/path/to/receipt.pdf", category: "receipt" } },
      responses: [
        { status: 201, schema: "File", desc: "Upload accepted." },
        { status: 413, schema: "Error", desc: "File too large (>25 MB)." },
        { status: 415, schema: "Error", desc: "Unsupported MIME type for this category." }
      ],
      responseExample: { id: "01HZXFILE0001234567890ABCD", filename: "aloft-receipt-2026-05-21.pdf", mimeType: "application/pdf", sizeBytes: 184221, category: "receipt", url: "https://files.dayforce.com/01HZXFILE…?sig=abc&exp=1685200000", uploadedBy: "01HZX0J8B7P3R2K6F9D5N8M4WT", uploadedAt: "2026-05-26T17:22:01Z" } },

    { id: "files_get", tag: "system",
      method: "GET", path: "/files/{fileId}",
      name: "Get a file record",
      summary: "Returns the file metadata plus a freshly-minted signed download URL (valid for 15 minutes).",
      params: [{ name: "fileId", in: "path", type: "string<ulid>", required: true, desc: "File to fetch." }],
      responses: [{ status: 200, schema: "File", desc: "File record + signed URL." }, { status: 404, schema: "Error", desc: "Not found, or not visible to caller." }],
      responseExample: { id: "01HZXFILE0001234567890ABCD", filename: "aloft-receipt-2026-05-21.pdf", url: "https://files.dayforce.com/01HZXFILE…?sig=def&exp=1685200900" } },

    { id: "files_delete", tag: "system",
      method: "DELETE", path: "/files/{fileId}",
      name: "Delete a file",
      summary: "Soft-deletes a file. Records that reference the file by id are unaffected; the URL stops resolving after deletion.",
      params: [{ name: "fileId", in: "path", type: "string<ulid>", required: true, desc: "File to delete." }],
      responses: [{ status: 204, schema: null, desc: "File deleted." }],
      responseExample: null }
  );

  /* ===== Devices + push =========================================== */
  add(
    { id: "devices_register", tag: "system",
      method: "POST", path: "/devices",
      name: "Register a device",
      summary:
        "Registers a mobile device's push token so the user receives push notifications. Idempotent on `pushToken` — re-registering refreshes lastSeenAt.",
      body: { schema: [
        { name: "platform",   type: "enum",   required: true, desc: "OS platform.", enum: ["ios", "android"] },
        { name: "pushToken",  type: "string", required: true, desc: "Vendor push token (APNs / FCM)." },
        { name: "appVersion", type: "string", required: true, desc: "Installed app version, semver." }
      ], example: { platform: "ios", pushToken: "apns_a08c3d0e7f6f5a4b3c2d1e0f", appVersion: "4.18.2" } },
      responses: [{ status: 201, schema: "Device", desc: "Device registered." }],
      responseExample: { id: "01HZXDEV00012345670000ABCD", platform: "ios", appVersion: "4.18.2", lastSeenAt: "2026-05-26T17:22:01Z" } },

    { id: "devices_delete", tag: "system",
      method: "DELETE", path: "/devices/{deviceId}",
      name: "Unregister a device",
      summary: "Stop sending push notifications to this device. Called automatically on app uninstall via APNs / FCM unregister callbacks.",
      params: [{ name: "deviceId", in: "path", type: "string<ulid>", required: true, desc: "Device to unregister." }],
      responses: [{ status: 204, schema: null, desc: "Device unregistered." }],
      responseExample: null }
  );

  /* ===== Search =================================================== */
  add(
    { id: "search", tag: "system",
      method: "GET", path: "/search",
      name: "Universal search",
      summary:
        "Cross-resource fuzzy search powering the in-product Cmd+K palette. Returns up to 20 ranked results across requisitions, workers, suppliers, candidates, and invoices.",
      detail:
        "Tokens are lowercased, accent-folded, and matched as prefixes against name, code, and reference fields. Results carry a `resource` discriminator so the UI can render the right icon and route.",
      params: [
        { name: "q",        in: "query", type: "string",         required: true,  desc: "Search query. Minimum 2 characters." },
        { name: "resource", in: "query", type: "Array<string>",  required: false, desc: "Restrict to a subset of resources, e.g. `?resource=workers,requisitions`." },
        { name: "limit",    in: "query", type: "integer",        required: false, desc: "Max results, 1–50. Defaults to 20." }
      ],
      responses: [{ status: 200, schema: "Array<SearchHit>", desc: "Ranked hits." }],
      responseExample: [
        { resource: "requisition", id: "01HZX7K2QM4FN0R8VBSE6PA7CY", title: "Warehouse picker — overnight", subtitle: "REQ-08421 · Reno DC-3", score: 0.92 },
        { resource: "worker",       id: "01HZX0J8B7P3R2K6F9D5N8M4WT", title: "Maya Okafor",                       subtitle: "Active · Reno DC-3",      score: 0.78 }
      ] }
  );

  /* ===== MSP cross-tenant routing ================================ */
  add(
    { id: "msp_programs", tag: "msp",
      method: "GET", path: "/msp/programs",
      name: "List MSP programs",
      summary: "For users with the MSP role: returns every client program the user is seated on.",
      detail:
        "An MSP partner runs several client programs (each a distinct Flex Work tenant) from one login. This endpoint powers the program switcher in the top-bar.",
      responses: [{ status: 200, schema: "Array<MspProgram>", desc: "Program list." }],
      responseExample: [
        { id: "aurora",    name: "Aurora Hotels & Resorts", industry: "hospitality", mark: "AU", color: "#A0541A", role: "msp" },
        { id: "mercy",     name: "Mercy Health System",     industry: "healthcare",  mark: "MH", color: "#147A78", role: "msp" },
        { id: "northwind", name: "Northwind Energy",        industry: "energy",      mark: "NW", color: "#3F5A14", role: "msp" }
      ] },

    { id: "msp_scope_get", tag: "msp",
      method: "GET", path: "/msp/scope",
      name: "Get MSP scope",
      summary:
        "Returns the user's current cross-program scope — which client programs are in view. An empty array means \"all programs\".",
      responses: [{ status: 200, schema: "MspScope", desc: "Scope envelope." }],
      responseExample: { programIds: [], updatedAt: "2026-05-26T17:22:01Z" } },

    { id: "msp_scope_set", tag: "msp",
      method: "PUT", path: "/msp/scope",
      name: "Update MSP scope",
      summary: "Replace the user's cross-program scope. Subsequent list calls automatically filter to the selected programs.",
      body: { schema: [
        { name: "programIds", type: "Array<string>", required: true, desc: "Program ids to scope to. Empty array means all." }
      ], example: { programIds: ["aurora", "mercy"] } },
      responses: [{ status: 200, schema: "MspScope", desc: "Saved scope." }],
      responseExample: { programIds: ["aurora", "mercy"], updatedAt: "2026-05-26T17:22:01Z" } }
  );

  /* ===== Suppliers — broadcast =================================== */
  add(
    { id: "sup_broadcast", tag: "suppliers",
      method: "POST", path: "/suppliers:broadcast",
      name: "Broadcast a message to suppliers",
      summary:
        "Sends a structured message — an announcement, an off-cycle requisition opening, a contract notice — to a set of suppliers in one call. Returns a delivery report.",
      detail:
        "Use this rather than emailing suppliers directly so the message lands in their Flex Work portal inbox AND on their existing email list, and so the audit log captures who sent what.",
      body: { schema: [
        { name: "supplierIds", type: "Array<string<ulid>>", required: true, desc: "Recipient suppliers." },
        { name: "subject",     type: "string",              required: true, desc: "Message subject." },
        { name: "body",        type: "string",              required: true, desc: "Message body. Markdown rendered." },
        { name: "channels",    type: "Array<enum>",         required: false, desc: "Delivery channels. Defaults to both.", enum: ["portal_inbox", "email"] },
        { name: "respondBy",   type: "string<datetime>",    required: false, desc: "Optional response deadline shown in the supplier portal." }
      ], example: { supplierIds: ["01HZX0J7X1K8N4F5R3S2D2YQAH"], subject: "Q3 forecast — please confirm capacity", body: "Anticipating a 22% headcount increase across Reno DC-3 starting July 1. Please confirm capacity by EOD Friday.", respondBy: "2026-05-30T17:00:00Z" } },
      responses: [{ status: 202, schema: "BroadcastReport", desc: "Broadcast scheduled. Returns a per-supplier delivery breakdown." }],
      responseExample: { id: "01HZXBROADCAST123456789ABC", scheduledFor: "2026-05-26T17:22:01Z", deliveries: [{ supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH", channels: ["portal_inbox", "email"], status: "queued" }] } }
  );

  /* ===== Config — worker types ==================================== */
  add(
    { id: "cfg_workertypes_get", tag: "config",
      method: "GET", path: "/config/worker-types",
      name: "Get worker-type config",
      summary: "Returns per-worker-type platform configuration — agreement template, classification policy, approval thresholds.",
      detail:
        "Flex Work distinguishes Frontline (always on), Professional, Contractors, and SOW Resources. Each type has its own cadence settings, document defaults, and tax treatment.",
      responses: [{ status: 200, schema: "WorkerTypeConfig", desc: "Per-type configuration." }],
      responseExample: { frontline: { enabled: true, agreementTemplateId: "01HZXAGR0001FRONTLINE000ABC", approvalThreshold: { amount: 0, currency: "USD" } }, professional: { enabled: true, agreementTemplateId: "01HZXAGR0001PROFESSION0DEF", approvalThreshold: { amount: 5000, currency: "USD" } }, contractor: { enabled: true, classificationPolicyId: "01HZXPOL0001CLASSIFICATION1", approvalThreshold: { amount: 2500, currency: "USD" } }, sow_resource: { enabled: false } } },

    { id: "cfg_workertypes_set", tag: "config",
      method: "PUT", path: "/config/worker-types",
      name: "Update worker-type config",
      summary: "Bulk-replace the worker-type configuration. Changes only take effect for new engagements.",
      body: { schemaRef: "WorkerTypeConfig", example: { contractor: { enabled: true, approvalThreshold: { amount: 5000, currency: "USD" } } } },
      responses: [{ status: 200, schema: "WorkerTypeConfig", desc: "Updated config." }],
      responseExample: { contractor: { enabled: true, approvalThreshold: { amount: 5000, currency: "USD" } } } }
  );

  /* ===== Enrichments: longer descriptions on highest-traffic eps ==
     We attach a `detail` paragraph to a curated set of endpoints; the
     renderer surfaces this below the summary on the endpoint page. ===*/
  function enrich(epId, detail) {
    var ep = spec.paths.find(function (p) { return p.id === epId; });
    if (ep) ep.detail = detail;
  }

  enrich("auth_token",
    "The grant_type=client_credentials flow is for server-to-server callers — daemons, ETL jobs, payroll exports. " +
    "Tokens it returns are bound to one Flex Work org and one role (Admin, Manager, Supplier, etc.); they CANNOT escalate scope at runtime. " +
    "If you need a user-context token (the user is signed in and you want to call the API on their behalf), use the OAuth authorization_code flow at /auth/authorize instead. " +
    "Treat the client_secret like a password: rotate it every 90 days, store it in a secret manager, and never embed it in a mobile app."
  );

  enrich("req_list",
    "This is the entry point most integrations start at. The default page size is 50 and the maximum is 200. " +
    "Combine `engagementType`, `sourcingChannel`, and `status` to slice the work — for example, fetching every open Frontline-Agency requisition is a single call with three filters. " +
    "For very large result sets, pass `count=false` (the default) — including the total adds a non-trivial COUNT(*) query at the storage layer. " +
    "Records that the caller can't see (different org, different scope) are quietly omitted; they DO NOT count toward totalCount."
  );

  enrich("req_create",
    "Requisitions are state machines. A newly-created record sits in `draft` until it clears the configured approval workflow, then moves to `pending_approval` → `open` → `filled` → `closed`. " +
    "Validation is layered: schema validation runs first (required fields, types), then platform rules (pay rate ≥ minimum wage for the location, supplier must be active, location open), then per-org policies. " +
    "When a 400 is returned, the `field` property names the exact JSON path of the violation so you can surface a precise error to the user. " +
    "Pair this call with `X-Flexwork-Idempotency-Key` so a network retry doesn't accidentally create a duplicate requisition."
  );

  enrich("req_distribute",
    "Distribution turns a requisition into supplier-visible demand. Strategy `all` blasts every active supplier in scope; `tiered` releases to tier 1 first and waits the configured `tierWait` minutes before opening to tier 2; `preferred` only releases to a curated list; `manual` requires an explicit supplierIds array. " +
    "The response describes the resolved plan — it does NOT confirm that the suppliers have received the notification yet. Subscribe to the `requisition.distributed` webhook event for that. " +
    "Re-distributing an already-distributed requisition is allowed and will only notify newly-added suppliers; existing recipients won't get a duplicate ping."
  );

  enrich("ts_approve",
    "Approval is the trigger for almost everything downstream — invoice generation, payroll export, supplier funding accrual, audit-log entry, dashboard counters. " +
    "Once a timesheet is approved, its entries become immutable; the only way to alter the recorded hours is via `/timesheets/{id}/adjustments`, which preserves the original audit trail. " +
    "Approval is a single SQL transaction — there's no partial state. If the post-approval workflow chain fails, the timesheet stays approved and the platform retries the downstream steps with exponential backoff."
  );

  enrich("inv_approve",
    "Approving an invoice posts the spend to the org's general ledger via the configured finance integration (Workday, NetSuite, SAP, or generic CSV). " +
    "If `glAccount` is omitted, the platform resolves the destination account using a precedence: requisition override → engagement type → location default → org default. " +
    "Approved invoices generate a `journal_entry.created` event so finance integrations can reconcile in near-real-time."
  );

  enrich("hk_create",
    "Subscribe to the events your integration cares about — there are 40+ event types listed at /webhooks/events. " +
    "Every delivery carries an `X-Flexwork-Signature` HMAC-SHA256 of the raw body, computed with the signing secret returned in this response. " +
    "Verify it before processing; reject mismatches. " +
    "Delivery uses exponential backoff: 1m, 3m, 10m, 30m, 1h, 3h, 6h, 12h, 24h, 72h. After 72h the delivery is abandoned and the subscription is marked unhealthy in the developer portal. " +
    "Endpoints should respond with a 2xx within 5 seconds; longer responses are treated as failures and retried."
  );

  enrich("metrics_query",
    "The metric query engine is read-only and idempotent — calling it twice with the same body returns the same result barring data changes in the window. " +
    "Use it to power custom dashboards, scheduled reports, or BI extracts. " +
    "Combine `groupBy` and `granularity` to pivot the result; for example, `groupBy: [\"supplier\"]` + `granularity: \"week\"` produces a row per supplier per week. " +
    "Hard limit: each query returns at most 50,000 rows. Larger pulls should be done through the audit log export or via the BI Connector."
  );

  enrich("audit_list",
    "The audit log is append-only and immutable. Every state change in the platform writes one event with the actor, the action, the before/after snapshot, the trace id, and the IP address of the caller. " +
    "Standard retention is 7 years (configurable down to the org's compliance regime — HIPAA tenants retain 6, SOX tenants retain 7, EU tenants honor GDPR right-to-erasure for non-financial events). " +
    "For compliance exports, pair this with `actorId` and `since`/`until` filters and stream through cursor pagination — the total event count can be in the tens of millions for active tenants."
  );

})();
