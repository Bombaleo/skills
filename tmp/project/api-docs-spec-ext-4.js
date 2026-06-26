/* =====================================================================
   Flex Work API · spec extension (part 4 — audit close-out)
   ---------------------------------------------------------------------
   Implements every gap identified in Flex Work API Audit.html.

   Feature parity (P0/P1/P2):
     P-01 Rosters & bookings
     P-02 Comments, mentions & attachments
     P-03 Expense-policy administration
     P-04 Recurring requisitions
     P-05 Worker performance feedback
     P-06 Worker timesheet-correction requests
     P-07 Bulk-publish schedules
     P-08 Document signing
     P-09 Activity feed & favorites
     P-10 Help center content API
     P-11 Currency conversion, audit-log export, scheduled reports

   Scale & architecture:
     A-04 Long-running operations (/operations/{id})
     A-05 Change-data-capture stream (/events:stream)
     A-08 SCIM 2.0 provisioning
     A-09 OAuth 2.1 discovery & JWKS

   Cross-cutting conventions (A-01, A-02, A-03, A-06, A-07, A-10) are
   contracts, not endpoints — surfaced via new info pages registered in
   api-docs-renderer.js (conditional reads, sparse fieldsets, filter
   language, residency, deprecation contract).

   Total: +44 new endpoints in 13 new tags.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }
  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }
  function ensureTag(t) { if (!spec.tags.find(function (x) { return x.id === t.id; })) spec.tags.push(t); }

  /* =========== TAGS ================================================= */
  ensureTag({ id: "rosters",          name: "Rosters & bookings",
    description: "Hospitality event rostering — a Booking is one banquet event (BEO, date, guest count, captain) and the Roster fans its positions out into per-position shifts. Used by Aurora Resort and every hospitality customer." });
  ensureTag({ id: "comments",         name: "Comments & mentions",
    description: "Polymorphic comment threads attached to any entity (requisition, worker, timesheet, invoice, candidate, SOW). @-mentions fan out to the inbox endpoint as notifications." });
  ensureTag({ id: "attachments",      name: "Attachments",
    description: "Join records that bind /files records to entities. Pair with /comments to surface documents inline in a thread." });
  ensureTag({ id: "expense-policies", name: "Expense policy",
    description: "Per-org expense policy administration — categories, ceilings, per-diems, mileage rates. Pair with /expenses for line submission and the calculator endpoint for client-side preflight." });
  ensureTag({ id: "feedback",         name: "Worker feedback",
    description: "End-of-shift rating + free-text notes captured from manager-mobile. Drives talent-pool membership, supplier scorecards, and the rehire-eligible flag on offboarding." });
  ensureTag({ id: "signing",          name: "Document signing",
    description: "Outbound signing requests routed to DocuSign, Adobe Sign, or the native signer. One uniform surface; provider is pluggable. Listens for completion via the document.signed event." });
  ensureTag({ id: "favorites",        name: "Favorites & activity",
    description: "Personalization surfaces — what the current user has favorited, what they have recently viewed, and a chronological feed of their actions." });
  ensureTag({ id: "help",             name: "Help center",
    description: "Read-only API over the help-center content tree. Powers the in-product help drawer and the customer-facing portal at help.dayforce.com." });
  ensureTag({ id: "fx",               name: "Currency",
    description: "Reference rates and on-demand currency conversion. Sourced from the platform's nightly snapshot; returns the rate, source, and timestamp used." });
  ensureTag({ id: "reports",          name: "Scheduled reports",
    description: "Saved analytics queries scheduled to run on a cadence and delivered to email or SFTP. Sits on top of /metrics/query." });
  ensureTag({ id: "operations",       name: "Long-running operations",
    description: "Unified async-job primitive. Every long-running operation in the platform — imports, exports, bulk-publish, distribution fan-out, AI summaries — returns a 202 with a Location header pointing here." });
  ensureTag({ id: "cdc",              name: "Change data capture",
    description: "Ordered, replayable change-event stream. The HTTP entry point is a long-poll cursor; native Kafka / Kinesis / S3 streams are documented out-of-band." });
  ensureTag({ id: "scim",             name: "SCIM 2.0",
    description: "RFC 7644-conformant user and group provisioning. Mapped onto the platform's existing User and Role resources so every IdP (Okta, Entra ID, Ping, JumpCloud, OneLogin) works out-of-the-box." });
  ensureTag({ id: "discovery",        name: "Discovery",
    description: "Standards-mandated metadata endpoints — OAuth 2.1, OpenID Connect, JWKS, SAML, the OpenAPI document, and the SOC2 / ISO compliance evidence pack." });

  /* =========== Place new tags in groups ============================= */
  // Find existing groups by id and append.
  function appendToGroup(groupId, tagIds) {
    var g = (spec.groups || []).find(function (x) { return x.id === groupId; });
    if (!g) return;
    tagIds.forEach(function (t) { if (g.tags.indexOf(t) < 0) g.tags.push(t); });
  }
  appendToGroup("operations", ["rosters", "expense-policies", "feedback"]);
  appendToGroup("demand",     ["signing"]);
  appendToGroup("workforce",  []);
  appendToGroup("money",      ["fx", "reports"]);
  appendToGroup("platform",   ["comments", "attachments", "help"]);
  appendToGroup("identity",   ["favorites"]);
  appendToGroup("developers", ["operations", "cdc", "scim", "discovery"]);

  /* =========== SCHEMAS ============================================== */
  Object.assign(spec.schemas, {
    Booking: {
      description: "A hospitality event (banquet, conference session, catering job) that fans out to one Roster with positions and shifts.",
      fields: [
        { name: "id",          type: "string<ulid>",     required: true,  desc: "Booking identifier." },
        { name: "beoNumber",   type: "string",           required: true,  desc: "Banquet Event Order number, customer-supplied." },
        { name: "name",        type: "string",           required: true,  desc: "Display name — e.g. \"Patel × Khan wedding · grand ballroom\"." },
        { name: "propertyId",  type: "string<ulid>",     required: true,  desc: "Location / property the event is at." },
        { name: "eventDate",   type: "string<date>",     required: true,  desc: "Date of the event." },
        { name: "setupAt",     type: "string<datetime>", required: true,  desc: "Setup begins." },
        { name: "serviceAt",   type: "string<datetime>", required: true,  desc: "Service begins." },
        { name: "endsAt",      type: "string<datetime>", required: true,  desc: "Breakdown ends." },
        { name: "guestCount",  type: "integer",          required: true,  desc: "Confirmed guest count." },
        { name: "style",       type: "string",           required: false, desc: "Service style — e.g. \"Plated · 4 course\"." },
        { name: "captainId",   type: "string<ulid>",     required: false, desc: "Banquet captain — primary on-site lead." },
        { name: "status",      type: "enum",             required: true,  desc: "Lifecycle.", enum: ["draft", "confirmed", "in_progress", "completed", "cancelled"] }
      ]
    },
    RosterPosition: {
      description: "One role on a Booking — N copies of a single job (e.g. 8 banquet servers).",
      fields: [
        { name: "id",        type: "string<ulid>",  required: true, desc: "Position identifier." },
        { name: "bookingId", type: "string<ulid>",  required: true, desc: "Parent booking." },
        { name: "role",      type: "string",        required: true, desc: "Job title — e.g. \"Banquet Server\"." },
        { name: "count",     type: "integer",       required: true, desc: "How many workers needed." },
        { name: "skills",    type: "Array<string>", required: false, desc: "Required skill tags." },
        { name: "primaryWorkerIds",  type: "Array<string<ulid>>", required: true, desc: "Confirmed primary assignments." },
        { name: "standbyWorkerIds",  type: "Array<string<ulid>>", required: false, desc: "Standby lineup — paid only on no-show." }
      ]
    },
    Comment: {
      description: "A comment attached to any entity, with optional @-mentions and inline attachment references.",
      fields: [
        { name: "id",          type: "string<ulid>",     required: true,  desc: "Comment identifier." },
        { name: "subjectType", type: "enum",             required: true,  desc: "Entity the comment is on.", enum: ["requisition", "worker", "timesheet", "invoice", "candidate", "sow", "supplier"] },
        { name: "subjectId",   type: "string<ulid>",     required: true,  desc: "Entity identifier." },
        { name: "authorId",    type: "string<ulid>",     required: true,  desc: "User who wrote the comment." },
        { name: "body",        type: "string",           required: true,  desc: "Comment body. Markdown rendered." },
        { name: "mentions",    type: "Array<string<ulid>>", required: false, desc: "User ids mentioned with @. Each mention fans out as a notification." },
        { name: "attachmentIds", type: "Array<string<ulid>>", required: false, desc: "File ids inlined into the comment." },
        { name: "createdAt",   type: "string<datetime>", required: true,  desc: "RFC 3339 timestamp." },
        { name: "editedAt",    type: "string<datetime>", required: false, desc: "Last edit timestamp, null if untouched." }
      ]
    },
    ExpensePolicy: {
      description: "Per-org expense policy. One policy is active at a time; superseded policies are kept in audit.",
      fields: [
        { name: "id",         type: "string<ulid>", required: true, desc: "Policy identifier." },
        { name: "active",     type: "boolean",      required: true, desc: "Whether this is the currently-applied policy." },
        { name: "categories", type: "Array<ExpenseCategory>", required: true, desc: "Allowed categories, ceilings, per-diems." },
        { name: "mileageRate",type: "Money",        required: true, desc: "Per-mile reimbursement (mileage category only)." },
        { name: "receiptRequiredOver", type: "Money", required: true, desc: "Receipt threshold. Below this, receipts are optional." },
        { name: "effectiveFrom", type: "string<date>", required: true, desc: "First day this policy applies to new expenses." }
      ]
    },
    Feedback: {
      description: "Manager-supplied feedback captured at the end of a shift.",
      fields: [
        { name: "id",          type: "string<ulid>",     required: true,  desc: "Feedback identifier." },
        { name: "workerId",    type: "string<ulid>",     required: true,  desc: "Worker being rated." },
        { name: "shiftId",     type: "string<ulid>",     required: false, desc: "Shift the feedback is anchored to. Null for off-shift feedback." },
        { name: "managerId",   type: "string<ulid>",     required: true,  desc: "Manager submitting the rating." },
        { name: "rating",      type: "integer",          required: true,  desc: "1–5 stars." },
        { name: "note",        type: "string",           required: false, desc: "Optional free-text note." },
        { name: "tags",        type: "Array<string>",    required: false, desc: "Quick-pick tags — e.g. \"on_time\", \"team_lead\"." },
        { name: "rehireEligible", type: "boolean",       required: false, desc: "Override the worker's rehire-eligible flag." },
        { name: "createdAt",   type: "string<datetime>", required: true,  desc: "When the feedback was submitted." }
      ]
    },
    SigningRequest: {
      description: "An outbound document-signing request routed through the configured provider (DocuSign / Adobe Sign / native).",
      fields: [
        { name: "id",          type: "string<ulid>",     required: true,  desc: "Request identifier." },
        { name: "provider",    type: "enum",             required: true,  desc: "Underlying signing provider.", enum: ["docusign", "adobesign", "native"] },
        { name: "subjectType", type: "enum",             required: true,  desc: "Entity the document is bound to.", enum: ["supplier_contract", "worker_nda", "contractor_agreement", "sow", "expense_attestation"] },
        { name: "subjectId",   type: "string<ulid>",     required: true,  desc: "Entity identifier." },
        { name: "fileId",      type: "string<ulid>",     required: true,  desc: "Template file in /files." },
        { name: "signers",     type: "Array<Signer>",    required: true,  desc: "Ordered list of signers." },
        { name: "status",      type: "enum",             required: true,  desc: "Lifecycle.", enum: ["draft", "sent", "viewed", "signed", "declined", "voided", "expired"] },
        { name: "completedAt", type: "string<datetime>", required: false, desc: "When the last signer signed. Null while in progress." }
      ]
    },
    Operation: {
      description: "Handle for a long-running platform operation — import, export, bulk action, AI summary, distribution fan-out.",
      fields: [
        { name: "id",         type: "string<ulid>",     required: true, desc: "Operation identifier." },
        { name: "type",       type: "string",           required: true, desc: "What the operation is doing, e.g. \"requisitions.import\"." },
        { name: "status",     type: "enum",             required: true, desc: "Run state.", enum: ["queued", "running", "succeeded", "failed", "cancelled"] },
        { name: "progress",   type: "number",           required: false, desc: "0–1 completion ratio. Null until progress is known." },
        { name: "startedAt",  type: "string<datetime>", required: true, desc: "When the operation started running." },
        { name: "finishedAt", type: "string<datetime>", required: false, desc: "When the operation finished. Null while in progress." },
        { name: "result",     type: "object",           required: false, desc: "Operation-specific result blob. Populated on success." },
        { name: "error",      type: "Error",            required: false, desc: "Populated on failure." },
        { name: "resultUrl",  type: "string<uri>",      required: false, desc: "Signed download URL for export operations. Valid 15 minutes." }
      ]
    },
    ScimUser: {
      description: "SCIM 2.0 representation of a Flex Work user. RFC 7643 § 4.1.",
      fields: [
        { name: "id",        type: "string<ulid>",        required: true, desc: "User identifier." },
        { name: "userName",  type: "string",              required: true, desc: "Primary email / SCIM userName." },
        { name: "name",      type: "object",              required: true, desc: "Object with givenName, familyName." },
        { name: "emails",    type: "Array<ScimEmail>",    required: true, desc: "Email list. At least one MUST be primary." },
        { name: "active",    type: "boolean",             required: true, desc: "Whether the user is active." },
        { name: "externalId",type: "string",              required: false, desc: "IdP's identifier for the user." }
      ]
    }
  });

  /* ===== Rosters & bookings (P-01) ================================= */
  add(
    { id: "bookings_list", tag: "rosters",
      method: "GET", path: "/bookings",
      name: "List bookings",
      summary: "Paginated list of hospitality bookings (banquet events, catering jobs, conference sessions).",
      detail:
        "Filter by date range and property when planning a week's labor. The default page size is 50; max 200. " +
        "Use the dedicated rostering UI for visual fan-out, or pull positions yourself via /bookings/{id}/positions.",
      params: [
        { name: "propertyId",  in: "query", type: "string<ulid>", required: false, desc: "Restrict to one property." },
        { name: "from",        in: "query", type: "string<date>", required: false, desc: "Bookings on or after this date." },
        { name: "to",          in: "query", type: "string<date>", required: false, desc: "Bookings on or before this date." },
        { name: "status",      in: "query", type: "enum",         required: false, desc: "Lifecycle filter.", enum: ["draft", "confirmed", "in_progress", "completed", "cancelled"] },
        { name: "cursor",      in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Booking>", desc: "Booking page." }],
      responseExample: { data: [
        { id: "01HZXBOK0001234567890AURA", beoNumber: "BEO #4187-A", name: "Patel \u00d7 Khan wedding \u00b7 grand ballroom", propertyId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", eventDate: "2026-04-25", setupAt: "2026-04-25T15:00:00-07:00", serviceAt: "2026-04-25T18:00:00-07:00", endsAt: "2026-04-26T01:00:00-07:00", guestCount: 240, style: "Plated \u00b7 4 course", captainId: "01HZX0J0WCAPTAIN0KIERRASTAN", status: "confirmed" }
      ], nextCursor: null } },

    { id: "bookings_create", tag: "rosters",
      method: "POST", path: "/bookings",
      name: "Create a booking",
      summary: "Create a hospitality booking. The companion roster is created empty; add positions via /bookings/{id}/positions.",
      body: { schemaRef: "Booking (without id, status)", example: { beoNumber: "BEO #4187-A", name: "Patel \u00d7 Khan wedding", propertyId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", eventDate: "2026-04-25", setupAt: "2026-04-25T15:00:00-07:00", serviceAt: "2026-04-25T18:00:00-07:00", endsAt: "2026-04-26T01:00:00-07:00", guestCount: 240, style: "Plated \u00b7 4 course" } },
      responses: [{ status: 201, schema: "Booking", desc: "Booking created." }],
      responseExample: { id: "01HZXBOK0001234567890AURA", status: "draft" } },

    { id: "bookings_get", tag: "rosters",
      method: "GET", path: "/bookings/{bookingId}",
      name: "Get a booking",
      summary: "Returns one booking with its roster summary inlined (position counts, fill state, captain).",
      params: [{ name: "bookingId", in: "path", type: "string<ulid>", required: true, desc: "Booking to fetch." }],
      responses: [{ status: 200, schema: "Booking", desc: "Booking envelope." }, { status: 404, schema: "Error", desc: "Not found." }],
      responseExample: { id: "01HZXBOK0001234567890AURA", beoNumber: "BEO #4187-A", name: "Patel \u00d7 Khan wedding \u00b7 grand ballroom", guestCount: 240, status: "confirmed" } },

    { id: "bookings_update", tag: "rosters",
      method: "PATCH", path: "/bookings/{bookingId}",
      name: "Update a booking",
      summary: "Partial update. Changing eventDate or the setup/service/endsAt window cascades to every position's fan-out shift.",
      params: [{ name: "bookingId", in: "path", type: "string<ulid>", required: true, desc: "Booking to update." }],
      body: { schemaRef: "Subset of Booking", example: { guestCount: 260, style: "Plated \u00b7 4 course \u00b7 vegan add-on" } },
      responses: [{ status: 200, schema: "Booking", desc: "Updated booking." }],
      responseExample: { id: "01HZXBOK0001234567890AURA", guestCount: 260 } },

    { id: "bookings_roster_get", tag: "rosters",
      method: "GET", path: "/bookings/{bookingId}/roster",
      name: "Get the roster",
      summary: "Returns every position on a booking with its current primary lineup and standby lane.",
      params: [{ name: "bookingId", in: "path", type: "string<ulid>", required: true, desc: "Booking to fetch." }],
      responses: [{ status: 200, schema: "Array<RosterPosition>", desc: "Position list." }],
      responseExample: [
        { id: "01HZXPOS0001234567890SERVER", bookingId: "01HZXBOK0001234567890AURA", role: "Banquet Server", count: 8, skills: ["plated", "fine-dining", "TIPS"], primaryWorkerIds: ["01HZX0J8B7P3R2K6F9D5N8M4WT", "01HZX0J8B7P3R2K6F9D5N8M4WB"], standbyWorkerIds: ["01HZX0J8B7P3R2K6F9D5N8M4WC"] }
      ] },

    { id: "bookings_positions_create", tag: "rosters",
      method: "POST", path: "/bookings/{bookingId}/positions",
      name: "Add a position",
      summary: "Add a new role to a booking — 8 banquet servers, 4 bartenders, 2 captains. Each position fans out to its own set of shifts on the schedule.",
      params: [{ name: "bookingId", in: "path", type: "string<ulid>", required: true, desc: "Booking to add to." }],
      body: { schemaRef: "RosterPosition", example: { role: "Bartender", count: 4, skills: ["bar", "TIPS"] } },
      responses: [{ status: 201, schema: "RosterPosition", desc: "Position added." }],
      responseExample: { id: "01HZXPOS0001234567890BAR000", role: "Bartender", count: 4 } },

    { id: "positions_assign", tag: "rosters",
      method: "POST", path: "/positions/{positionId}/assignments",
      name: "Assign workers to a position",
      summary: "Set the primary lineup (and optional standby lineup) for a position. Returns 409 if any worker has a conflict.",
      params: [{ name: "positionId", in: "path", type: "string<ulid>", required: true, desc: "Position to assign." }],
      body: { schema: [
        { name: "primaryWorkerIds",  type: "Array<string<ulid>>", required: true,  desc: "Confirmed primary assignments. Must match position.count." },
        { name: "standbyWorkerIds",  type: "Array<string<ulid>>", required: false, desc: "Standby workers — paid only on no-show." }
      ], example: { primaryWorkerIds: ["01HZX0J8B7P3R2K6F9D5N8M4WT", "01HZX0J8B7P3R2K6F9D5N8M4WB"], standbyWorkerIds: ["01HZX0J8B7P3R2K6F9D5N8M4WC"] } },
      responses: [{ status: 200, schema: "RosterPosition", desc: "Updated position." }, { status: 409, schema: "Error", desc: "Worker has a conflicting shift." }],
      responseExample: { id: "01HZXPOS0001234567890SERVER", primaryWorkerIds: ["01HZX0J8B7P3R2K6F9D5N8M4WT", "01HZX0J8B7P3R2K6F9D5N8M4WB"] } },

    { id: "positions_fanout", tag: "rosters",
      method: "POST", path: "/positions/{positionId}:fanout",
      name: "Fan out a position to shifts",
      summary: "Materializes the position's headcount into N shifts on the schedule, copying the booking's setup/service/endsAt window. Returns the new shift ids.",
      detail: "Idempotent — re-running on a fanned-out position is a no-op unless the booking's time window changed, in which case the existing shifts are updated in place.",
      params: [{ name: "positionId", in: "path", type: "string<ulid>", required: true, desc: "Position to fan out." }],
      responses: [{ status: 200, schema: "FanoutResult", desc: "Created or updated shift ids." }],
      responseExample: { positionId: "01HZXPOS0001234567890SERVER", shiftIds: ["01HZX9P2RM8K4F6D7N3S0001", "01HZX9P2RM8K4F6D7N3S0002", "01HZX9P2RM8K4F6D7N3S0003"] } }
  );

  /* ===== Comments & mentions (P-02) ================================ */
  add(
    { id: "comments_list", tag: "comments",
      method: "GET", path: "/comments",
      name: "List comments",
      summary: "Returns the comment thread for one entity, oldest first.",
      detail: "Always scope by subjectType + subjectId. Returns up to 200 per page; combine with cursor for older threads.",
      params: [
        { name: "subjectType", in: "query", type: "enum",         required: true,  desc: "Entity type.", enum: ["requisition", "worker", "timesheet", "invoice", "candidate", "sow", "supplier"] },
        { name: "subjectId",   in: "query", type: "string<ulid>", required: true,  desc: "Entity identifier." },
        { name: "cursor",      in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Comment>", desc: "Comment page, ascending by createdAt." }],
      responseExample: { data: [
        { id: "01HZXCMT0001234567890ABCDE", subjectType: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY", authorId: "01HZX0J0XM7R1F2N6K3L7S5VWE", body: "Distribution looks tight. @Amy can you confirm StaffWise West's capacity?", mentions: ["01HZX0J0XM7R1F2N6K3L7S5VWA"], createdAt: "2026-05-22T14:08:12Z" }
      ], nextCursor: null } },

    { id: "comments_create", tag: "comments",
      method: "POST", path: "/comments",
      name: "Post a comment",
      summary: "Add a comment to a thread. @-mentions referenced in `mentions` fan out to the inbox endpoint as notifications.",
      body: { schemaRef: "Comment (without id, authorId, createdAt)", example: {
        subjectType: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY",
        body: "Distribution looks tight. @Amy can you confirm StaffWise West's capacity?",
        mentions: ["01HZX0J0XM7R1F2N6K3L7S5VWA"]
      } },
      responses: [{ status: 201, schema: "Comment", desc: "Comment created." }],
      responseExample: { id: "01HZXCMT0001234567890ABCDE", createdAt: "2026-05-22T14:08:12Z" } },

    { id: "comments_update", tag: "comments",
      method: "PATCH", path: "/comments/{commentId}",
      name: "Edit a comment",
      summary: "Edit the body of a comment. Only the author can edit; the original body is retained in audit.",
      params: [{ name: "commentId", in: "path", type: "string<ulid>", required: true, desc: "Comment to edit." }],
      body: { schema: [{ name: "body", type: "string", required: true, desc: "New body." }], example: { body: "Distribution looks tight \u2014 Amy confirmed StaffWise can cover." } },
      responses: [{ status: 200, schema: "Comment", desc: "Updated comment." }],
      responseExample: { id: "01HZXCMT0001234567890ABCDE", editedAt: "2026-05-22T14:18:00Z" } },

    { id: "comments_delete", tag: "comments",
      method: "DELETE", path: "/comments/{commentId}",
      name: "Delete a comment",
      summary: "Soft-delete a comment. The thread retains a tombstone so other replies still parent correctly.",
      params: [{ name: "commentId", in: "path", type: "string<ulid>", required: true, desc: "Comment to delete." }],
      responses: [{ status: 204, schema: null, desc: "Comment deleted." }],
      responseExample: null },

    { id: "attachments_create", tag: "attachments",
      method: "POST", path: "/attachments",
      name: "Attach a file to an entity",
      summary: "Bind an uploaded /files record to an entity. Pair with /comments to surface attachments inline in a thread.",
      body: { schema: [
        { name: "fileId",      type: "string<ulid>", required: true,  desc: "Uploaded file." },
        { name: "subjectType", type: "enum",         required: true,  desc: "Entity type.", enum: ["requisition", "worker", "timesheet", "invoice", "candidate", "sow", "supplier"] },
        { name: "subjectId",   type: "string<ulid>", required: true,  desc: "Entity identifier." },
        { name: "label",       type: "string",       required: false, desc: "Display label, e.g. \"Signed NDA\"." }
      ], example: { fileId: "01HZXFILE0001234567890ABCD", subjectType: "supplier", subjectId: "01HZX0J7X1K8N4F5R3S2D2YQAH", label: "MSA \u00b7 2026" } },
      responses: [{ status: 201, schema: "Attachment", desc: "Attachment created." }],
      responseExample: { id: "01HZXATT0001234567890ABCDE", fileId: "01HZXFILE0001234567890ABCD", subjectType: "supplier", subjectId: "01HZX0J7X1K8N4F5R3S2D2YQAH", label: "MSA \u00b7 2026", createdAt: "2026-05-22T14:08:12Z" } },

    { id: "attachments_list", tag: "attachments",
      method: "GET", path: "/{resource}/{id}/attachments",
      name: "List attachments on an entity",
      summary: "Returns every file attached to one entity. Files include signed download URLs.",
      params: [
        { name: "resource", in: "path", type: "enum",         required: true, desc: "Resource type.", enum: ["requisitions", "workers", "timesheets", "invoices", "candidates", "sows", "suppliers"] },
        { name: "id",       in: "path", type: "string<ulid>", required: true, desc: "Resource identifier." }
      ],
      responses: [{ status: 200, schema: "Array<Attachment>", desc: "Attachment list." }],
      responseExample: [
        { id: "01HZXATT0001234567890ABCDE", fileId: "01HZXFILE0001234567890ABCD", label: "MSA \u00b7 2026", file: { id: "01HZXFILE0001234567890ABCD", filename: "msa-2026.pdf", url: "https://files.dayforce.com/01HZXFILE\u2026?sig=abc" } }
      ] }
  );

  /* ===== Expense policy (P-03) ===================================== */
  add(
    { id: "expolicy_get", tag: "expense-policies",
      method: "GET", path: "/expense-policies",
      name: "Get the active expense policy",
      summary: "Returns the org's currently-applied expense policy — categories, per-diems, mileage rate, receipt thresholds.",
      detail: "There is one active policy per org. Superseded policies are retained in audit; their resolved values stay attached to the expense records they validated.",
      responses: [{ status: 200, schema: "ExpensePolicy", desc: "Active policy." }],
      responseExample: { id: "01HZXEPL0001234567890ABCDE", active: true, effectiveFrom: "2026-01-01", receiptRequiredOver: { amount: 25, currency: "USD" }, mileageRate: { amount: 0.67, currency: "USD" }, categories: [
        { code: "lodging", label: "Lodging",  perDiems: [{ country: "US", region: "CA-SF", amount: 320, currency: "USD" }, { country: "US", region: "NY-NYC", amount: 380, currency: "USD" }] },
        { code: "meals",   label: "Meals",     perDiems: [{ country: "US", region: "*", amount: 75, currency: "USD" }] },
        { code: "ground",  label: "Ground",    ceiling: { amount: 150, currency: "USD" } }
      ] } },

    { id: "expolicy_put", tag: "expense-policies",
      method: "PUT", path: "/expense-policies/{policyId}",
      name: "Replace the expense policy",
      summary: "Replace the active expense policy. The previous policy is archived; in-flight expenses keep their original validation snapshot.",
      params: [{ name: "policyId", in: "path", type: "string<ulid>", required: true, desc: "Policy to replace (the current id)." }],
      body: { schemaRef: "ExpensePolicy (without id, active)", example: { effectiveFrom: "2026-07-01", receiptRequiredOver: { amount: 25, currency: "USD" }, mileageRate: { amount: 0.70, currency: "USD" }, categories: [{ code: "lodging", label: "Lodging", perDiems: [{ country: "US", region: "*", amount: 250, currency: "USD" }] }] } },
      responses: [{ status: 200, schema: "ExpensePolicy", desc: "New active policy." }],
      responseExample: { id: "01HZXEPL0001234567890FGHIJ", active: true, effectiveFrom: "2026-07-01" } },

    { id: "expolicy_validate", tag: "expense-policies",
      method: "POST", path: "/expense-policies/{policyId}:validate",
      name: "Validate an expense against the policy",
      summary: "Client-side preflight — checks an expense draft against the current policy and returns the resolved ceiling, the violations, and whether a receipt is required.",
      detail: "Use this to provide instant feedback in your UI before the worker actually submits. The same engine runs server-side on POST /expenses, so the result is authoritative.",
      params: [{ name: "policyId", in: "path", type: "string<ulid>", required: true, desc: "Policy id, or `active` to use the current policy." }],
      body: { schemaRef: "Subset of Expense", example: { category: "lodging", incurredOn: "2026-07-12", amount: { amount: 412.00, currency: "USD" }, locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YY" } },
      responses: [{ status: 200, schema: "ExpenseValidation", desc: "Validation result." }],
      responseExample: { allowed: false, receiptRequired: true, resolvedCeiling: { amount: 380, currency: "USD" }, violations: [{ field: "amount", code: "over_per_diem", message: "Lodging in NY-NYC capped at $380/night." }] } }
  );

  /* ===== Recurring requisitions (P-04) ============================= */
  add(
    { id: "tpl_schedule_get", tag: "requisition-templates",
      method: "GET", path: "/requisition-templates/{templateId}/schedule",
      name: "Get recurrence",
      summary: "Returns the recurrence schedule attached to a template, if any.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template." }],
      responses: [{ status: 200, schema: "TemplateSchedule", desc: "Recurrence definition." }, { status: 404, schema: "Error", desc: "No schedule attached." }],
      responseExample: { templateId: "01HZXTPL000WAREHOUSE000NIGHT", rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=4;BYMINUTE=0", startsOn: "2026-06-01", endsOn: "2026-08-24", paused: false, nextRunAt: "2026-06-01T04:00:00Z" } },

    { id: "tpl_schedule_set", tag: "requisition-templates",
      method: "POST", path: "/requisition-templates/{templateId}/schedule",
      name: "Attach recurrence",
      summary: "Attach an RFC 5545 RRULE recurrence to a template. The platform opens a fresh requisition at every fire time.",
      detail: "Use a standard RRULE expression. Bounded windows are recommended — open-ended schedules require manual pause/resume to wind down. Holidays in the location's calendar are skipped automatically.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template." }],
      body: { schema: [
        { name: "rrule",    type: "string<rrule>", required: true,  desc: "RFC 5545 recurrence rule." },
        { name: "startsOn", type: "string<date>",  required: true,  desc: "First eligible fire date." },
        { name: "endsOn",   type: "string<date>",  required: false, desc: "Stop after this date. Open-ended if omitted." }
      ], example: { rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=4;BYMINUTE=0", startsOn: "2026-06-01", endsOn: "2026-08-24" } },
      responses: [{ status: 201, schema: "TemplateSchedule", desc: "Recurrence attached." }],
      responseExample: { templateId: "01HZXTPL000WAREHOUSE000NIGHT", rrule: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=4;BYMINUTE=0", nextRunAt: "2026-06-01T04:00:00Z", paused: false } },

    { id: "tpl_pause", tag: "requisition-templates",
      method: "POST", path: "/requisition-templates/{templateId}:pause",
      name: "Pause recurrence",
      summary: "Pause a template's recurrence. No new requisitions fire until /resume is called. Existing open requisitions are unaffected.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template." }],
      responses: [{ status: 200, schema: "TemplateSchedule", desc: "Paused." }],
      responseExample: { templateId: "01HZXTPL000WAREHOUSE000NIGHT", paused: true, pausedAt: "2026-05-26T17:22:01Z" } },

    { id: "tpl_resume", tag: "requisition-templates",
      method: "POST", path: "/requisition-templates/{templateId}:resume",
      name: "Resume recurrence",
      summary: "Resume a paused recurrence. The next fire time is computed from the original RRULE, skipping any missed dates while paused.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template." }],
      responses: [{ status: 200, schema: "TemplateSchedule", desc: "Resumed." }],
      responseExample: { templateId: "01HZXTPL000WAREHOUSE000NIGHT", paused: false, nextRunAt: "2026-06-08T04:00:00Z" } }
  );

  /* ===== Worker feedback (P-05) ==================================== */
  add(
    { id: "feedback_list", tag: "feedback",
      method: "GET", path: "/workers/{workerId}/feedback",
      name: "List feedback for a worker",
      summary: "Paginated list of feedback rows for one worker, newest first.",
      params: [
        { name: "workerId", in: "path",  type: "string<ulid>", required: true,  desc: "Worker to fetch." },
        { name: "since",    in: "query", type: "string<datetime>", required: false, desc: "Only entries on or after this timestamp." },
        { name: "cursor",   in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Feedback>", desc: "Feedback page." }],
      responseExample: { data: [
        { id: "01HZXFBK0001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT", managerId: "01HZX0J0XM7R1F2N6K3L7S5VWE", rating: 5, note: "On-time, calm under pressure, ran the OT line solo from 23:00.", tags: ["on_time", "team_lead"], rehireEligible: true, createdAt: "2026-05-22T06:08:12Z" }
      ], nextCursor: null } },

    { id: "feedback_create", tag: "feedback",
      method: "POST", path: "/workers/{workerId}/feedback",
      name: "Record feedback",
      summary: "Manager-side: record an end-of-shift rating and optional note. Fans out to talent-pool eligibility and supplier scorecards.",
      detail: "Best called from manager-mobile at shift end. The rehireEligible field is sticky — it overrides the worker-level flag until the next time it's set.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker being rated." }],
      body: { schemaRef: "Feedback (without id, managerId, createdAt)", example: { shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT", rating: 5, note: "On-time, calm under pressure.", tags: ["on_time", "team_lead"], rehireEligible: true } },
      responses: [{ status: 201, schema: "Feedback", desc: "Feedback recorded." }],
      responseExample: { id: "01HZXFBK0001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", rating: 5 } },

    { id: "feedback_summary", tag: "feedback",
      method: "GET", path: "/workers/{workerId}/feedback/summary",
      name: "Get feedback summary",
      summary: "Returns the worker's rolling rating average + tag histogram across a configurable window.",
      params: [
        { name: "workerId", in: "path",  type: "string<ulid>", required: true,  desc: "Worker to summarize." },
        { name: "window",   in: "query", type: "enum",         required: false, desc: "Time window.", enum: ["last_30d", "last_90d", "last_365d", "all_time"] }
      ],
      responses: [{ status: 200, schema: "FeedbackSummary", desc: "Summary envelope." }],
      responseExample: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", window: "last_90d", entryCount: 14, averageRating: 4.6, ratingHistogram: { "5": 9, "4": 4, "3": 1 }, topTags: [{ tag: "on_time", count: 11 }, { tag: "team_lead", count: 5 }] } }
  );

  /* ===== Timesheet correction requests (P-06) ====================== */
  add(
    { id: "ts_correction_list", tag: "timesheets",
      method: "GET", path: "/timesheets/{timesheetId}/correction-requests",
      name: "List correction requests",
      summary: "Returns worker-initiated corrections against an approved timesheet, oldest first.",
      params: [{ name: "timesheetId", in: "path", type: "string<ulid>", required: true, desc: "Timesheet." }],
      responses: [{ status: 200, schema: "Array<CorrectionRequest>", desc: "Correction list." }],
      responseExample: [
        { id: "01HZXTSC0001234567890ABCDE", timesheetId: "01HZX9N1KD7H4F2R6S3P8M5VYC", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", reasonCode: "missed_clockout", description: "Wednesday 17:00 clockout didn't register — actual end 18:00.", hoursDelta: 1.0, status: "pending", submittedAt: "2026-05-22T19:08:12Z" }
      ] },

    { id: "ts_correction_create", tag: "timesheets",
      method: "POST", path: "/timesheets/{timesheetId}/correction-requests",
      name: "Submit a correction request",
      summary: "Worker-side: file a correction against an approved timesheet. Routes to the manager who originally approved it; resolves into a timesheet adjustment on accept.",
      params: [{ name: "timesheetId", in: "path", type: "string<ulid>", required: true, desc: "Timesheet." }],
      body: { schema: [
        { name: "reasonCode",  type: "enum",   required: true,  desc: "Reason.", enum: ["missed_clockout", "missed_clockin", "wrong_rate", "wrong_hours", "wrong_requisition", "other"] },
        { name: "description", type: "string", required: true,  desc: "Free-text explanation." },
        { name: "hoursDelta",  type: "number", required: false, desc: "Suggested hour adjustment (positive or negative)." }
      ], example: { reasonCode: "missed_clockout", description: "Wednesday 17:00 clockout didn't register \u2014 actual end 18:00.", hoursDelta: 1.0 } },
      responses: [{ status: 201, schema: "CorrectionRequest", desc: "Request filed." }],
      responseExample: { id: "01HZXTSC0001234567890ABCDE", status: "pending" } },

    { id: "ts_correction_resolve", tag: "timesheets",
      method: "POST", path: "/correction-requests/{requestId}:resolve",
      name: "Resolve a correction request",
      summary: "Manager-side: accept (creates an adjustment on the timesheet) or reject (closes the request with a reason).",
      params: [{ name: "requestId", in: "path", type: "string<ulid>", required: true, desc: "Request to resolve." }],
      body: { schema: [
        { name: "outcome", type: "enum",   required: true,  desc: "Resolution.", enum: ["accept", "reject"] },
        { name: "note",    type: "string", required: false, desc: "Manager note. Visible to the worker." }
      ], example: { outcome: "accept", note: "Confirmed via gate-scan log." } },
      responses: [{ status: 200, schema: "CorrectionRequest", desc: "Updated request, including the adjustmentId on accept." }],
      responseExample: { id: "01HZXTSC0001234567890ABCDE", status: "accepted", adjustmentId: "01HZXTSADJ0001234567890ABC1" } }
  );

  /* ===== Bulk schedule publish (P-07) ============================== */
  add(
    { id: "schedules_bulk_publish", tag: "schedules",
      method: "POST", path: "/schedules:bulk-publish",
      name: "Bulk-publish schedules",
      summary: "Publish many schedules in one call — by id list, or by (locationSet, week) filter. Returns an Operation handle to poll.",
      detail: "A single $500M-tier tenant publishes ~480 schedules a week; without this endpoint clients fan out 480 separate POSTs and hit the rate limit. The Operation completes when every schedule transitions; a per-schedule error report is included in the result.",
      body: { schema: [
        { name: "scheduleIds", type: "Array<string<ulid>>", required: false, desc: "Specific schedules to publish. Either this or filter must be set." },
        { name: "filter",      type: "object",              required: false, desc: "Filter expression — `{locationIds:[\u2026], weekStarting:\"2026-06-01\"}`." },
        { name: "notifyWorkers",     type: "boolean", required: false, desc: "Whether to send push + email. Defaults to true." },
        { name: "respectQuietHours", type: "boolean", required: false, desc: "Suppress notifications outside quiet hours. Defaults to true." }
      ], example: { filter: { locationIds: ["01HZX0J5W1S9D8H7N3E6Q4R2YX", "01HZX0J5W1S9D8H7N3E6Q4R2YY"], weekStarting: "2026-06-01" }, notifyWorkers: true } },
      responses: [{ status: 202, schema: "Operation", desc: "Operation queued. Poll /operations/{id}." }],
      responseExample: { id: "01HZXOPN0001234567890BULK1", type: "schedules.bulk_publish", status: "running", progress: 0, startedAt: "2026-05-26T17:22:01Z" } }
  );

  /* ===== Document signing (P-08) =================================== */
  add(
    { id: "signing_create", tag: "signing",
      method: "POST", path: "/signing-requests",
      name: "Create a signing request",
      summary: "Routes a document through the configured provider (DocuSign / Adobe Sign / native) to a list of signers in order.",
      body: { schemaRef: "SigningRequest (without id, status)", example: {
        subjectType: "supplier_contract", subjectId: "01HZX9M3D5T8Q2N7P4F1H7B6KE",
        fileId: "01HZXFILE0001234567890MSA0",
        signers: [
          { email: "ops@staffwise.example", name: "Amy Chen",       order: 1 },
          { email: "legal@helios.example",  name: "Jordan Patel",   order: 2 }
        ]
      } },
      responses: [{ status: 201, schema: "SigningRequest", desc: "Request created and dispatched." }],
      responseExample: { id: "01HZXSGN0001234567890ABCDE", provider: "docusign", status: "sent", subjectType: "supplier_contract", subjectId: "01HZX9M3D5T8Q2N7P4F1H7B6KE" } },

    { id: "signing_get", tag: "signing",
      method: "GET", path: "/signing-requests/{signingRequestId}",
      name: "Get a signing request",
      summary: "Returns the current status of a signing request and the per-signer state.",
      params: [{ name: "signingRequestId", in: "path", type: "string<ulid>", required: true, desc: "Signing request." }],
      responses: [{ status: 200, schema: "SigningRequest", desc: "Signing-request envelope." }],
      responseExample: { id: "01HZXSGN0001234567890ABCDE", status: "viewed", signers: [{ email: "ops@staffwise.example", name: "Amy Chen", order: 1, status: "signed", signedAt: "2026-05-22T17:00:00Z" }, { email: "legal@helios.example", name: "Jordan Patel", order: 2, status: "viewed", viewedAt: "2026-05-26T15:08:00Z" }] } },

    { id: "signing_remind", tag: "signing",
      method: "POST", path: "/signing-requests/{signingRequestId}:remind",
      name: "Send a reminder",
      summary: "Sends a reminder email to the next signer in the chain. No-op if the request has already been signed or voided.",
      params: [{ name: "signingRequestId", in: "path", type: "string<ulid>", required: true, desc: "Signing request." }],
      responses: [{ status: 202, schema: null, desc: "Reminder queued." }],
      responseExample: null },

    { id: "signing_void", tag: "signing",
      method: "POST", path: "/signing-requests/{signingRequestId}:void",
      name: "Void a signing request",
      summary: "Cancels an in-flight request. Once voided, signers' signing links return an error page.",
      params: [{ name: "signingRequestId", in: "path", type: "string<ulid>", required: true, desc: "Signing request." }],
      body: { schema: [{ name: "reason", type: "string", required: true, desc: "Reason logged in audit and shown to the next signer." }], example: { reason: "Replacing with corrected MSA revision." } },
      responses: [{ status: 200, schema: "SigningRequest", desc: "Request voided." }],
      responseExample: { id: "01HZXSGN0001234567890ABCDE", status: "voided" } }
  );

  /* ===== Favorites & activity (P-09) =============================== */
  add(
    { id: "favorites_list", tag: "favorites",
      method: "GET", path: "/users/me/favorites",
      name: "List my favorites",
      summary: "Returns the calling user's favorited entities across all resource types.",
      params: [
        { name: "resource", in: "query", type: "enum", required: false, desc: "Restrict to one resource type.", enum: ["requisition", "worker", "supplier", "candidate", "schedule", "sow"] }
      ],
      responses: [{ status: 200, schema: "Array<Favorite>", desc: "Favorite list." }],
      responseExample: [
        { id: "01HZXFAV0001234567890ABCDE", resource: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY", label: "REQ-08421 \u00b7 Warehouse picker", addedAt: "2026-05-20T10:08:12Z" }
      ] },

    { id: "favorites_create", tag: "favorites",
      method: "POST", path: "/users/me/favorites",
      name: "Add a favorite",
      summary: "Favorite an entity. Idempotent on (resource, subjectId).",
      body: { schema: [
        { name: "resource",  type: "enum",         required: true, desc: "Resource type.", enum: ["requisition", "worker", "supplier", "candidate", "schedule", "sow"] },
        { name: "subjectId", type: "string<ulid>", required: true, desc: "Entity identifier." }
      ], example: { resource: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY" } },
      responses: [{ status: 201, schema: "Favorite", desc: "Favorited." }],
      responseExample: { id: "01HZXFAV0001234567890ABCDE", resource: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY" } },

    { id: "favorites_delete", tag: "favorites",
      method: "DELETE", path: "/users/me/favorites/{favoriteId}",
      name: "Remove a favorite",
      summary: "Unfavorite an entity.",
      params: [{ name: "favoriteId", in: "path", type: "string<ulid>", required: true, desc: "Favorite to remove." }],
      responses: [{ status: 204, schema: null, desc: "Removed." }],
      responseExample: null },

    { id: "activity_me", tag: "favorites",
      method: "GET", path: "/users/me/activity",
      name: "Get my recent activity",
      summary: "Returns a chronological feed of the calling user's recent actions across the platform.",
      params: [
        { name: "since",  in: "query", type: "string<datetime>", required: false, desc: "Only events after this timestamp." },
        { name: "limit",  in: "query", type: "integer",          required: false, desc: "Max events, 1\u2013100. Default 50." }
      ],
      responses: [{ status: 200, schema: "Array<ActivityEvent>", desc: "Activity events." }],
      responseExample: [
        { at: "2026-05-26T17:00:00Z", kind: "timesheet.approved",   subjectType: "timesheet",   subjectId: "01HZX9N1KD7H4F2R6S3P8M5VYC" },
        { at: "2026-05-26T16:48:00Z", kind: "requisition.created",  subjectType: "requisition", subjectId: "01HZX7K2QM4FN0R8VBSE6PA7CY" }
      ] }
  );

  /* ===== Help center (P-10) ======================================== */
  add(
    { id: "help_articles_list", tag: "help",
      method: "GET", path: "/help/articles",
      name: "List help articles",
      summary: "Returns the help-center table of contents.",
      params: [
        { name: "section", in: "query", type: "enum",   required: false, desc: "Filter by section.", enum: ["features", "onboarding", "playbooks", "release", "competitive", "glossary"] },
        { name: "locale",  in: "query", type: "string", required: false, desc: "Locale code. Defaults to the caller's preference." }
      ],
      responses: [{ status: 200, schema: "Array<HelpArticle>", desc: "Article list." }],
      responseExample: [
        { id: "requisitions",     section: "features", title: "Requisitions",     summary: "How demand enters Flex Work.", updatedAt: "2026-05-22T10:00:00Z" },
        { id: "engagement-types", section: "features", title: "Engagement types", summary: "Shift, Assignment, Project, Statement of Work.", updatedAt: "2026-05-20T08:30:00Z" }
      ] },

    { id: "help_article_get", tag: "help",
      method: "GET", path: "/help/articles/{articleId}",
      name: "Get a help article",
      summary: "Returns one article in Markdown, plus contextual cross-links and the related metric / tag references.",
      params: [
        { name: "articleId", in: "path",  type: "string", required: true,  desc: "Article identifier." },
        { name: "locale",    in: "query", type: "string", required: false, desc: "Locale code." }
      ],
      responses: [{ status: 200, schema: "HelpArticle", desc: "Article envelope." }, { status: 404, schema: "Error", desc: "Not found." }],
      responseExample: { id: "requisitions", title: "Requisitions", section: "features", body: "# Requisitions\n\nRequisitions are the unit of demand in Flex Work\u2026", related: ["distribution", "engagement-types", "candidates"], updatedAt: "2026-05-22T10:00:00Z" } },

    { id: "help_search", tag: "help",
      method: "GET", path: "/help/search",
      name: "Search the help center",
      summary: "Substring + semantic search across the help-center content tree.",
      params: [
        { name: "q",      in: "query", type: "string", required: true,  desc: "Query, minimum 2 characters." },
        { name: "locale", in: "query", type: "string", required: false, desc: "Locale code." }
      ],
      responses: [{ status: 200, schema: "Array<HelpHit>", desc: "Ranked hits." }],
      responseExample: [
        { id: "requisitions", title: "Requisitions", section: "features", snippet: "\u2026the unit of <em>demand</em> in Flex Work\u2026", score: 0.91 },
        { id: "rosters",      title: "Rosters",      section: "features", snippet: "\u2026event rostering for hospitality\u2026",            score: 0.62 }
      ] }
  );

  /* ===== Currency, audit export, scheduled reports (P-11) ========== */
  add(
    { id: "fx_rates", tag: "fx",
      method: "GET", path: "/fx/rates",
      name: "List exchange rates",
      summary: "Returns the platform's published exchange rates for one base currency against the full ISO 4217 catalog.",
      detail: "Rates come from the nightly snapshot published at 00:00 UTC. The platform also publishes rates from a real-time provider on demand via /fx:convert — use that instead when the rate must reflect intraday markets.",
      params: [
        { name: "base", in: "query", type: "string<iso4217>", required: true,  desc: "Base currency, e.g. USD." },
        { name: "date", in: "query", type: "string<date>",    required: false, desc: "Rate date. Defaults to today's snapshot." }
      ],
      responses: [{ status: 200, schema: "FxRates", desc: "Rate envelope." }],
      responseExample: { base: "USD", date: "2026-05-26", source: "platform_snapshot", rates: { EUR: 0.928, GBP: 0.797, CAD: 1.364, MXN: 17.18, JPY: 158.42 } } },

    { id: "fx_convert", tag: "fx",
      method: "POST", path: "/fx:convert",
      name: "Convert currency",
      summary: "Convert an amount from one currency to another using the platform's published rate. Returns the resolved rate, source, and timestamp.",
      body: { schema: [
        { name: "amount", type: "Money",          required: true,  desc: "Amount to convert." },
        { name: "to",     type: "string<iso4217>",required: true,  desc: "Target currency." },
        { name: "date",   type: "string<date>",   required: false, desc: "Use the rate snapshot for this date. Defaults to live." }
      ], example: { amount: { amount: 1000, currency: "USD" }, to: "EUR" } },
      responses: [{ status: 200, schema: "FxConversion", desc: "Resolved conversion." }],
      responseExample: { from: { amount: 1000, currency: "USD" }, to: { amount: 928.00, currency: "EUR" }, rate: 0.928, source: "platform_realtime", asOf: "2026-05-26T17:22:01Z" } },

    { id: "audit_export", tag: "audit",
      method: "POST", path: "/audit-events:export",
      name: "Export the audit log",
      summary: "Queue an async export of the audit log to CSV or NDJSON. Returns an Operation handle; download the file via the operation's resultUrl.",
      detail: "Big tenants have audit logs in the tens of millions of rows. Use this rather than paging through /audit-events — the export ships as a streamed NDJSON or CSV and respects the same since/until/actor/subject filters.",
      body: { schema: [
        { name: "format",      type: "enum",             required: true,  desc: "Output format.", enum: ["csv", "ndjson", "parquet"] },
        { name: "since",       type: "string<datetime>", required: true,  desc: "Inclusive start." },
        { name: "until",       type: "string<datetime>", required: true,  desc: "Inclusive end." },
        { name: "subjectType", type: "enum",             required: false, desc: "Filter by subject type." },
        { name: "actorId",     type: "string<ulid>",     required: false, desc: "Filter by actor." }
      ], example: { format: "ndjson", since: "2026-01-01T00:00:00Z", until: "2026-05-31T23:59:59Z" } },
      responses: [{ status: 202, schema: "Operation", desc: "Export queued." }],
      responseExample: { id: "01HZXOPN0001234567890AUDX1", type: "audit.export", status: "queued", startedAt: "2026-05-26T17:22:01Z" } },

    { id: "reports_list", tag: "reports",
      method: "GET", path: "/reports",
      name: "List scheduled reports",
      summary: "Returns the org's scheduled reports.",
      responses: [{ status: 200, schema: "Array<Report>", desc: "Report list." }],
      responseExample: [
        { id: "01HZXRPT0001234567890ABCDE", name: "Weekly spend by location", metric: "spend.committed", cadence: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=8", deliveries: [{ channel: "email", target: "finops@helios.example" }], lastRunAt: "2026-05-20T08:00:00Z" }
      ] },

    { id: "reports_create", tag: "reports",
      method: "POST", path: "/reports",
      name: "Schedule a report",
      summary: "Schedule a saved query to run on an RRULE cadence and deliver the result to email or SFTP.",
      body: { schema: [
        { name: "name",       type: "string", required: true,  desc: "Display name." },
        { name: "metric",     type: "string", required: true,  desc: "Metric code." },
        { name: "query",      type: "object", required: true,  desc: "Query body, same shape as /metrics/query." },
        { name: "cadence",    type: "string<rrule>", required: true, desc: "RFC 5545 RRULE." },
        { name: "deliveries", type: "Array<Delivery>", required: true, desc: "Where to send each run." }
      ], example: { name: "Weekly spend by location", metric: "spend.committed", query: { from: "{{week.start}}", to: "{{week.end}}", groupBy: ["location"] }, cadence: "FREQ=WEEKLY;BYDAY=MO;BYHOUR=8", deliveries: [{ channel: "email", target: "finops@helios.example" }] } },
      responses: [{ status: 201, schema: "Report", desc: "Scheduled." }],
      responseExample: { id: "01HZXRPT0001234567890ABCDE", name: "Weekly spend by location" } },

    { id: "reports_run", tag: "reports",
      method: "POST", path: "/reports/{reportId}/runs",
      name: "Run a report now",
      summary: "Manually trigger a report run. Returns an Operation handle; the result is delivered to the report's configured channels AND attached to the operation's resultUrl.",
      params: [{ name: "reportId", in: "path", type: "string<ulid>", required: true, desc: "Report." }],
      responses: [{ status: 202, schema: "Operation", desc: "Run queued." }],
      responseExample: { id: "01HZXOPN0001234567890RPTRUN", type: "reports.run", status: "running", startedAt: "2026-05-26T17:22:01Z" } }
  );

  /* ===== Long-running operations (A-04) ============================ */
  add(
    { id: "ops_list", tag: "operations",
      method: "GET", path: "/operations",
      name: "List operations",
      summary: "Paginated list of long-running operations the caller has visibility into.",
      params: [
        { name: "status", in: "query", type: "enum",   required: false, desc: "Filter by status.", enum: ["queued", "running", "succeeded", "failed", "cancelled"] },
        { name: "type",   in: "query", type: "string", required: false, desc: "Filter by operation type, e.g. \"requisitions.import\"." },
        { name: "cursor", in: "query", type: "string", required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Operation>", desc: "Operation page." }],
      responseExample: { data: [
        { id: "01HZXOPN0001234567890BULK1", type: "schedules.bulk_publish", status: "succeeded", progress: 1, startedAt: "2026-05-26T17:22:01Z", finishedAt: "2026-05-26T17:23:42Z", result: { scheduleCount: 480, shiftCount: 31200 } }
      ], nextCursor: null } },

    { id: "ops_get", tag: "operations",
      method: "GET", path: "/operations/{operationId}",
      name: "Get an operation",
      summary: "Returns the current status, progress, error (if any), and result URL of one long-running operation. Poll this for completion.",
      detail: "Every endpoint that returns 202 puts the operation id in the response body AND in the Location header. Recommended polling cadence: 1s for the first 10s, then exponentially back off to 30s.",
      params: [{ name: "operationId", in: "path", type: "string<ulid>", required: true, desc: "Operation to fetch." }],
      responses: [
        { status: 200, schema: "Operation", desc: "Operation envelope." },
        { status: 404, schema: "Error",     desc: "Not found." }
      ],
      responseExample: { id: "01HZXOPN0001234567890BULK1", type: "schedules.bulk_publish", status: "succeeded", progress: 1, startedAt: "2026-05-26T17:22:01Z", finishedAt: "2026-05-26T17:23:42Z", result: { scheduleCount: 480, shiftCount: 31200 } } },

    { id: "ops_cancel", tag: "operations",
      method: "POST", path: "/operations/{operationId}:cancel",
      name: "Cancel an operation",
      summary: "Cancels a running operation. Operations that have completed are returned as-is; queued operations are removed.",
      params: [{ name: "operationId", in: "path", type: "string<ulid>", required: true, desc: "Operation to cancel." }],
      responses: [{ status: 200, schema: "Operation", desc: "Operation envelope." }],
      responseExample: { id: "01HZXOPN0001234567890BULK1", status: "cancelled" } }
  );

  /* ===== Change-data-capture stream (A-05) ========================= */
  add(
    { id: "cdc_stream", tag: "cdc",
      method: "GET", path: "/events:stream",
      name: "Read the CDC stream",
      summary: "Long-poll cursor over the platform's ordered change-event stream. Native streams (Kafka, Kinesis, S3) are documented out-of-band; this is the HTTP entry point.",
      detail: "Pass `?cursor=` from the previous response to resume; omit to start from the latest event. Events are ordered globally within a region and delivered at-least-once. Each batch returns up to 500 events; a sustained stream of 5,000 events / second is supported. Pair with `?wait=30` to hold the connection for up to 30 seconds when no new events are available.",
      params: [
        { name: "cursor",    in: "query", type: "string", required: false, desc: "Resume cursor from a prior response." },
        { name: "wait",      in: "query", type: "integer",required: false, desc: "Hold the connection up to N seconds awaiting new events. 0 = immediate return. Max 60." },
        { name: "resources", in: "query", type: "Array<string>", required: false, desc: "Restrict to specific resource types." }
      ],
      responses: [{ status: 200, schema: "CdcBatch", desc: "Batch of events + next cursor." }],
      responseExample: { events: [
        { id: "evt_01HZXCDC000000000000001", at: "2026-05-26T17:22:01.114Z", type: "requisition.distributed", resource: "requisition", resourceId: "01HZX7K2QM4FN0R8VBSE6PA7CY", before: { status: "pending_approval" }, after: { status: "open" } },
        { id: "evt_01HZXCDC000000000000002", at: "2026-05-26T17:22:01.221Z", type: "timesheet.approved",      resource: "timesheet",   resourceId: "01HZX9N1KD7H4F2R6S3P8M5VYC", before: { status: "submitted" },        after: { status: "approved" } }
      ], nextCursor: "eyJ0c1wiOlwiMTcxNjUwNDcyMTIyMVwifQ==" } },

    { id: "cdc_asyncapi", tag: "discovery",
      method: "GET", path: "/.well-known/asyncapi.json",
      name: "Get the AsyncAPI document",
      summary: "Returns the AsyncAPI 2.6 description of the CDC stream and webhook channels. Use to generate consumer SDKs.",
      responses: [{ status: 200, schema: "AsyncApiDocument", desc: "AsyncAPI 2.6 document." }],
      responseExample: { asyncapi: "2.6.0", info: { title: "Flex Work CDC", version: "1.0" }, channels: { "events:requisition.opened": { subscribe: { message: { name: "Requisition", payload: { $ref: "#/components/schemas/Requisition" } } } } } } }
  );

  /* ===== SCIM 2.0 (A-08) =========================================== */
  add(
    { id: "scim_users_list", tag: "scim",
      method: "GET", path: "/scim/v2/Users",
      name: "List SCIM users",
      summary: "RFC 7644-conformant user listing. Use with the IdP's SCIM connector (Okta, Entra ID, Ping, JumpCloud).",
      detail: "Supports the standard `filter`, `startIndex`, `count`, `attributes`, and `excludedAttributes` query parameters. Mapped to /users internally; the SCIM envelope is added at the edge.",
      params: [
        { name: "filter",     in: "query", type: "string",  required: false, desc: "SCIM filter, e.g. `userName eq \"amy@example.com\"`." },
        { name: "startIndex", in: "query", type: "integer", required: false, desc: "1-based start index. Default 1." },
        { name: "count",      in: "query", type: "integer", required: false, desc: "Page size. Default 100, max 500." }
      ],
      responses: [{ status: 200, schema: "ScimListResponse", desc: "SCIM ListResponse." }],
      responseExample: { schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: 4218, startIndex: 1, itemsPerPage: 100, Resources: [
        { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], id: "01HZX0J0XM7R1F2N6K3L7S5VWE", userName: "amy.chen@helios.example", name: { givenName: "Amy", familyName: "Chen" }, emails: [{ value: "amy.chen@helios.example", primary: true }], active: true }
      ] } },

    { id: "scim_users_create", tag: "scim",
      method: "POST", path: "/scim/v2/Users",
      name: "Create a SCIM user",
      summary: "IdP-triggered user provisioning. Creates a Flex Work user and sends an activation email.",
      body: { schemaRef: "ScimUser", example: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], userName: "new.hire@helios.example", name: { givenName: "Jordan", familyName: "Reyes" }, emails: [{ value: "new.hire@helios.example", primary: true }], active: true } },
      responses: [{ status: 201, schema: "ScimUser", desc: "User created." }, { status: 409, schema: "ScimError", desc: "User already exists." }],
      responseExample: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], id: "01HZX0JUSERNEW0001234567XY", userName: "new.hire@helios.example", active: true } },

    { id: "scim_users_get", tag: "scim",
      method: "GET", path: "/scim/v2/Users/{userId}",
      name: "Get a SCIM user",
      summary: "Returns one user in SCIM envelope. Mapped to /users/{id}.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User identifier." }],
      responses: [{ status: 200, schema: "ScimUser", desc: "SCIM user." }],
      responseExample: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], id: "01HZX0J0XM7R1F2N6K3L7S5VWE", userName: "amy.chen@helios.example", active: true } },

    { id: "scim_users_patch", tag: "scim",
      method: "PATCH", path: "/scim/v2/Users/{userId}",
      name: "Update a SCIM user",
      summary: "RFC 7644 PATCH operation — sequence of add / replace / remove operations.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User identifier." }],
      body: { schema: [{ name: "Operations", type: "Array<ScimPatchOp>", required: true, desc: "Ordered operations." }], example: { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "replace", path: "active", value: false }] } },
      responses: [{ status: 200, schema: "ScimUser", desc: "Updated SCIM user." }],
      responseExample: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], id: "01HZX0J0XM7R1F2N6K3L7S5VWE", active: false } },

    { id: "scim_users_delete", tag: "scim",
      method: "DELETE", path: "/scim/v2/Users/{userId}",
      name: "Deactivate a SCIM user",
      summary: "SCIM DELETE — soft-deactivates the user. The record is retained for audit.",
      params: [{ name: "userId", in: "path", type: "string<ulid>", required: true, desc: "User identifier." }],
      responses: [{ status: 204, schema: null, desc: "Deactivated." }],
      responseExample: null },

    { id: "scim_groups_list", tag: "scim",
      method: "GET", path: "/scim/v2/Groups",
      name: "List SCIM groups",
      summary: "Returns the org's roles as SCIM groups. Group membership equals role assignment.",
      responses: [{ status: 200, schema: "ScimListResponse", desc: "SCIM ListResponse over Groups." }],
      responseExample: { schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: 6, Resources: [
        { schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"], id: "01HZX0JROLEADMIN000000000A", displayName: "Admin",   members: [{ value: "01HZX0J0XM7R1F2N6K3L7S5VWE" }] },
        { schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"], id: "01HZX0JROLEMANAGER0000001B", displayName: "Manager", members: [] }
      ] } }
  );

  /* ===== Discovery (A-09 + A-10) =================================== */
  add(
    { id: "disc_oauth", tag: "discovery",
      method: "GET", path: "/.well-known/oauth-authorization-server",
      name: "OAuth 2.1 authorization server metadata",
      summary: "RFC 8414 metadata describing the platform's OAuth endpoints, supported grants, scopes, and response types. Consumed by every standard OAuth client SDK.",
      responses: [{ status: 200, schema: "OAuthMetadata", desc: "Server metadata." }],
      responseExample: {
        issuer: "https://api.dayforce.com/flex-work",
        authorization_endpoint: "https://api.dayforce.com/flex-work/v1/auth/authorize",
        token_endpoint:         "https://api.dayforce.com/flex-work/v1/auth/token",
        jwks_uri:               "https://api.dayforce.com/flex-work/v1/.well-known/jwks.json",
        grant_types_supported:  ["authorization_code", "refresh_token", "client_credentials"],
        response_types_supported: ["code"],
        scopes_supported:       ["requisitions.read", "requisitions.write", "workers.read", "workers.write", "timesheets.read", "timesheets.approve"],
        code_challenge_methods_supported: ["S256"]
      } },

    { id: "disc_oidc", tag: "discovery",
      method: "GET", path: "/.well-known/openid-configuration",
      name: "OpenID Connect discovery",
      summary: "OpenID Connect Discovery 1.0 metadata. Consumed by every OIDC-compatible SDK (AppAuth, Auth0, Okta).",
      responses: [{ status: 200, schema: "OidcMetadata", desc: "OIDC metadata." }],
      responseExample: {
        issuer: "https://api.dayforce.com/flex-work",
        authorization_endpoint: "https://api.dayforce.com/flex-work/v1/auth/authorize",
        token_endpoint:         "https://api.dayforce.com/flex-work/v1/auth/token",
        userinfo_endpoint:      "https://api.dayforce.com/flex-work/v1/users/me",
        jwks_uri:               "https://api.dayforce.com/flex-work/v1/.well-known/jwks.json",
        subject_types_supported:["public"],
        id_token_signing_alg_values_supported: ["RS256", "ES256"]
      } },

    { id: "disc_jwks", tag: "discovery",
      method: "GET", path: "/.well-known/jwks.json",
      name: "JWKS — JSON Web Key Set",
      summary: "Public keys used to verify access-token signatures. Rotated quarterly with a 30-day overlap.",
      responses: [{ status: 200, schema: "Jwks", desc: "JWKS." }],
      responseExample: { keys: [
        { kty: "RSA", kid: "fwkid_01", use: "sig", alg: "RS256", n: "yL9c\u2026", e: "AQAB" },
        { kty: "RSA", kid: "fwkid_02", use: "sig", alg: "RS256", n: "8z3K\u2026", e: "AQAB" }
      ] } },

    { id: "disc_openapi", tag: "discovery",
      method: "GET", path: "/.well-known/openapi.json",
      name: "OpenAPI document",
      summary: "The platform's OpenAPI 3.1 document. Use to generate SDKs or to drive an external reference renderer.",
      params: [{ name: "version", in: "query", type: "string", required: false, desc: "Pinned schema version (YYYY-MM-DD). Defaults to latest." }],
      responses: [{ status: 200, schema: "OpenApiDocument", desc: "OpenAPI 3.1 document." }],
      responseExample: { openapi: "3.1.0", info: { title: "Flex Work API", version: "2026-05-26" }, servers: [{ url: "https://api.dayforce.com/flex-work/v1" }], paths: { "/requisitions": { get: { summary: "List requisitions", "\u2026": null } } } } },

    { id: "disc_saml", tag: "discovery",
      method: "GET", path: "/.well-known/saml-metadata.xml",
      name: "SAML service provider metadata",
      summary: "Flex Work's SP metadata XML for SAML 2.0 IdP setup. Upload to Okta / Entra ID / Ping to configure SSO.",
      responses: [{ status: 200, schema: "SamlMetadata", desc: "SAML SP metadata XML." }],
      responseExample: "<EntityDescriptor entityID=\"https://api.dayforce.com/flex-work\" xmlns=\"urn:oasis:names:tc:SAML:2.0:metadata\">\u2026</EntityDescriptor>" },

    { id: "disc_compliance", tag: "discovery",
      method: "GET", path: "/.well-known/compliance",
      name: "Programmatic compliance evidence",
      summary: "Returns the platform's compliance attestations — SOC2 Type II, ISO 27001, HIPAA, GDPR DPA — with last-attestation dates and downloadable evidence packs.",
      responses: [{ status: 200, schema: "ComplianceManifest", desc: "Compliance manifest." }],
      responseExample: {
        attestations: [
          { code: "soc2_type_ii", name: "SOC 2 Type II", scope: "Security, Availability, Confidentiality", attestedAt: "2026-02-15", validUntil: "2026-08-15", reportUrl: "https://compliance.dayforce.com/soc2-2026H1.pdf" },
          { code: "iso_27001",    name: "ISO/IEC 27001:2022", attestedAt: "2026-01-30", validUntil: "2027-01-30", reportUrl: "https://compliance.dayforce.com/iso-2026.pdf" },
          { code: "hipaa_baa",    name: "HIPAA Business Associate Agreement", available: true },
          { code: "gdpr_dpa",     name: "GDPR Data Processing Addendum", available: true }
        ],
        dataResidency: ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ca-central-1", "ap-southeast-2"],
        subprocessors: "https://compliance.dayforce.com/subprocessors.json"
      } },

    { id: "disc_rate_limit", tag: "system",
      method: "GET", path: "/system/rate-limit-status",
      name: "Get current rate-limit headroom",
      summary: "Returns the caller's current rate-limit usage per scope. SDKs can read this to throttle themselves before getting 429'd.",
      detail: "The same numbers come back as X-RateLimit-* headers on every response — this endpoint is for SDKs that want to poll rather than parse headers.",
      responses: [{ status: 200, schema: "RateLimitStatus", desc: "Per-scope usage." }],
      responseExample: { scopes: [
        { scope: "GET",        limit: 300, remaining: 287, resetAt: "2026-05-26T17:23:00Z" },
        { scope: "POST",       limit: 120, remaining:  91, resetAt: "2026-05-26T17:23:00Z" },
        { scope: "POST /auth", limit:  30, remaining:  29, resetAt: "2026-05-26T17:23:00Z" },
        { scope: "POST /ai",   limit:  20, remaining:  20, resetAt: "2026-05-26T17:23:00Z" }
      ] } }
  );

  /* ===== Enrich a few existing endpoints with `detail` ============ */
  function enrich(epId, detail) {
    var ep = spec.paths.find(function (p) { return p.id === epId; });
    if (ep) ep.detail = detail;
  }

  enrich("req_import",
    "Pass `dryRun: true` on the first call to validate without persisting — you'll get a per-row error report with line numbers and field paths. " +
    "Imports run synchronously up to 200 rows; larger imports return a 202 Operation handle and run async via /operations. " +
    "All rows in one call share the same idempotency key; partial commits don't happen — either the whole batch lands or none of it does."
  );

  enrich("ts_bulk_approve",
    "Single-call bulk approvals up to 200 timesheets; the 201st returns a 202 with an Operation handle. " +
    "Per-id failures are returned in the response body alongside successes — the overall call still returns 200. " +
    "Each downstream workflow (invoice generation, payroll export, ledger posting) is fired per timesheet, so a partial failure on one doesn't block the rest."
  );

})();
