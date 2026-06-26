/* =====================================================================
   Flex Work API · OpenAPI spec (data only)
   ---------------------------------------------------------------------
   Sourced from the public Flex Work v2 platform reference. Mirrors the
   live OpenAPI 3.0 document at:
       https://api.dayforce.com/flex-work/v1/openapi.json

   Renderer lives in api-docs-renderer.js.
   ===================================================================== */
window.FW_API_SPEC = {
  info: {
    title: "Flex Work API",
    version: "1.0",
    description:
      "The Flex Work API is the platform interface to Dayforce's vendor management system. " +
      "Every page in the product is backed by these endpoints — requisitions, candidates, " +
      "timesheets, invoices, schedules, supplier contracts, and the workflow engine that " +
      "binds them. Endpoints are REST over HTTPS, return JSON, and accept JSON bodies. " +
      "Identifiers are ULIDs. Timestamps are RFC 3339 in UTC.",
    contact: { name: "Flex Work Platform", url: "https://developer.dayforce.com/flex-work" }
  },

  servers: [
    { name: "Production", url: "https://api.dayforce.com/flex-work/v1" },
    { name: "Sandbox",    url: "https://api.sandbox.dayforce.com/flex-work/v1" },
    { name: "EU",         url: "https://api.eu.dayforce.com/flex-work/v1" }
  ],

  auth: {
    description:
      "All requests must be authenticated. Flex Work uses OAuth 2.0 with the " +
      "client_credentials grant for server-to-server traffic, and the authorization_code " +
      "grant for delegated access from a managed user account.",
    schemes: [
      { name: "Bearer token", type: "http", scheme: "bearer", header: "Authorization: Bearer <token>" },
      { name: "Org context",  type: "header", header: "X-Flexwork-Org: <orgId>" }
    ]
  },

  tags: [
    {
      id: "auth",
      name: "Authentication",
      description:
        "Exchange your client credentials for an access token. Tokens are scoped to " +
        "an org and a role and expire after one hour."
    },
    {
      id: "requisitions",
      name: "Requisitions",
      description:
        "Requisitions are the unit of demand in Flex Work. Every requisition has an " +
        "engagement type (Shift, Assignment, Project, Statement of Work) and a sourcing " +
        "channel (Frontline, Agency, EOR, Independent Contractor, SOW vendor)."
    },
    {
      id: "workers",
      name: "Workers",
      description:
        "A worker is a person engaged through Flex Work. Workers carry tenure across " +
        "requisitions; the API surfaces the active engagement, credentials, and shift history."
    },
    {
      id: "suppliers",
      name: "Suppliers",
      description:
        "Staffing agencies, EOR partners, and SOW vendors that fulfil requisitions. " +
        "Contracts, distribution lists, and funding rules are all addressable via this API."
    },
    {
      id: "timesheets",
      name: "Timesheets",
      description:
        "Per-shift time captured by workers, approved by managers, and posted to payroll. " +
        "All values are stored in the requisition's pay currency."
    },
    {
      id: "schedules",
      name: "Schedules",
      description:
        "Shifts and shift patterns. The schedule engine handles publish, swap, drop, " +
        "and pick-up flows for shift-based engagements."
    },
    {
      id: "invoices",
      name: "Invoices",
      description:
        "Invoices generated from approved time, milestones, or fixed-fee SOW lines. " +
        "Returns the invoice header plus line-level detail."
    },
    {
      id: "locations",
      name: "Locations",
      description:
        "Physical worksites attached to the org tree. Locations carry their own " +
        "tax jurisdiction, work hours, and managers."
    },
    {
      id: "jobs",
      name: "Jobs catalog",
      description:
        "The job catalog. Each org maintains a Frontline catalog and (optionally) " +
        "a Professional catalog with longer-tail roles."
    },
    {
      id: "workflows",
      name: "Workflows",
      description:
        "Approval flows that fire on requisition submit, candidate hire, timesheet " +
        "approve, and invoice approve. Workflows can be paused, reordered, or branched."
    },
    {
      id: "budgets",
      name: "Budgets",
      description:
        "Org-level spend budgets, broken down by department, location, and engagement " +
        "type. Includes committed and realized spend."
    },
    {
      id: "webhooks",
      name: "Webhooks",
      description:
        "Subscribe to platform events with a signed HTTPS callback. Delivery uses " +
        "exponential backoff with a 72-hour ceiling."
    },
    {
      id: "audit",
      name: "Audit log",
      description:
        "Immutable record of every state change in the platform. Used for compliance " +
        "exports and incident review."
    }
  ],

  /* ===== Reusable schemas ============================================= */
  schemas: {
    Requisition: {
      description: "A demand record for one or more workers.",
      fields: [
        { name: "id",              type: "string<ulid>",    required: true,  desc: "Unique requisition identifier." },
        { name: "code",            type: "string",          required: true,  desc: "Human-readable code, e.g. \"REQ-08421\"." },
        { name: "title",           type: "string",          required: true,  desc: "Free-text title visible to managers and suppliers." },
        { name: "engagementType",  type: "enum",            required: true,  desc: "One of the four canonical engagement types.", enum: ["shift", "assignment", "project", "statementOfWork"] },
        { name: "sourcingChannel", type: "enum",            required: true,  desc: "Where workers will be sourced from.", enum: ["frontline", "agency", "eor", "independent", "sow"] },
        { name: "jobId",           type: "string<ulid>",    required: true,  desc: "Reference to the job in the catalog." },
        { name: "locationId",      type: "string<ulid>",    required: true,  desc: "Worksite the requisition is anchored to." },
        { name: "headcount",       type: "integer",         required: true,  desc: "Number of workers needed. Greater than zero." },
        { name: "startDate",       type: "string<date>",    required: true,  desc: "First day workers may start." },
        { name: "endDate",         type: "string<date>",    required: false, desc: "Optional end date. Open-ended if omitted." },
        { name: "payRate",         type: "Money",           required: false, desc: "Hourly pay rate. Required for Shift / Assignment / Project." },
        { name: "billRate",        type: "Money",           required: false, desc: "Hourly bill rate, gross of supplier markup." },
        { name: "totalValue",      type: "Money",           required: false, desc: "Fixed-fee value. Required for Statement of Work." },
        { name: "status",          type: "enum",            required: true,  desc: "Lifecycle state.", enum: ["draft", "pending_approval", "open", "filled", "closed", "cancelled"] },
        { name: "createdAt",       type: "string<datetime>",required: true,  desc: "RFC 3339 timestamp of creation." },
        { name: "createdBy",       type: "string<ulid>",    required: true,  desc: "User who created the requisition." }
      ]
    },
    Worker: {
      description: "A person engaged through Flex Work.",
      fields: [
        { name: "id",                  type: "string<ulid>",    required: true,  desc: "Unique worker identifier; stable across requisitions." },
        { name: "displayName",         type: "string",          required: true,  desc: "Preferred name to show in product UI." },
        { name: "legalFirstName",      type: "string",          required: true,  desc: "Legal first name as it appears on tax forms." },
        { name: "legalLastName",       type: "string",          required: true,  desc: "Legal last name." },
        { name: "email",               type: "string<email>",   required: true,  desc: "Primary contact email." },
        { name: "phone",               type: "string",          required: false, desc: "E.164 phone, optional." },
        { name: "engagementType",      type: "enum",            required: true,  desc: "Current engagement type.", enum: ["shift", "assignment", "project", "statementOfWork"] },
        { name: "sourcingChannel",     type: "enum",            required: true,  desc: "How the worker is sourced.", enum: ["frontline", "agency", "eor", "independent", "sow"] },
        { name: "currentRequisitionId",type: "string<ulid>",    required: false, desc: "Active requisition, if any." },
        { name: "supplierId",          type: "string<ulid>",    required: false, desc: "Supplier of record. Null for frontline workers." },
        { name: "tenureWeeks",         type: "integer",         required: true,  desc: "Total weeks of engaged tenure across all requisitions." },
        { name: "status",              type: "enum",            required: true,  desc: "Worker state.", enum: ["onboarding", "active", "on_leave", "ended"] }
      ]
    },
    Supplier: {
      description: "Staffing partner that fulfils requisitions.",
      fields: [
        { name: "id",            type: "string<ulid>",    required: true,  desc: "Supplier identifier." },
        { name: "name",          type: "string",          required: true,  desc: "Legal supplier name." },
        { name: "type",          type: "enum",            required: true,  desc: "Supplier classification.", enum: ["agency", "eor", "sow", "independent"] },
        { name: "primaryContactEmail", type: "string<email>", required: true, desc: "Primary point of contact." },
        { name: "contractStatus",type: "enum",            required: true,  desc: "Master contract state.", enum: ["draft", "pending", "active", "expired", "terminated"] },
        { name: "fillRate",      type: "number",          required: false, desc: "Historical fill rate, 0–1." },
        { name: "rating",        type: "number",          required: false, desc: "Aggregate quality rating, 0–5." },
        { name: "createdAt",     type: "string<datetime>",required: true,  desc: "RFC 3339 timestamp of creation." }
      ]
    },
    Timesheet: {
      description: "A worker's time captured for one pay period.",
      fields: [
        { name: "id",             type: "string<ulid>", required: true,  desc: "Timesheet identifier." },
        { name: "workerId",       type: "string<ulid>", required: true,  desc: "Worker the timesheet belongs to." },
        { name: "requisitionId",  type: "string<ulid>", required: true,  desc: "Requisition the time was worked against." },
        { name: "weekStarting",   type: "string<date>", required: true,  desc: "First day of the pay week, ISO 8601." },
        { name: "hours",          type: "number",       required: true,  desc: "Total hours captured. Two decimal precision." },
        { name: "overtimeHours",  type: "number",       required: false, desc: "Subset of hours classified as overtime." },
        { name: "status",         type: "enum",         required: true,  desc: "Lifecycle state.", enum: ["draft", "submitted", "approved", "rejected", "exported"] },
        { name: "approvedBy",     type: "string<ulid>", required: false, desc: "User who approved this timesheet." },
        { name: "approvedAt",     type: "string<datetime>", required: false, desc: "When the timesheet was approved." }
      ]
    },
    Shift: {
      description: "A planned or worked shift on a schedule.",
      fields: [
        { name: "id",          type: "string<ulid>",    required: true,  desc: "Shift identifier." },
        { name: "scheduleId",  type: "string<ulid>",    required: true,  desc: "Schedule the shift belongs to." },
        { name: "workerId",    type: "string<ulid>",    required: false, desc: "Assigned worker, null if open." },
        { name: "locationId",  type: "string<ulid>",    required: true,  desc: "Where the shift is worked." },
        { name: "jobId",       type: "string<ulid>",    required: true,  desc: "Job the shift is performed as." },
        { name: "startsAt",    type: "string<datetime>",required: true,  desc: "Shift start, RFC 3339." },
        { name: "endsAt",      type: "string<datetime>",required: true,  desc: "Shift end, RFC 3339." },
        { name: "status",      type: "enum",            required: true,  desc: "Shift lifecycle.", enum: ["open", "assigned", "confirmed", "in_progress", "completed", "no_show"] }
      ]
    },
    Invoice: {
      description: "An invoice generated by Flex Work for approved spend.",
      fields: [
        { name: "id",             type: "string<ulid>",    required: true,  desc: "Invoice identifier." },
        { name: "number",         type: "string",          required: true,  desc: "Human-readable invoice number." },
        { name: "supplierId",     type: "string<ulid>",    required: true,  desc: "Supplier the invoice belongs to." },
        { name: "periodStart",    type: "string<date>",    required: true,  desc: "First day of the billed period." },
        { name: "periodEnd",      type: "string<date>",    required: true,  desc: "Last day of the billed period." },
        { name: "subtotal",       type: "Money",           required: true,  desc: "Pre-tax subtotal." },
        { name: "tax",            type: "Money",           required: true,  desc: "Tax applied to the subtotal." },
        { name: "total",          type: "Money",           required: true,  desc: "Grand total billed." },
        { name: "status",         type: "enum",            required: true,  desc: "Invoice state.", enum: ["draft", "issued", "approved", "paid", "disputed", "void"] },
        { name: "lines",          type: "Array<InvoiceLine>", required: true, desc: "Line items billed on this invoice." }
      ]
    },
    Money: {
      description: "Monetary value with explicit currency.",
      fields: [
        { name: "amount",   type: "number",  required: true, desc: "Decimal value to two places." },
        { name: "currency", type: "string<iso4217>", required: true, desc: "ISO 4217 currency code." }
      ]
    },
    Page: {
      description: "Cursor pagination envelope wrapping any list response.",
      fields: [
        { name: "data",        type: "Array",   required: true,  desc: "List of records on this page." },
        { name: "nextCursor",  type: "string",  required: false, desc: "Opaque cursor for the next page, null when no more." },
        { name: "totalCount",  type: "integer", required: false, desc: "Total matching records, included when count=true." }
      ]
    },
    Error: {
      description: "Standard error envelope returned on 4xx and 5xx.",
      fields: [
        { name: "type",    type: "string",          required: true,  desc: "Stable error code, e.g. \"requisition.headcount_invalid\"." },
        { name: "title",   type: "string",          required: true,  desc: "Short human-readable error summary." },
        { name: "detail",  type: "string",          required: false, desc: "Long-form explanation of what failed." },
        { name: "field",   type: "string",          required: false, desc: "Specific field that triggered the error, if applicable." },
        { name: "traceId", type: "string<ulid>",    required: true,  desc: "Trace identifier for incident review." }
      ]
    }
  },

  /* ===== Endpoints ====================================================
     Each entry generates:
       - a left-nav row
       - a center-column section
       - a right-rail code sample and response example
     ==================================================================== */
  paths: [
    /* ----------- Authentication ----------- */
    {
      id: "auth_token", tag: "auth",
      method: "POST", path: "/auth/token",
      name: "Exchange credentials for a token",
      summary:
        "Trades a client ID + secret (or refresh token) for a short-lived access token " +
        "scoped to a Flex Work org.",
      params: [
        { name: "X-Flexwork-Org", in: "header", type: "string<ulid>", required: true, desc: "Target org. Tokens are always org-scoped." }
      ],
      body: {
        schema: [
          { name: "grant_type",    type: "enum",   required: true,  desc: "OAuth grant.", enum: ["client_credentials", "refresh_token"] },
          { name: "client_id",     type: "string", required: true,  desc: "API client ID provisioned in Settings → Developer." },
          { name: "client_secret", type: "string", required: false, desc: "Required when grant_type is client_credentials." },
          { name: "refresh_token", type: "string", required: false, desc: "Required when grant_type is refresh_token." },
          { name: "scope",         type: "string", required: false, desc: "Space-delimited scope list. Defaults to the client's full scope." }
        ],
        example: {
          grant_type: "client_credentials",
          client_id: "fw_live_a08c3d…",
          client_secret: "•••••••••••",
          scope: "requisitions.read requisitions.write workers.read"
        }
      },
      responses: [
        { status: 200, schema: "TokenResponse", desc: "A bearer token plus expiry metadata." },
        { status: 401, schema: "Error", desc: "Credentials rejected." }
      ],
      responseExample: {
        access_token: "eyJraWQiOiJmd2tpZF8wMSIs…",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "requisitions.read requisitions.write workers.read",
        org_id: "01HZX5N4F8…"
      }
    },
    {
      id: "auth_revoke", tag: "auth",
      method: "POST", path: "/auth/revoke",
      name: "Revoke a token",
      summary:
        "Immediately invalidate an access token or refresh token. Returns 204 even if the " +
        "token was already expired.",
      body: {
        schema: [
          { name: "token", type: "string", required: true, desc: "The token to revoke." },
          { name: "token_type_hint", type: "enum", required: false, desc: "Optional hint for faster lookup.", enum: ["access_token", "refresh_token"] }
        ],
        example: { token: "eyJraWQiOiJmd2tpZF8wMSIs…", token_type_hint: "access_token" }
      },
      responses: [
        { status: 204, schema: null, desc: "Token revoked." },
        { status: 401, schema: "Error", desc: "Caller not authorized to revoke this token." }
      ],
      responseExample: null
    },

    /* ----------- Requisitions ----------- */
    {
      id: "req_list", tag: "requisitions",
      method: "GET", path: "/requisitions",
      name: "List requisitions",
      summary:
        "Returns a cursor-paginated list of requisitions visible to the caller. " +
        "Default page size is 50.",
      params: [
        { name: "engagementType", in: "query", type: "enum",   required: false, desc: "Filter by engagement type.", enum: ["shift", "assignment", "project", "statementOfWork"] },
        { name: "sourcingChannel",in: "query", type: "enum",   required: false, desc: "Filter by sourcing channel.", enum: ["frontline", "agency", "eor", "independent", "sow"] },
        { name: "status",         in: "query", type: "enum",   required: false, desc: "Filter by lifecycle status.", enum: ["draft", "pending_approval", "open", "filled", "closed", "cancelled"] },
        { name: "locationId",     in: "query", type: "string<ulid>", required: false, desc: "Restrict to one location." },
        { name: "supplierId",     in: "query", type: "string<ulid>", required: false, desc: "Restrict to requisitions distributed to one supplier." },
        { name: "openedAfter",    in: "query", type: "string<date>", required: false, desc: "Requisitions opened on or after this date." },
        { name: "cursor",         in: "query", type: "string", required: false, desc: "Pagination cursor from a previous response." },
        { name: "limit",          in: "query", type: "integer",required: false, desc: "Page size, 1–200. Defaults to 50." },
        { name: "count",          in: "query", type: "boolean",required: false, desc: "Include totalCount in the response. Adds latency." }
      ],
      responses: [
        { status: 200, schema: "Page<Requisition>", desc: "Page of requisitions." },
        { status: 400, schema: "Error", desc: "Invalid filter or cursor." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZX7K2QM4FN0R8VBSE6PA7CY",
            code: "REQ-08421",
            title: "Warehouse picker — overnight",
            engagementType: "shift",
            sourcingChannel: "agency",
            jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH",
            locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX",
            headcount: 8,
            startDate: "2026-06-01",
            endDate: "2026-09-30",
            payRate: { amount: 22.50, currency: "USD" },
            billRate: { amount: 31.75, currency: "USD" },
            status: "open",
            createdAt: "2026-05-20T14:08:12Z",
            createdBy: "01HZX0J0XM7R1F2N6K3L7S5VWE"
          }
        ],
        nextCursor: "eyJpZCI6IjAxSFpYN0sy…",
        totalCount: 248
      }
    },
    {
      id: "req_create", tag: "requisitions",
      method: "POST", path: "/requisitions",
      name: "Create a requisition",
      summary:
        "Creates a requisition. The combination of engagementType and sourcingChannel " +
        "determines which fields are required — for instance, Statement of Work requires " +
        "totalValue but not headcount.",
      body: {
        schemaRef: "Requisition (without id, createdAt, createdBy)",
        example: {
          title: "Warehouse picker — overnight",
          engagementType: "shift",
          sourcingChannel: "agency",
          jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH",
          locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX",
          headcount: 8,
          startDate: "2026-06-01",
          endDate: "2026-09-30",
          payRate: { amount: 22.50, currency: "USD" },
          billRate: { amount: 31.75, currency: "USD" }
        }
      },
      responses: [
        { status: 201, schema: "Requisition", desc: "Requisition created, ready to distribute." },
        { status: 400, schema: "Error", desc: "Body failed validation. The Error.field identifies the offending property." },
        { status: 409, schema: "Error", desc: "A draft for the same job and start date already exists." }
      ],
      responseExample: {
        id: "01HZX7K2QM4FN0R8VBSE6PA7CY",
        code: "REQ-08421",
        title: "Warehouse picker — overnight",
        engagementType: "shift",
        sourcingChannel: "agency",
        status: "draft",
        createdAt: "2026-05-26T17:22:01Z",
        createdBy: "01HZX0J0XM7R1F2N6K3L7S5VWE"
      }
    },
    {
      id: "req_get", tag: "requisitions",
      method: "GET", path: "/requisitions/{requisitionId}",
      name: "Get a requisition",
      summary: "Returns one requisition by ID, including its current distribution list and fill state.",
      params: [
        { name: "requisitionId", in: "path", type: "string<ulid>", required: true, desc: "Requisition to fetch." },
        { name: "include",       in: "query", type: "enum", required: false, desc: "Optional related entities to inline in the response.", enum: ["distribution", "candidates", "workers", "timesheets"] }
      ],
      responses: [
        { status: 200, schema: "Requisition", desc: "Requisition envelope." },
        { status: 404, schema: "Error", desc: "Requisition not found or not visible to this caller." }
      ],
      responseExample: {
        id: "01HZX7K2QM4FN0R8VBSE6PA7CY",
        code: "REQ-08421",
        title: "Warehouse picker — overnight",
        engagementType: "shift",
        sourcingChannel: "agency",
        headcount: 8,
        status: "open",
        startDate: "2026-06-01",
        endDate: "2026-09-30"
      }
    },
    {
      id: "req_update", tag: "requisitions",
      method: "PATCH", path: "/requisitions/{requisitionId}",
      name: "Update a requisition",
      summary:
        "Partial update. Only fields included in the body are changed. Some fields " +
        "(engagementType, sourcingChannel) are immutable once the requisition is open.",
      params: [
        { name: "requisitionId", in: "path", type: "string<ulid>", required: true, desc: "Requisition to update." }
      ],
      body: {
        schemaRef: "Subset of Requisition",
        example: { headcount: 10, endDate: "2026-10-15" }
      },
      responses: [
        { status: 200, schema: "Requisition", desc: "Updated requisition." },
        { status: 400, schema: "Error", desc: "Illegal field change for the current state." },
        { status: 404, schema: "Error", desc: "Requisition not found." }
      ],
      responseExample: { id: "01HZX7K2QM4FN0R8VBSE6PA7CY", headcount: 10, endDate: "2026-10-15", status: "open" }
    },
    {
      id: "req_distribute", tag: "requisitions",
      method: "POST", path: "/requisitions/{requisitionId}:distribute",
      name: "Distribute a requisition",
      summary:
        "Submits the requisition to one or more suppliers based on the supplied " +
        "distribution rules. Returns the resolved distribution list.",
      params: [
        { name: "requisitionId", in: "path", type: "string<ulid>", required: true, desc: "Requisition to distribute." }
      ],
      body: {
        schema: [
          { name: "strategy",  type: "enum",         required: true,  desc: "Distribution strategy.", enum: ["all", "tiered", "preferred", "manual"] },
          { name: "supplierIds", type: "Array<string<ulid>>", required: false, desc: "Required when strategy=manual." },
          { name: "tierWait",  type: "integer",      required: false, desc: "Minutes to wait between tiers when strategy=tiered." },
          { name: "respondBy", type: "string<datetime>", required: false, desc: "Hard deadline for supplier responses." }
        ],
        example: { strategy: "tiered", tierWait: 60, respondBy: "2026-05-27T17:00:00Z" }
      },
      responses: [
        { status: 200, schema: "DistributionResult", desc: "Resolved distribution list." },
        { status: 409, schema: "Error", desc: "Requisition is not in a distributable state." }
      ],
      responseExample: {
        requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
        strategy: "tiered",
        tiers: [
          { tier: 1, supplierIds: ["01HZX0J7X1K8N4F5R3S2D2YQAH"], startsAt: "2026-05-26T17:30:00Z" },
          { tier: 2, supplierIds: ["01HZX0J7X1K8N4F5R3S2D2YQBJ", "01HZX0J7X1K8N4F5R3S2D2YQCK"], startsAt: "2026-05-26T18:30:00Z" }
        ]
      }
    },
    {
      id: "req_cancel", tag: "requisitions",
      method: "DELETE", path: "/requisitions/{requisitionId}",
      name: "Cancel a requisition",
      summary:
        "Soft-deletes a requisition by moving it to the cancelled state. Open shifts are " +
        "released and pending candidates are notified.",
      params: [
        { name: "requisitionId", in: "path", type: "string<ulid>", required: true, desc: "Requisition to cancel." },
        { name: "reason", in: "query", type: "string", required: false, desc: "Free-text reason recorded in the audit log." }
      ],
      responses: [
        { status: 204, schema: null, desc: "Requisition cancelled." },
        { status: 404, schema: "Error", desc: "Requisition not found." }
      ],
      responseExample: null
    },

    /* ----------- Workers ----------- */
    {
      id: "wrk_list", tag: "workers",
      method: "GET", path: "/workers",
      name: "List workers",
      summary: "Paginated list of workers, optionally filtered by engagement, supplier, or status.",
      params: [
        { name: "status",          in: "query", type: "enum",         required: false, desc: "Worker state filter.", enum: ["onboarding", "active", "on_leave", "ended"] },
        { name: "engagementType",  in: "query", type: "enum",         required: false, desc: "Filter by engagement type.", enum: ["shift", "assignment", "project", "statementOfWork"] },
        { name: "sourcingChannel", in: "query", type: "enum",         required: false, desc: "Filter by sourcing channel.", enum: ["frontline", "agency", "eor", "independent", "sow"] },
        { name: "supplierId",      in: "query", type: "string<ulid>", required: false, desc: "Workers belonging to one supplier." },
        { name: "locationId",      in: "query", type: "string<ulid>", required: false, desc: "Workers anchored to one location." },
        { name: "search",          in: "query", type: "string",       required: false, desc: "Substring match against name, email, or worker code." },
        { name: "cursor",          in: "query", type: "string",       required: false, desc: "Pagination cursor." },
        { name: "limit",           in: "query", type: "integer",      required: false, desc: "Page size, 1–200. Defaults to 50." }
      ],
      responses: [
        { status: 200, schema: "Page<Worker>", desc: "Page of workers." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZX0J8B7P3R2K6F9D5N8M4WT",
            displayName: "Maya Okafor",
            legalFirstName: "Maya",
            legalLastName: "Okafor",
            email: "maya.okafor@example.com",
            engagementType: "shift",
            sourcingChannel: "agency",
            supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH",
            currentRequisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
            tenureWeeks: 41,
            status: "active"
          }
        ],
        nextCursor: null,
        totalCount: 1
      }
    },
    {
      id: "wrk_get", tag: "workers",
      method: "GET", path: "/workers/{workerId}",
      name: "Get a worker",
      summary: "Returns one worker, including their active engagement and credentials.",
      params: [
        { name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to fetch." }
      ],
      responses: [
        { status: 200, schema: "Worker", desc: "Worker envelope." },
        { status: 404, schema: "Error", desc: "Worker not found." }
      ],
      responseExample: {
        id: "01HZX0J8B7P3R2K6F9D5N8M4WT",
        displayName: "Maya Okafor",
        email: "maya.okafor@example.com",
        engagementType: "shift",
        sourcingChannel: "agency",
        tenureWeeks: 41,
        status: "active"
      }
    },
    {
      id: "wrk_assign", tag: "workers",
      method: "POST", path: "/workers/{workerId}:assign",
      name: "Assign a worker to a requisition",
      summary:
        "Moves a worker into a new requisition. Used for direct placements (frontline) and " +
        "for migrating an existing worker between requisitions.",
      params: [
        { name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to assign." }
      ],
      body: {
        schema: [
          { name: "requisitionId", type: "string<ulid>", required: true,  desc: "Target requisition." },
          { name: "startDate",     type: "string<date>", required: true,  desc: "First day on the new requisition." },
          { name: "endDate",       type: "string<date>", required: false, desc: "Optional end date." },
          { name: "payRate",       type: "Money",        required: false, desc: "Override pay rate, if different from the requisition default." }
        ],
        example: {
          requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
          startDate: "2026-06-01",
          payRate: { amount: 23.00, currency: "USD" }
        }
      },
      responses: [
        { status: 200, schema: "Worker", desc: "Updated worker with new active requisition." },
        { status: 409, schema: "Error", desc: "Requisition has no remaining headcount." }
      ],
      responseExample: { id: "01HZX0J8B7P3R2K6F9D5N8M4WT", currentRequisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", status: "active" }
    },
    {
      id: "wrk_offboard", tag: "workers",
      method: "POST", path: "/workers/{workerId}:offboard",
      name: "Offboard a worker",
      summary:
        "End a worker's engagement. Closes the active requisition seat, fires the offboarding " +
        "workflow, and triggers final pay where applicable.",
      params: [
        { name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to offboard." }
      ],
      body: {
        schema: [
          { name: "lastDay",   type: "string<date>", required: true,  desc: "Worker's last working day." },
          { name: "reasonCode",type: "enum",         required: true,  desc: "Offboarding reason.", enum: ["assignment_ended", "performance", "no_show", "voluntary", "headcount_reduction"] },
          { name: "rehireEligible", type: "boolean", required: false, desc: "Whether the worker may be rehired. Defaults to true." }
        ],
        example: { lastDay: "2026-06-30", reasonCode: "assignment_ended", rehireEligible: true }
      },
      responses: [
        { status: 200, schema: "Worker", desc: "Worker moved to ended state." },
        { status: 404, schema: "Error", desc: "Worker not found." }
      ],
      responseExample: { id: "01HZX0J8B7P3R2K6F9D5N8M4WT", status: "ended" }
    },

    /* ----------- Suppliers ----------- */
    {
      id: "sup_list", tag: "suppliers",
      method: "GET", path: "/suppliers",
      name: "List suppliers",
      summary: "Paginated list of staffing partners attached to the org.",
      params: [
        { name: "type",   in: "query", type: "enum",    required: false, desc: "Filter by supplier classification.", enum: ["agency", "eor", "sow", "independent"] },
        { name: "status", in: "query", type: "enum",    required: false, desc: "Filter by contract state.", enum: ["draft", "pending", "active", "expired", "terminated"] },
        { name: "search", in: "query", type: "string",  required: false, desc: "Substring match against supplier name." },
        { name: "cursor", in: "query", type: "string",  required: false, desc: "Pagination cursor." },
        { name: "limit",  in: "query", type: "integer", required: false, desc: "Page size, 1–200." }
      ],
      responses: [
        { status: 200, schema: "Page<Supplier>", desc: "Page of suppliers." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZX0J7X1K8N4F5R3S2D2YQAH",
            name: "StaffWise West",
            type: "agency",
            primaryContactEmail: "ops@staffwise.example",
            contractStatus: "active",
            fillRate: 0.86,
            rating: 4.4,
            createdAt: "2024-11-04T10:31:00Z"
          }
        ],
        nextCursor: null
      }
    },
    {
      id: "sup_get", tag: "suppliers",
      method: "GET", path: "/suppliers/{supplierId}",
      name: "Get a supplier",
      summary: "Returns one supplier with their master contract metadata.",
      params: [
        { name: "supplierId", in: "path", type: "string<ulid>", required: true, desc: "Supplier to fetch." }
      ],
      responses: [
        { status: 200, schema: "Supplier", desc: "Supplier envelope." },
        { status: 404, schema: "Error", desc: "Supplier not found." }
      ],
      responseExample: {
        id: "01HZX0J7X1K8N4F5R3S2D2YQAH",
        name: "StaffWise West",
        type: "agency",
        contractStatus: "active",
        fillRate: 0.86
      }
    },
    {
      id: "sup_contract", tag: "suppliers",
      method: "POST", path: "/suppliers/{supplierId}/contracts",
      name: "Create a supplier contract",
      summary:
        "Adds a new master contract revision. The previous revision is retained in the " +
        "audit log; only one contract can be active per supplier at a time.",
      params: [
        { name: "supplierId", in: "path", type: "string<ulid>", required: true, desc: "Supplier to contract with." }
      ],
      body: {
        schema: [
          { name: "effectiveStart",  type: "string<date>", required: true, desc: "First day the contract is in effect." },
          { name: "effectiveEnd",    type: "string<date>", required: false, desc: "Optional end date." },
          { name: "markupPct",       type: "number",       required: true, desc: "Default supplier markup, e.g. 0.42 for 42%." },
          { name: "paymentTermsDays",type: "integer",      required: true, desc: "Net payment terms in days." },
          { name: "documentUrl",     type: "string<uri>",  required: false, desc: "Link to the signed PDF in document storage." }
        ],
        example: {
          effectiveStart: "2026-07-01",
          markupPct: 0.42,
          paymentTermsDays: 30,
          documentUrl: "https://docs.dayforce.com/contracts/sw-2026.pdf"
        }
      },
      responses: [
        { status: 201, schema: "Contract", desc: "Contract created and made active." }
      ],
      responseExample: {
        id: "01HZX9M3D5T8Q2N7P4F1H7B6KE",
        supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH",
        effectiveStart: "2026-07-01",
        markupPct: 0.42,
        status: "active"
      }
    },

    /* ----------- Timesheets ----------- */
    {
      id: "ts_list", tag: "timesheets",
      method: "GET", path: "/timesheets",
      name: "List timesheets",
      summary: "Paginated list of timesheets, with filters for status, worker, and pay period.",
      params: [
        { name: "status",       in: "query", type: "enum",         required: false, desc: "Filter by lifecycle state.", enum: ["draft", "submitted", "approved", "rejected", "exported"] },
        { name: "workerId",     in: "query", type: "string<ulid>", required: false, desc: "One worker's timesheets." },
        { name: "requisitionId",in: "query", type: "string<ulid>", required: false, desc: "All timesheets for one requisition." },
        { name: "weekStarting", in: "query", type: "string<date>", required: false, desc: "Match a specific pay week." },
        { name: "cursor",       in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [
        { status: 200, schema: "Page<Timesheet>", desc: "Page of timesheets." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZX9N1KD7H4F2R6S3P8M5VYC",
            workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT",
            requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
            weekStarting: "2026-05-18",
            hours: 38.5,
            overtimeHours: 0,
            status: "submitted"
          }
        ],
        nextCursor: null
      }
    },
    {
      id: "ts_approve", tag: "timesheets",
      method: "POST", path: "/timesheets/{timesheetId}:approve",
      name: "Approve a timesheet",
      summary:
        "Approve a submitted timesheet. Triggers the post-approval workflow (invoice " +
        "generation, payroll export, etc.).",
      params: [
        { name: "timesheetId", in: "path", type: "string<ulid>", required: true, desc: "Timesheet to approve." }
      ],
      body: {
        schema: [
          { name: "note", type: "string", required: false, desc: "Optional manager note. Visible to the worker and audit log." }
        ],
        example: { note: "OK — Thursday OT pre-approved." }
      },
      responses: [
        { status: 200, schema: "Timesheet", desc: "Timesheet moved to approved." },
        { status: 409, schema: "Error", desc: "Timesheet is not in a submittable state." }
      ],
      responseExample: {
        id: "01HZX9N1KD7H4F2R6S3P8M5VYC",
        status: "approved",
        approvedBy: "01HZX0J0XM7R1F2N6K3L7S5VWE",
        approvedAt: "2026-05-26T17:21:55Z"
      }
    },
    {
      id: "ts_reject", tag: "timesheets",
      method: "POST", path: "/timesheets/{timesheetId}:reject",
      name: "Reject a timesheet",
      summary:
        "Reject a submitted timesheet and return it to the worker for correction. The reason " +
        "is shown to the worker in the mobile app.",
      params: [
        { name: "timesheetId", in: "path", type: "string<ulid>", required: true, desc: "Timesheet to reject." }
      ],
      body: {
        schema: [
          { name: "reason", type: "string", required: true, desc: "Why the timesheet was rejected. Required." }
        ],
        example: { reason: "Thursday hours don't match the gate-scan record." }
      },
      responses: [
        { status: 200, schema: "Timesheet", desc: "Timesheet moved back to draft with the reason attached." }
      ],
      responseExample: {
        id: "01HZX9N1KD7H4F2R6S3P8M5VYC",
        status: "rejected"
      }
    },

    /* ----------- Schedules ----------- */
    {
      id: "sch_list_shifts", tag: "schedules",
      method: "GET", path: "/shifts",
      name: "List shifts",
      summary: "Paginated list of shifts across schedules. Useful for building external schedule views.",
      params: [
        { name: "scheduleId",   in: "query", type: "string<ulid>",     required: false, desc: "Restrict to one schedule." },
        { name: "workerId",     in: "query", type: "string<ulid>",     required: false, desc: "Restrict to one worker." },
        { name: "locationId",   in: "query", type: "string<ulid>",     required: false, desc: "Restrict to one location." },
        { name: "status",       in: "query", type: "enum",             required: false, desc: "Filter by shift state.", enum: ["open", "assigned", "confirmed", "in_progress", "completed", "no_show"] },
        { name: "startsAfter",  in: "query", type: "string<datetime>", required: false, desc: "Only shifts starting on or after this timestamp." },
        { name: "startsBefore", in: "query", type: "string<datetime>", required: false, desc: "Only shifts starting before this timestamp." },
        { name: "cursor",       in: "query", type: "string",           required: false, desc: "Pagination cursor." }
      ],
      responses: [
        { status: 200, schema: "Page<Shift>", desc: "Page of shifts." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZX9P2RM8K4F6D7N3S6PA2WT",
            scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
            workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT",
            locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX",
            jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH",
            startsAt: "2026-06-01T22:00:00Z",
            endsAt: "2026-06-02T06:00:00Z",
            status: "assigned"
          }
        ],
        nextCursor: null
      }
    },
    {
      id: "sch_publish", tag: "schedules",
      method: "POST", path: "/schedules/{scheduleId}:publish",
      name: "Publish a schedule",
      summary:
        "Move every shift in the schedule from draft to published. Notifications are " +
        "queued to workers and supervisors.",
      params: [
        { name: "scheduleId", in: "path", type: "string<ulid>", required: true, desc: "Schedule to publish." }
      ],
      body: {
        schema: [
          { name: "notifyWorkers",     type: "boolean", required: false, desc: "Whether to send push + email notifications. Defaults to true." },
          { name: "respectQuietHours", type: "boolean", required: false, desc: "Suppress notifications outside the location's quiet hours. Defaults to true." }
        ],
        example: { notifyWorkers: true, respectQuietHours: true }
      },
      responses: [
        { status: 200, schema: "Schedule", desc: "Schedule published with publishedAt timestamp." }
      ],
      responseExample: {
        id: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        publishedAt: "2026-05-26T17:22:01Z",
        shiftCount: 142
      }
    },
    {
      id: "sch_swap", tag: "schedules",
      method: "POST", path: "/shifts/{shiftId}:swap",
      name: "Swap a shift",
      summary:
        "Initiates a shift swap between two workers. The receiving worker must accept " +
        "before the swap takes effect.",
      params: [
        { name: "shiftId", in: "path", type: "string<ulid>", required: true, desc: "Shift being offered." }
      ],
      body: {
        schema: [
          { name: "toWorkerId",  type: "string<ulid>", required: true, desc: "Worker the shift is offered to." },
          { name: "message",     type: "string",       required: false, desc: "Optional message attached to the swap request." }
        ],
        example: { toWorkerId: "01HZX0J8B7P3R2K6F9D5N8M4WB", message: "Trading for Friday off — appreciate it." }
      },
      responses: [
        { status: 202, schema: "SwapRequest", desc: "Swap request created, awaiting acceptance." }
      ],
      responseExample: {
        id: "01HZX9Q7TS2K8F6D3N1M4PA9WC",
        shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT",
        toWorkerId: "01HZX0J8B7P3R2K6F9D5N8M4WB",
        status: "pending"
      }
    },

    /* ----------- Invoices ----------- */
    {
      id: "inv_list", tag: "invoices",
      method: "GET", path: "/invoices",
      name: "List invoices",
      summary: "Paginated invoice list, filterable by supplier, period, and status.",
      params: [
        { name: "supplierId",  in: "query", type: "string<ulid>", required: false, desc: "Restrict to one supplier." },
        { name: "status",      in: "query", type: "enum",         required: false, desc: "Filter by invoice state.", enum: ["draft", "issued", "approved", "paid", "disputed", "void"] },
        { name: "periodStart", in: "query", type: "string<date>", required: false, desc: "Restrict to invoices whose period starts on or after this date." },
        { name: "periodEnd",   in: "query", type: "string<date>", required: false, desc: "Restrict to invoices whose period ends on or before this date." },
        { name: "cursor",      in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [
        { status: 200, schema: "Page<Invoice>", desc: "Page of invoices." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZXA0K2N4R8F7D3M2P5S6QWE",
            number: "INV-2026-08421",
            supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH",
            periodStart: "2026-05-04",
            periodEnd: "2026-05-17",
            subtotal: { amount: 41280.50, currency: "USD" },
            tax:      { amount:  3302.44, currency: "USD" },
            total:    { amount: 44582.94, currency: "USD" },
            status: "issued"
          }
        ],
        nextCursor: null
      }
    },
    {
      id: "inv_get", tag: "invoices",
      method: "GET", path: "/invoices/{invoiceId}",
      name: "Get an invoice",
      summary: "Returns the invoice header and all of its line items.",
      params: [
        { name: "invoiceId", in: "path", type: "string<ulid>", required: true, desc: "Invoice to fetch." }
      ],
      responses: [
        { status: 200, schema: "Invoice", desc: "Invoice with line items." },
        { status: 404, schema: "Error", desc: "Invoice not found." }
      ],
      responseExample: {
        id: "01HZXA0K2N4R8F7D3M2P5S6QWE",
        number: "INV-2026-08421",
        total: { amount: 44582.94, currency: "USD" },
        status: "issued",
        lines: [
          { id: "01HZXA1T7P2R8M4F5K6D9N3S2W", description: "Regular hours · week of May 11", hours: 320, rate: 31.75, amount: 10160.00 },
          { id: "01HZXA1T7P2R8M4F5K6D9N3S2X", description: "Overtime hours · week of May 11",  hours:  18, rate: 47.63, amount:   857.34 }
        ]
      }
    },
    {
      id: "inv_approve", tag: "invoices",
      method: "POST", path: "/invoices/{invoiceId}:approve",
      name: "Approve an invoice",
      summary:
        "Approve an issued invoice. Posts the spend to the org's general ledger via the " +
        "configured finance integration.",
      params: [
        { name: "invoiceId", in: "path", type: "string<ulid>", required: true, desc: "Invoice to approve." }
      ],
      body: {
        schema: [
          { name: "glAccount", type: "string", required: false, desc: "Override GL account; defaults to the location's account." }
        ],
        example: { glAccount: "6400-1100-OPS" }
      },
      responses: [
        { status: 200, schema: "Invoice", desc: "Invoice moved to approved." }
      ],
      responseExample: { id: "01HZXA0K2N4R8F7D3M2P5S6QWE", status: "approved" }
    },

    /* ----------- Locations ----------- */
    {
      id: "loc_list", tag: "locations",
      method: "GET", path: "/locations",
      name: "List locations",
      summary: "Paginated list of every worksite attached to the org.",
      params: [
        { name: "search", in: "query", type: "string",  required: false, desc: "Substring match against location name." },
        { name: "active", in: "query", type: "boolean", required: false, desc: "If true, exclude archived locations. Defaults to true." },
        { name: "cursor", in: "query", type: "string",  required: false, desc: "Pagination cursor." }
      ],
      responses: [
        { status: 200, schema: "Page<Location>", desc: "Page of locations." }
      ],
      responseExample: {
        data: [
          { id: "01HZX0J5W1S9D8H7N3E6Q4R2YX", name: "Reno DC-3",   timezone: "America/Los_Angeles", country: "US", state: "NV", postalCode: "89506" },
          { id: "01HZX0J5W1S9D8H7N3E6Q4R2YY", name: "Phoenix DC-1", timezone: "America/Phoenix",     country: "US", state: "AZ", postalCode: "85003" }
        ],
        nextCursor: null
      }
    },
    {
      id: "loc_create", tag: "locations",
      method: "POST", path: "/locations",
      name: "Create a location",
      summary: "Adds a new worksite to the org tree.",
      body: {
        schema: [
          { name: "name",           type: "string", required: true, desc: "Display name." },
          { name: "address1",       type: "string", required: true, desc: "Street address." },
          { name: "city",           type: "string", required: true, desc: "City." },
          { name: "state",          type: "string", required: true, desc: "State or region code." },
          { name: "country",        type: "string<iso3166>", required: true, desc: "Two-letter country code." },
          { name: "postalCode",     type: "string", required: true, desc: "Postal code." },
          { name: "timezone",       type: "string", required: true, desc: "IANA timezone, e.g. \"America/New_York\"." },
          { name: "parentOrgUnitId",type: "string<ulid>", required: false, desc: "Optional org-tree parent." }
        ],
        example: {
          name: "Reno DC-3",
          address1: "1500 Vista Boulevard",
          city: "Reno", state: "NV", country: "US", postalCode: "89506",
          timezone: "America/Los_Angeles"
        }
      },
      responses: [
        { status: 201, schema: "Location", desc: "Location created." }
      ],
      responseExample: { id: "01HZX0J5W1S9D8H7N3E6Q4R2YX", name: "Reno DC-3" }
    },

    /* ----------- Jobs catalog ----------- */
    {
      id: "jobs_list", tag: "jobs",
      method: "GET", path: "/jobs",
      name: "List jobs",
      summary: "Paginated catalog of jobs the org has configured.",
      params: [
        { name: "category", in: "query", type: "enum",   required: false, desc: "Catalog scope.", enum: ["frontline", "professional"] },
        { name: "search",   in: "query", type: "string", required: false, desc: "Substring match against job title." },
        { name: "cursor",   in: "query", type: "string", required: false, desc: "Pagination cursor." }
      ],
      responses: [
        { status: 200, schema: "Page<Job>", desc: "Page of jobs." }
      ],
      responseExample: {
        data: [
          { id: "01HZX0J9V6KM6H7TB1W3D7F2QH", title: "Warehouse picker", category: "frontline", defaultPayRate: { amount: 22.50, currency: "USD" } },
          { id: "01HZX0J9V6KM6H7TB1W3D7F2QJ", title: "Forklift operator", category: "frontline", defaultPayRate: { amount: 26.00, currency: "USD" } }
        ],
        nextCursor: null
      }
    },
    {
      id: "jobs_get", tag: "jobs",
      method: "GET", path: "/jobs/{jobId}",
      name: "Get a job",
      summary: "Returns one job, including its default pay band and credential requirements.",
      params: [
        { name: "jobId", in: "path", type: "string<ulid>", required: true, desc: "Job to fetch." }
      ],
      responses: [
        { status: 200, schema: "Job", desc: "Job envelope." },
        { status: 404, schema: "Error", desc: "Job not found." }
      ],
      responseExample: {
        id: "01HZX0J9V6KM6H7TB1W3D7F2QH",
        title: "Warehouse picker",
        category: "frontline",
        defaultPayRate: { amount: 22.50, currency: "USD" },
        credentialIds: ["01HZX0JCREDOSHA10HOURABC123"]
      }
    },

    /* ----------- Workflows ----------- */
    {
      id: "wf_list", tag: "workflows",
      method: "GET", path: "/workflows",
      name: "List workflows",
      summary: "Returns the workflows currently installed on the org.",
      params: [
        { name: "trigger", in: "query", type: "enum",   required: false, desc: "Filter by trigger event.", enum: ["requisition.submit", "candidate.hire", "timesheet.approve", "invoice.approve", "worker.offboard"] },
        { name: "active",  in: "query", type: "boolean",required: false, desc: "If true, only active workflows. Defaults to true." }
      ],
      responses: [
        { status: 200, schema: "Array<Workflow>", desc: "List of workflows." }
      ],
      responseExample: [
        { id: "01HZX0JWFLOWREQAPPROVE0001", name: "Requisition approval — North America", trigger: "requisition.submit", stepCount: 3, active: true },
        { id: "01HZX0JWFLOWTSAPPROVE00002", name: "Timesheet approval — Frontline",        trigger: "timesheet.approve", stepCount: 1, active: true }
      ]
    },
    {
      id: "wf_run", tag: "workflows",
      method: "POST", path: "/workflows/{workflowId}:run",
      name: "Run a workflow",
      summary:
        "Synchronously triggers a workflow for one entity. Returns the run record; check " +
        "/workflow-runs/{id} for status if the workflow contains long-running steps.",
      params: [
        { name: "workflowId", in: "path", type: "string<ulid>", required: true, desc: "Workflow to run." }
      ],
      body: {
        schema: [
          { name: "subjectType", type: "enum",         required: true, desc: "Type of subject the run is for.", enum: ["requisition", "candidate", "timesheet", "invoice", "worker"] },
          { name: "subjectId",   type: "string<ulid>", required: true, desc: "Subject identifier." },
          { name: "context",     type: "object",       required: false, desc: "Optional arbitrary context blob passed to every step." }
        ],
        example: { subjectType: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY" }
      },
      responses: [
        { status: 202, schema: "WorkflowRun", desc: "Run accepted and scheduled." }
      ],
      responseExample: {
        id: "01HZXB2QRUN8F7D3K6N2M4PA5WC",
        workflowId: "01HZX0JWFLOWREQAPPROVE0001",
        subjectType: "requisition",
        subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
        status: "running",
        startedAt: "2026-05-26T17:22:01Z"
      }
    },

    /* ----------- Budgets ----------- */
    {
      id: "bg_list", tag: "budgets",
      method: "GET", path: "/budgets",
      name: "List budgets",
      summary: "Returns org budgets, optionally rolled up by department or location.",
      params: [
        { name: "fiscalYear",    in: "query", type: "integer",      required: false, desc: "Fiscal year, e.g. 2026. Defaults to current." },
        { name: "departmentId",  in: "query", type: "string<ulid>", required: false, desc: "Restrict to one department." },
        { name: "locationId",    in: "query", type: "string<ulid>", required: false, desc: "Restrict to one location." }
      ],
      responses: [
        { status: 200, schema: "Array<Budget>", desc: "Budget records with committed and realized spend." }
      ],
      responseExample: [
        {
          id: "01HZXC0K2N4R8F7D3M2P5S6BUDX",
          fiscalYear: 2026,
          departmentId: "01HZX0JDEPOPS00000000000001",
          plan:     { amount: 4200000, currency: "USD" },
          committed:{ amount: 2710000, currency: "USD" },
          realized: { amount: 1840000, currency: "USD" }
        }
      ]
    },

    /* ----------- Webhooks ----------- */
    {
      id: "hk_list", tag: "webhooks",
      method: "GET", path: "/webhooks",
      name: "List webhook subscriptions",
      summary: "Returns the org's webhook subscriptions.",
      responses: [
        { status: 200, schema: "Array<Webhook>", desc: "Subscriptions list." }
      ],
      responseExample: [
        { id: "01HZX0JWHOOK000001234567ABC", url: "https://hooks.acme.example/dayforce", events: ["requisition.opened", "timesheet.approved"], active: true }
      ]
    },
    {
      id: "hk_create", tag: "webhooks",
      method: "POST", path: "/webhooks",
      name: "Create a webhook",
      summary:
        "Registers a new HTTPS endpoint to receive event callbacks. The platform signs every " +
        "delivery with HMAC-SHA256 using the returned signing secret.",
      body: {
        schema: [
          { name: "url",       type: "string<uri>",     required: true,  desc: "HTTPS endpoint that will receive events." },
          { name: "events",    type: "Array<string>",   required: true,  desc: "Subscribed event types." },
          { name: "active",    type: "boolean",         required: false, desc: "Whether to start delivering immediately. Defaults to true." }
        ],
        example: {
          url: "https://hooks.acme.example/dayforce",
          events: ["requisition.opened", "requisition.filled", "timesheet.approved", "invoice.approved"]
        }
      },
      responses: [
        { status: 201, schema: "Webhook", desc: "Subscription created. Includes the one-time signing secret." }
      ],
      responseExample: {
        id: "01HZX0JWHOOK000001234567ABC",
        url: "https://hooks.acme.example/dayforce",
        events: ["requisition.opened", "requisition.filled", "timesheet.approved", "invoice.approved"],
        signingSecret: "whsec_4n…⟨only shown once⟩",
        active: true
      }
    },
    {
      id: "hk_delete", tag: "webhooks",
      method: "DELETE", path: "/webhooks/{webhookId}",
      name: "Delete a webhook",
      summary: "Removes a webhook subscription. No further deliveries are attempted.",
      params: [
        { name: "webhookId", in: "path", type: "string<ulid>", required: true, desc: "Subscription to delete." }
      ],
      responses: [
        { status: 204, schema: null, desc: "Subscription removed." }
      ],
      responseExample: null
    },

    /* ----------- Audit log ----------- */
    {
      id: "audit_list", tag: "audit",
      method: "GET", path: "/audit-events",
      name: "List audit events",
      summary:
        "Cursor-paginated audit log. The log records every state change in Flex Work — " +
        "requisition transitions, timesheet edits, supplier-contract changes, configuration " +
        "saves, and login events.",
      params: [
        { name: "subjectType", in: "query", type: "enum",          required: false, desc: "Filter by subject type.", enum: ["requisition", "worker", "supplier", "timesheet", "invoice", "workflow", "user", "config"] },
        { name: "subjectId",   in: "query", type: "string<ulid>",  required: false, desc: "Filter by subject identifier." },
        { name: "actorId",     in: "query", type: "string<ulid>",  required: false, desc: "Filter by user who performed the action." },
        { name: "since",       in: "query", type: "string<datetime>", required: false, desc: "Only events at or after this timestamp." },
        { name: "until",       in: "query", type: "string<datetime>", required: false, desc: "Only events before this timestamp." },
        { name: "cursor",      in: "query", type: "string",        required: false, desc: "Pagination cursor." }
      ],
      responses: [
        { status: 200, schema: "Page<AuditEvent>", desc: "Page of audit events." }
      ],
      responseExample: {
        data: [
          {
            id: "01HZXD0K2N4R8F7D3M2P5S6AUDX",
            at: "2026-05-26T17:22:01Z",
            actorId: "01HZX0J0XM7R1F2N6K3L7S5VWE",
            action: "requisition.approved",
            subjectType: "requisition",
            subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
            before: { status: "pending_approval" },
            after:  { status: "open" }
          }
        ],
        nextCursor: "eyJpZCI6IjAxSFpYRDBLMk40Uj…"
      }
    }
  ]
};
