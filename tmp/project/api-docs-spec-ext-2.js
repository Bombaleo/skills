/* =====================================================================
   Flex Work API · spec extension (part 2 — domain endpoints)
   ---------------------------------------------------------------------
   Adds paths for the workforce, finance, schedule, and platform-ops
   surfaces:
     · Requisition templates, imports, audit
     · Candidates / submittals
     · SOWs + milestones
     · Contractors + classification
     · Credentials & compliance
     · Distribution rules
     · Pricing rules, supplier funding, sales tax
     · Policies
     · Talent pools
     · Time off
     · Analytics, insights, dashboards
     · Event catalog (webhooks)
     · System
     · AI · Labs
   Loaded after api-docs-spec-ext-1.js.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }
  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }

  /* ===== Requisition templates & imports & audit =================== */
  add(
    { id: "tpl_list", tag: "requisition-templates",
      method: "GET", path: "/requisition-templates",
      name: "List templates",
      summary: "Returns saved requisition templates available at intake.",
      params: [
        { name: "category", in: "query", type: "enum",   required: false, desc: "Filter by job category.", enum: ["frontline", "professional"] },
        { name: "search",   in: "query", type: "string", required: false, desc: "Substring match against template name." }
      ],
      responses: [{ status: 200, schema: "Array<RequisitionTemplate>", desc: "Template list." }],
      responseExample: [
        { id: "01HZXTPL000WAREHOUSE000NIGHT", name: "Warehouse picker — overnight", category: "frontline", usageCount: 124, lastUsedAt: "2026-05-19T10:02:00Z" },
        { id: "01HZXTPL001FORKLIFT00000DAY",  name: "Forklift operator — day",      category: "frontline", usageCount:  87, lastUsedAt: "2026-05-22T09:30:00Z" }
      ] },

    { id: "tpl_create", tag: "requisition-templates",
      method: "POST", path: "/requisition-templates",
      name: "Create a template",
      summary: "Save the current requisition shape as a reusable template.",
      body: { schema: [
        { name: "name",            type: "string",       required: true,  desc: "Display name." },
        { name: "category",        type: "enum",         required: true,  desc: "Job category.", enum: ["frontline", "professional"] },
        { name: "jobId",           type: "string<ulid>", required: true,  desc: "Job in the catalog." },
        { name: "engagementType",  type: "enum",         required: true,  desc: "Engagement type.", enum: ["shift", "assignment", "project", "statementOfWork"] },
        { name: "sourcingChannel", type: "enum",         required: true,  desc: "Sourcing channel.", enum: ["frontline", "agency", "eor", "independent", "sow"] },
        { name: "defaults",        type: "object",       required: false, desc: "Default field values applied at intake." }
      ], example: { name: "Warehouse picker — overnight", category: "frontline", jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH", engagementType: "shift", sourcingChannel: "agency" } },
      responses: [{ status: 201, schema: "RequisitionTemplate", desc: "Template created." }],
      responseExample: { id: "01HZXTPL000WAREHOUSE000NIGHT", name: "Warehouse picker — overnight" } },

    { id: "tpl_get", tag: "requisition-templates",
      method: "GET", path: "/requisition-templates/{templateId}",
      name: "Get a template",
      summary: "Returns one template.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template to fetch." }],
      responses: [{ status: 200, schema: "RequisitionTemplate", desc: "Template envelope." }],
      responseExample: { id: "01HZXTPL000WAREHOUSE000NIGHT", name: "Warehouse picker — overnight", category: "frontline" } },

    { id: "tpl_update", tag: "requisition-templates",
      method: "PATCH", path: "/requisition-templates/{templateId}",
      name: "Update a template",
      summary: "Partial update of a template.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template to update." }],
      body: { schemaRef: "Subset of RequisitionTemplate", example: { name: "Warehouse picker — overnight (graveyard)" } },
      responses: [{ status: 200, schema: "RequisitionTemplate", desc: "Updated template." }],
      responseExample: { id: "01HZXTPL000WAREHOUSE000NIGHT", name: "Warehouse picker — overnight (graveyard)" } },

    { id: "tpl_delete", tag: "requisition-templates",
      method: "DELETE", path: "/requisition-templates/{templateId}",
      name: "Delete a template",
      summary: "Permanently removes a template. Existing requisitions created from it are unaffected.",
      params: [{ name: "templateId", in: "path", type: "string<ulid>", required: true, desc: "Template to delete." }],
      responses: [{ status: 204, schema: null, desc: "Template deleted." }],
      responseExample: null },

    { id: "req_import", tag: "requisitions",
      method: "POST", path: "/requisitions:import",
      name: "Bulk import requisitions",
      summary:
        "Validate and import multiple requisitions in one call. Use the dry-run flag to preview the parsed rows " +
        "without persisting. Errors are returned per row with the line number and field.",
      body: { schema: [
        { name: "format",  type: "enum",   required: true,  desc: "Source format.", enum: ["csv", "xlsx", "json"] },
        { name: "content", type: "string", required: true,  desc: "Base64-encoded file payload." },
        { name: "mapping", type: "object", required: false, desc: "Column -> field name mapping. Required for CSV/XLSX with non-canonical headers." },
        { name: "dryRun",  type: "boolean",required: false, desc: "Validate only; do not persist. Defaults to false." }
      ], example: { format: "csv", content: "JTI…(base64)", dryRun: true } },
      responses: [{ status: 200, schema: "ImportResult", desc: "Per-row validation + creation results." }],
      responseExample: { totalRows: 24, validRows: 22, invalidRows: 2, created: 0, errors: [{ row: 5, field: "payRate", message: "Must be greater than the federal minimum wage." }, { row: 13, field: "locationId", message: "Unknown location." }] } },

    { id: "req_audit", tag: "requisitions",
      method: "GET", path: "/requisitions/{requisitionId}/audit",
      name: "Get a requisition's audit trail",
      summary: "Returns every state change applied to one requisition.",
      params: [{ name: "requisitionId", in: "path", type: "string<ulid>", required: true, desc: "Requisition to query." }],
      responses: [{ status: 200, schema: "Array<AuditEvent>", desc: "Audit events for this requisition." }],
      responseExample: [
        { at: "2026-05-20T14:08:12Z", actorId: "01HZX0J0XM7R1F2N6K3L7S5VWE", action: "requisition.created" },
        { at: "2026-05-20T14:32:17Z", actorId: "01HZX0J0XM7R1F2N6K3L7S5VWE", action: "requisition.distributed" },
        { at: "2026-05-21T10:11:02Z", actorId: "01HZX0J0XM7R1F2N6K3L7S5VWA", action: "requisition.approved" }
      ] }
  );

  /* ===== Candidates ================================================ */
  add(
    { id: "cand_list", tag: "candidates",
      method: "GET", path: "/candidates",
      name: "List candidates",
      summary: "Paginated list of submittals, filterable by requisition, supplier, or stage.",
      params: [
        { name: "requisitionId", in: "query", type: "string<ulid>", required: false, desc: "Restrict to one requisition." },
        { name: "supplierId",    in: "query", type: "string<ulid>", required: false, desc: "Restrict to one supplier." },
        { name: "stage",         in: "query", type: "enum",         required: false, desc: "Filter by pipeline stage.", enum: ["submitted", "screening", "interview", "offer", "hired", "rejected", "withdrawn"] },
        { name: "cursor",        in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Candidate>", desc: "Candidate page." }],
      responseExample: { data: [{ id: "01HZXCND0001234567890ABCDE", requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH", firstName: "Maya", lastName: "Okafor", stage: "interview", rate: { amount: 22.50, currency: "USD" }, submittedAt: "2026-05-22T09:30:00Z" }], nextCursor: null } },

    { id: "cand_submit", tag: "candidates",
      method: "POST", path: "/candidates",
      name: "Submit a candidate",
      summary: "Supplier-side: submit a candidate against an open requisition.",
      body: { schema: [
        { name: "requisitionId", type: "string<ulid>", required: true,  desc: "Requisition the candidate is for." },
        { name: "firstName",     type: "string",       required: true,  desc: "Candidate first name." },
        { name: "lastName",      type: "string",       required: true,  desc: "Candidate last name." },
        { name: "email",         type: "string<email>",required: true,  desc: "Contact email." },
        { name: "phone",         type: "string",       required: false, desc: "E.164 phone." },
        { name: "rate",          type: "Money",        required: false, desc: "Proposed hourly rate." },
        { name: "availableFrom", type: "string<date>", required: false, desc: "Earliest start date." },
        { name: "notes",         type: "string",       required: false, desc: "Free-text submittal notes." }
      ], example: { requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", firstName: "Maya", lastName: "Okafor", email: "maya.okafor@example.com", rate: { amount: 22.50, currency: "USD" }, availableFrom: "2026-06-01" } },
      responses: [{ status: 201, schema: "Candidate", desc: "Candidate submitted." }],
      responseExample: { id: "01HZXCND0001234567890ABCDE", stage: "submitted" } },

    { id: "cand_get", tag: "candidates",
      method: "GET", path: "/candidates/{candidateId}",
      name: "Get a candidate",
      summary: "Returns one submittal record.",
      params: [{ name: "candidateId", in: "path", type: "string<ulid>", required: true, desc: "Candidate to fetch." }],
      responses: [{ status: 200, schema: "Candidate", desc: "Candidate envelope." }],
      responseExample: { id: "01HZXCND0001234567890ABCDE", firstName: "Maya", lastName: "Okafor", stage: "interview" } },

    { id: "cand_advance", tag: "candidates",
      method: "POST", path: "/candidates/{candidateId}:advance",
      name: "Advance a candidate",
      summary: "Move a candidate forward through the pipeline (e.g. submitted -> screening -> interview).",
      params: [{ name: "candidateId", in: "path", type: "string<ulid>", required: true, desc: "Candidate to advance." }],
      body: { schema: [
        { name: "toStage", type: "enum",   required: true,  desc: "Target stage.", enum: ["screening", "interview", "offer"] },
        { name: "note",    type: "string", required: false, desc: "Optional note recorded on the candidate." }
      ], example: { toStage: "interview", note: "Manager available Tues 10am." } },
      responses: [{ status: 200, schema: "Candidate", desc: "Updated candidate." }],
      responseExample: { id: "01HZXCND0001234567890ABCDE", stage: "interview" } },

    { id: "cand_hire", tag: "candidates",
      method: "POST", path: "/candidates/{candidateId}:hire",
      name: "Hire a candidate",
      summary:
        "Convert a candidate into an engaged worker. Creates the worker record (if new), opens an engagement " +
        "against the requisition, and fires the onboarding workflow.",
      params: [{ name: "candidateId", in: "path", type: "string<ulid>", required: true, desc: "Candidate to hire." }],
      body: { schema: [
        { name: "startDate", type: "string<date>", required: true,  desc: "First day on the engagement." },
        { name: "rate",      type: "Money",        required: false, desc: "Final agreed rate. Defaults to the submittal rate." }
      ], example: { startDate: "2026-06-01" } },
      responses: [
        { status: 200, schema: "Candidate", desc: "Candidate hired. Includes the new workerId." },
        { status: 409, schema: "Error",     desc: "Requisition has no remaining headcount." }
      ],
      responseExample: { id: "01HZXCND0001234567890ABCDE", stage: "hired", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT" } },

    { id: "cand_reject", tag: "candidates",
      method: "POST", path: "/candidates/{candidateId}:reject",
      name: "Reject a candidate",
      summary: "Reject a submittal. Reason is shown to the supplier in their dashboard.",
      params: [{ name: "candidateId", in: "path", type: "string<ulid>", required: true, desc: "Candidate to reject." }],
      body: { schema: [
        { name: "reasonCode", type: "enum",   required: true,  desc: "Rejection reason.", enum: ["rate_too_high", "credentials", "experience", "availability", "duplicate", "other"] },
        { name: "note",       type: "string", required: false, desc: "Optional free-text note." }
      ], example: { reasonCode: "rate_too_high", note: "Above the position's band." } },
      responses: [{ status: 200, schema: "Candidate", desc: "Candidate rejected." }],
      responseExample: { id: "01HZXCND0001234567890ABCDE", stage: "rejected" } }
  );

  /* ===== Statement of Work ========================================= */
  add(
    { id: "sow_list", tag: "sow",
      method: "GET", path: "/sows",
      name: "List SOWs",
      summary: "Paginated list of Statements of Work.",
      params: [
        { name: "supplierId", in: "query", type: "string<ulid>", required: false, desc: "Restrict to one supplier." },
        { name: "status",     in: "query", type: "enum",         required: false, desc: "Filter by lifecycle.", enum: ["draft", "pending_approval", "active", "completed", "cancelled"] },
        { name: "cursor",     in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<SOW>", desc: "SOW page." }],
      responseExample: { data: [{ id: "01HZXSOW0001234567890ABCDE", number: "SOW-2026-1042", title: "Outage support — Q3", supplierId: "01HZX0J7X1K8N4F5R3S2D2YQCK", totalValue: { amount: 248000, currency: "USD" }, startDate: "2026-07-01", endDate: "2026-09-30", status: "active" }], nextCursor: null } },

    { id: "sow_create", tag: "sow",
      method: "POST", path: "/sows",
      name: "Create a SOW",
      summary: "Create a new Statement of Work in draft.",
      body: { schemaRef: "SOW", example: { title: "Outage support — Q3", supplierId: "01HZX0J7X1K8N4F5R3S2D2YQCK", totalValue: { amount: 248000, currency: "USD" }, startDate: "2026-07-01", endDate: "2026-09-30" } },
      responses: [{ status: 201, schema: "SOW", desc: "SOW created." }],
      responseExample: { id: "01HZXSOW0001234567890ABCDE", number: "SOW-2026-1042", status: "draft" } },

    { id: "sow_get", tag: "sow",
      method: "GET", path: "/sows/{sowId}",
      name: "Get a SOW",
      summary: "Returns one SOW, including its milestones.",
      params: [{ name: "sowId", in: "path", type: "string<ulid>", required: true, desc: "SOW to fetch." }],
      responses: [{ status: 200, schema: "SOW", desc: "SOW envelope." }],
      responseExample: { id: "01HZXSOW0001234567890ABCDE", number: "SOW-2026-1042", status: "active", totalValue: { amount: 248000, currency: "USD" } } },

    { id: "sow_update", tag: "sow",
      method: "PATCH", path: "/sows/{sowId}",
      name: "Update a SOW",
      summary: "Partial update. Most fields become immutable once the SOW is active.",
      params: [{ name: "sowId", in: "path", type: "string<ulid>", required: true, desc: "SOW to update." }],
      body: { schemaRef: "Subset of SOW", example: { endDate: "2026-10-31", totalValue: { amount: 312000, currency: "USD" } } },
      responses: [{ status: 200, schema: "SOW", desc: "Updated SOW." }],
      responseExample: { id: "01HZXSOW0001234567890ABCDE", endDate: "2026-10-31", totalValue: { amount: 312000, currency: "USD" } } },

    { id: "sow_milestones_list", tag: "sow",
      method: "GET", path: "/sows/{sowId}/milestones",
      name: "List SOW milestones",
      summary: "Returns the milestone schedule for one SOW, in due-date order.",
      params: [{ name: "sowId", in: "path", type: "string<ulid>", required: true, desc: "SOW to fetch milestones for." }],
      responses: [{ status: 200, schema: "Array<Milestone>", desc: "Milestone list." }],
      responseExample: [
        { id: "01HZXMSTN1000000000000000A", sowId: "01HZXSOW0001234567890ABCDE", title: "Site assessment", value: { amount: 38000, currency: "USD" }, dueDate: "2026-07-15", status: "completed" },
        { id: "01HZXMSTN1000000000000000B", sowId: "01HZXSOW0001234567890ABCDE", title: "Phase 1 outage", value: { amount: 124000, currency: "USD" }, dueDate: "2026-08-12", status: "in_progress" }
      ] },

    { id: "sow_milestones_create", tag: "sow",
      method: "POST", path: "/sows/{sowId}/milestones",
      name: "Add a milestone",
      summary: "Append a milestone to a SOW. Sum of milestone values cannot exceed the SOW totalValue.",
      params: [{ name: "sowId", in: "path", type: "string<ulid>", required: true, desc: "SOW to add to." }],
      body: { schemaRef: "Milestone", example: { title: "Phase 2 outage", value: { amount: 86000, currency: "USD" }, dueDate: "2026-09-15" } },
      responses: [{ status: 201, schema: "Milestone", desc: "Milestone added." }],
      responseExample: { id: "01HZXMSTN1000000000000000C", title: "Phase 2 outage", status: "pending" } },

    { id: "sow_milestone_complete", tag: "sow",
      method: "POST", path: "/milestones/{milestoneId}:complete",
      name: "Mark a milestone complete",
      summary: "Supplier-side: marks a milestone complete and queues it for buyer approval.",
      params: [{ name: "milestoneId", in: "path", type: "string<ulid>", required: true, desc: "Milestone to mark complete." }],
      body: { schema: [{ name: "evidenceUrls", type: "Array<string<uri>>", required: false, desc: "Optional links to deliverables." }], example: { evidenceUrls: ["https://docs.example.com/phase-1-report.pdf"] } },
      responses: [{ status: 200, schema: "Milestone", desc: "Milestone awaiting approval." }],
      responseExample: { id: "01HZXMSTN1000000000000000B", status: "completed" } },

    { id: "sow_milestone_approve", tag: "sow",
      method: "POST", path: "/milestones/{milestoneId}:approve",
      name: "Approve a milestone",
      summary: "Buyer-side: approve a completed milestone. Triggers invoice generation.",
      params: [{ name: "milestoneId", in: "path", type: "string<ulid>", required: true, desc: "Milestone to approve." }],
      responses: [{ status: 200, schema: "Milestone", desc: "Milestone approved." }],
      responseExample: { id: "01HZXMSTN1000000000000000B", status: "approved" } }
  );

  /* ===== Contractors ============================================== */
  add(
    { id: "ctr_list", tag: "contractors",
      method: "GET", path: "/contractors",
      name: "List contractors",
      summary:
        "Returns the subset of workers engaged as 1099 independent contractors. " +
        "For all workers regardless of sourcing channel, use /workers.",
      params: [
        { name: "status", in: "query", type: "enum",   required: false, desc: "Worker state filter.", enum: ["onboarding", "active", "on_leave", "ended"] },
        { name: "search", in: "query", type: "string", required: false, desc: "Substring match against name." },
        { name: "cursor", in: "query", type: "string", required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<Worker>", desc: "Contractor page." }],
      responseExample: { data: [{ id: "01HZXCTR000000123456789ABC", displayName: "Sami Soto", sourcingChannel: "independent", status: "active" }], nextCursor: null } },

    { id: "ctr_onboard", tag: "contractors",
      method: "POST", path: "/contractors:onboard",
      name: "Onboard a contractor",
      summary:
        "Start the contractor onboarding flow. Creates a worker record, queues the W-9 and " +
        "banking collection steps, and fires the classification test suite.",
      body: { schema: [
        { name: "legalFirstName", type: "string",        required: true, desc: "Legal first name." },
        { name: "legalLastName",  type: "string",        required: true, desc: "Legal last name." },
        { name: "email",          type: "string<email>", required: true, desc: "Contact email." },
        { name: "requisitionId",  type: "string<ulid>",  required: true, desc: "Requisition to engage on." },
        { name: "rate",           type: "Money",         required: true, desc: "Agreed hourly rate." }
      ], example: { legalFirstName: "Sami", legalLastName: "Soto", email: "sami.soto@example.com", requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", rate: { amount: 88, currency: "USD" } } },
      responses: [{ status: 202, schema: "Worker", desc: "Onboarding started. Worker is in `onboarding` state." }],
      responseExample: { id: "01HZXCTR000000123456789ABC", status: "onboarding" } },

    { id: "ctr_classification_get", tag: "contractors",
      method: "GET", path: "/contractors/{workerId}/classification",
      name: "Get classification results",
      summary:
        "Returns IRS 20-factor test, ABC test, exclusivity and tenure flags for one contractor. " +
        "Returns the most recent evaluation; rerun with the :evaluate endpoint.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Contractor to inspect." }],
      responses: [{ status: 200, schema: "ClassificationResult", desc: "Classification envelope." }],
      responseExample: { workerId: "01HZXCTR000000123456789ABC", irsScore: 4, abcScore: 2, exclusivity: false, tenureMonths: 8, misclassificationRisk: "low", evaluatedAt: "2026-05-26T09:00:00Z" } },

    { id: "ctr_classification_run", tag: "contractors",
      method: "POST", path: "/contractors/{workerId}/classification:evaluate",
      name: "Re-evaluate classification",
      summary: "Run the classification test suite against the contractor and persist the new result.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Contractor to evaluate." }],
      responses: [{ status: 200, schema: "ClassificationResult", desc: "Fresh classification result." }],
      responseExample: { workerId: "01HZXCTR000000123456789ABC", irsScore: 4, abcScore: 2, misclassificationRisk: "low" } }
  );

  /* ===== Credentials & compliance ================================= */
  add(
    { id: "cred_list", tag: "credentials",
      method: "GET", path: "/credentials",
      name: "List credential types",
      summary: "Catalog of credential types the org tracks (e.g. OSHA-10, RCRA, NERC CIP, RN license).",
      params: [{ name: "search", in: "query", type: "string", required: false, desc: "Substring match against name or code." }],
      responses: [{ status: 200, schema: "Array<Credential>", desc: "Credential-type catalog." }],
      responseExample: [
        { id: "01HZX0JCREDOSHA10HOURABC123", code: "osha-10", name: "OSHA 10-hour General Industry", issuer: "OSHA", validityDays: 1825, renewable: true },
        { id: "01HZX0JCREDNERCCIP00000ABC4", code: "nerc-cip", name: "NERC CIP-004",                      issuer: "NERC", validityDays: 1095, renewable: true }
      ] },

    { id: "cred_create", tag: "credentials",
      method: "POST", path: "/credentials",
      name: "Create a credential type",
      summary: "Add a credential type to the catalog.",
      body: { schemaRef: "Credential", example: { code: "fcra-background", name: "FCRA background check", issuer: "Internal", validityDays: 365, renewable: true } },
      responses: [{ status: 201, schema: "Credential", desc: "Credential type created." }],
      responseExample: { id: "01HZX0JCREDFCRABG00000ABC5", code: "fcra-background" } },

    { id: "wcred_list", tag: "credentials",
      method: "GET", path: "/worker-credentials",
      name: "List worker credentials",
      summary: "Issued credentials, filterable by worker, type, or expiry.",
      params: [
        { name: "workerId",     in: "query", type: "string<ulid>", required: false, desc: "One worker's credentials." },
        { name: "credentialId", in: "query", type: "string<ulid>", required: false, desc: "All issued credentials of one type." },
        { name: "expiringBefore",in: "query", type: "string<date>",required: false, desc: "Credentials expiring on or before this date." },
        { name: "status",       in: "query", type: "enum",         required: false, desc: "Verification state.", enum: ["pending", "verified", "expired", "rejected"] }
      ],
      responses: [{ status: 200, schema: "Page<WorkerCredential>", desc: "Worker-credential page." }],
      responseExample: { data: [{ id: "01HZXWCRED0001234567890ABC", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", credentialId: "01HZX0JCREDOSHA10HOURABC123", issuedOn: "2025-03-12", expiresOn: "2030-03-12", status: "verified" }], nextCursor: null } },

    { id: "wcred_create", tag: "credentials",
      method: "POST", path: "/worker-credentials",
      name: "Record a credential",
      summary: "Record that a worker has earned a credential. Returns `pending` until verification completes.",
      body: { schema: [
        { name: "workerId",     type: "string<ulid>",required: true,  desc: "Worker the credential belongs to." },
        { name: "credentialId", type: "string<ulid>",required: true,  desc: "Credential type." },
        { name: "issuedOn",     type: "string<date>",required: true,  desc: "Issue date." },
        { name: "expiresOn",    type: "string<date>",required: false, desc: "Expiry. Inferred from type if omitted." },
        { name: "documentUrl",  type: "string<uri>", required: false, desc: "Link to the credential PDF." }
      ], example: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", credentialId: "01HZX0JCREDOSHA10HOURABC123", issuedOn: "2025-03-12" } },
      responses: [{ status: 201, schema: "WorkerCredential", desc: "Credential recorded." }],
      responseExample: { id: "01HZXWCRED0001234567890ABC", status: "pending" } },

    { id: "wcred_verify", tag: "credentials",
      method: "POST", path: "/worker-credentials/{credentialId}:verify",
      name: "Verify a credential",
      summary: "Manually mark a credential verified, attaching the verifying user and source.",
      params: [{ name: "credentialId", in: "path", type: "string<ulid>", required: true, desc: "Worker-credential record to verify." }],
      body: { schema: [
        { name: "source", type: "enum",   required: true,  desc: "Verification source.", enum: ["manual", "issuer_api", "psv", "document_upload"] },
        { name: "note",   type: "string", required: false, desc: "Optional note." }
      ], example: { source: "psv", note: "Confirmed via Symplr CVO" } },
      responses: [{ status: 200, schema: "WorkerCredential", desc: "Credential verified." }],
      responseExample: { id: "01HZXWCRED0001234567890ABC", status: "verified" } },

    { id: "compliance_run", tag: "credentials",
      method: "POST", path: "/compliance-checks:run",
      name: "Run a compliance check",
      summary: "Trigger a compliance check (I-9, OSHA, background) against a worker. Returns a run handle.",
      body: { schema: [
        { name: "workerId", type: "string<ulid>", required: true, desc: "Worker to check." },
        { name: "kind",     type: "enum",         required: true, desc: "Check kind.", enum: ["i9", "osha", "fcra_background", "drug_screen", "right_to_work"] }
      ], example: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", kind: "fcra_background" } },
      responses: [{ status: 202, schema: "ComplianceCheckRun", desc: "Check started." }],
      responseExample: { id: "01HZXCMPRUN001234567890ABC", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", kind: "fcra_background", status: "running" } }
  );

  /* ===== Distribution rules ======================================= */
  add(
    { id: "dist_list", tag: "distribution",
      method: "GET", path: "/distribution-rules",
      name: "List distribution rules",
      summary: "Returns rules controlling how requisitions fan out to suppliers.",
      params: [
        { name: "scope",       in: "query", type: "enum",         required: false, desc: "Scope filter.", enum: ["global", "org_unit", "location"] },
        { name: "orgUnitId",   in: "query", type: "string<ulid>", required: false, desc: "Restrict to one org-unit scope." },
        { name: "locationId",  in: "query", type: "string<ulid>", required: false, desc: "Restrict to one location scope." }
      ],
      responses: [{ status: 200, schema: "Array<DistributionRule>", desc: "Rule list." }],
      responseExample: [
        { id: "01HZXDST0001234567890ABCDE", scope: "global",   strategy: "tiered", tiers: [{ tier: 1, supplierIds: ["01HZX0J7X1K8N4F5R3S2D2YQAH"] }] },
        { id: "01HZXDST0001234567890ABCDF", scope: "location", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", strategy: "preferred", supplierIds: ["01HZX0J7X1K8N4F5R3S2D2YQBJ"] }
      ] },

    { id: "dist_create", tag: "distribution",
      method: "POST", path: "/distribution-rules",
      name: "Create a distribution rule",
      summary: "Create a global, org-unit, or location-scoped distribution rule.",
      body: { schema: [
        { name: "scope",      type: "enum",         required: true,  desc: "Rule scope.", enum: ["global", "org_unit", "location"] },
        { name: "orgUnitId",  type: "string<ulid>", required: false, desc: "Required when scope=org_unit." },
        { name: "locationId", type: "string<ulid>", required: false, desc: "Required when scope=location." },
        { name: "strategy",   type: "enum",         required: true,  desc: "Distribution strategy.", enum: ["all", "tiered", "preferred", "manual"] },
        { name: "tiers",      type: "Array<Tier>",  required: false, desc: "Tier configuration when strategy=tiered." }
      ], example: { scope: "location", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", strategy: "preferred", supplierIds: ["01HZX0J7X1K8N4F5R3S2D2YQBJ"] } },
      responses: [{ status: 201, schema: "DistributionRule", desc: "Rule created." }],
      responseExample: { id: "01HZXDST0001234567890ABCDF", scope: "location", strategy: "preferred" } },

    { id: "dist_update", tag: "distribution",
      method: "PATCH", path: "/distribution-rules/{ruleId}",
      name: "Update a distribution rule",
      summary: "Partial update of a rule's strategy or supplier list.",
      params: [{ name: "ruleId", in: "path", type: "string<ulid>", required: true, desc: "Rule to update." }],
      body: { schemaRef: "Subset of DistributionRule", example: { strategy: "tiered" } },
      responses: [{ status: 200, schema: "DistributionRule", desc: "Updated rule." }],
      responseExample: { id: "01HZXDST0001234567890ABCDF", strategy: "tiered" } },

    { id: "dist_delete", tag: "distribution",
      method: "DELETE", path: "/distribution-rules/{ruleId}",
      name: "Delete a distribution rule",
      summary: "Remove a scoped rule. Falls back to the parent scope's rule.",
      params: [{ name: "ruleId", in: "path", type: "string<ulid>", required: true, desc: "Rule to delete." }],
      responses: [{ status: 204, schema: null, desc: "Rule deleted." }],
      responseExample: null },

    { id: "dist_resolve", tag: "distribution",
      method: "GET", path: "/distribution-rules:resolve",
      name: "Resolve effective rule",
      summary: "Returns the effective distribution rule a requisition would use, given its location and org-unit.",
      params: [
        { name: "locationId", in: "query", type: "string<ulid>", required: true, desc: "Target location." },
        { name: "orgUnitId",  in: "query", type: "string<ulid>", required: false, desc: "Optional org-unit override." }
      ],
      responses: [{ status: 200, schema: "DistributionRule", desc: "The rule that would apply." }],
      responseExample: { id: "01HZXDST0001234567890ABCDF", scope: "location", strategy: "preferred" } },

    { id: "sup_scorecard", tag: "suppliers",
      method: "GET", path: "/suppliers/{supplierId}/scorecard",
      name: "Get a supplier scorecard",
      summary: "Returns the rolling scorecard for one supplier — fill rate, time-to-fill, retention, quality.",
      params: [
        { name: "supplierId", in: "path",  type: "string<ulid>", required: true,  desc: "Supplier to inspect." },
        { name: "window",     in: "query", type: "enum",         required: false, desc: "Time window.", enum: ["last_30d", "last_90d", "last_365d", "ytd"] }
      ],
      responses: [{ status: 200, schema: "SupplierScorecard", desc: "Scorecard envelope." }],
      responseExample: { supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH", window: "last_90d", fillRate: 0.86, timeToFillHours: 14.2, retention90Day: 0.92, qualityRating: 4.4 } }
  );

  /* ===== Pricing, funding, tax ==================================== */
  add(
    { id: "price_list", tag: "pricing",
      method: "GET", path: "/pricing-rules",
      name: "List pricing rules",
      summary: "Pay/bill rate cards by job, location, and shift differential.",
      params: [
        { name: "jobId",      in: "query", type: "string<ulid>", required: false, desc: "Restrict to one job." },
        { name: "locationId", in: "query", type: "string<ulid>", required: false, desc: "Restrict to one location." }
      ],
      responses: [{ status: 200, schema: "Array<PricingRule>", desc: "Pricing rules." }],
      responseExample: [
        { id: "01HZXPRC0001234567890ABCDE", jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", payRate: { amount: 22.50, currency: "USD" }, billRate: { amount: 31.75, currency: "USD" }, differential: 0.15 }
      ] },

    { id: "price_create", tag: "pricing",
      method: "POST", path: "/pricing-rules",
      name: "Create a pricing rule",
      summary: "Add a rate-card row for a job + location combination.",
      body: { schemaRef: "PricingRule", example: { jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", payRate: { amount: 22.50, currency: "USD" }, billRate: { amount: 31.75, currency: "USD" } } },
      responses: [{ status: 201, schema: "PricingRule", desc: "Rule created." }],
      responseExample: { id: "01HZXPRC0001234567890ABCDE" } },

    { id: "price_update", tag: "pricing",
      method: "PATCH", path: "/pricing-rules/{ruleId}",
      name: "Update a pricing rule",
      summary: "Partial update of a rate-card row.",
      params: [{ name: "ruleId", in: "path", type: "string<ulid>", required: true, desc: "Rule to update." }],
      body: { schemaRef: "Subset of PricingRule", example: { billRate: { amount: 32.50, currency: "USD" } } },
      responses: [{ status: 200, schema: "PricingRule", desc: "Updated rule." }],
      responseExample: { id: "01HZXPRC0001234567890ABCDE", billRate: { amount: 32.50, currency: "USD" } } },

    { id: "price_delete", tag: "pricing",
      method: "DELETE", path: "/pricing-rules/{ruleId}",
      name: "Delete a pricing rule",
      summary: "Remove a rate-card row.",
      params: [{ name: "ruleId", in: "path", type: "string<ulid>", required: true, desc: "Rule to delete." }],
      responses: [{ status: 204, schema: null, desc: "Rule deleted." }],
      responseExample: null },

    { id: "fund_list", tag: "pricing",
      method: "GET", path: "/funding-rules",
      name: "List supplier funding rules",
      summary: "Per-supplier funding rules — invoice factoring terms, payment timing, currency.",
      responses: [{ status: 200, schema: "Array<FundingRule>", desc: "Funding rule list." }],
      responseExample: [
        { id: "01HZXFND0001234567890ABCDE", supplierId: "01HZX0J7X1K8N4F5R3S2D2YQAH", factoringRate: 0.012, paymentTermsDays: 30, currency: "USD" }
      ] },

    { id: "fund_update", tag: "pricing",
      method: "PATCH", path: "/funding-rules/{ruleId}",
      name: "Update a funding rule",
      summary: "Partial update of a supplier's funding rule.",
      params: [{ name: "ruleId", in: "path", type: "string<ulid>", required: true, desc: "Funding rule to update." }],
      body: { schemaRef: "Subset of FundingRule", example: { paymentTermsDays: 45 } },
      responses: [{ status: 200, schema: "FundingRule", desc: "Updated rule." }],
      responseExample: { id: "01HZXFND0001234567890ABCDE", paymentTermsDays: 45 } },

    { id: "tax_list", tag: "pricing",
      method: "GET", path: "/tax-rules",
      name: "List sales-tax rules",
      summary: "Tax rules by jurisdiction. Used at invoice time to compute applicable tax.",
      params: [{ name: "jurisdiction", in: "query", type: "string", required: false, desc: "ISO-3166 country + region code." }],
      responses: [{ status: 200, schema: "Array<TaxRule>", desc: "Tax rule list." }],
      responseExample: [
        { id: "01HZXTAX0001234567890ABCDE", jurisdiction: "US-CA", rate: 0.0875, kind: "sales_tax" },
        { id: "01HZXTAX0001234567890ABCDF", jurisdiction: "CA-ON", rate: 0.13,   kind: "hst" }
      ] },

    { id: "tax_calc", tag: "pricing",
      method: "POST", path: "/tax-rules:calculate",
      name: "Calculate tax",
      summary: "Compute applicable tax for a given amount and jurisdiction.",
      body: { schema: [
        { name: "amount",      type: "Money",  required: true, desc: "Pre-tax amount." },
        { name: "jurisdiction",type: "string", required: true, desc: "ISO-3166 country + region." }
      ], example: { amount: { amount: 4500, currency: "USD" }, jurisdiction: "US-CA" } },
      responses: [{ status: 200, schema: "TaxCalculation", desc: "Resolved tax breakdown." }],
      responseExample: { subtotal: { amount: 4500, currency: "USD" }, tax: { amount: 393.75, currency: "USD" }, total: { amount: 4893.75, currency: "USD" }, rules: [{ id: "01HZXTAX0001234567890ABCDE", rate: 0.0875 }] } }
  );

  /* ===== Policies ================================================= */
  add(
    { id: "policy_list", tag: "policies",
      method: "GET", path: "/policies",
      name: "List policies",
      summary: "Returns policy packs the org has installed, with their scope.",
      params: [
        { name: "category", in: "query", type: "enum",    required: false, desc: "Filter by category.", enum: ["background_check", "drug_screen", "attendance", "dress_code", "harassment", "safety"] },
        { name: "active",   in: "query", type: "boolean", required: false, desc: "If true, only active policies." }
      ],
      responses: [{ status: 200, schema: "Array<Policy>", desc: "Policy list." }],
      responseExample: [
        { id: "01HZXPOL0001234567890ABCDE", name: "Standard background check", category: "background_check", scope: { workerTypes: ["agency", "eor", "independent"] }, active: true }
      ] },

    { id: "policy_create", tag: "policies",
      method: "POST", path: "/policies",
      name: "Create a policy",
      summary: "Install a policy pack.",
      body: { schemaRef: "Policy", example: { name: "Standard background check", category: "background_check", scope: { workerTypes: ["agency", "eor"] }, active: true } },
      responses: [{ status: 201, schema: "Policy", desc: "Policy created." }],
      responseExample: { id: "01HZXPOL0001234567890ABCDE", name: "Standard background check" } },

    { id: "policy_update", tag: "policies",
      method: "PATCH", path: "/policies/{policyId}",
      name: "Update a policy",
      summary: "Partial update of an installed policy pack.",
      params: [{ name: "policyId", in: "path", type: "string<ulid>", required: true, desc: "Policy to update." }],
      body: { schemaRef: "Subset of Policy", example: { active: false } },
      responses: [{ status: 200, schema: "Policy", desc: "Updated policy." }],
      responseExample: { id: "01HZXPOL0001234567890ABCDE", active: false } },

    { id: "policy_apply", tag: "policies",
      method: "POST", path: "/policies/{policyId}:apply",
      name: "Apply a policy",
      summary: "Re-evaluate a policy's scope and apply it to every matching worker.",
      params: [{ name: "policyId", in: "path", type: "string<ulid>", required: true, desc: "Policy to apply." }],
      responses: [{ status: 202, schema: "PolicyApplicationRun", desc: "Application run scheduled." }],
      responseExample: { runId: "01HZXPOLRUN001234567890ABC", scopedWorkerCount: 248 } }
  );

  /* ===== Talent pools ============================================= */
  add(
    { id: "pool_list", tag: "talent-pools",
      method: "GET", path: "/talent-pools",
      name: "List talent pools",
      summary: "Returns named worker pools the org has configured.",
      responses: [{ status: 200, schema: "Array<TalentPool>", desc: "Pool list." }],
      responseExample: [
        { id: "01HZXTPOOL00123456789ABCDEF", name: "Reno overnight regulars", workerCount: 42, rule: "tenure>=12 AND last_shift>=14d ago" },
        { id: "01HZXTPOOL00123456789ABCDEG", name: "Class A CDL operators",   workerCount: 18, rule: "credentials includes 'cdl-a'" }
      ] },

    { id: "pool_create", tag: "talent-pools",
      method: "POST", path: "/talent-pools",
      name: "Create a talent pool",
      summary: "Create a rule-driven worker pool.",
      body: { schema: [
        { name: "name", type: "string", required: true, desc: "Display name." },
        { name: "rule", type: "string", required: true, desc: "Pool membership rule, in the platform's DSL." }
      ], example: { name: "Phoenix swing-shift veterans", rule: "tenure>=26 AND location.id=='01HZX0J5W1S9D8H7N3E6Q4R2YY' AND last_shift_kind=='swing'" } },
      responses: [{ status: 201, schema: "TalentPool", desc: "Pool created." }],
      responseExample: { id: "01HZXTPOOL00123456789ABCDEH", workerCount: 12 } },

    { id: "pool_members", tag: "talent-pools",
      method: "GET", path: "/talent-pools/{poolId}/members",
      name: "List pool members",
      summary: "Returns the workers currently in a pool.",
      params: [{ name: "poolId", in: "path", type: "string<ulid>", required: true, desc: "Pool to list." }],
      responses: [{ status: 200, schema: "Page<Worker>", desc: "Member page." }],
      responseExample: { data: [{ id: "01HZX0J8B7P3R2K6F9D5N8M4WT", displayName: "Maya Okafor" }], nextCursor: null } }
  );

  /* ===== Schedule extensions, time-off ============================ */
  add(
    { id: "sch_list", tag: "schedules",
      method: "GET", path: "/schedules",
      name: "List schedules",
      summary: "Paginated list of schedules, optionally filtered by location or status.",
      params: [
        { name: "locationId", in: "query", type: "string<ulid>", required: false, desc: "Restrict to one location." },
        { name: "status",     in: "query", type: "enum",         required: false, desc: "Lifecycle filter.", enum: ["draft", "published", "archived"] }
      ],
      responses: [{ status: 200, schema: "Page<Schedule>", desc: "Schedule page." }],
      responseExample: { data: [{ id: "01HZX0J6T4D9N7K8B5P3M2YQXR", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", weekStarting: "2026-06-01", shiftCount: 142, status: "published" }], nextCursor: null } },

    { id: "sch_create", tag: "schedules",
      method: "POST", path: "/schedules",
      name: "Create a schedule",
      summary: "Create a draft schedule for a given location and week.",
      body: { schema: [
        { name: "locationId",   type: "string<ulid>", required: true, desc: "Location the schedule covers." },
        { name: "weekStarting", type: "string<date>", required: true, desc: "ISO 8601 first day of the week." }
      ], example: { locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", weekStarting: "2026-06-01" } },
      responses: [{ status: 201, schema: "Schedule", desc: "Draft schedule created." }],
      responseExample: { id: "01HZX0J6T4D9N7K8B5P3M2YQXR", status: "draft" } },

    { id: "sch_shift_create", tag: "schedules",
      method: "POST", path: "/shifts",
      name: "Create a shift",
      summary: "Add a shift to an existing schedule. Pass workerId to assign immediately, or omit for an open shift.",
      body: { schemaRef: "Shift", example: { scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR", locationId: "01HZX0J5W1S9D8H7N3E6Q4R2YX", jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH", startsAt: "2026-06-02T22:00:00Z", endsAt: "2026-06-03T06:00:00Z" } },
      responses: [{ status: 201, schema: "Shift", desc: "Shift created." }],
      responseExample: { id: "01HZX9P2RM8K4F6D7N3S6PA2WT", status: "open" } },

    { id: "sch_shift_assign", tag: "schedules",
      method: "POST", path: "/shifts/{shiftId}:assign",
      name: "Assign a shift",
      summary: "Assign an open shift to a worker. Returns 409 if the worker has a conflict.",
      params: [{ name: "shiftId", in: "path", type: "string<ulid>", required: true, desc: "Shift to assign." }],
      body: { schema: [{ name: "workerId", type: "string<ulid>", required: true, desc: "Worker to assign." }], example: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT" } },
      responses: [{ status: 200, schema: "Shift", desc: "Shift assigned." }, { status: 409, schema: "Error", desc: "Worker has a conflicting shift or unavailability." }],
      responseExample: { id: "01HZX9P2RM8K4F6D7N3S6PA2WT", status: "assigned" } },

    { id: "sch_shift_drop", tag: "schedules",
      method: "POST", path: "/shifts/{shiftId}:drop",
      name: "Drop a shift",
      summary: "Worker-side: release an assigned shift back into the open pool.",
      params: [{ name: "shiftId", in: "path", type: "string<ulid>", required: true, desc: "Shift to drop." }],
      body: { schema: [{ name: "reason", type: "string", required: false, desc: "Optional reason recorded on the shift." }], example: { reason: "Family obligation." } },
      responses: [{ status: 200, schema: "Shift", desc: "Shift dropped." }],
      responseExample: { id: "01HZX9P2RM8K4F6D7N3S6PA2WT", status: "open" } },

    { id: "sch_shift_pickup", tag: "schedules",
      method: "POST", path: "/shifts/{shiftId}:pickup",
      name: "Pick up a shift",
      summary: "Worker-side: claim an open shift. Subject to eligibility (qualified job, no conflicts).",
      params: [{ name: "shiftId", in: "path", type: "string<ulid>", required: true, desc: "Shift to claim." }],
      responses: [{ status: 200, schema: "Shift", desc: "Shift claimed." }, { status: 409, schema: "Error", desc: "Worker not eligible (credentials, conflicts, hours cap)." }],
      responseExample: { id: "01HZX9P2RM8K4F6D7N3S6PA2WT", status: "assigned" } },

    { id: "open_shifts", tag: "schedules",
      method: "GET", path: "/open-shifts",
      name: "List open shifts",
      summary: "Convenience endpoint that returns shifts in the `open` state, sorted by start time.",
      params: [
        { name: "locationId", in: "query", type: "string<ulid>", required: false, desc: "Restrict to one location." },
        { name: "workerId",   in: "query", type: "string<ulid>", required: false, desc: "Open shifts the worker is eligible for." }
      ],
      responses: [{ status: 200, schema: "Array<Shift>", desc: "Open shifts." }],
      responseExample: [{ id: "01HZX9P2RM8K4F6D7N3S6PA2WT", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR", startsAt: "2026-06-02T22:00:00Z", endsAt: "2026-06-03T06:00:00Z", status: "open" }] },

    { id: "to_list", tag: "time-off",
      method: "GET", path: "/time-off-requests",
      name: "List time-off requests",
      summary: "Paginated list of time-off requests, filterable by worker and status.",
      params: [
        { name: "workerId", in: "query", type: "string<ulid>", required: false, desc: "One worker's requests." },
        { name: "status",   in: "query", type: "enum",         required: false, desc: "Status filter.", enum: ["pending", "approved", "rejected", "cancelled"] }
      ],
      responses: [{ status: 200, schema: "Page<TimeOffRequest>", desc: "Request page." }],
      responseExample: { data: [{ id: "01HZXTOR0001234567890ABCDE", workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", kind: "pto", startsOn: "2026-07-04", endsOn: "2026-07-07", status: "pending" }], nextCursor: null } },

    { id: "to_create", tag: "time-off",
      method: "POST", path: "/time-off-requests",
      name: "Submit a time-off request",
      summary: "Worker-side: submit a request for time off.",
      body: { schema: [
        { name: "workerId", type: "string<ulid>", required: true,  desc: "Requester." },
        { name: "kind",     type: "enum",         required: true,  desc: "Kind of leave.", enum: ["pto", "sick", "unpaid", "bereavement", "jury_duty"] },
        { name: "startsOn", type: "string<date>", required: true,  desc: "First day off." },
        { name: "endsOn",   type: "string<date>", required: true,  desc: "Last day off." },
        { name: "note",     type: "string",       required: false, desc: "Optional reason." }
      ], example: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", kind: "pto", startsOn: "2026-07-04", endsOn: "2026-07-07" } },
      responses: [{ status: 201, schema: "TimeOffRequest", desc: "Request submitted." }],
      responseExample: { id: "01HZXTOR0001234567890ABCDE", status: "pending" } },

    { id: "to_approve", tag: "time-off",
      method: "POST", path: "/time-off-requests/{requestId}:approve",
      name: "Approve a time-off request",
      summary: "Approve a pending request. Releases any conflicting shifts back to the open pool.",
      params: [{ name: "requestId", in: "path", type: "string<ulid>", required: true, desc: "Request to approve." }],
      responses: [{ status: 200, schema: "TimeOffRequest", desc: "Request approved." }],
      responseExample: { id: "01HZXTOR0001234567890ABCDE", status: "approved" } },

    { id: "to_reject", tag: "time-off",
      method: "POST", path: "/time-off-requests/{requestId}:reject",
      name: "Reject a time-off request",
      summary: "Reject a pending request with a reason.",
      params: [{ name: "requestId", in: "path", type: "string<ulid>", required: true, desc: "Request to reject." }],
      body: { schema: [{ name: "reason", type: "string", required: true, desc: "Reason recorded on the request." }], example: { reason: "Coverage gap during peak week — please pick another date." } },
      responses: [{ status: 200, schema: "TimeOffRequest", desc: "Request rejected." }],
      responseExample: { id: "01HZXTOR0001234567890ABCDE", status: "rejected" } }
  );

  /* ===== Timesheet extensions ===================================== */
  add(
    { id: "ts_submit", tag: "timesheets",
      method: "POST", path: "/timesheets",
      name: "Submit a timesheet",
      summary: "Worker-side: submit a draft or in-progress timesheet for approval.",
      body: { schema: [
        { name: "workerId",      type: "string<ulid>", required: true,  desc: "Worker submitting time." },
        { name: "requisitionId", type: "string<ulid>", required: true,  desc: "Requisition the time was worked against." },
        { name: "weekStarting",  type: "string<date>", required: true,  desc: "Pay week." },
        { name: "entries",       type: "Array<TimesheetEntry>", required: true, desc: "One row per worked shift." }
      ], example: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", weekStarting: "2026-06-01", entries: [{ date: "2026-06-02", startsAt: "22:00", endsAt: "06:00", breakMinutes: 30, hours: 7.5 }] } },
      responses: [{ status: 201, schema: "Timesheet", desc: "Timesheet submitted." }],
      responseExample: { id: "01HZX9N1KD7H4F2R6S3P8M5VYC", status: "submitted" } },

    { id: "ts_update", tag: "timesheets",
      method: "PATCH", path: "/timesheets/{timesheetId}",
      name: "Update a timesheet",
      summary: "Partial update of a draft timesheet's entries. Approved timesheets are immutable; use adjustments.",
      params: [{ name: "timesheetId", in: "path", type: "string<ulid>", required: true, desc: "Timesheet to update." }],
      body: { schemaRef: "Subset of Timesheet", example: { entries: [{ date: "2026-06-02", startsAt: "22:00", endsAt: "06:30", hours: 8.0 }] } },
      responses: [{ status: 200, schema: "Timesheet", desc: "Updated timesheet." }],
      responseExample: { id: "01HZX9N1KD7H4F2R6S3P8M5VYC", status: "draft" } },

    { id: "ts_bulk_approve", tag: "timesheets",
      method: "POST", path: "/timesheets:bulk-approve",
      name: "Bulk-approve timesheets",
      summary: "Approve multiple timesheets in one call. Returns per-id results.",
      body: { schema: [
        { name: "timesheetIds", type: "Array<string<ulid>>", required: true,  desc: "Timesheets to approve." },
        { name: "note",         type: "string",              required: false, desc: "Optional note recorded on each." }
      ], example: { timesheetIds: ["01HZX9N1KD7H4F2R6S3P8M5VYC", "01HZX9N1KD7H4F2R6S3P8M5VYD"] } },
      responses: [{ status: 200, schema: "BulkApproveResult", desc: "Per-id success/failure." }],
      responseExample: { results: [{ id: "01HZX9N1KD7H4F2R6S3P8M5VYC", status: "approved" }, { id: "01HZX9N1KD7H4F2R6S3P8M5VYD", status: "approved" }] } },

    { id: "ts_adjustment", tag: "timesheets",
      method: "POST", path: "/timesheets/{timesheetId}/adjustments",
      name: "Add a timesheet adjustment",
      summary:
        "Add a post-approval adjustment to a timesheet. Audit-logged and exported on the next payroll run. " +
        "Use this rather than editing approved timesheets directly.",
      params: [{ name: "timesheetId", in: "path", type: "string<ulid>", required: true, desc: "Timesheet to adjust." }],
      body: { schema: [
        { name: "kind",   type: "enum",   required: true,  desc: "Adjustment kind.", enum: ["correction", "missed_clockout", "retro_pay", "bonus"] },
        { name: "hours",  type: "number", required: false, desc: "Hours adjustment (positive or negative)." },
        { name: "amount", type: "Money",  required: false, desc: "Money adjustment, when kind is retro_pay or bonus." },
        { name: "reason", type: "string", required: true,  desc: "Why the adjustment was made." }
      ], example: { kind: "missed_clockout", hours: 0.5, reason: "Worker forgot to clock out at end of shift." } },
      responses: [{ status: 201, schema: "TimesheetAdjustment", desc: "Adjustment recorded." }],
      responseExample: { id: "01HZXTSADJ0123456789ABCDEF", timesheetId: "01HZX9N1KD7H4F2R6S3P8M5VYC", kind: "missed_clockout", hours: 0.5 } },

    { id: "ts_export", tag: "timesheets",
      method: "POST", path: "/timesheets:export",
      name: "Export to payroll",
      summary:
        "Bundle approved timesheets into a payroll export. Returns an export job; poll its ID for the resulting file.",
      body: { schema: [
        { name: "weekStarting", type: "string<date>", required: true, desc: "Pay week to export." },
        { name: "format",       type: "enum",         required: false, desc: "Output format. Defaults to csv.", enum: ["csv", "xlsx", "json", "dayforce"] }
      ], example: { weekStarting: "2026-06-01", format: "dayforce" } },
      responses: [{ status: 202, schema: "ExportJob", desc: "Export queued." }],
      responseExample: { id: "01HZXTSEXP0123456789ABCDEF", weekStarting: "2026-06-01", format: "dayforce", status: "running" } }
  );

  /* ===== Invoice extensions ======================================= */
  add(
    { id: "inv_lines", tag: "invoices",
      method: "GET", path: "/invoices/{invoiceId}/lines",
      name: "List invoice lines",
      summary: "Returns just the line items for an invoice. Useful when the parent invoice is already cached.",
      params: [{ name: "invoiceId", in: "path", type: "string<ulid>", required: true, desc: "Invoice to fetch." }],
      responses: [{ status: 200, schema: "Array<InvoiceLine>", desc: "Line items." }],
      responseExample: [
        { id: "01HZXA1T7P2R8M4F5K6D9N3S2W", description: "Regular hours · week of May 11", hours: 320, rate: 31.75, amount: 10160.00 },
        { id: "01HZXA1T7P2R8M4F5K6D9N3S2X", description: "Overtime hours · week of May 11",  hours:  18, rate: 47.63, amount:   857.34 }
      ] },

    { id: "inv_dispute", tag: "invoices",
      method: "POST", path: "/invoices/{invoiceId}:dispute",
      name: "Dispute an invoice",
      summary: "Open a dispute on an invoice. Pauses the payment workflow and notifies the supplier.",
      params: [{ name: "invoiceId", in: "path", type: "string<ulid>", required: true, desc: "Invoice to dispute." }],
      body: { schema: [
        { name: "reasonCode", type: "enum",   required: true,  desc: "Dispute reason.", enum: ["hours_mismatch", "rate_mismatch", "duplicate", "tax_incorrect", "other"] },
        { name: "note",       type: "string", required: true,  desc: "Free-text explanation." },
        { name: "lineIds",    type: "Array<string<ulid>>", required: false, desc: "Specific line items in dispute." }
      ], example: { reasonCode: "hours_mismatch", note: "Wednesday OT not approved." } },
      responses: [{ status: 200, schema: "Invoice", desc: "Invoice moved to disputed." }],
      responseExample: { id: "01HZXA0K2N4R8F7D3M2P5S6QWE", status: "disputed" } },

    { id: "inv_pay", tag: "invoices",
      method: "POST", path: "/invoices/{invoiceId}:pay",
      name: "Mark an invoice paid",
      summary: "Mark an approved invoice as paid (typically called by the AP integration callback).",
      params: [{ name: "invoiceId", in: "path", type: "string<ulid>", required: true, desc: "Invoice to mark paid." }],
      body: { schema: [
        { name: "paidAt",       type: "string<datetime>", required: true,  desc: "Settlement timestamp." },
        { name: "paymentRef",   type: "string",           required: false, desc: "Reference number from AP." }
      ], example: { paidAt: "2026-06-12T17:00:00Z", paymentRef: "DAYF-AP-99211" } },
      responses: [{ status: 200, schema: "Invoice", desc: "Invoice marked paid." }],
      responseExample: { id: "01HZXA0K2N4R8F7D3M2P5S6QWE", status: "paid" } }
  );

  /* ===== Worker extensions ======================================== */
  add(
    { id: "wrk_credentials", tag: "workers",
      method: "GET", path: "/workers/{workerId}/credentials",
      name: "Get a worker's credentials",
      summary: "Returns every credential record attached to one worker, including expired ones.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to query." }],
      responses: [{ status: 200, schema: "Array<WorkerCredential>", desc: "Credential list." }],
      responseExample: [
        { id: "01HZXWCRED0001234567890ABC", credentialId: "01HZX0JCREDOSHA10HOURABC123", status: "verified", expiresOn: "2030-03-12" }
      ] },

    { id: "wrk_tenure", tag: "workers",
      method: "GET", path: "/workers/{workerId}/tenure",
      name: "Get a worker's tenure",
      summary: "Returns the worker's tenure summary across all requisitions.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to query." }],
      responses: [{ status: 200, schema: "TenureSummary", desc: "Tenure envelope." }],
      responseExample: { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WT", totalWeeks: 41, engagementCount: 3, firstEngagementAt: "2025-08-04", longestEngagementWeeks: 22 } },

    { id: "wrk_timeline", tag: "workers",
      method: "GET", path: "/workers/{workerId}/timeline",
      name: "Get a worker's timeline",
      summary:
        "Returns a chronological feed of every engagement event for one worker — placements, shifts " +
        "worked, credentials earned, performance notes.",
      params: [{ name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to query." }],
      responses: [{ status: 200, schema: "Array<TimelineEvent>", desc: "Timeline events." }],
      responseExample: [
        { at: "2025-08-04T13:00:00Z", kind: "engagement.started", requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CX" },
        { at: "2025-09-10T17:00:00Z", kind: "credential.earned",  credentialId: "01HZX0JCREDOSHA10HOURABC123" }
      ] }
  );

  /* ===== Analytics, insights, dashboards ========================== */
  add(
    { id: "metrics_list", tag: "analytics",
      method: "GET", path: "/metrics",
      name: "List metrics",
      summary: "Returns the catalog of pre-built metrics available for query.",
      responses: [{ status: 200, schema: "Array<MetricDefinition>", desc: "Metric catalog." }],
      responseExample: [
        { code: "spend.committed",      name: "Committed spend",        unit: "money", dimensions: ["location", "supplier", "engagementType"] },
        { code: "fill_rate",            name: "Fill rate",              unit: "ratio", dimensions: ["location", "supplier", "job"] },
        { code: "time_to_fill",         name: "Time to fill",           unit: "hours", dimensions: ["location", "supplier", "engagementType"] }
      ] },

    { id: "metrics_query", tag: "analytics",
      method: "POST", path: "/metrics/query",
      name: "Run a metric query",
      summary: "Execute a metric query with filters and groupings. Returns rows ready to render in a chart.",
      body: { schema: [
        { name: "metric",     type: "string",  required: true,  desc: "Metric code." },
        { name: "from",       type: "string<date>", required: true, desc: "Inclusive start date." },
        { name: "to",         type: "string<date>", required: true, desc: "Inclusive end date." },
        { name: "groupBy",    type: "Array<string>", required: false, desc: "Dimensions to group by." },
        { name: "filters",    type: "object",  required: false, desc: "Equality filters keyed by dimension." },
        { name: "granularity",type: "enum",    required: false, desc: "Time bucket size.", enum: ["day", "week", "month", "quarter"] }
      ], example: { metric: "spend.committed", from: "2026-01-01", to: "2026-05-31", groupBy: ["engagementType"], granularity: "week" } },
      responses: [{ status: 200, schema: "MetricQueryResult", desc: "Result rows." }],
      responseExample: { metric: "spend.committed", unit: "money", currency: "USD", rows: [{ engagementType: "shift", week: "2026-05-25", value: 412800 }, { engagementType: "assignment", week: "2026-05-25", value: 184300 }] } },

    { id: "insights_list", tag: "analytics",
      method: "GET", path: "/insights",
      name: "List insights",
      summary:
        "Returns named insights — automatically-generated summaries of spend, supplier performance, and risk.",
      responses: [{ status: 200, schema: "Array<Insight>", desc: "Insight list." }],
      responseExample: [
        { id: "01HZXINS00012345670000000A", title: "Reno DC-3 fill rate down 8% week-over-week", category: "supplier_performance", severity: "warning", subjectType: "location", subjectId: "01HZX0J5W1S9D8H7N3E6Q4R2YX" },
        { id: "01HZXINS00012345670000000B", title: "3 credentials expiring in 14 days",          category: "compliance",          severity: "info",    subjectType: "org",      subjectId: "01HZX0J0ORG0000000000000XY" }
      ] },

    { id: "dash_get", tag: "dashboards",
      method: "GET", path: "/dashboards",
      name: "Get the user's dashboard",
      summary: "Returns the current user's dashboard layout — tabs, widgets, and their saved configuration.",
      responses: [{ status: 200, schema: "Dashboard", desc: "Dashboard envelope." }],
      responseExample: { tabs: [{ id: "home", label: "Home", widgets: [{ id: "weekly_spend",  pos: [0, 0, 6, 4] }, { id: "open_reqs",     pos: [6, 0, 6, 4] }] }] } },

    { id: "dash_update", tag: "dashboards",
      method: "PUT", path: "/dashboards",
      name: "Save the user's dashboard",
      summary: "Persist the user's dashboard tabs and widget layout.",
      body: { schemaRef: "Dashboard", example: { tabs: [{ id: "home", label: "Home", widgets: [{ id: "weekly_spend", pos: [0, 0, 12, 4] }] }] } },
      responses: [{ status: 200, schema: "Dashboard", desc: "Saved dashboard." }],
      responseExample: { tabs: [{ id: "home", label: "Home", widgets: [{ id: "weekly_spend", pos: [0, 0, 12, 4] }] }] } },

    { id: "dash_widgets", tag: "dashboards",
      method: "GET", path: "/dashboards/widgets",
      name: "List available widgets",
      summary: "Returns the catalog of widgets available for placement on the dashboard.",
      responses: [{ status: 200, schema: "Array<WidgetDefinition>", desc: "Widget catalog." }],
      responseExample: [
        { id: "weekly_spend",  name: "Weekly spend",        category: "finance",  minW: 4, minH: 3 },
        { id: "open_reqs",     name: "Open requisitions",   category: "workflow", minW: 4, minH: 3 },
        { id: "approvals_due", name: "Approvals due today", category: "workflow", minW: 4, minH: 2 }
      ] }
  );

  /* ===== Webhooks event catalog =================================== */
  add(
    { id: "events_list", tag: "events",
      method: "GET", path: "/webhooks/events",
      name: "List event types",
      summary: "Returns every event type a webhook subscription can listen for.",
      responses: [{ status: 200, schema: "Array<EventDefinition>", desc: "Event catalog." }],
      responseExample: [
        { type: "requisition.opened",    payloadSchema: "Requisition", retryUpToHours: 72 },
        { type: "requisition.filled",    payloadSchema: "Requisition", retryUpToHours: 72 },
        { type: "candidate.submitted",   payloadSchema: "Candidate",   retryUpToHours: 72 },
        { type: "candidate.hired",       payloadSchema: "Candidate",   retryUpToHours: 72 },
        { type: "timesheet.submitted",   payloadSchema: "Timesheet",   retryUpToHours: 72 },
        { type: "timesheet.approved",    payloadSchema: "Timesheet",   retryUpToHours: 72 },
        { type: "invoice.issued",        payloadSchema: "Invoice",     retryUpToHours: 72 },
        { type: "invoice.approved",      payloadSchema: "Invoice",     retryUpToHours: 72 },
        { type: "worker.onboarded",      payloadSchema: "Worker",      retryUpToHours: 72 },
        { type: "worker.offboarded",     payloadSchema: "Worker",      retryUpToHours: 72 },
        { type: "credential.expiring",   payloadSchema: "WorkerCredential", retryUpToHours: 72 }
      ] },

    { id: "hk_deliveries", tag: "webhooks",
      method: "GET", path: "/webhooks/{webhookId}/deliveries",
      name: "List deliveries",
      summary: "Returns recent delivery attempts for a webhook subscription. Useful for debugging.",
      params: [
        { name: "webhookId", in: "path",  type: "string<ulid>", required: true,  desc: "Subscription to inspect." },
        { name: "status",    in: "query", type: "enum",         required: false, desc: "Filter by outcome.", enum: ["pending", "succeeded", "failed", "abandoned"] },
        { name: "cursor",    in: "query", type: "string",       required: false, desc: "Pagination cursor." }
      ],
      responses: [{ status: 200, schema: "Page<WebhookDelivery>", desc: "Delivery page." }],
      responseExample: { data: [{ id: "01HZXWHKDLV001234567890ABC", eventType: "timesheet.approved", attemptedAt: "2026-05-26T17:22:01Z", status: "succeeded", responseCode: 200, latencyMs: 142 }], nextCursor: null } },

    { id: "hk_rotate_secret", tag: "webhooks",
      method: "POST", path: "/webhooks/{webhookId}:rotate-secret",
      name: "Rotate signing secret",
      summary:
        "Generate a new signing secret for a webhook subscription. The old secret remains valid for 24 hours to allow rollover.",
      params: [{ name: "webhookId", in: "path", type: "string<ulid>", required: true, desc: "Subscription." }],
      responses: [{ status: 200, schema: "WebhookRotateResult", desc: "New secret." }],
      responseExample: { signingSecret: "whsec_9p…⟨new⟩", previousSecretValidUntil: "2026-05-27T17:22:01Z" } }
  );

  /* ===== System =================================================== */
  add(
    { id: "sys_health", tag: "system",
      method: "GET", path: "/system/health",
      name: "Get system health",
      summary: "Returns the current operational status of the platform. Unauthenticated.",
      responses: [{ status: 200, schema: "SystemHealth", desc: "Status envelope." }],
      responseExample: { status: "operational", region: "us-east-1", incidents: [], updatedAt: "2026-05-26T17:22:01Z" } },

    { id: "sys_regions", tag: "system",
      method: "GET", path: "/system/regions",
      name: "List regions",
      summary: "Returns the data-residency regions the platform offers, and the region the caller's org sits in.",
      responses: [{ status: 200, schema: "Array<Region>", desc: "Region list." }],
      responseExample: [
        { code: "us",  name: "United States", baseUrl: "https://api.dayforce.com/flex-work/v1",    primary: true },
        { code: "eu",  name: "European Union", baseUrl: "https://api.eu.dayforce.com/flex-work/v1" }
      ] },

    { id: "api_keys_list", tag: "system",
      method: "GET", path: "/api-keys",
      name: "List API keys",
      summary: "Returns the API keys the org has provisioned.",
      responses: [{ status: 200, schema: "Array<ApiKey>", desc: "API key list." }],
      responseExample: [
        { id: "01HZXAPI0001234567890ABCDE", name: "Payroll export · production",  scopes: ["timesheets.read", "invoices.read"], lastUsedAt: "2026-05-26T16:09:00Z", createdAt: "2025-12-04T11:00:00Z" }
      ] },

    { id: "api_keys_create", tag: "system",
      method: "POST", path: "/api-keys",
      name: "Create an API key",
      summary: "Provision a new API key. The full secret is returned ONCE in the response; capture it on creation.",
      body: { schema: [
        { name: "name",   type: "string",        required: true, desc: "Display name." },
        { name: "scopes", type: "Array<string>", required: true, desc: "Permission scopes granted to the key." }
      ], example: { name: "Payroll export · production", scopes: ["timesheets.read", "invoices.read"] } },
      responses: [{ status: 201, schema: "ApiKeyWithSecret", desc: "API key created. The `secret` field is shown ONCE." }],
      responseExample: { id: "01HZXAPI0001234567890ABCDE", name: "Payroll export · production", secret: "fw_live_a08c3d…⟨only shown once⟩", scopes: ["timesheets.read", "invoices.read"] } },

    { id: "api_keys_delete", tag: "system",
      method: "DELETE", path: "/api-keys/{keyId}",
      name: "Revoke an API key",
      summary: "Permanently revoke an API key. Any in-flight requests using the key will fail with 401.",
      params: [{ name: "keyId", in: "path", type: "string<ulid>", required: true, desc: "Key to revoke." }],
      responses: [{ status: 204, schema: null, desc: "Key revoked." }],
      responseExample: null }
  );

  /* ===== AI / Labs ================================================ */
  add(
    { id: "ai_chat", tag: "ai",
      method: "POST", path: "/ai/chat",
      name: "Send a chat turn",
      summary:
        "Sends a user message to the Flex Work assistant, augmented with the current org context. " +
        "Beta surface — requires the X-Flexwork-Labs header set to `aiChat`.",
      body: { schema: [
        { name: "messages",       type: "Array<ChatMessage>", required: true, desc: "Conversation so far, newest last." },
        { name: "contextHints",   type: "object",             required: false, desc: "Optional context — current page, selected entities — to ground the response." }
      ], example: { messages: [{ role: "user", content: "Which suppliers had the worst fill rate this month?" }], contextHints: { page: "insights" } } },
      responses: [{ status: 200, schema: "ChatResponse", desc: "Assistant reply." }],
      responseExample: { role: "assistant", content: "Three suppliers came in below 70% fill rate in May: StaffWise West (62%), …", citations: [{ kind: "metric", code: "fill_rate", dimension: "supplier" }] } },

    { id: "ai_summarize_req", tag: "ai",
      method: "POST", path: "/ai/requisitions/{requisitionId}:summarize",
      name: "Summarize a requisition",
      summary: "Returns a one-paragraph LLM summary of a requisition's status, pipeline, and risk factors.",
      params: [{ name: "requisitionId", in: "path", type: "string<ulid>", required: true, desc: "Requisition to summarize." }],
      responses: [{ status: 200, schema: "AISummary", desc: "Summary envelope." }],
      responseExample: { requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7CY", summary: "Open since May 20 with 8 of 8 headcount still to fill. StaffWise West has submitted 4 candidates — 2 in interview, 1 rejected on rate, 1 withdrawn. Time-to-fill is trending 24% above the location's 90-day median.", generatedAt: "2026-05-26T17:22:01Z" } }
  );

})();
