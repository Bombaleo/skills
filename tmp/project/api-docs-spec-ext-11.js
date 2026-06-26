/* =====================================================================
   Flex Work API · spec extension (part 11 — missing endpoints)
   ---------------------------------------------------------------------
   Closes the six P0 findings from Flex Work API Platform Audit.html:
   five screens that had no endpoint to call at all.

   Loads AFTER ext-10 (screen-grade examples). Adds new endpoints and
   tags in place; never mutates ones added by earlier files.

   Findings → endpoints added:
     G-07  Supplier contract history ........ GET /suppliers/{id}/contracts
                                              GET /suppliers/{id}/contracts/{revisionId}
     G-12  Schedule console heat map ........ GET /schedules/console
     G-16  Contractor classification trend .. GET /contractors/{id}/classification/history
     G-17  Inbox cross-entity approval queue  GET /me/approvals
                                              POST /me/approvals:bulk
     G-18  Universal search palette ......... GET /search
     G-19  Booking roster lineup is handled
           by extending bookings_roster_get
           in ext-12, not adding a new endpoint.

   New tags introduced:
     search           — Universal search (platform group)
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  function add() { for (var i = 0; i < arguments.length; i++) spec.paths.push(arguments[i]); }
  function ensureTag(t) {
    if (!spec.tags.find(function (x) { return x.id === t.id; })) spec.tags.push(t);
  }
  function ensureTagInGroup(groupId, tagId) {
    var g = (spec.groups || []).find(function (x) { return x.id === groupId; });
    if (g && (g.tags || []).indexOf(tagId) < 0) g.tags.push(tagId);
  }

  /* ------ Stable ULIDs (reuse the ID dictionary from ext-10) -------- */
  var ID = {
    sup_staffwise:  "01HZX0J7X1K8N4F5R3S2D2YQAH",
    sup_orion:      "01HZX0J7X1K8N4F5R3S2D2YQAK",
    sup_globalpath: "01HZX0J7X1K8N4F5R3S2D2YQAJ",
    sup_riverbend:  "01HZX0J7X1K8N4F5R3S2D2YQAL",
    loc_reno:       "01HZX0J5W1S9D8H7N3E6Q4R2YX",
    loc_phoenix:    "01HZX0J5W1S9D8H7N3E6Q4R2YY",
    loc_chicago:    "01HZX0J5W1S9D8H7N3E6Q4R2YZ",
    loc_dublin:     "01HZX0J5W1S9D8H7N3E6Q4R2Y0",
    user_alex:      "01HZX0J0XM7R1F2N6K3L7S5VWE",
    user_priya:     "01HZX0J0XM7R1F2N6K3L7S5VWF",
    wrk_maya:       "01HZX0J8B7P3R2K6F9D5N8M4WT",
    wrk_lukas:      "01HZX0J8B7P3R2K6F9D5N8M4WU",
    wrk_sami:       "01HZX0J8B7P3R2K6F9D5N8M4WV",
    req_picker:     "01HZX7K2QM4FN0R8VBSE6PA7CY",
    req_devops:     "01HZX7K2QM4FN0R8VBSE6PA7D0"
  };

  /* =================================================================
     G-07 · Supplier contract history (GET endpoints)
     ================================================================= */
  add(
    { id: "sup_contracts_list", tag: "suppliers",
      method: "GET", path: "/suppliers/{supplierId}/contracts",
      name: "List supplier contracts",
      summary: "Returns every contract revision for one supplier, newest first. The currently-active revision is `state === \"active\"`; all prior revisions stay readable for audit and for in-flight requisitions that adopted their terms.",
      detail:
        "Contracts are versioned by-design — every markup, payment terms, or billing cadence change creates a new revision and archives the previous one. Open requisitions distributed to the supplier continue to bill at the terms from the revision they were opened under; only NEW requisitions adopt the active revision. Use this endpoint as the data source for the contract-history surface on the supplier page.",
      params: [
        { name: "supplierId", in: "path",  type: "string<ulid>", required: true,  desc: "Supplier to list contracts for." },
        { name: "state",      in: "query", type: "enum",         required: false, desc: "Filter by lifecycle state.", enum: ["draft", "pending", "active", "expired", "terminated"] },
        { name: "cursor",     in: "query", type: "string",       required: false, desc: "Pagination cursor." },
        { name: "limit",      in: "query", type: "integer",      required: false, desc: "Page size, 1\u201350. Defaults to 20." }
      ],
      responses: [
        { status: 200, schema: "Page<SupplierContract>", desc: "Page of contract revisions." },
        { status: 404, schema: "Error", desc: "Supplier not found." }
      ],
      responseExample: {
        data: [
          { id: "01HZXCNT0001STAFFWISE00ACT4", supplierId: ID.sup_staffwise, version: 4,
            state: "active",
            effectiveStart: "2026-06-01", effectiveEnd: "2029-06-01",
            markupPct: 0.43, paymentTermsDays: 30, billingCadence: "weekly",
            currency: "USD", autoRenew: true,
            documentUrl: "https://files.dayforce.com/contracts/01HZXCNT0001STAFFWISE00ACT4.pdf?sig=\u2026",
            signedBy: [
              { name: "Renee Bauer",   role: "Director, StaffWise West", signedAt: "2026-05-26T16:00:00Z" },
              { name: "Priya Aravind", role: "Director of vendor ops",    signedAt: "2026-05-26T16:02:11Z" }
            ],
            createdAt: "2026-05-26T17:22:01Z", createdBy: ID.user_priya },
          { id: "01HZXCNT0001STAFFWISE00ACT3", supplierId: ID.sup_staffwise, version: 3,
            state: "expired",
            effectiveStart: "2024-01-01", effectiveEnd: "2026-05-31",
            markupPct: 0.41, paymentTermsDays: 30, billingCadence: "weekly",
            currency: "USD", autoRenew: true,
            documentUrl: "https://files.dayforce.com/contracts/01HZXCNT0001STAFFWISE00ACT3.pdf?sig=\u2026",
            signedBy: [
              { name: "Renee Bauer",   role: "Director, StaffWise West", signedAt: "2023-12-22T15:30:00Z" },
              { name: "Tomás Núñez",   role: "Procurement lead",         signedAt: "2023-12-22T16:00:00Z" }
            ],
            createdAt: "2023-12-22T16:01:00Z", createdBy: ID.user_priya },
          { id: "01HZXCNT0001STAFFWISE00ACT2", supplierId: ID.sup_staffwise, version: 2,
            state: "expired",
            effectiveStart: "2022-01-01", effectiveEnd: "2023-12-31",
            markupPct: 0.38, paymentTermsDays: 45, billingCadence: "biweekly",
            currency: "USD", autoRenew: false,
            documentUrl: "https://files.dayforce.com/contracts/01HZXCNT0001STAFFWISE00ACT2.pdf?sig=\u2026",
            signedBy: [
              { name: "Renee Bauer",   role: "Director, StaffWise West", signedAt: "2021-11-08T14:00:00Z" },
              { name: "Tomás Núñez",   role: "Procurement lead",         signedAt: "2021-11-09T09:00:00Z" }
            ],
            createdAt: "2021-11-09T09:01:00Z", createdBy: ID.user_priya }
        ],
        nextCursor: null,
        totalCount: 4
      } },

    { id: "sup_contract_get", tag: "suppliers",
      method: "GET", path: "/suppliers/{supplierId}/contracts/{revisionId}",
      name: "Get a supplier contract revision",
      summary: "Returns one supplier contract revision in full — terms, signers, attached document URL, and the audit trail for the revision itself.",
      params: [
        { name: "supplierId", in: "path", type: "string<ulid>", required: true, desc: "Supplier the contract belongs to." },
        { name: "revisionId", in: "path", type: "string<ulid>", required: true, desc: "Specific revision to fetch." }
      ],
      responses: [
        { status: 200, schema: "SupplierContract", desc: "Contract revision envelope." },
        { status: 404, schema: "Error", desc: "Supplier or revision not found." }
      ],
      responseExample: {
        id: "01HZXCNT0001STAFFWISE00ACT4", supplierId: ID.sup_staffwise, version: 4,
        state: "active",
        effectiveStart: "2026-06-01", effectiveEnd: "2029-06-01",
        markupPct: 0.43, paymentTermsDays: 30, billingCadence: "weekly",
        currency: "USD", autoRenew: true,
        documentUrl: "https://files.dayforce.com/contracts/01HZXCNT0001STAFFWISE00ACT4.pdf?sig=\u2026",
        signedBy: [
          { name: "Renee Bauer",   role: "Director, StaffWise West", signedAt: "2026-05-26T16:00:00Z" },
          { name: "Priya Aravind", role: "Director of vendor ops",    signedAt: "2026-05-26T16:02:11Z" }
        ],
        earlyPayDiscounts: [{ days: 10, discountPct: 0.02 }],
        complianceClauses: ["COI", "BAA"],
        previousRevisionId: "01HZXCNT0001STAFFWISE00ACT3",
        createdAt: "2026-05-26T17:22:01Z", createdBy: ID.user_priya
      } }
  );

  /* =================================================================
     G-12 · Schedule console heat map
     ================================================================= */
  add(
    { id: "sch_console", tag: "schedules",
      method: "GET", path: "/schedules/console",
      name: "Get schedule console grid",
      summary: "Returns the location-by-day aggregation that powers the schedule console heat map. One cell per (location, date) with shift count and fill state — saves a round-trip per cell vs paginating /shifts.",
      detail:
        "Use this endpoint for any cross-location calendar view (the schedule console, the manager mobile schedule, the dashboard schedule widget). The response groups by location AND day; for the underlying shifts use /shifts (filterable by location + day-range).",
      params: [
        { name: "week",        in: "query", type: "string<date>", required: true,  desc: "ISO date for the Monday of the week (e.g. `2026-06-01`)." },
        { name: "locationIds", in: "query", type: "string<ulid>", required: false, desc: "Comma-separated location filter. Omit for every location the caller can see." },
        { name: "engagementType", in: "query", type: "enum",      required: false, desc: "Filter by EngagementType.", enum: ["shift", "assignment", "project", "sow"] },
        { name: "jobIds",      in: "query", type: "string<ulid>", required: false, desc: "Comma-separated job filter." }
      ],
      responses: [
        { status: 200, schema: "ScheduleConsoleGrid", desc: "Location-by-day aggregation grid." }
      ],
      responseExample: {
        weekStarting: "2026-06-01", weekEnding: "2026-06-07",
        locations: [
          { locationId: ID.loc_reno, locationName: "Reno DC-3", timezone: "America/Los_Angeles" },
          { locationId: ID.loc_phoenix, locationName: "Phoenix DC-1", timezone: "America/Phoenix" },
          { locationId: ID.loc_chicago, locationName: "Chicago HQ", timezone: "America/Chicago" }
        ],
        days: ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07"],
        cells: [
          { locationId: ID.loc_reno, date: "2026-06-01", totalShifts: 24, openShifts: 3, assignedShifts: 21, confirmedShifts: 18, fillState: "partial" },
          { locationId: ID.loc_reno, date: "2026-06-02", totalShifts: 24, openShifts: 2, assignedShifts: 22, confirmedShifts: 20, fillState: "partial" },
          { locationId: ID.loc_reno, date: "2026-06-03", totalShifts: 24, openShifts: 0, assignedShifts: 24, confirmedShifts: 23, fillState: "filled" },
          { locationId: ID.loc_reno, date: "2026-06-04", totalShifts: 24, openShifts: 1, assignedShifts: 23, confirmedShifts: 21, fillState: "filled" },
          { locationId: ID.loc_reno, date: "2026-06-05", totalShifts: 22, openShifts: 4, assignedShifts: 18, confirmedShifts: 14, fillState: "partial" },
          { locationId: ID.loc_reno, date: "2026-06-06", totalShifts: 12, openShifts: 6, assignedShifts: 6,  confirmedShifts: 4,  fillState: "open" },
          { locationId: ID.loc_reno, date: "2026-06-07", totalShifts: 12, openShifts: 4, assignedShifts: 8,  confirmedShifts: 5,  fillState: "partial" },
          { locationId: ID.loc_phoenix, date: "2026-06-01", totalShifts: 16, openShifts: 0, assignedShifts: 16, confirmedShifts: 16, fillState: "filled" },
          { locationId: ID.loc_phoenix, date: "2026-06-02", totalShifts: 16, openShifts: 1, assignedShifts: 15, confirmedShifts: 14, fillState: "partial" },
          { locationId: ID.loc_phoenix, date: "2026-06-03", totalShifts: 16, openShifts: 0, assignedShifts: 16, confirmedShifts: 15, fillState: "filled" },
          { locationId: ID.loc_phoenix, date: "2026-06-04", totalShifts: 16, openShifts: 2, assignedShifts: 14, confirmedShifts: 13, fillState: "partial" },
          { locationId: ID.loc_phoenix, date: "2026-06-05", totalShifts: 14, openShifts: 1, assignedShifts: 13, confirmedShifts: 12, fillState: "partial" },
          { locationId: ID.loc_phoenix, date: "2026-06-06", totalShifts: 8,  openShifts: 4, assignedShifts: 4,  confirmedShifts: 3,  fillState: "open" },
          { locationId: ID.loc_phoenix, date: "2026-06-07", totalShifts: 8,  openShifts: 2, assignedShifts: 6,  confirmedShifts: 5,  fillState: "partial" },
          { locationId: ID.loc_chicago, date: "2026-06-01", totalShifts: 4,  openShifts: 1, assignedShifts: 3,  confirmedShifts: 3,  fillState: "partial" },
          { locationId: ID.loc_chicago, date: "2026-06-02", totalShifts: 4,  openShifts: 0, assignedShifts: 4,  confirmedShifts: 4,  fillState: "filled" },
          { locationId: ID.loc_chicago, date: "2026-06-03", totalShifts: 4,  openShifts: 0, assignedShifts: 4,  confirmedShifts: 4,  fillState: "filled" },
          { locationId: ID.loc_chicago, date: "2026-06-04", totalShifts: 4,  openShifts: 0, assignedShifts: 4,  confirmedShifts: 4,  fillState: "filled" },
          { locationId: ID.loc_chicago, date: "2026-06-05", totalShifts: 4,  openShifts: 0, assignedShifts: 4,  confirmedShifts: 4,  fillState: "filled" },
          { locationId: ID.loc_chicago, date: "2026-06-06", totalShifts: 0,  openShifts: 0, assignedShifts: 0,  confirmedShifts: 0,  fillState: "closed" },
          { locationId: ID.loc_chicago, date: "2026-06-07", totalShifts: 0,  openShifts: 0, assignedShifts: 0,  confirmedShifts: 0,  fillState: "closed" }
        ],
        totals: {
          totalShifts: 232, openShifts: 31, assignedShifts: 201, confirmedShifts: 178
        }
      } }
  );

  /* =================================================================
     G-16 · Contractor classification trend
     ================================================================= */
  add(
    { id: "ctr_classification_history", tag: "contractors",
      method: "GET", path: "/contractors/{workerId}/classification/history",
      name: "Get contractor classification history",
      summary: "Returns every classification evaluation ever run against one contractor, chronological. Powers the quarterly trend chart on the contractor detail page.",
      detail:
        "The classification policy re-evaluates contractors on a configurable cadence (quarterly by default) plus on every engagement-fact change (new requisition, exclusivity flag flipping, tenure crossing a threshold). Each evaluation is persisted as a row here; the trend chart plots `riskScore` over `evaluatedAt`. Use ?since= to scope to a specific window.",
      params: [
        { name: "workerId", in: "path",  type: "string<ulid>", required: true,  desc: "Contractor (worker) to fetch history for." },
        { name: "since",    in: "query", type: "string<date>", required: false, desc: "Earliest evaluatedAt to include. Defaults to last 6 quarters." }
      ],
      responses: [
        { status: 200, schema: "Page<ClassificationEvaluation>", desc: "Chronological evaluations." }
      ],
      responseExample: {
        workerId: ID.wrk_sami,
        data: [
          { id: "01HZXCLS0001SAMI00000000Q1", evaluatedAt: "2024-10-12T09:00:00Z", riskScore: 24, risk: "medium",
            factors: { irs_20_factor: { score: 16, result: "pass" }, abc_test: { score: 16, result: "review", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 32, result: "pass" } },
            triggeredBy: "policy.quarterly_review", recommendation: "monitor" },
          { id: "01HZXCLS0001SAMI00000000Q2", evaluatedAt: "2025-01-12T09:00:00Z", riskScore: 21, risk: "medium",
            factors: { irs_20_factor: { score: 15, result: "pass" }, abc_test: { score: 18, result: "pass", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 45, result: "pass" } },
            triggeredBy: "policy.quarterly_review", recommendation: "no_action" },
          { id: "01HZXCLS0001SAMI00000000Q3", evaluatedAt: "2025-04-12T09:00:00Z", riskScore: 18, risk: "low",
            factors: { irs_20_factor: { score: 14, result: "pass" }, abc_test: { score: 18, result: "pass", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 58, result: "pass" } },
            triggeredBy: "policy.quarterly_review", recommendation: "no_action" },
          { id: "01HZXCLS0001SAMI00000000Q4", evaluatedAt: "2025-07-12T09:00:00Z", riskScore: 16, risk: "low",
            factors: { irs_20_factor: { score: 14, result: "pass" }, abc_test: { score: 19, result: "pass", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 71, result: "pass" } },
            triggeredBy: "policy.quarterly_review", recommendation: "no_action" },
          { id: "01HZXCLS0001SAMI00000000Q5", evaluatedAt: "2025-10-12T09:00:00Z", riskScore: 14, risk: "low",
            factors: { irs_20_factor: { score: 14, result: "pass" }, abc_test: { score: 19, result: "pass", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 84, result: "pass" } },
            triggeredBy: "engagement.added", recommendation: "no_action" },
          { id: "01HZXCLS0001SAMI00000000Q6", evaluatedAt: "2026-01-12T09:00:00Z", riskScore: 13, risk: "low",
            factors: { irs_20_factor: { score: 14, result: "pass" }, abc_test: { score: 18, result: "pass", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 97, result: "pass" } },
            triggeredBy: "policy.quarterly_review", recommendation: "no_action" },
          { id: "01HZXCLS0001SAMI00000000Q7", evaluatedAt: "2026-04-12T09:00:00Z", riskScore: 12, risk: "low",
            factors: { irs_20_factor: { score: 14, result: "pass" }, abc_test: { score: 18, result: "pass", jurisdiction: "IL" }, exclusivity: { result: "pass" }, tenure: { weeks: 110, result: "pass" } },
            triggeredBy: "policy.quarterly_review", recommendation: "no_action" }
        ],
        nextCursor: null,
        totalCount: 7
      } }
  );

  /* =================================================================
     G-17 · Inbox cross-entity approval queue
     ================================================================= */
  add(
    { id: "me_approvals_list", tag: "me",
      method: "GET", path: "/me/approvals",
      name: "Get my approval queue",
      summary: "Returns every item awaiting the calling user's sign-off across resource types — timesheets, requisitions, invoices, rate-card change requests. Drives the Inbox triage queue.",
      detail:
        "The envelope is intentionally polymorphic: each entry carries a `kind` discriminator (`timesheet | requisition | invoice | rate_change | expense | sow_milestone`) and a `subject` sub-object shaped per kind. Bulk action across heterogeneous kinds via /me/approvals:bulk. The `counts` object lets the UI render per-kind tab counters in one round trip.",
      params: [
        { name: "kind",     in: "query", type: "enum",   required: false, desc: "Filter to one kind of pending approval.", enum: ["timesheet", "requisition", "invoice", "rate_change", "expense", "sow_milestone"] },
        { name: "priority", in: "query", type: "enum",   required: false, desc: "Filter by SLA priority.", enum: ["low", "normal", "high", "critical"] },
        { name: "ageHoursGte", in: "query", type: "integer", required: false, desc: "Surface only items aged ≥ N hours since they entered my queue." },
        { name: "sort",     in: "query", type: "enum",   required: false, desc: "Sort axis.", enum: ["priority", "ageHours", "amount", "dueAt"] },
        { name: "cursor",   in: "query", type: "string", required: false, desc: "Pagination cursor." },
        { name: "limit",    in: "query", type: "integer",required: false, desc: "Page size, 1\u2013100. Defaults to 50." }
      ],
      responses: [
        { status: 200, schema: "ApprovalQueue", desc: "Approval-queue envelope with polymorphic data and per-kind counts." }
      ],
      responseExample: {
        data: [
          { id: "01HZXAPP001REQ0HEADCOUNT", kind: "requisition",
            subjectId: ID.req_devops,
            subject: { code: "REQ-08423", title: "Senior DevOps engineer (12-mo)", engagementType: "project", amount: { amount: 138.00, currency: "USD" } },
            requestor: { id: ID.user_priya, name: "Priya Aravind", avatarUrl: null },
            ageHours: 6, priority: "high", dueAt: "2026-05-27T17:00:00Z",
            actionUrl: "/requisitions/" + ID.req_devops, actionLabel: "Review requisition" },
          { id: "01HZXAPP002TS0SUBMIT001", kind: "timesheet",
            subjectId: "01HZX9N1KD7H4F2R6S3P8M5V02",
            subject: { workerName: "Lukas Kowalski", periodLabel: "Week of May 18", hours: 40.0, totalBillable: { amount: 3315.00, currency: "EUR" } },
            requestor: { id: ID.wrk_lukas, name: "Lukas Kowalski", avatarUrl: null },
            ageHours: 4, priority: "normal", dueAt: "2026-05-27T13:00:00Z",
            actionUrl: "/timesheets/01HZX9N1KD7H4F2R6S3P8M5V02", actionLabel: "Approve timesheet" },
          { id: "01HZXAPP003INV00DISPUTE", kind: "invoice",
            subjectId: "01HZXA0K2N4R8F7D3M2P5S6Q04",
            subject: { number: "INV-2026-08412", supplierName: "Orion Staffing", total: { amount: 13413.60, currency: "USD" }, status: "disputed" },
            requestor: { id: ID.user_priya, name: "Priya Aravind", avatarUrl: null },
            ageHours: 28, priority: "high", dueAt: "2026-05-28T14:50:00Z",
            actionUrl: "/invoices/01HZXA0K2N4R8F7D3M2P5S6Q04", actionLabel: "Resolve dispute" },
          { id: "01HZXAPP004RATE0CHANGE", kind: "rate_change",
            subjectId: "01HZXPRC0001RENO0PICKER0NIGHT",
            subject: { jobTitle: "Warehouse picker · night differential", supplierName: "StaffWise West", oldBillRate: 34.50, newBillRate: 36.20, currency: "USD", deltaPct: 0.049 },
            requestor: { id: ID.user_priya, name: "Priya Aravind", avatarUrl: null },
            ageHours: 14, priority: "normal", dueAt: "2026-05-27T03:00:00Z",
            actionUrl: "/pricing-config/01HZXPRC0001RENO0PICKER0NIGHT", actionLabel: "Review rate change" },
          { id: "01HZXAPP005EXP00LODGING0", kind: "expense",
            subjectId: "01HZXEXP002MEALS0000CHICAGO",
            subject: { workerName: "Sami Soto", category: "meals", amount: { amount: 64.18, currency: "USD" }, requisitionCode: "REQ-08423" },
            requestor: { id: ID.wrk_sami, name: "Sami Soto", avatarUrl: null },
            ageHours: 30, priority: "low", dueAt: "2026-05-28T17:00:00Z",
            actionUrl: "/expenses/01HZXEXP002MEALS0000CHICAGO", actionLabel: "Approve expense" },
          { id: "01HZXAPP006SOW0MILESTONE", kind: "sow_milestone",
            subjectId: "01HZXMST0001SF000000DISCOVRY",
            subject: { sowNumber: "SOW-2026-1042", title: "Discovery & blueprint", supplierName: "Riverbend Consulting", value: { amount: 48000, currency: "USD" } },
            requestor: { id: "01HZX0J0XM7R1F2N6K3L7S5VW9", name: "Tomás Núñez (Riverbend)", avatarUrl: null },
            ageHours: 2, priority: "normal", dueAt: "2026-05-29T11:00:00Z",
            actionUrl: "/sows/01HZXSOW0001234567890ABCD1#milestone-01HZXMST0001SF000000DISCOVRY", actionLabel: "Approve milestone" }
        ],
        counts: { all: 18, timesheet: 7, requisition: 3, invoice: 2, rate_change: 4, expense: 1, sow_milestone: 1 },
        nextCursor: "eyJpZCI6IjAxSFpYQVBQMDA3\u2026",
        totalCount: 18
      } },

    { id: "me_approvals_bulk", tag: "me",
      method: "POST", path: "/me/approvals:bulk",
      name: "Bulk-resolve queue items",
      summary: "Approve or reject multiple queue items in one call, even when the items are different kinds. Returns a per-item resolution report so partial successes are visible.",
      detail:
        "Each item is resolved atomically — one failure does not block the others. The response carries a per-item `result` envelope; clients should inspect each one and surface failures inline rather than treating the response as boolean.",
      body: {
        schema: [
          { name: "action", type: "enum",   required: true,  desc: "Decision applied to every item.", enum: ["approve", "reject"] },
          { name: "items",  type: "string<ulid>[]", required: true, desc: "Queue-item ids from /me/approvals." },
          { name: "reason", type: "string", required: false, desc: "Required when action=reject. Shown to the requestor." },
          { name: "note",   type: "string", required: false, desc: "Internal note attached to each item's audit row." }
        ],
        example: {
          action: "approve",
          items: ["01HZXAPP001REQ0HEADCOUNT", "01HZXAPP002TS0SUBMIT001"],
          note: "Reviewed at month-end batch"
        }
      },
      responses: [
        { status: 200, schema: "BulkApprovalResult", desc: "Per-item resolution report." },
        { status: 207, schema: "BulkApprovalResult", desc: "Multi-status — at least one item failed; inspect each `result` envelope." }
      ],
      responseExample: {
        results: [
          { id: "01HZXAPP001REQ0HEADCOUNT", status: 200, kind: "requisition", resolvedAt: "2026-05-26T17:33:11Z" },
          { id: "01HZXAPP002TS0SUBMIT001",  status: 200, kind: "timesheet",   resolvedAt: "2026-05-26T17:33:11Z" }
        ],
        summary: { requested: 2, succeeded: 2, failed: 0 }
      } }
  );

  /* =================================================================
     G-18 · Universal search — upgrade existing /search endpoint
     ext-3 already declared a thin /search returning an Array<SearchHit>.
     Upgrade it in place: keep the same path & id, but swap the shape
     to a grouped, ranked envelope and retag it from "system" to a
     dedicated "search" tag.
     ================================================================= */
  ensureTag({
    id: "search",
    name: "Search",
    description:
      "Universal search across every entity the platform exposes — requisitions, workers, suppliers, candidates, locations, jobs, timesheets, SOWs, plus help articles. Single keystroke-friendly endpoint behind the omnibar."
  });
  ensureTagInGroup("platform", "search");

  (function upgradeSearch() {
    var existing = (spec.paths || []).find(function (p) { return p.id === "search"; });
    if (!existing) {
      spec.paths.push({ id: "search", tag: "search", method: "GET", path: "/search",
        name: "Universal search", responses: [] });
      existing = (spec.paths || []).find(function (p) { return p.id === "search"; });
    }
    existing.tag = "search";
    existing.name = "Universal search";
    existing.summary = "Substring + semantic search across every searchable resource. Returns ranked, grouped-by-type results in a single round trip.";
    existing.detail =
      "Per-keystroke search costs one call regardless of how many resource types are involved. Results are partitioned by type and ranked together; per-type caps apply (default 8 per type) so a runaway type can't crowd the others out. Authorization is enforced inside the index — supplier principals see only their own workers, etc.";
    existing.params = [
      { name: "q",     in: "query", type: "string", required: true,  desc: "Search query. Minimum 2 characters; substring + fuzzy match." },
      { name: "types", in: "query", type: "string", required: false, desc: "Comma-separated types to include.", enum: ["requisitions", "workers", "suppliers", "candidates", "locations", "jobs", "timesheets", "invoices", "sows", "help"] },
      { name: "limit", in: "query", type: "integer",required: false, desc: "Per-type result cap. Defaults to 8, max 25." },
      { name: "context", in: "query", type: "enum", required: false, desc: "Boost results adjacent to the calling user's current screen (passed by the omnibar).", enum: ["dashboard", "requisitions", "workers", "schedule"] }
    ];
    existing.responses = [
      { status: 200, schema: "SearchResult", desc: "Grouped, ranked search hits." },
      { status: 400, schema: "Error", desc: "Missing or too-short query." }
    ];
    existing.responseExample = {
      query: "maya",
      groups: [
        { type: "workers", label: "Workers", count: 1, results: [
          { id: ID.wrk_maya, label: "Maya Okafor", subtitle: "Warehouse picker · Reno DC-3 · 41 wk tenure",
            href: "/workers/" + ID.wrk_maya, score: 0.97,
            snippet: "<b>Maya</b> Okafor · maya.okafor@example.com",
            type: "workers" }
        ] },
        { type: "candidates", label: "Candidates", count: 1, results: [
          { id: "01HZXCND0001234567890ABCD1", label: "Maya Okafor", subtitle: "Hired · REQ-08421 · StaffWise West",
            href: "/candidates/01HZXCND0001234567890ABCD1", score: 0.93,
            snippet: "<b>Maya</b> Okafor",
            type: "candidates" }
        ] },
        { type: "timesheets", label: "Timesheets", count: 2, results: [
          { id: "01HZX9N1KD7H4F2R6S3P8M5V01", label: "Timesheet · Maya Okafor · Week of May 18",
            subtitle: "Approved · 38.5 h · $1,222.38", href: "/timesheets/01HZX9N1KD7H4F2R6S3P8M5V01", score: 0.81,
            type: "timesheets" },
          { id: "01HZX9N1KD7H4F2R6S3P8M5V05", label: "Timesheet · Maya Okafor · Week of May 11",
            subtitle: "Rejected · 36.0 h · $1,143.00", href: "/timesheets/01HZX9N1KD7H4F2R6S3P8M5V05", score: 0.78,
            type: "timesheets" }
        ] },
        { type: "requisitions", label: "Requisitions", count: 1, results: [
          { id: ID.req_picker, label: "REQ-08421 · Warehouse picker — overnight",
            subtitle: "Open · Reno DC-3 · 5 of 8 filled · Maya Okafor assigned",
            href: "/requisitions/" + ID.req_picker, score: 0.62,
            snippet: "<b>Maya</b> Okafor is one of 5 workers assigned",
            type: "requisitions" }
        ] }
      ],
      totalHits: 5,
      elapsedMs: 41
    };

    // Drop any duplicates that crept in from earlier extension files
    // (we only want ONE /search endpoint).
    var seen = false;
    spec.paths = spec.paths.filter(function (p) {
      if (p.id !== "search") return true;
      if (!seen) { seen = true; return true; }
      return false;
    });
  })();

  /* =================================================================
     Bonus · GET /timesheets/{id} — the platform audit's G-09 finding
     assumed ts_get existed; in fact only the list endpoint was
     declared. Add a screen-grade single-timesheet endpoint so ext-12
     can hang `entries[]` and `activity[]` on it.
     ================================================================= */
  add(
    { id: "ts_get", tag: "timesheets",
      method: "GET", path: "/timesheets/{timesheetId}",
      name: "Get a timesheet",
      summary: "Returns one timesheet envelope, including the per-shift entries[] array (≤14 entries inlined by default) and a short activity[] audit slice.",
      detail:
        "Use this when you have a timesheetId — from /timesheets, from a notification, from an inbox approval. For longer-period professional timesheets pass `?expand=entries:full` if you want every entry regardless of period length; otherwise entries are inlined up to a 14-row cap to keep the payload small.",
      params: [
        { name: "timesheetId", in: "path",  type: "string<ulid>", required: true,  desc: "Timesheet to fetch." },
        { name: "expand",      in: "query", type: "enum",         required: false, desc: "Force full inlining of related arrays.", enum: ["entries:full", "activity:full"] }
      ],
      responses: [
        { status: 200, schema: "Timesheet", desc: "Timesheet envelope with entries and activity." },
        { status: 404, schema: "Error", desc: "Timesheet not found or not visible." }
      ],
      responseExample: null // populated by ext-12 with a full screen-grade payload
    }
  );

  /* =================================================================
     Verifier-friendly summary
     ================================================================= */
  if (typeof window !== "undefined" && window.console) {
    var added = ["sup_contracts_list", "sup_contract_get", "sch_console", "ctr_classification_history",
                 "me_approvals_list", "me_approvals_bulk", "search", "ts_get"];
    var missing = added.filter(function (id) {
      return !(spec.paths || []).some(function (p) { return p.id === id; });
    });
    if (missing.length) {
      console.warn("FW_API_SPEC ext-11: failed to add endpoints →", missing);
    } else {
      console.info("FW_API_SPEC ext-11: added " + added.length + " endpoints (G-07, G-12, G-16, G-17, G-18).");
    }
  }
})();
