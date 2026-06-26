/* =====================================================================
   Flex Work API · spec extension (part 13 — coverage audit breaks)
   ---------------------------------------------------------------------
   Closes the eight P0 ("break") findings from Flex Work API Coverage
   Audit.html — screens that simply could not render from the API as
   it stood: pay stubs, time-off balances, compliance check history,
   non-approval bulk actions, help-center sections, shift clock-in
   evidence, worker onboarding progress.

   Loads AFTER ext-12 (field-shape gaps). Adds new endpoints, new
   tags, and new schema fields in place.

   Findings → fix:
     C-10  /me/paystubs + /workers/{id}/paystubs + /me/paystubs/ytd
     C-11  /me/time-off/balance + /workers/{id}/time-off/balance
     C-12  /compliance-checks (org-wide) + /workers/{id}/compliance-checks
     C-21  POST /requisitions:bulk, /workers:bulk, /suppliers:bulk
     C-22  GET /help/sections (section taxonomy tree)
     C-23  Shift clock-in evidence fields (extend Shift schema +
           sch_list_shifts examples)
     C-25  Worker.onboardingProgress + offboardingProgress

   New tags introduced:
     paystubs     — Pay stubs (Money group)
     time-off-balance — was already covered by `time-off` tag; we
                        retag the new endpoint under the same tag.
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
  function ensureField(schemaName, field) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !Array.isArray(s.fields)) return;
    if (s.fields.some(function (f) { return f.name === field.name; })) return;
    s.fields.push(field);
  }
  function findEp(id) { return (spec.paths || []).find(function (p) { return p.id === id; }); }

  /* ------ Stable ULIDs (continue the ext-10 dictionary) ------------- */
  var ID = {
    sup_staffwise:   "01HZX0J7X1K8N4F5R3S2D2YQAH",
    sup_globalpath:  "01HZX0J7X1K8N4F5R3S2D2YQAJ",
    sup_orion:       "01HZX0J7X1K8N4F5R3S2D2YQAK",
    loc_reno:        "01HZX0J5W1S9D8H7N3E6Q4R2YX",
    loc_phoenix:     "01HZX0J5W1S9D8H7N3E6Q4R2YY",
    loc_chicago:     "01HZX0J5W1S9D8H7N3E6Q4R2YZ",
    loc_dublin:      "01HZX0J5W1S9D8H7N3E6Q4R2Y0",
    user_alex:       "01HZX0J0XM7R1F2N6K3L7S5VWE",
    user_priya:      "01HZX0J0XM7R1F2N6K3L7S5VWF",
    user_jordan:     "01HZX0J0XM7R1F2N6K3L7S5VWG",
    wrk_maya:        "01HZX0J8B7P3R2K6F9D5N8M4WT",
    wrk_lukas:       "01HZX0J8B7P3R2K6F9D5N8M4WV",
    wrk_sami:        "01HZX0J8B7P3R2K6F9D5N8M4WW",
    wrk_priya:       "01HZX0J8B7P3R2K6F9D5N8M4WX",
    wrk_newhire:     "01HZX0J8B7P3R2K6F9D5N8M4Y0",
    req_picker:      "01HZX7K2QM4FN0R8VBSE6PA7CY",
    req_devops:      "01HZX7K2QM4FN0R8VBSE6PA7D0",
    job_picker:      "01HZX0J9V6KM6H7TB1W3D7F2QH"
  };

  /* =================================================================
     C-10 · Pay stubs (worker mobile's #1 surface)
     ================================================================= */
  ensureTag({
    id: "paystubs",
    name: "Pay stubs",
    description:
      "Pay stubs — per-pay-period gross/net, earnings breakdown, deductions, and YTD totals. The worker mobile app's pay-stubs panel reads these; managers read the per-worker variant during compensation reviews. Pair with /tax-forms for year-end documents and /banking for direct-deposit accounts."
  });
  ensureTagInGroup("money", "paystubs");

  add(
    { id: "me_paystubs_list", tag: "paystubs",
      method: "GET", path: "/me/paystubs",
      name: "List my pay stubs",
      summary: "Returns the calling worker's pay stubs, newest first. Each entry carries the period dates, gross / net totals, and an exportedAt timestamp; the per-period breakdown of earnings and deductions is on /me/paystubs/{id}.",
      detail:
        "The default window is the current calendar year; pass `?since=YYYY-MM-DD` to walk back further. Worker scope only — the calling user must be a worker. Managers who need a worker's stubs go through `/workers/{id}/paystubs`. PDF copies are available via the `documentUrl` field on each entry once they have been finalized (most orgs finalize on the pay date).",
      params: [
        { name: "since",   in: "query", type: "string<date>", required: false, desc: "Earliest periodStart to include. Defaults to Jan 1 of the current calendar year." },
        { name: "taxYear", in: "query", type: "integer",      required: false, desc: "Filter to a specific tax year (e.g. 2025)." },
        { name: "cursor",  in: "query", type: "string",       required: false, desc: "Pagination cursor." },
        { name: "limit",   in: "query", type: "integer",      required: false, desc: "Page size, 1\u2013100. Defaults to 26 (one calendar year of biweekly stubs)." }
      ],
      responses: [
        { status: 200, schema: "Page<PayStubSummary>", desc: "Pay-stub summaries, newest first." }
      ],
      responseExample: {
        data: [
          { id: "01HZXPSTUB001MAY002026WK20", periodStart: "2026-05-18", periodEnd: "2026-05-24",
            workerId: ID.wrk_maya, taxYear: 2026,
            gross: { amount: 866.25, currency: "USD" },
            net:   { amount: 712.41, currency: "USD" },
            status: "finalized", payDate: "2026-05-29",
            exportedAt: "2026-05-26T07:00:00Z",
            documentUrl: "https://files.dayforce.com/paystubs/01HZXPSTUB001MAY002026WK20.pdf?sig=\u2026",
            shifts: 5, hours: 38.5 },
          { id: "01HZXPSTUB001MAY002026WK18", periodStart: "2026-05-04", periodEnd: "2026-05-10",
            workerId: ID.wrk_maya, taxYear: 2026,
            gross: { amount: 832.50, currency: "USD" },
            net:   { amount: 684.18, currency: "USD" },
            status: "finalized", payDate: "2026-05-15",
            exportedAt: "2026-05-12T07:00:00Z",
            documentUrl: "https://files.dayforce.com/paystubs/01HZXPSTUB001MAY002026WK18.pdf?sig=\u2026",
            shifts: 5, hours: 37.0 },
          { id: "01HZXPSTUB001APR002026WK17", periodStart: "2026-04-20", periodEnd: "2026-04-26",
            workerId: ID.wrk_maya, taxYear: 2026,
            gross: { amount: 900.00, currency: "USD" },
            net:   { amount: 740.40, currency: "USD" },
            status: "finalized", payDate: "2026-05-01",
            exportedAt: "2026-04-28T07:00:00Z",
            documentUrl: "https://files.dayforce.com/paystubs/01HZXPSTUB001APR002026WK17.pdf?sig=\u2026",
            shifts: 5, hours: 40.0 }
        ],
        nextCursor: "eyJpZCI6IjAxSFpYUFNUVUIw\u2026",
        totalCount: 21
      } },

    { id: "me_paystub_get", tag: "paystubs",
      method: "GET", path: "/me/paystubs/{paystubId}",
      name: "Get a pay stub",
      summary: "Returns one pay stub with the full earnings + deductions breakdown. Powers the expanded per-period view in the worker app.",
      detail:
        "Earnings array carries one entry per shift or differential (`kind` discriminator: `regular`, `overtime`, `differential`, `holiday`, `bonus`, `reimbursement`). Deductions array carries tax withholdings and benefit contributions with a `kind` discriminator. Totals are precomputed; clients should display rather than recompute. The stub is immutable once `status === \"finalized\"`.",
      params: [
        { name: "paystubId", in: "path", type: "string<ulid>", required: true, desc: "Pay stub to fetch." }
      ],
      responses: [
        { status: 200, schema: "PayStub", desc: "Full pay-stub envelope." },
        { status: 404, schema: "Error", desc: "Pay stub not found or not visible." }
      ],
      responseExample: {
        id: "01HZXPSTUB001MAY002026WK20",
        workerId: ID.wrk_maya, workerName: "Maya Okafor",
        periodStart: "2026-05-18", periodEnd: "2026-05-24",
        payDate: "2026-05-29", taxYear: 2026,
        status: "finalized",
        gross: { amount: 866.25, currency: "USD" },
        net:   { amount: 712.41, currency: "USD" },
        totalHours: 38.5, totalShifts: 5,
        earnings: [
          { kind: "regular",      label: "Regular hours · Reno DC-3 picker", hours: 38.5, rate: 22.50, amount: { amount: 866.25, currency: "USD" }, shiftIds: ["01HZX9P2RM8K4F6D7N3S6PA2W01", "01HZX9P2RM8K4F6D7N3S6PA2W02", "01HZX9P2RM8K4F6D7N3S6PA2W03", "01HZX9P2RM8K4F6D7N3S6PA2W04", "01HZX9P2RM8K4F6D7N3S6PA2W05"] }
        ],
        deductions: [
          { kind: "federal_tax", label: "Federal income tax",       amount: { amount:  86.63, currency: "USD" } },
          { kind: "fica",        label: "FICA (SS + Medicare)",     amount: { amount:  66.27, currency: "USD" } },
          { kind: "state_tax",   label: "Nevada state withholding", amount: { amount:   0.94, currency: "USD" } }
        ],
        ytd: {
          gross: { amount: 12480.50, currency: "USD" },
          net:   { amount: 10256.32, currency: "USD" },
          taxes: { amount:  2098.18, currency: "USD" },
          benefits: { amount: 126.00, currency: "USD" }
        },
        documentUrl: "https://files.dayforce.com/paystubs/01HZXPSTUB001MAY002026WK20.pdf?sig=\u2026",
        exportedAt: "2026-05-26T07:00:00Z",
        bankingAccountLast4: "8421"
      } },

    { id: "me_paystub_ytd", tag: "paystubs",
      method: "GET", path: "/me/paystubs/ytd",
      name: "Get my year-to-date pay totals",
      summary: "Returns the calling worker's year-to-date gross/net/tax/benefit rollups. Powers the YTD strip at the top of the pay-stubs screen.",
      params: [
        { name: "taxYear", in: "query", type: "integer", required: false, desc: "Tax year to roll up. Defaults to the current calendar year." }
      ],
      responses: [
        { status: 200, schema: "PayStubYTD", desc: "YTD rollup." }
      ],
      responseExample: {
        workerId: ID.wrk_maya, taxYear: 2026,
        periods: 21,
        gross: { amount: 12480.50, currency: "USD" },
        net:   { amount: 10256.32, currency: "USD" },
        taxes: { amount:  2098.18, currency: "USD" },
        benefits: { amount: 126.00, currency: "USD" },
        breakdown: {
          regularHours:  812.50,
          overtimeHours:  12.00,
          differentialHours: 24.00
        },
        asOf: "2026-05-26T07:00:00Z"
      } },

    { id: "wrk_paystubs", tag: "paystubs",
      method: "GET", path: "/workers/{workerId}/paystubs",
      name: "List a worker's pay stubs",
      summary: "Manager-side. Returns one worker's pay stubs. Same shape as /me/paystubs but scoped to one worker; requires the workers.pay.read scope.",
      params: [
        { name: "workerId", in: "path", type: "string<ulid>", required: true, desc: "Worker to fetch pay stubs for." },
        { name: "since",    in: "query", type: "string<date>", required: false, desc: "Earliest periodStart." },
        { name: "taxYear",  in: "query", type: "integer",      required: false, desc: "Filter to a specific tax year." }
      ],
      responses: [
        { status: 200, schema: "Page<PayStubSummary>", desc: "Pay-stub summaries." },
        { status: 403, schema: "Error", desc: "Missing workers.pay.read scope." }
      ],
      responseExample: null // mirrors me_paystubs_list shape
    }
  );

  /* =================================================================
     C-11 · Time-off balance + accruals
     ================================================================= */
  add(
    { id: "me_time_off_balance", tag: "time-off",
      method: "GET", path: "/me/time-off/balance",
      name: "Get my time-off balance",
      summary: "Returns the calling worker's per-category time-off balance — accrued, used, and remaining hours, plus the accrual rate and next accrual date.",
      detail:
        "One entry per category configured on the worker's policy. Common categories: vacation, sick, personal, bereavement, jury_duty. The numbers refresh nightly; the `asOf` timestamp tells the consumer how fresh the rollup is. Workers see only their own; managers reach a worker's balance via /workers/{id}/time-off/balance.",
      params: [
        { name: "asOf", in: "query", type: "string<date>", required: false, desc: "Compute the balance as of this date. Defaults to today." }
      ],
      responses: [
        { status: 200, schema: "TimeOffBalance", desc: "Per-category balance." }
      ],
      responseExample: {
        workerId: ID.wrk_maya,
        asOf: "2026-05-26",
        policyId: "01HZXTOFFPOL00000FULLTIME01",
        categories: [
          { kind: "vacation",   label: "Vacation",       accruedHours: 80, usedHours: 24, remainingHours: 56, accrualRatePerPeriod: 3.08, accrualPeriod: "biweekly", nextAccrualOn: "2026-06-05", maxCarryoverHours: 40 },
          { kind: "sick",       label: "Sick time",      accruedHours: 40, usedHours:  8, remainingHours: 32, accrualRatePerPeriod: 1.54, accrualPeriod: "biweekly", nextAccrualOn: "2026-06-05", maxCarryoverHours: 40 },
          { kind: "personal",   label: "Personal days",  accruedHours: 16, usedHours:  0, remainingHours: 16, accrualRatePerPeriod: 0,    accrualPeriod: "annual",   nextAccrualOn: "2027-01-01", maxCarryoverHours:  0 },
          { kind: "bereavement",label: "Bereavement",    accruedHours: 24, usedHours:  0, remainingHours: 24, accrualRatePerPeriod: 0,    accrualPeriod: "as_needed",nextAccrualOn: null,         maxCarryoverHours:  0 }
        ]
      } },

    { id: "wrk_time_off_balance", tag: "time-off",
      method: "GET", path: "/workers/{workerId}/time-off/balance",
      name: "Get a worker's time-off balance",
      summary: "Manager-side. Returns one worker's per-category time-off balance. Same shape as /me/time-off/balance.",
      params: [
        { name: "workerId", in: "path",  type: "string<ulid>", required: true, desc: "Worker to fetch balance for." },
        { name: "asOf",     in: "query", type: "string<date>", required: false, desc: "Compute the balance as of this date." }
      ],
      responses: [
        { status: 200, schema: "TimeOffBalance", desc: "Per-category balance." }
      ],
      responseExample: null
    }
  );

  /* =================================================================
     C-12 · Compliance check history (list endpoints)
     ================================================================= */
  add(
    { id: "compliance_list", tag: "credentials",
      method: "GET", path: "/compliance-checks",
      name: "List compliance check results",
      summary: "Org-wide list of compliance check results, newest first. Powers the Compliance dashboard's cross-worker table.",
      detail:
        "Each row carries one evaluation of one check against one worker. Multi-step checks (background, drug, I-9) write multiple rows over their lifetime; the latest `status` is what most lists render. For per-worker history use /workers/{id}/compliance-checks.",
      params: [
        { name: "checkType", in: "query", type: "enum",         required: false, desc: "Filter to one check kind.", enum: ["background", "drug_screen", "i9", "osha10", "tb_test", "covid_vaccination", "drivers_license"] },
        { name: "status",    in: "query", type: "enum",         required: false, desc: "Filter by outcome.", enum: ["pending", "passed", "failed", "needs_review", "expired"] },
        { name: "workerId",  in: "query", type: "string<ulid>", required: false, desc: "Restrict to one worker." },
        { name: "since",     in: "query", type: "string<date>", required: false, desc: "Earliest runAt to include." },
        { name: "cursor",    in: "query", type: "string",       required: false, desc: "Pagination cursor." },
        { name: "limit",     in: "query", type: "integer",      required: false, desc: "Page size, 1\u2013200. Defaults to 50." }
      ],
      responses: [
        { status: 200, schema: "Page<ComplianceCheck>", desc: "Compliance check results." }
      ],
      responseExample: {
        data: [
          { id: "01HZXCMPC001MAYA00000I9CHK", workerId: ID.wrk_maya, workerName: "Maya Okafor",
            checkType: "i9", checkTypeLabel: "I-9 employment eligibility",
            status: "passed", runAt: "2025-08-04T10:32:00Z", completedAt: "2025-08-04T10:32:14Z",
            expiresAt: null,
            policyId: "01HZXPOL0001234567890ABCD1",
            evidenceFileId: "01HZXFILE001I9MAYA0000000",
            resolution: "Verified by Jordan Hsu", resolvedBy: ID.user_jordan },
          { id: "01HZXCMPC002LUKAS0BACKGROUND", workerId: ID.wrk_lukas, workerName: "Lukas Kowalski",
            checkType: "background", checkTypeLabel: "Background check (7-year)",
            status: "passed", runAt: "2025-12-12T09:00:00Z", completedAt: "2025-12-15T14:18:00Z",
            expiresAt: "2027-12-15",
            policyId: "01HZXPOL0001234567890ABCD1",
            evidenceFileId: "01HZXFILE002BACKGROUND0LUKAS",
            resolution: "Clean record", resolvedBy: "system" },
          { id: "01HZXCMPC003PRIYA00DRUGSCREEN", workerId: ID.wrk_priya, workerName: "Priya Menon",
            checkType: "drug_screen", checkTypeLabel: "5-panel drug screen",
            status: "needs_review", runAt: "2026-05-21T08:00:00Z", completedAt: null,
            expiresAt: null,
            policyId: "01HZXPOL0001234567890ABCD2",
            evidenceFileId: null,
            resolution: "Lab requested re-collection due to dilute sample", resolvedBy: null },
          { id: "01HZXCMPC004SAMI000CLASSCHECK", workerId: ID.wrk_sami, workerName: "Sami Soto",
            checkType: "drivers_license", checkTypeLabel: "Driver's license verification",
            status: "expired", runAt: "2024-04-12T09:00:00Z", completedAt: "2024-04-12T09:14:00Z",
            expiresAt: "2026-04-12",
            policyId: "01HZXPOL0001234567890ABCD3",
            evidenceFileId: "01HZXFILE004DRIVERLIC0SAMI0",
            resolution: "Expired; awaiting renewal", resolvedBy: null }
        ],
        nextCursor: "eyJpZCI6IjAxSFpYQ01QQzAw\u2026",
        totalCount: 484,
        counts: {
          all: 484, pending: 18, passed: 412, failed: 8, needs_review: 22, expired: 24
        }
      } },

    { id: "wrk_compliance_list", tag: "credentials",
      method: "GET", path: "/workers/{workerId}/compliance-checks",
      name: "List one worker's compliance checks",
      summary: "Returns every compliance check ever run against one worker, chronological. Powers the credentials/compliance panel on the worker detail page.",
      params: [
        { name: "workerId",  in: "path",  type: "string<ulid>", required: true, desc: "Worker to fetch checks for." },
        { name: "checkType", in: "query", type: "enum",         required: false, desc: "Filter to one check kind.", enum: ["background", "drug_screen", "i9", "osha10", "tb_test", "covid_vaccination", "drivers_license"] }
      ],
      responses: [
        { status: 200, schema: "Page<ComplianceCheck>", desc: "Compliance checks for one worker." }
      ],
      responseExample: null
    }
  );

  /* =================================================================
     C-21 · Bulk action endpoints (non-approvals)
     ================================================================= */
  add(
    { id: "req_bulk", tag: "requisitions",
      method: "POST", path: "/requisitions:bulk",
      name: "Bulk requisition action",
      summary: "Apply one action across multiple requisitions in a single call. Returns a per-item resolution report so partial successes are visible.",
      detail:
        "Used by the requisitions list bulk-action bar (Distribute, Pause, Send message, Export). Each item is processed atomically; one failure does not block the others. Long-running actions (`export`, `distribute` to large supplier sets) return 202 with an operation handle in the per-item result.",
      body: {
        schema: [
          { name: "action", type: "enum",            required: true,  desc: "Action to apply.",
            enum: ["distribute", "pause", "resume", "cancel", "message", "export"] },
          { name: "ids",    type: "string<ulid>[]", required: true,  desc: "Requisition ids." },
          { name: "params", type: "object",         required: false, desc: "Action-specific parameters (distribute: strategy / supplierIds; message: subject / body; export: format)." }
        ],
        example: {
          action: "distribute",
          ids: [ID.req_picker, ID.req_devops],
          params: { strategy: "tiered", supplierIds: [ID.sup_staffwise, ID.sup_orion] }
        }
      },
      responses: [
        { status: 200, schema: "BulkActionResult", desc: "All items resolved synchronously." },
        { status: 202, schema: "BulkActionResult", desc: "Long-running items returned operation handles." },
        { status: 207, schema: "BulkActionResult", desc: "Multi-status — at least one item failed." }
      ],
      responseExample: {
        results: [
          { id: ID.req_picker, status: 200, action: "distribute", suppliersTouched: 2 },
          { id: ID.req_devops, status: 202, action: "distribute", operationId: "01HZXOPN0002REQDIST" }
        ],
        summary: { requested: 2, succeeded: 1, queued: 1, failed: 0 }
      } },

    { id: "wrk_bulk", tag: "workers",
      method: "POST", path: "/workers:bulk",
      name: "Bulk worker action",
      summary: "Apply one action across multiple workers in a single call. Used by the workforce list bulk-action bar — Message, Add to pool, Request credentials, Assign training, Block from sites.",
      body: {
        schema: [
          { name: "action", type: "enum",            required: true,  desc: "Action to apply.",
            enum: ["message", "add_to_pool", "remove_from_pool", "request_credentials", "assign_training", "block_from_site", "move_to_supplier"] },
          { name: "ids",    type: "string<ulid>[]", required: true,  desc: "Worker ids." },
          { name: "params", type: "object",         required: false, desc: "Action-specific parameters (add_to_pool: poolId; message: subject / body; assign_training: trainingId)." }
        ],
        example: {
          action: "add_to_pool",
          ids: [ID.wrk_maya, ID.wrk_priya],
          params: { poolId: "01HZXPOOL01RENO00FLOATPICKER" }
        }
      },
      responses: [
        { status: 200, schema: "BulkActionResult", desc: "Per-worker resolution." },
        { status: 207, schema: "BulkActionResult", desc: "Multi-status." }
      ],
      responseExample: {
        results: [
          { id: ID.wrk_maya,  status: 200, action: "add_to_pool", poolId: "01HZXPOOL01RENO00FLOATPICKER" },
          { id: ID.wrk_priya, status: 200, action: "add_to_pool", poolId: "01HZXPOOL01RENO00FLOATPICKER" }
        ],
        summary: { requested: 2, succeeded: 2, failed: 0 }
      } },

    { id: "sup_bulk", tag: "suppliers",
      method: "POST", path: "/suppliers:bulk",
      name: "Bulk supplier action",
      summary: "Apply one action across multiple suppliers in a single call. Used by the suppliers list bulk-action bar — Broadcast, Pause, Resume, Tier change.",
      body: {
        schema: [
          { name: "action", type: "enum",            required: true, desc: "Action to apply.",
            enum: ["broadcast", "pause", "resume", "change_tier", "export"] },
          { name: "ids",    type: "string<ulid>[]", required: true, desc: "Supplier ids." },
          { name: "params", type: "object",         required: false, desc: "Action-specific (broadcast: subject / body / requireRsvp; change_tier: tier)." }
        ],
        example: {
          action: "broadcast",
          ids: [ID.sup_staffwise, ID.sup_orion],
          params: { subject: "Q3 surge plan", body: "Need additional capacity in Reno and Phoenix from July\u2026", requireRsvp: true }
        }
      },
      responses: [
        { status: 200, schema: "BulkActionResult", desc: "Per-supplier resolution." },
        { status: 207, schema: "BulkActionResult", desc: "Multi-status." }
      ],
      responseExample: {
        results: [
          { id: ID.sup_staffwise, status: 200, action: "broadcast", broadcastId: "01HZXBRD001STAFFWISE0000" },
          { id: ID.sup_orion,     status: 200, action: "broadcast", broadcastId: "01HZXBRD002ORION0000000" }
        ],
        summary: { requested: 2, succeeded: 2, failed: 0 }
      } }
  );

  /* =================================================================
     C-22 · Help-center sections (taxonomy tree)
     ================================================================= */
  add(
    { id: "help_sections_list", tag: "help",
      method: "GET", path: "/help/sections",
      name: "List help-center sections",
      summary: "Returns the section taxonomy tree that powers the help center's left rail. Each section carries its slug, label, count of articles, and any nested sub-sections.",
      detail:
        "The taxonomy is platform-managed but org-extensible — orgs can add a custom \"My company\" section beneath the root. Articles continue to carry a `category` string for backwards compat; new code should branch off the tree. The response is cached aggressively at the edge (TTL 1 hour).",
      responses: [
        { status: 200, schema: "HelpSectionTree", desc: "Section taxonomy tree." }
      ],
      responseExample: {
        sections: [
          { slug: "onboarding", label: "Onboarding", articleCount: 14,
            children: [
              { slug: "onboarding-getting-started", label: "Getting started", articleCount: 6 },
              { slug: "onboarding-first-shift",    label: "Your first shift",  articleCount: 4 },
              { slug: "onboarding-credentials",    label: "Credentials & docs", articleCount: 4 }
            ] },
          { slug: "playbooks", label: "Playbooks", articleCount: 22,
            children: [
              { slug: "playbooks-supplier",     label: "Supplier ops",     articleCount: 8 },
              { slug: "playbooks-scheduling",   label: "Scheduling",       articleCount: 6 },
              { slug: "playbooks-pay-cycle",    label: "Pay cycle",        articleCount: 5 },
              { slug: "playbooks-troubleshoot", label: "Troubleshooting",  articleCount: 3 }
            ] },
          { slug: "battlecards", label: "Battlecards", articleCount: 18,
            children: [
              { slug: "battlecards-talent",   label: "Talent vendors",     articleCount: 6 },
              { slug: "battlecards-eor",      label: "EOR partners",       articleCount: 5 },
              { slug: "battlecards-msp",      label: "MSP",                articleCount: 7 }
            ] },
          { slug: "glossary", label: "Glossary", articleCount: 38, children: [] },
          { slug: "release-notes", label: "Release notes", articleCount: 12, children: [] }
        ],
        totalArticles: 104,
        updatedAt: "2026-05-26T05:00:00Z"
      } }
  );

  /* =================================================================
     C-23 · Shift clock-in evidence fields
     ================================================================= */
  (function () {
    ensureField("Shift", { name: "clockInLat", type: "number", required: false,
      desc: "Latitude captured at clock-in (decimal degrees, WGS-84)." });
    ensureField("Shift", { name: "clockInLng", type: "number", required: false,
      desc: "Longitude captured at clock-in (decimal degrees, WGS-84)." });
    ensureField("Shift", { name: "clockInAccuracyMeters", type: "number", required: false,
      desc: "GPS horizontal accuracy at clock-in, in meters. Some jurisdictions require this for the clock to count." });
    ensureField("Shift", { name: "clockInPhotoFileId", type: "string<ulid>", required: false,
      desc: "Optional photo captured at clock-in (proof of presence)." });
    ensureField("Shift", { name: "clockInSignatureFileId", type: "string<ulid>", required: false,
      desc: "Optional signature captured at clock-in (safety attestation, supervisor sign-off)." });
    ensureField("Shift", { name: "clockOutLat", type: "number", required: false, desc: "Latitude captured at clock-out." });
    ensureField("Shift", { name: "clockOutLng", type: "number", required: false, desc: "Longitude captured at clock-out." });
    ensureField("Shift", { name: "clockOutAccuracyMeters", type: "number", required: false, desc: "GPS horizontal accuracy at clock-out, in meters." });

    // Sprinkle realistic evidence onto two existing shift rows so the
    // new fields show up in Try-it without a separate example block.
    var e = findEp("sch_list_shifts");
    if (e && e.responseExample && Array.isArray(e.responseExample.data)) {
      var EVIDENCE = {
        "01HZX9P2RM8K4F6D7N3S6PA2W05": {
          clockInLat: 39.5286, clockInLng: -119.8131, clockInAccuracyMeters: 6.4,
          clockInPhotoFileId: "01HZXFILE002CLOCKIN0MAY5W05",
          clockOutLat: 39.5288, clockOutLng: -119.8133, clockOutAccuracyMeters: 8.0
        },
        "01HZX9P2RM8K4F6D7N3S6PA2W06": {
          clockInLat: 39.5302, clockInLng: -119.7920, clockInAccuracyMeters: 142.0,
          clockInPhotoFileId: null,
          clockOutLat: null, clockOutLng: null, clockOutAccuracyMeters: null
        }
      };
      e.responseExample.data.forEach(function (row) {
        if (EVIDENCE[row.id]) Object.assign(row, EVIDENCE[row.id]);
      });
    }
  })();

  /* =================================================================
     C-25 · Worker.onboardingProgress + offboardingProgress
     ================================================================= */
  (function () {
    ensureField("Worker", { name: "onboardingProgress", type: "OnboardingProgress", required: false,
      desc: "When status === \"onboarding\", the per-step progress for the active onboarding workflow. Null otherwise." });
    ensureField("Worker", { name: "offboardingProgress", type: "OffboardingProgress", required: false,
      desc: "When status === \"offboarding\", the per-step progress for the active offboarding workflow. Null otherwise." });

    // The wrk_get example becomes the canonical place to see the
    // progress shape — populate it for the existing Maya envelope
    // (active) AND add an onboarding example row to wrk_list.
    var get = findEp("wrk_get");
    if (get && get.responseExample) {
      get.responseExample.onboardingProgress = null; // Maya is active
      get.responseExample.offboardingProgress = null;
    }
    var list = findEp("wrk_list");
    if (list && list.responseExample && Array.isArray(list.responseExample.data)) {
      list.responseExample.data.push({
        id: ID.wrk_newhire, displayName: "Avery Lin",
        legalFirstName: "Avery", legalLastName: "Lin",
        email: "avery.lin@example.com", phone: "+1-775-555-0188",
        engagementType: "shift", supplierType: "agency",
        supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        currentRequisitionId: ID.req_picker, currentJobTitle: "Warehouse picker",
        locationId: ID.loc_reno, locationName: "Reno DC-3",
        tenureWeeks: 0, rating: null, credentialIssues: 1,
        status: "onboarding", startedAt: null, lastShiftAt: null,
        jobs: [{ id: ID.job_picker, title: "Warehouse picker" }],
        poolId: null, poolName: null,
        cadence: "weekly", rateAmount: 22.50, rateCurrency: "USD",
        flaggedShifts: 0,
        onboardingProgress: {
          totalSteps: 5, completedSteps: 2,
          currentStep: "tax_forms",
          steps: [
            { id: "profile",        label: "Profile",            state: "completed",  completedAt: "2026-05-22T09:30:00Z" },
            { id: "i9",             label: "I-9 verification",   state: "completed",  completedAt: "2026-05-23T14:18:00Z", evidenceFileId: "01HZXFILE003I9AVERY00000000" },
            { id: "tax_forms",      label: "Tax forms",          state: "in_progress", startedAt:   "2026-05-26T08:00:00Z" },
            { id: "direct_deposit", label: "Direct deposit",     state: "pending" },
            { id: "site_orientation",label: "Site orientation",  state: "pending" }
          ]
        },
        offboardingProgress: null
      });
      list.responseExample.totalCount = (list.responseExample.totalCount || 0) + 1;
    }
  })();

  /* =================================================================
     Verifier-friendly summary
     ================================================================= */
  if (typeof window !== "undefined" && window.console) {
    var added = ["me_paystubs_list", "me_paystub_get", "me_paystub_ytd", "wrk_paystubs",
                 "me_time_off_balance", "wrk_time_off_balance",
                 "compliance_list", "wrk_compliance_list",
                 "req_bulk", "wrk_bulk", "sup_bulk",
                 "help_sections_list"];
    var missing = added.filter(function (id) {
      return !(spec.paths || []).some(function (p) { return p.id === id; });
    });
    if (missing.length) {
      console.warn("FW_API_SPEC ext-13: failed to add endpoints \u2192", missing);
    } else {
      console.info("FW_API_SPEC ext-13: added " + added.length + " endpoints + extended Shift / Worker schemas.");
    }
  }
})();
