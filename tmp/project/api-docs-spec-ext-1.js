/* =====================================================================
   Flex Work API · spec extension (part 1 — platform foundation)
   ---------------------------------------------------------------------
   Adds tags, schemas, and paths for:
     · Organization & settings
     · Users, roles, permissions
     · Org tree (org units)
     · Configuration (engagement types, supplier types, jobs catalog)
     · Reference data (countries, locales, industries)
     · Notifications / inbox
   Loaded after api-docs-spec.js. Appends in place.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing — load api-docs-spec.js first"); return; }

  /* ---------- additional tags ---------- */
  // Insert new tags at semantically appropriate positions.
  function insertAfter(arr, afterId, items) {
    var i = arr.findIndex(function (t) { return t.id === afterId; });
    if (i < 0) i = arr.length - 1;
    arr.splice.apply(arr, [i + 1, 0].concat(items));
  }

  insertAfter(spec.tags, "auth", [
    {
      id: "organization",
      name: "Organization",
      description:
        "The org is the tenant boundary. Endpoints here surface the org's profile, " +
        "feature flags, industry context, and reference data — the values the rest " +
        "of the platform resolves against."
    },
    {
      id: "users",
      name: "Users & roles",
      description:
        "Internal users with seats on the platform. Each user carries one role per org; " +
        "the role grants a fixed set of permissions on top of the user's data scope."
    },
    {
      id: "org-tree",
      name: "Org tree",
      description:
        "Hierarchical org units (divisions, regions, departments, cost centers) attached " +
        "to the org. Locations hang off org units. Supplier distribution rules and " +
        "approval workflows can be scoped to any node."
    },
    {
      id: "config",
      name: "Configuration",
      description:
        "Per-org platform configuration — enabled engagement types, supplier types, " +
        "industry context, feature flags. Changes are audit-logged."
    }
  ]);

  insertAfter(spec.tags, "requisitions", [
    {
      id: "requisition-templates",
      name: "Requisition templates",
      description:
        "Reusable requisition shapes. Used at intake to pre-fill the form, and at bulk " +
        "import to validate incoming rows."
    },
    {
      id: "candidates",
      name: "Candidates & submittals",
      description:
        "Supplier-submitted candidates against an open requisition. Tracks the submittal " +
        "through screening, interview, offer, hire, and rejection."
    },
    {
      id: "sow",
      name: "Statement of Work",
      description:
        "SOWs are fixed-fee engagements with deliverables and milestones. The SOW API " +
        "covers the contract surface; payroll-style time goes through /timesheets."
    },
    {
      id: "contractors",
      name: "Contractors",
      description:
        "Independent contractors engaged directly by the org (no supplier in the middle). " +
        "Carries the misclassification test suite (IRS 20-factor, ABC test, exclusivity)."
    }
  ]);

  insertAfter(spec.tags, "workers", [
    {
      id: "credentials",
      name: "Credentials & compliance",
      description:
        "Credential definitions and worker-issued credentials. Includes compliance checks " +
        "(I-9, OSHA, FCRA background, drug screen) that run against workers on a cadence."
    }
  ]);

  insertAfter(spec.tags, "suppliers", [
    {
      id: "distribution",
      name: "Distribution rules",
      description:
        "Rules controlling which suppliers a requisition gets distributed to. Rules can " +
        "be set globally, by org-unit, or by location, and resolve into an ordered fan-out."
    },
    {
      id: "pricing",
      name: "Pricing & funding",
      description:
        "Pay/bill rate cards, supplier markup overrides, supplier funding rules, and " +
        "sales-tax rules. Used by the rate-resolver at requisition intake and at invoice time."
    },
    {
      id: "policies",
      name: "Policies",
      description:
        "Policy packs (background, drug screen, dress code, attendance) applied to " +
        "workers via worker-type or location scope."
    },
    {
      id: "talent-pools",
      name: "Talent pools",
      description:
        "Named groups of pre-qualified workers, automatically populated from rules " +
        "(tenure, performance, credentials) and reachable for fast re-engagement."
    }
  ]);

  insertAfter(spec.tags, "schedules", [
    {
      id: "time-off",
      name: "Time off",
      description:
        "Worker time-off requests, balances, and approvals. Time-off intersects with the " +
        "schedule engine — approved time-off opens shifts for pickup."
    }
  ]);

  insertAfter(spec.tags, "workflows", [
    {
      id: "notifications",
      name: "Notifications",
      description:
        "Per-user inbox of platform notifications (approvals, mentions, system events). " +
        "Preferences are per-user, per-channel (in-app, email, push)."
    },
    {
      id: "analytics",
      name: "Analytics & insights",
      description:
        "Pre-built metrics, ad-hoc queries, and saved insights. Powers the Insights tab " +
        "and the dashboard widget library."
    },
    {
      id: "dashboards",
      name: "Dashboards",
      description:
        "The home dashboard surface. Read the user's layout, list available widgets, " +
        "and save edits to tabs and widget configuration."
    }
  ]);

  insertAfter(spec.tags, "webhooks", [
    {
      id: "events",
      name: "Event catalog",
      description:
        "The full catalog of platform events you can subscribe to via webhooks. Each " +
        "event lists its trigger, payload schema, and retry policy."
    }
  ]);

  insertAfter(spec.tags, "audit", [
    {
      id: "system",
      name: "System",
      description:
        "Operational status of the platform — health, region, scheduled maintenance, " +
        "API keys, and rate-limit headroom for the calling client."
    },
    {
      id: "ai",
      name: "AI · Labs",
      description:
        "Endpoints powering the in-product AI assistant. Beta — surfaces are stable but " +
        "may evolve. Pair with the X-Flexwork-Labs header to opt in."
    }
  ]);

  /* ---------- additional schemas ---------- */
  Object.assign(spec.schemas, {
    OrgUnit: {
      description: "A node in the org tree.",
      fields: [
        { name: "id",          type: "string<ulid>", required: true,  desc: "Org-unit identifier." },
        { name: "name",        type: "string",       required: true,  desc: "Display name." },
        { name: "kind",        type: "enum",         required: true,  desc: "Node classification.", enum: ["division", "region", "department", "team", "cost_center"] },
        { name: "parentId",    type: "string<ulid>", required: false, desc: "Parent node; null for root." },
        { name: "managerId",   type: "string<ulid>", required: false, desc: "User who owns this node." },
        { name: "childCount",  type: "integer",      required: true,  desc: "Number of direct children." }
      ]
    },
    User: {
      description: "An internal Flex Work user.",
      fields: [
        { name: "id",         type: "string<ulid>",     required: true,  desc: "User identifier." },
        { name: "email",      type: "string<email>",    required: true,  desc: "Primary email; used for sign-in." },
        { name: "name",       type: "string",           required: true,  desc: "Display name." },
        { name: "roleId",     type: "string<ulid>",     required: true,  desc: "Assigned role." },
        { name: "orgUnitIds", type: "Array<string<ulid>>", required: false, desc: "Data-scope: org-units the user can see." },
        { name: "status",     type: "enum",             required: true,  desc: "User state.", enum: ["invited", "active", "suspended", "deactivated"] },
        { name: "lastSeenAt", type: "string<datetime>", required: false, desc: "RFC 3339 timestamp of last activity." }
      ]
    },
    Role: {
      description: "Named permission set assigned to users.",
      fields: [
        { name: "id",          type: "string<ulid>",   required: true, desc: "Role identifier." },
        { name: "name",        type: "string",         required: true, desc: "Display name." },
        { name: "description", type: "string",         required: false, desc: "Free-text description." },
        { name: "permissions", type: "Array<string>",  required: true, desc: "Permission codes, e.g. \"requisitions.write\"." },
        { name: "builtIn",     type: "boolean",        required: true, desc: "True for the platform-supplied roles (Admin, Manager, Supplier)." }
      ]
    },
    Candidate: {
      description: "A supplier-submitted candidate against a requisition.",
      fields: [
        { name: "id",            type: "string<ulid>",     required: true, desc: "Submittal identifier." },
        { name: "requisitionId", type: "string<ulid>",     required: true, desc: "Requisition the candidate is for." },
        { name: "supplierId",    type: "string<ulid>",     required: true, desc: "Supplier who submitted." },
        { name: "workerId",      type: "string<ulid>",     required: false, desc: "Worker record once they're engaged." },
        { name: "firstName",     type: "string",           required: true, desc: "Candidate first name." },
        { name: "lastName",      type: "string",           required: true, desc: "Candidate last name." },
        { name: "stage",         type: "enum",             required: true, desc: "Stage in the pipeline.", enum: ["submitted", "screening", "interview", "offer", "hired", "rejected", "withdrawn"] },
        { name: "rate",          type: "Money",            required: false, desc: "Candidate's proposed rate." },
        { name: "submittedAt",   type: "string<datetime>", required: true, desc: "When the submittal was created." }
      ]
    },
    SOW: {
      description: "A Statement of Work — a fixed-fee engagement.",
      fields: [
        { name: "id",         type: "string<ulid>",  required: true,  desc: "SOW identifier." },
        { name: "number",     type: "string",        required: true,  desc: "Human-readable SOW number." },
        { name: "title",      type: "string",        required: true,  desc: "Free-text title." },
        { name: "supplierId", type: "string<ulid>",  required: true,  desc: "Vendor performing the work." },
        { name: "totalValue", type: "Money",         required: true,  desc: "Total fixed fee." },
        { name: "startDate",  type: "string<date>",  required: true,  desc: "First day of performance." },
        { name: "endDate",    type: "string<date>",  required: true,  desc: "Last day of performance." },
        { name: "status",     type: "enum",          required: true,  desc: "Lifecycle state.", enum: ["draft", "pending_approval", "active", "completed", "cancelled"] }
      ]
    },
    Milestone: {
      description: "A deliverable on a Statement of Work.",
      fields: [
        { name: "id",        type: "string<ulid>",  required: true, desc: "Milestone identifier." },
        { name: "sowId",     type: "string<ulid>",  required: true, desc: "SOW this milestone belongs to." },
        { name: "title",     type: "string",        required: true, desc: "Milestone title." },
        { name: "value",     type: "Money",         required: true, desc: "Amount billed when complete." },
        { name: "dueDate",   type: "string<date>",  required: true, desc: "Target completion date." },
        { name: "status",    type: "enum",          required: true, desc: "Milestone state.", enum: ["pending", "in_progress", "completed", "approved", "rejected"] }
      ]
    },
    Credential: {
      description: "A credential type the org tracks for workers.",
      fields: [
        { name: "id",            type: "string<ulid>",  required: true,  desc: "Credential-type identifier." },
        { name: "code",          type: "string",        required: true,  desc: "Stable code, e.g. \"osha-10\"." },
        { name: "name",          type: "string",        required: true,  desc: "Display name." },
        { name: "issuer",        type: "string",        required: false, desc: "Issuing body, e.g. \"OSHA\"." },
        { name: "validityDays",  type: "integer",       required: false, desc: "How long the credential is valid for, in days." },
        { name: "renewable",     type: "boolean",       required: true,  desc: "Whether the credential can be renewed." }
      ]
    },
    Notification: {
      description: "An in-app notification for one user.",
      fields: [
        { name: "id",        type: "string<ulid>",     required: true,  desc: "Notification identifier." },
        { name: "userId",    type: "string<ulid>",     required: true,  desc: "Recipient." },
        { name: "kind",      type: "enum",             required: true,  desc: "Notification category.", enum: ["approval_request", "mention", "system", "shift_change", "credential_expiring"] },
        { name: "title",     type: "string",           required: true,  desc: "Short headline." },
        { name: "body",      type: "string",           required: false, desc: "Optional body copy." },
        { name: "subjectType",type: "string",          required: false, desc: "Type of the entity this notification is about." },
        { name: "subjectId", type: "string<ulid>",     required: false, desc: "Identifier of the related entity." },
        { name: "readAt",    type: "string<datetime>", required: false, desc: "When the user read it. Null if unread." },
        { name: "createdAt", type: "string<datetime>", required: true,  desc: "When the notification was created." }
      ]
    },
    Policy: {
      description: "A policy pack scoped to workers, locations, or worker types.",
      fields: [
        { name: "id",        type: "string<ulid>",   required: true,  desc: "Policy identifier." },
        { name: "name",      type: "string",         required: true,  desc: "Display name." },
        { name: "category",  type: "enum",           required: true,  desc: "Policy category.", enum: ["background_check", "drug_screen", "attendance", "dress_code", "harassment", "safety"] },
        { name: "scope",     type: "object",         required: true,  desc: "Resolved scope: org-units, locations, worker types." },
        { name: "active",    type: "boolean",        required: true,  desc: "Whether the policy is currently enforced." }
      ]
    }
  });

  /* ---------- helper to append paths ---------- */
  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }
  function id(p) { return p; }

  /* ===== Organization ============================================== */
  add(
    { id: "org_get", tag: "organization",
      method: "GET", path: "/org",
      name: "Get the current org",
      summary: "Returns the org profile for the token's scope.",
      responses: [{ status: 200, schema: "Org", desc: "Org envelope." }],
      responseExample: { id: "01HZX0J0ORG0000000000000XY", name: "Helios Power Generation", industry: "energy", country: "US", createdAt: "2024-02-11T14:02:00Z" } },

    { id: "org_update", tag: "organization",
      method: "PATCH", path: "/org",
      name: "Update the current org",
      summary: "Partial update of the org profile.",
      body: { schemaRef: "Subset of Org", example: { name: "Helios Power Generation" } },
      responses: [{ status: 200, schema: "Org", desc: "Updated org." }],
      responseExample: { id: "01HZX0J0ORG0000000000000XY", name: "Helios Power Generation" } },

    { id: "org_settings_get", tag: "organization",
      method: "GET", path: "/org/settings",
      name: "Get org settings",
      summary: "Returns the org's runtime configuration — enabled engagement types, supplier types, industry, locales.",
      responses: [{ status: 200, schema: "OrgSettings", desc: "Settings envelope." }],
      responseExample: { engagementTypes: ["shift", "assignment", "project", "statementOfWork"], supplierTypes: ["agency", "eor", "independent"], industry: "energy", defaultLocale: "en-US", defaultCurrency: "USD" } },

    { id: "org_settings_update", tag: "organization",
      method: "PATCH", path: "/org/settings",
      name: "Update org settings",
      summary: "Partially update the org's settings. Most changes are audit-logged and require an admin role.",
      body: { schemaRef: "Subset of OrgSettings", example: { engagementTypes: ["shift", "assignment", "statementOfWork"] } },
      responses: [{ status: 200, schema: "OrgSettings", desc: "Updated settings." }],
      responseExample: { engagementTypes: ["shift", "assignment", "statementOfWork"] } },

    { id: "org_flags_get", tag: "organization",
      method: "GET", path: "/org/feature-flags",
      name: "List feature flags",
      summary: "Returns every feature flag's current resolved value for the org.",
      responses: [{ status: 200, schema: "Map<string, boolean>", desc: "Flag map." }],
      responseExample: { agencyPro: true, aiChat: false, independentContractor: true, professionalJobTypes: true } },

    { id: "org_flag_update", tag: "organization",
      method: "PATCH", path: "/org/feature-flags/{flag}",
      name: "Set a feature flag",
      summary: "Toggle one feature flag. Most flags only take effect for new sessions.",
      params: [{ name: "flag", in: "path", type: "string", required: true, desc: "Flag identifier." }],
      body: { schema: [{ name: "value", type: "boolean", required: true, desc: "New value." }], example: { value: true } },
      responses: [{ status: 200, schema: "FeatureFlag", desc: "Updated flag." }],
      responseExample: { flag: "agencyPro", value: true } },

    { id: "ref_countries", tag: "organization",
      method: "GET", path: "/reference/countries",
      name: "List countries",
      summary: "Returns every country the platform supports for legal entities, payroll, and tax.",
      responses: [{ status: 200, schema: "Array<Country>", desc: "Country list." }],
      responseExample: [
        { code: "US", name: "United States", currency: "USD", payrollSupported: true },
        { code: "CA", name: "Canada",       currency: "CAD", payrollSupported: true },
        { code: "GB", name: "United Kingdom",currency: "GBP", payrollSupported: true }
      ] },

    { id: "ref_locales", tag: "organization",
      method: "GET", path: "/reference/locales",
      name: "List locales",
      summary: "Returns the locales the platform UI is translated into.",
      responses: [{ status: 200, schema: "Array<Locale>", desc: "Locale list." }],
      responseExample: [
        { code: "en-US", name: "English (US)" },
        { code: "fr-CA", name: "French (Canada)" },
        { code: "es-MX", name: "Spanish (Mexico)" }
      ] },

    { id: "ref_industries", tag: "organization",
      method: "GET", path: "/reference/industries",
      name: "List industries",
      summary: "Industries the platform ships preset defaults for.",
      responses: [{ status: 200, schema: "Array<Industry>", desc: "Industry list." }],
      responseExample: [
        { code: "energy",       name: "Energy & utilities" },
        { code: "healthcare",   name: "Healthcare" },
        { code: "retail",       name: "Retail & hospitality" },
        { code: "manufacturing",name: "Manufacturing & logistics" }
      ] }
  );

  /* ===== Users & roles ============================================= */
  add(
    { id: "users_list", tag: "users",
      method: "GET", path: "/users",
      name: "List users",
      summary: "Paginated list of internal users on the org.",
      params: [
        { name: "status", in: "query", type: "enum", required: false, desc: "Filter by status.", enum: ["invited", "active", "suspended", "deactivated"] },
        { name: "roleId", in: "query", type: "string<ulid>", required: false, desc: "Filter by role." },
        { name: "search", in: "query", type: "string", required: false, desc: "Substring match against name or email." },
        { name: "cursor", in: "query", type: "string", required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<User>", desc: "User page." }],
      responseExample: { data: [{ id: "01HZX0J0XM7R1F2N6K3L7S5VWE", email: "amy.chen@helios.example", name: "Amy Chen", roleId: "01HZX0JROLEADMIN000000000A", status: "active", lastSeenAt: "2026-05-26T17:12:08Z" }], nextCursor: null } },

    { id: "users_invite", tag: "users",
      method: "POST", path: "/users",
      name: "Invite a user",
      summary: "Creates a user record and sends them an invitation email.",
      body: { schema: [
        { name: "email",      type: "string<email>",       required: true,  desc: "Invitee email." },
        { name: "name",       type: "string",              required: true,  desc: "Display name." },
        { name: "roleId",     type: "string<ulid>",        required: true,  desc: "Role to assign." },
        { name: "orgUnitIds", type: "Array<string<ulid>>", required: false, desc: "Data-scope. Omit for full-org scope." }
      ], example: { email: "new.hire@helios.example", name: "Jordan Reyes", roleId: "01HZX0JROLEMANAGER0000001B" } },
      responses: [
        { status: 201, schema: "User", desc: "User invited." },
        { status: 409, schema: "Error", desc: "Email already belongs to an active user." }
      ],
      responseExample: { id: "01HZX0JUSERNEW0001234567XY", email: "new.hire@helios.example", name: "Jordan Reyes", status: "invited" } },

    { id: "users_get", tag: "users",
      method: "GET", path: "/users/{userId}",
      name: "Get a user",
      summary: "Returns one user.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User to fetch." }],
      responses: [{ status: 200, schema: "User", desc: "User envelope." }],
      responseExample: { id: "01HZX0J0XM7R1F2N6K3L7S5VWE", email: "amy.chen@helios.example", name: "Amy Chen", status: "active" } },

    { id: "users_update", tag: "users",
      method: "PATCH", path: "/users/{userId}",
      name: "Update a user",
      summary: "Partial update of a user's name, role, or scope.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User to update." }],
      body: { schemaRef: "Subset of User", example: { roleId: "01HZX0JROLEADMIN000000000A" } },
      responses: [{ status: 200, schema: "User", desc: "Updated user." }],
      responseExample: { id: "01HZX0J0XM7R1F2N6K3L7S5VWE", roleId: "01HZX0JROLEADMIN000000000A" } },

    { id: "users_deactivate", tag: "users",
      method: "DELETE", path: "/users/{userId}",
      name: "Deactivate a user",
      summary: "Move the user to deactivated. Their active sessions are revoked. The record is retained for audit.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User to deactivate." }],
      responses: [{ status: 204, schema: null, desc: "User deactivated." }],
      responseExample: null },

    { id: "users_me", tag: "users",
      method: "GET", path: "/users/me",
      name: "Get the current user",
      summary: "Returns the user record for the bearer token's principal.",
      responses: [{ status: 200, schema: "User", desc: "Current user." }],
      responseExample: { id: "01HZX0J0XM7R1F2N6K3L7S5VWE", email: "amy.chen@helios.example", name: "Amy Chen", roleId: "01HZX0JROLEADMIN000000000A" } },

    { id: "users_resend", tag: "users",
      method: "POST", path: "/users/{userId}:resend-invitation",
      name: "Resend an invitation",
      summary: "Resends the invitation email for a user still in `invited` state.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User to resend." }],
      responses: [
        { status: 204, schema: null, desc: "Invitation resent." },
        { status: 409, schema: "Error", desc: "User is not in the invited state." }
      ],
      responseExample: null },

    { id: "roles_list", tag: "users",
      method: "GET", path: "/roles",
      name: "List roles",
      summary: "Returns built-in and custom roles on the org.",
      responses: [{ status: 200, schema: "Array<Role>", desc: "Role list." }],
      responseExample: [
        { id: "01HZX0JROLEADMIN000000000A", name: "Admin",   permissions: ["*"], builtIn: true },
        { id: "01HZX0JROLEMANAGER0000001B", name: "Manager", permissions: ["requisitions.*", "timesheets.approve", "workers.read"], builtIn: true }
      ] },

    { id: "roles_create", tag: "users",
      method: "POST", path: "/roles",
      name: "Create a role",
      summary: "Creates a custom role. Built-in roles cannot be created or modified.",
      body: { schema: [
        { name: "name",        type: "string",        required: true,  desc: "Display name." },
        { name: "description", type: "string",        required: false, desc: "Free-text description." },
        { name: "permissions", type: "Array<string>", required: true,  desc: "Permission codes to grant." }
      ], example: { name: "Procurement reviewer", permissions: ["requisitions.read", "suppliers.read", "invoices.read"] } },
      responses: [{ status: 201, schema: "Role", desc: "Role created." }],
      responseExample: { id: "01HZX0JROLECUSTOM00000123C", name: "Procurement reviewer", builtIn: false } },

    { id: "roles_update", tag: "users",
      method: "PATCH", path: "/roles/{roleId}",
      name: "Update a role",
      summary: "Partial update of a custom role. Built-in roles return 403.",
      params: [{ name: "roleId", in: "path", type: "string<ulid>", required: true, desc: "Role to update." }],
      body: { schemaRef: "Subset of Role", example: { permissions: ["requisitions.read", "suppliers.read", "invoices.read", "invoices.approve"] } },
      responses: [{ status: 200, schema: "Role", desc: "Updated role." }, { status: 403, schema: "Error", desc: "Built-in role." }],
      responseExample: { id: "01HZX0JROLECUSTOM00000123C", permissions: ["requisitions.read", "suppliers.read", "invoices.read", "invoices.approve"] } },

    { id: "roles_delete", tag: "users",
      method: "DELETE", path: "/roles/{roleId}",
      name: "Delete a role",
      summary: "Deletes a custom role. Returns 409 if any users still hold the role.",
      params: [{ name: "roleId", in: "path", type: "string<ulid>", required: true, desc: "Role to delete." }],
      responses: [{ status: 204, schema: null, desc: "Role deleted." }, { status: 409, schema: "Error", desc: "Role still assigned to users." }],
      responseExample: null },

    { id: "permissions_list", tag: "users",
      method: "GET", path: "/permissions",
      name: "List permissions",
      summary: "Returns the full permission catalog with human-readable descriptions.",
      responses: [{ status: 200, schema: "Array<Permission>", desc: "Permission catalog." }],
      responseExample: [
        { code: "requisitions.read",  description: "Read requisitions visible to the user's scope." },
        { code: "requisitions.write", description: "Create and update requisitions in scope." },
        { code: "timesheets.approve", description: "Approve or reject submitted timesheets." }
      ] }
  );

  /* ===== Org tree ================================================== */
  add(
    { id: "orgtree_list", tag: "org-tree",
      method: "GET", path: "/org-units",
      name: "List org units",
      summary: "Flat list of org units. Pass `tree=true` to get the hierarchy instead.",
      params: [
        { name: "kind",     in: "query", type: "enum",         required: false, desc: "Filter by kind.", enum: ["division", "region", "department", "team", "cost_center"] },
        { name: "parentId", in: "query", type: "string<ulid>", required: false, desc: "Children of this parent." },
        { name: "tree",     in: "query", type: "boolean",      required: false, desc: "Return a nested hierarchy instead of a flat list." }
      ],
      responses: [{ status: 200, schema: "Array<OrgUnit>", desc: "Org-unit list." }],
      responseExample: [
        { id: "01HZX0JOU0NORTH000000000NA", name: "North America", kind: "region",     parentId: null,                           childCount: 3 },
        { id: "01HZX0JOU0WESTERN00000WST", name: "Western US",     kind: "region",     parentId: "01HZX0JOU0NORTH000000000NA",   childCount: 5 }
      ] },

    { id: "orgtree_create", tag: "org-tree",
      method: "POST", path: "/org-units",
      name: "Create an org unit",
      summary: "Adds a node to the org tree.",
      body: { schema: [
        { name: "name",      type: "string",       required: true,  desc: "Display name." },
        { name: "kind",      type: "enum",         required: true,  desc: "Node kind.", enum: ["division", "region", "department", "team", "cost_center"] },
        { name: "parentId",  type: "string<ulid>", required: false, desc: "Parent node. Omit for top-level." },
        { name: "managerId", type: "string<ulid>", required: false, desc: "Owner of this node." }
      ], example: { name: "Western US", kind: "region", parentId: "01HZX0JOU0NORTH000000000NA" } },
      responses: [{ status: 201, schema: "OrgUnit", desc: "Org unit created." }],
      responseExample: { id: "01HZX0JOU0WESTERN00000WST", name: "Western US", kind: "region" } },

    { id: "orgtree_get", tag: "org-tree",
      method: "GET", path: "/org-units/{orgUnitId}",
      name: "Get an org unit",
      summary: "Returns one node with its parent chain and direct children.",
      params: [{ name: "orgUnitId", in: "path", type: "string<ulid>", required: true, desc: "Org unit to fetch." }],
      responses: [{ status: 200, schema: "OrgUnit", desc: "Org-unit envelope." }],
      responseExample: { id: "01HZX0JOU0WESTERN00000WST", name: "Western US", kind: "region", parentId: "01HZX0JOU0NORTH000000000NA", childCount: 5 } },

    { id: "orgtree_update", tag: "org-tree",
      method: "PATCH", path: "/org-units/{orgUnitId}",
      name: "Update an org unit",
      summary: "Partial update. Moving a node by changing `parentId` re-parents the entire subtree.",
      params: [{ name: "orgUnitId", in: "path", type: "string<ulid>", required: true, desc: "Org unit to update." }],
      body: { schemaRef: "Subset of OrgUnit", example: { managerId: "01HZX0J0XM7R1F2N6K3L7S5VWE" } },
      responses: [{ status: 200, schema: "OrgUnit", desc: "Updated org unit." }],
      responseExample: { id: "01HZX0JOU0WESTERN00000WST", managerId: "01HZX0J0XM7R1F2N6K3L7S5VWE" } },

    { id: "orgtree_delete", tag: "org-tree",
      method: "DELETE", path: "/org-units/{orgUnitId}",
      name: "Delete an org unit",
      summary: "Deletes a leaf node. Returns 409 if the node has children or locations attached.",
      params: [{ name: "orgUnitId", in: "path", type: "string<ulid>", required: true, desc: "Org unit to delete." }],
      responses: [{ status: 204, schema: null, desc: "Org unit deleted." }, { status: 409, schema: "Error", desc: "Node has children or attached locations." }],
      responseExample: null }
  );

  /* ===== Configuration ============================================ */
  add(
    { id: "cfg_engtypes_get", tag: "config",
      method: "GET", path: "/config/engagement-types",
      name: "Get engagement-type config",
      summary: "Returns which engagement types are enabled for this org.",
      responses: [{ status: 200, schema: "EngagementTypeConfig", desc: "Per-type enabled flags + default copy." }],
      responseExample: { shift: { enabled: true, label: "Shift" }, assignment: { enabled: true, label: "Assignment" }, project: { enabled: true, label: "Project" }, statementOfWork: { enabled: true, label: "Statement of Work" } } },

    { id: "cfg_engtypes_set", tag: "config",
      method: "PUT", path: "/config/engagement-types",
      name: "Update engagement-type config",
      summary: "Bulk-replace the enabled engagement types and their labels.",
      body: { schemaRef: "EngagementTypeConfig", example: { shift: { enabled: true }, assignment: { enabled: true }, project: { enabled: false }, statementOfWork: { enabled: true } } },
      responses: [{ status: 200, schema: "EngagementTypeConfig", desc: "Saved config." }],
      responseExample: { shift: { enabled: true }, assignment: { enabled: true }, project: { enabled: false }, statementOfWork: { enabled: true } } },

    { id: "cfg_suptypes_get", tag: "config",
      method: "GET", path: "/config/supplier-types",
      name: "Get supplier-type config",
      summary: "Returns which supplier types are enabled (Agency, EOR, Independent Contractor).",
      responses: [{ status: 200, schema: "SupplierTypeConfig", desc: "Per-type enabled flags." }],
      responseExample: { agency: { enabled: true }, eor: { enabled: true }, independent: { enabled: true } } },

    { id: "cfg_suptypes_set", tag: "config",
      method: "PUT", path: "/config/supplier-types",
      name: "Update supplier-type config",
      summary: "Bulk-replace enabled supplier types.",
      body: { schemaRef: "SupplierTypeConfig", example: { agency: { enabled: true }, eor: { enabled: false }, independent: { enabled: true } } },
      responses: [{ status: 200, schema: "SupplierTypeConfig", desc: "Saved config." }],
      responseExample: { agency: { enabled: true }, eor: { enabled: false }, independent: { enabled: true } } },

    { id: "cfg_jobcats_get", tag: "config",
      method: "GET", path: "/config/job-categories",
      name: "Get job-catalog categories",
      summary: "Returns which job-catalog categories (Frontline, Professional) are enabled.",
      responses: [{ status: 200, schema: "JobCategoryConfig", desc: "Category flags." }],
      responseExample: { frontline: { enabled: true, jobCount: 42 }, professional: { enabled: true, jobCount: 17 } } },

    { id: "cfg_jobcats_set", tag: "config",
      method: "PUT", path: "/config/job-categories",
      name: "Update job-catalog categories",
      summary: "Bulk-replace enabled job categories.",
      body: { schemaRef: "JobCategoryConfig", example: { frontline: { enabled: true }, professional: { enabled: false } } },
      responses: [{ status: 200, schema: "JobCategoryConfig", desc: "Saved config." }],
      responseExample: { frontline: { enabled: true }, professional: { enabled: false } } }
  );

  /* ===== Notifications ============================================ */
  add(
    { id: "notif_list", tag: "notifications",
      method: "GET", path: "/notifications",
      name: "List notifications",
      summary: "Returns the current user's inbox, newest first.",
      params: [
        { name: "unreadOnly", in: "query", type: "boolean", required: false, desc: "If true, return only unread notifications." },
        { name: "kind",       in: "query", type: "enum",    required: false, desc: "Filter by kind.", enum: ["approval_request", "mention", "system", "shift_change", "credential_expiring"] },
        { name: "cursor",     in: "query", type: "string",  required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Notification>", desc: "Notification page." }],
      responseExample: { data: [
        { id: "01HZXDNOT01F7D3M2P5S6QWEKLM", userId: "01HZX0J0XM7R1F2N6K3L7S5VWE", kind: "approval_request", title: "3 timesheets awaiting your approval", subjectType: "timesheet", readAt: null, createdAt: "2026-05-26T17:12:08Z" }
      ], nextCursor: null, unreadCount: 7 } },

    { id: "notif_mark_read", tag: "notifications",
      method: "POST", path: "/notifications/{notificationId}:mark-read",
      name: "Mark a notification read",
      summary: "Marks one notification read and clears it from the unread counter.",
      params: [{ name: "notificationId", in: "path", type: "string<ulid>", required: true, desc: "Notification to mark read." }],
      responses: [{ status: 204, schema: null, desc: "Marked read." }],
      responseExample: null },

    { id: "notif_mark_all_read", tag: "notifications",
      method: "POST", path: "/notifications:mark-all-read",
      name: "Mark all read",
      summary: "Marks every unread notification in the user's inbox as read.",
      responses: [{ status: 204, schema: null, desc: "All marked read." }],
      responseExample: null },

    { id: "notif_prefs_get", tag: "notifications",
      method: "GET", path: "/notifications/preferences",
      name: "Get notification preferences",
      summary: "Returns the user's per-channel preferences (in-app, email, push).",
      responses: [{ status: 200, schema: "NotificationPreferences", desc: "Preference envelope." }],
      responseExample: { approval_request: { inApp: true, email: true, push: true }, mention: { inApp: true, email: false, push: true }, system: { inApp: true, email: false, push: false } } },

    { id: "notif_prefs_set", tag: "notifications",
      method: "PATCH", path: "/notifications/preferences",
      name: "Update notification preferences",
      summary: "Partial update of the user's notification preferences.",
      body: { schemaRef: "Subset of NotificationPreferences", example: { mention: { email: true } } },
      responses: [{ status: 200, schema: "NotificationPreferences", desc: "Updated preferences." }],
      responseExample: { mention: { inApp: true, email: true, push: true } } }
  );

})();
