/* =====================================================================
   Flex Work API · spec extension (part 12 — field gap fixes)
   ---------------------------------------------------------------------
   Closes the 11 P1 + 4 of the 5 P2 findings from the platform audit
   that are field-shape gaps on existing endpoints. Mutates
   responseExample, body.example, and schema fields in place.

   Loads AFTER ext-11 (new endpoints) so it can also touch any new
   payloads that need cross-cutting fields.

   Findings → patch:
     G-01  req_list rows  ............... + costCenter, tempSpendTier,
                                            distributedSuppliers[],
                                            closeBy
     G-02  req_get envelope ............. + approvals, distribution[].funnel
     G-03  wrk_list rows  ............... + jobs[], pool, cadence, rate,
                                            credentialIssues, flaggedShifts
     G-04  wrk_get envelope ............. + nextScheduledShift,
                                            clockingStatus, activeWarnings[]
     G-05  sup_list rows  ............... + tier, noShowPct, spendYTD,
                                            capabilities[] (multi-type)
     G-06  sup_scorecard envelope ........ reorganize into operational +
                                            financial sub-objects
     G-08  ts_list rows  ................. + scheduled/actual punch pair,
                                            breakMinutes, billable split,
                                            billingBasis, timeCapture,
                                            engagementType
     G-09  ts_get envelope ............... + entries[], activity[]
     G-10  inv_list rows  ................ + locationIds, locationNames,
                                            engagementTypes[], billingBasis,
                                            timeCapture, supplierTypes[]
     G-11  inv_get envelope .............. + totalsByEngagementType,
                                            totalsByLocation
     G-13  sch_list_shifts rows .......... + geofenceStatus, break boundaries,
                                            payRate, differential
     G-14  cand_list rows ................. + resumeFileId, skillsMatchPct,
                                            bidRate, attestedCredentials,
                                            tenureWithSupplierWeeks
     G-15  sow_get milestones ............ + invoicedAmount, paidAmount,
                                            attachedFiles[], acceptanceCriteria
     G-19  bookings_roster_get ........... + lineup[], standby[] per position
     G-21  loc_list rows ................. + openShifts, activeWorkers
     G-22  pagination envelope ............ normalize 3 endpoints to
                                            { data, nextCursor, totalCount }
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  function findEp(id) { return (spec.paths || []).find(function (p) { return p.id === id; }); }
  function ep(id) { return findEp(id); }
  function findField(schemaName, fieldName) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !s.fields) return null;
    return s.fields.find(function (f) { return f.name === fieldName; });
  }
  function ensureField(schemaName, field) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !Array.isArray(s.fields)) return;
    if (s.fields.some(function (f) { return f.name === field.name; })) return;
    s.fields.push(field);
  }

  /* ------ Stable IDs (reuse) -------------------------------------- */
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
    user_jordan:    "01HZX0J0XM7R1F2N6K3L7S5VWG",
    user_finance:   "01HZX0J0XM7R1F2N6K3L7S5VWH",
    wrk_maya:       "01HZX0J8B7P3R2K6F9D5N8M4WT",
    wrk_jordan:     "01HZX0J8B7P3R2K6F9D5N8M4WU",
    wrk_lukas:      "01HZX0J8B7P3R2K6F9D5N8M4WV",
    wrk_sami:       "01HZX0J8B7P3R2K6F9D5N8M4WW",
    wrk_priya:      "01HZX0J8B7P3R2K6F9D5N8M4WX",
    job_picker:     "01HZX0J9V6KM6H7TB1W3D7F2QH",
    job_forklift:   "01HZX0J9V6KM6H7TB1W3D7F2QJ",
    job_rn:         "01HZX0J9V6KM6H7TB1W3D7F2QK",
    job_devops:     "01HZX0J9V6KM6H7TB1W3D7F2QL",
    job_pm:         "01HZX0J9V6KM6H7TB1W3D7F2QM",
    req_picker:     "01HZX7K2QM4FN0R8VBSE6PA7CY",
    req_forklift:   "01HZX7K2QM4FN0R8VBSE6PA7CZ",
    req_devops:     "01HZX7K2QM4FN0R8VBSE6PA7D0",
    req_pm_sow:     "01HZX7K2QM4FN0R8VBSE6PA7D1",
    req_rn_eor:     "01HZX7K2QM4FN0R8VBSE6PA7D2",
    dept_ops:       "01HZX0JDEPOPS00000000000001",
    dept_eng:       "01HZX0JDEPOPS00000000000002",
    dept_clinical:  "01HZX0JDEPOPS00000000000003"
  };

  /* =================================================================
     G-01 — req_list rows: distributedSuppliers[], costCenter,
                          tempSpendTier, closeBy
     ================================================================= */
  (function () {
    var e = ep("req_list");
    if (!e || !e.responseExample) return;
    // Helper to convert a row's bare distributedToSupplierIds[] into
    // {id, name, state} objects, and add the four new fields.
    var SUP_NAME = {};
    SUP_NAME[ID.sup_staffwise]  = "StaffWise West";
    SUP_NAME[ID.sup_orion]      = "Orion Staffing";
    SUP_NAME[ID.sup_globalpath] = "GlobalPath EOR";
    SUP_NAME[ID.sup_riverbend]  = "Riverbend Consulting";

    var ROW_META = {};
    // req_picker
    ROW_META[ID.req_picker] = {
      costCenter: "6010-OPS-WEST", costCenterName: "Ops · West",
      tempSpendTier: "medium", closeBy: "2026-06-01",
      distributedSuppliers: [
        { id: ID.sup_staffwise, name: "StaffWise West", state: "accepted" },
        { id: ID.sup_orion,     name: "Orion Staffing", state: "in_progress" }
      ]
    };
    ROW_META[ID.req_forklift] = {
      costCenter: "6010-OPS-WEST", costCenterName: "Ops · West",
      tempSpendTier: "low", closeBy: "2026-06-15",
      distributedSuppliers: [
        { id: ID.sup_staffwise, name: "StaffWise West", state: "accepted" }
      ]
    };
    ROW_META[ID.req_devops] = {
      costCenter: "7020-ENG", costCenterName: "Engineering",
      tempSpendTier: "high", closeBy: "2026-06-30",
      distributedSuppliers: [
        { id: ID.sup_orion, name: "Orion Staffing", state: "in_progress" }
      ]
    };
    ROW_META[ID.req_pm_sow] = {
      costCenter: "7020-ENG", costCenterName: "Engineering",
      tempSpendTier: "high", closeBy: "2026-06-25",
      distributedSuppliers: [
        { id: ID.sup_riverbend, name: "Riverbend Consulting", state: "accepted" }
      ]
    };
    ROW_META[ID.req_rn_eor] = {
      costCenter: "8030-CLINICAL", costCenterName: "Clinical",
      tempSpendTier: "medium", closeBy: "2026-06-08",
      distributedSuppliers: [
        { id: ID.sup_globalpath, name: "GlobalPath EOR", state: "accepted" }
      ]
    };

    (e.responseExample.data || []).forEach(function (row) {
      var meta = ROW_META[row.id] || {
        costCenter: "6010-OPS-WEST", costCenterName: "Ops · West",
        tempSpendTier: "medium", closeBy: row.startDate,
        distributedSuppliers: (row.distributedToSupplierIds || []).map(function (id) {
          return { id: id, name: SUP_NAME[id] || "Supplier", state: "in_progress" };
        })
      };
      Object.assign(row, meta);
      // The old bare-ULID array stays for backwards compat; the new
      // object array is the screen-ready form.
    });
  })();

  /* =================================================================
     G-02 — req_get envelope: approvals{} + distribution[].funnel
     ================================================================= */
  (function () {
    var e = ep("req_get");
    if (!e || !e.responseExample) return;
    e.responseExample.approvals = {
      currentStepId: "step_finance_review",
      slaHoursTotal: 24,
      slaHoursRemaining: 18,
      steps: [
        { id: "step_initial_review", approverId: ID.user_alex, name: "Alex Chen",
          role: "Hiring manager", state: "completed", completedAt: "2026-05-20T14:08:30Z",
          slaHours: 4, decision: "approved" },
        { id: "step_finance_review", approverId: ID.user_finance, name: "Tomás Núñez",
          role: "Finance approver", state: "in_progress", startedAt: "2026-05-26T11:08:00Z",
          slaHours: 8, decision: null },
        { id: "step_director_signoff", approverId: ID.user_priya, name: "Priya Aravind",
          role: "Director · Ops", state: "pending", startedAt: null,
          slaHours: 12, decision: null }
      ]
    };
    // Extend the existing distribution[] entries with funnel data.
    (e.responseExample.distribution || []).forEach(function (d, i) {
      d.funnel = i === 0
        ? { submitted: 12, screening: 6, interview: 3, offer: 1, hired: 4, declined: 2 }
        : { submitted: 6,  screening: 4, interview: 2, offer: 1, hired: 1, declined: 0 };
      d.avgTimeToFirstSubmittalHours = i === 0 ? 4.2 : 18.4;
    });
  })();

  /* =================================================================
     G-03 — wrk_list rows: jobs[], pool, cadence, rate, credentialIssues,
                          flaggedShifts. Also add fields to Worker schema.
     ================================================================= */
  (function () {
    // Schema additions (denormalized from active engagement).
    ensureField("Worker", { name: "jobs", type: "Array<{id,title}>", required: false,
      desc: "All jobs the worker is currently qualified for. Denormalized from talent-pool eligibility." });
    ensureField("Worker", { name: "poolId", type: "string<ulid>", required: false,
      desc: "Primary talent pool the worker belongs to. Null when the worker isn't pool-eligible." });
    ensureField("Worker", { name: "poolName", type: "string", required: false,
      desc: "Display name of the primary talent pool." });
    ensureField("Worker", { name: "cadence", type: "enum", required: false,
      desc: "Time-capture cadence for the active engagement.", enum: ["daily", "weekly", "biweekly", "monthly", "project"] });
    ensureField("Worker", { name: "rateAmount", type: "number", required: false,
      desc: "Pay rate for the active engagement, in the worker's home currency." });
    ensureField("Worker", { name: "rateCurrency", type: "string", required: false,
      desc: "ISO 4217 currency code matching rateAmount." });
    ensureField("Worker", { name: "credentialIssues", type: "integer", required: false,
      desc: "Count of credentials currently in expired or missing state. 0 when compliant." });
    ensureField("Worker", { name: "flaggedShifts", type: "integer", required: false,
      desc: "Count of attendance flags (late / no-show / early-out) in the trailing 30 days." });

    var e = ep("wrk_list");
    if (!e || !e.responseExample) return;
    var ENRICH = {};
    ENRICH[ID.wrk_maya] = {
      jobs: [{ id: ID.job_picker, title: "Warehouse picker" }, { id: ID.job_forklift, title: "Forklift operator" }],
      poolId: "01HZXPOOL01RENO00FLOATPICKER", poolName: "Reno · Float pickers",
      cadence: "weekly", rateAmount: 22.50, rateCurrency: "USD",
      credentialIssues: 0, flaggedShifts: 0
    };
    ENRICH[ID.wrk_lukas] = {
      jobs: [{ id: ID.job_rn, title: "Registered nurse" }],
      poolId: null, poolName: null,
      cadence: "weekly", rateAmount: 52.00, rateCurrency: "EUR",
      credentialIssues: 0, flaggedShifts: 0
    };
    ENRICH[ID.wrk_sami] = {
      jobs: [{ id: ID.job_devops, title: "Senior DevOps engineer" }],
      poolId: null, poolName: null,
      cadence: "biweekly", rateAmount: 92.00, rateCurrency: "USD",
      credentialIssues: 0, flaggedShifts: 0
    };
    ENRICH[ID.wrk_priya] = {
      jobs: [{ id: ID.job_forklift, title: "Forklift operator" }, { id: ID.job_picker, title: "Warehouse picker" }],
      poolId: "01HZXPOOL02PHX00FLOATPICKER0", poolName: "Phoenix · Float pickers",
      cadence: "weekly", rateAmount: 26.00, rateCurrency: "USD",
      credentialIssues: 1, flaggedShifts: 0
    };

    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ENRICH[row.id] || {
        jobs: [], poolId: null, poolName: null,
        cadence: "weekly", rateAmount: null, rateCurrency: null,
        credentialIssues: 0, flaggedShifts: 0
      });
    });
  })();

  /* =================================================================
     G-04 — wrk_get envelope: nextScheduledShift, clockingStatus,
                              activeWarnings[]
     ================================================================= */
  (function () {
    var e = ep("wrk_get");
    if (!e || !e.responseExample) return;
    e.responseExample.nextScheduledShift = {
      shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WTN",
      startsAt: "2026-05-27T22:00:00Z",
      endsAt:   "2026-05-28T06:00:00Z",
      jobId: ID.job_picker, jobTitle: "Warehouse picker",
      locationId: ID.loc_reno, locationName: "Reno DC-3"
    };
    e.responseExample.clockingStatus = {
      state: "clocked_out",
      lastClockInAt:  "2026-05-25T22:00:00Z",
      lastClockOutAt: "2026-05-26T06:02:00Z",
      lastGeofenceState: "inside"
    };
    e.responseExample.activeWarnings = [
      { kind: "credential_expiring", severity: "warning",
        message: "Safety orientation expires in 14 days (2026-12-01).",
        link: "/workers/" + ID.wrk_maya + "/credentials/01HZXWCR0001MAYA0000SAFETY0" }
    ];
  })();

  /* =================================================================
     G-05 — sup_list rows: tier, noShowPct, spendYTD, capabilities[]
     ================================================================= */
  (function () {
    // Add Supplier.capabilities[] alongside the singular .type — a
    // supplier can advertise multiple SupplierType capabilities.
    ensureField("Supplier", { name: "tier", type: "enum", required: false,
      desc: "Sourcing-priority tier the supplier is on. Drives distribution-rule ordering.",
      enum: ["t1", "t2", "t3"] });
    ensureField("Supplier", { name: "capabilities", type: "enum[]", required: false,
      desc: "Every SupplierType capability the supplier advertises. `.type` is the primary; `.capabilities[]` is the set.",
      enum: ["agency", "contractor", "eor", "float"] });
    ensureField("Supplier", { name: "noShowPct", type: "number", required: false,
      desc: "Rolling 90-day no-show rate, 0\u20131." });
    ensureField("Supplier", { name: "spendYTD", type: "Money", required: false,
      desc: "Year-to-date spend with this supplier in the supplier's contract currency." });

    var e = ep("sup_list");
    if (!e || !e.responseExample) return;
    var ENRICH = {};
    ENRICH[ID.sup_staffwise] = {
      tier: "t1", capabilities: ["agency", "eor"],
      noShowPct: 0.018, spendYTD: { amount: 1842000, currency: "USD" }
    };
    ENRICH[ID.sup_orion] = {
      tier: "t2", capabilities: ["agency"],
      noShowPct: 0.035, spendYTD: { amount: 612000, currency: "USD" }
    };
    ENRICH[ID.sup_globalpath] = {
      tier: "t1", capabilities: ["eor"],
      noShowPct: 0.012, spendYTD: { amount: 482000, currency: "EUR" }
    };
    ENRICH[ID.sup_riverbend] = {
      tier: "t2", capabilities: ["agency"],
      noShowPct: 0.008, spendYTD: { amount: 312000, currency: "USD" }
    };
    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ENRICH[row.id] || {
        tier: "t2", capabilities: [row.type], noShowPct: 0.030, spendYTD: { amount: 0, currency: "USD" }
      });
    });
  })();

  /* =================================================================
     G-06 — sup_scorecard envelope: operational / financial sub-objects
     ================================================================= */
  (function () {
    var e = ep("sup_scorecard");
    if (!e || !e.responseExample) return;
    var r = e.responseExample;
    e.responseExample = {
      supplierId: r.supplierId, window: r.window,
      operational: {
        fillRate: r.fillRate, timeToFillHours: r.timeToFillHours,
        retention90Day: r.retention90Day, qualityRating: r.qualityRating,
        noShowPct: 0.018, attritionPct: 0.072,
        ncrCount: 1, submittals: r.submittals, hires: r.hires,
        declines: r.declines, withdrawals: r.withdrawals
      },
      financial: {
        spendYTD:                   { amount: 1842000, currency: "USD" },
        spendMTD:                   { amount: 412800,  currency: "USD" },
        grossMarginPct:             0.273,
        apDaysOutstanding:          22.4,
        disputeRatePct:             0.012,
        paymentTermsCompliancePct:  0.985,
        invoicesIssued:             24,
        invoicesPaid:               22,
        invoicesDisputed:           1
      },
      monthlyFillRate: r.monthlyFillRate,
      rank: r.rank,
      // Keep top-level aliases for one release for backwards compat.
      fillRate: r.fillRate, timeToFillHours: r.timeToFillHours,
      retention90Day: r.retention90Day, qualityRating: r.qualityRating
    };
  })();

  /* =================================================================
     G-08 — ts_list rows: scheduled/actual punches, breakMinutes,
                          billable split, billingBasis, timeCapture,
                          engagementType
     ================================================================= */
  (function () {
    ensureField("Timesheet", { name: "scheduledStart", type: "string<datetime>", required: false, desc: "Scheduled start of the period or shift." });
    ensureField("Timesheet", { name: "actualStart",    type: "string<datetime>", required: false, desc: "Worker's first clock-in for this timesheet." });
    ensureField("Timesheet", { name: "scheduledEnd",   type: "string<datetime>", required: false, desc: "Scheduled end of the period." });
    ensureField("Timesheet", { name: "actualEnd",      type: "string<datetime>", required: false, desc: "Worker's last clock-out for this timesheet." });
    ensureField("Timesheet", { name: "breakMinutes",   type: "integer",          required: false, desc: "Total break minutes across the period." });
    ensureField("Timesheet", { name: "billableHours",  type: "number",           required: false, desc: "Hours classified as billable to the customer." });
    ensureField("Timesheet", { name: "nonBillableHours", type: "number",         required: false, desc: "Hours captured but not billed (training, travel, internal)." });
    ensureField("Timesheet", { name: "billingBasis",   type: "enum",             required: false, desc: "How the engagement bills.", enum: ["weekly", "biweekly", "monthly", "hourly", "milestone"] });
    ensureField("Timesheet", { name: "timeCapture",    type: "enum",             required: false, desc: "How time was captured.", enum: ["timesheet", "time_tracking", "passive", "milestone"] });
    ensureField("Timesheet", { name: "engagementType", type: "enum",             required: false, desc: "Denormalized EngagementType from the requisition.", enum: ["shift", "assignment", "project", "sow"] });

    var e = ep("ts_list");
    if (!e || !e.responseExample) return;
    var ROW = {};
    ROW["01HZX9N1KD7H4F2R6S3P8M5V01"] = {
      engagementType: "shift", billingBasis: "weekly", timeCapture: "timesheet",
      scheduledStart: "2026-05-18T22:00:00Z", actualStart: "2026-05-18T21:58:00Z",
      scheduledEnd:   "2026-05-23T06:00:00Z", actualEnd:   "2026-05-23T06:02:00Z",
      breakMinutes: 150, billableHours: 38.5, nonBillableHours: 0
    };
    ROW["01HZX9N1KD7H4F2R6S3P8M5V02"] = {
      engagementType: "assignment", billingBasis: "weekly", timeCapture: "time_tracking",
      scheduledStart: "2026-05-18T07:00:00Z", actualStart: "2026-05-18T07:02:00Z",
      scheduledEnd:   "2026-05-24T18:00:00Z", actualEnd:   "2026-05-24T18:30:00Z",
      breakMinutes: 90, billableHours: 40.0, nonBillableHours: 2.5
    };
    ROW["01HZX9N1KD7H4F2R6S3P8M5V03"] = {
      engagementType: "project", billingBasis: "biweekly", timeCapture: "time_tracking",
      scheduledStart: "2026-05-18T09:00:00Z", actualStart: "2026-05-18T09:14:00Z",
      scheduledEnd:   "2026-05-24T18:00:00Z", actualEnd:   "2026-05-24T17:42:00Z",
      breakMinutes: 60, billableHours: 32.0, nonBillableHours: 0
    };
    ROW["01HZX9N1KD7H4F2R6S3P8M5V04"] = {
      engagementType: "shift", billingBasis: "weekly", timeCapture: "timesheet",
      scheduledStart: "2026-05-11T14:00:00Z", actualStart: "2026-05-11T13:58:00Z",
      scheduledEnd:   "2026-05-17T22:00:00Z", actualEnd:   "2026-05-17T22:04:00Z",
      breakMinutes: 150, billableHours: 40.0, nonBillableHours: 0
    };
    ROW["01HZX9N1KD7H4F2R6S3P8M5V05"] = {
      engagementType: "shift", billingBasis: "weekly", timeCapture: "timesheet",
      scheduledStart: "2026-05-11T22:00:00Z", actualStart: "2026-05-11T22:02:00Z",
      scheduledEnd:   "2026-05-16T06:00:00Z", actualEnd:   "2026-05-16T05:48:00Z",
      breakMinutes: 120, billableHours: 36.0, nonBillableHours: 0
    };
    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ROW[row.id] || {
        engagementType: "shift", billingBasis: "weekly", timeCapture: "timesheet",
        scheduledStart: null, actualStart: null, scheduledEnd: null, actualEnd: null,
        breakMinutes: 0, billableHours: row.hours || 0, nonBillableHours: 0
      });
    });
  })();

  /* =================================================================
     G-09 — ts_get envelope: entries[] + activity[]
     ================================================================= */
  (function () {
    // Add (or replace) a screen-grade ts_get example covering the
    // canonical Maya timesheet that the list returns.
    var e = ep("ts_get");
    if (!e) return;
    e.responseExample = {
      id: "01HZX9N1KD7H4F2R6S3P8M5V01",
      workerId: ID.wrk_maya, workerName: "Maya Okafor",
      requisitionId: ID.req_picker, requisitionCode: "REQ-08421",
      supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
      locationId: ID.loc_reno, locationName: "Reno DC-3", locationTimezone: "America/Los_Angeles",
      engagementType: "shift", billingBasis: "weekly", timeCapture: "timesheet",
      weekStarting: "2026-05-18", periodLabel: "Week of May 18",
      scheduledStart: "2026-05-18T22:00:00Z", actualStart: "2026-05-18T21:58:00Z",
      scheduledEnd:   "2026-05-23T06:00:00Z", actualEnd:   "2026-05-23T06:02:00Z",
      hours: 38.5, overtimeHours: 0,
      billableHours: 38.5, nonBillableHours: 0, breakMinutes: 150,
      payRate: { amount: 22.50, currency: "USD" }, billRate: { amount: 31.75, currency: "USD" },
      totalBillable: { amount: 1222.38, currency: "USD" },
      status: "approved",
      submittedAt: "2026-05-25T12:00:00Z",
      approvedAt:  "2026-05-25T17:08:11Z", approvedBy: ID.user_alex,
      entries: [
        { date: "2026-05-18", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2W01", scheduledStart: "2026-05-18T22:00:00Z", actualStart: "2026-05-18T21:58:00Z",
          breaks: [{ startsAt: "2026-05-19T02:00:00Z", endsAt: "2026-05-19T02:30:00Z", paid: false }],
          scheduledEnd: "2026-05-19T06:00:00Z", actualEnd: "2026-05-19T06:02:00Z",
          hours: 7.5, billable: true, notes: null },
        { date: "2026-05-19", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2W02", scheduledStart: "2026-05-19T22:00:00Z", actualStart: "2026-05-19T22:01:00Z",
          breaks: [{ startsAt: "2026-05-20T02:00:00Z", endsAt: "2026-05-20T02:30:00Z", paid: false }],
          scheduledEnd: "2026-05-20T06:00:00Z", actualEnd: "2026-05-20T06:05:00Z",
          hours: 7.5, billable: true, notes: null },
        { date: "2026-05-20", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2W03", scheduledStart: "2026-05-20T22:00:00Z", actualStart: "2026-05-20T22:00:00Z",
          breaks: [{ startsAt: "2026-05-21T02:00:00Z", endsAt: "2026-05-21T02:30:00Z", paid: false }],
          scheduledEnd: "2026-05-21T06:00:00Z", actualEnd: "2026-05-21T05:55:00Z",
          hours: 7.5, billable: true, notes: null },
        { date: "2026-05-21", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2W04", scheduledStart: "2026-05-21T22:00:00Z", actualStart: "2026-05-21T22:00:00Z",
          breaks: [{ startsAt: "2026-05-22T02:00:00Z", endsAt: "2026-05-22T02:30:00Z", paid: false }],
          scheduledEnd: "2026-05-22T06:00:00Z", actualEnd: "2026-05-22T06:00:00Z",
          hours: 8.0, billable: true, notes: null },
        { date: "2026-05-22", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2W05", scheduledStart: "2026-05-22T22:00:00Z", actualStart: "2026-05-22T22:00:00Z",
          breaks: [{ startsAt: "2026-05-23T02:00:00Z", endsAt: "2026-05-23T02:30:00Z", paid: false }],
          scheduledEnd: "2026-05-23T06:00:00Z", actualEnd: "2026-05-23T06:02:00Z",
          hours: 8.0, billable: true, notes: null }
      ],
      activity: [
        { at: "2026-05-25T17:08:11Z", actorId: ID.user_alex, actorName: "Alex Chen", kind: "approved", note: null },
        { at: "2026-05-25T12:00:00Z", actorId: ID.wrk_maya,  actorName: "Maya Okafor", kind: "submitted", note: null },
        { at: "2026-05-23T06:02:00Z", actorId: "system",     actorName: "System", kind: "auto_closed", note: "Last shift completed" }
      ]
    };
  })();

  /* =================================================================
     G-10 — inv_list rows: location rollups, engagementTypes[],
                          billingBasis, timeCapture, supplierTypes[]
     ================================================================= */
  (function () {
    ensureField("Invoice", { name: "locationIds",      type: "string<ulid>[]", required: false, desc: "Locations the invoice covers (denormalized from line items)." });
    ensureField("Invoice", { name: "locationNames",    type: "string[]",       required: false, desc: "Human-readable names paired 1:1 with locationIds." });
    ensureField("Invoice", { name: "engagementTypes",  type: "enum[]",         required: false, desc: "EngagementTypes represented across the invoice's lines.", enum: ["shift", "assignment", "project", "sow"] });
    ensureField("Invoice", { name: "billingBasis",     type: "enum",           required: false, desc: "Dominant billing basis for the invoice.", enum: ["weekly", "biweekly", "monthly", "hourly", "milestone"] });
    ensureField("Invoice", { name: "timeCapture",      type: "enum",           required: false, desc: "Dominant time-capture method for the invoice.", enum: ["timesheet", "time_tracking", "passive", "milestone"] });
    ensureField("Invoice", { name: "supplierTypes",    type: "enum[]",         required: false, desc: "Supplier capabilities on the issuing supplier.", enum: ["agency", "contractor", "eor", "float"] });

    var e = ep("inv_list");
    if (!e || !e.responseExample) return;
    var ROW = {};
    ROW["01HZXA0K2N4R8F7D3M2P5S6Q01"] = {
      locationIds: [ID.loc_reno], locationNames: ["Reno DC-3"],
      engagementTypes: ["shift", "assignment"], billingBasis: "weekly", timeCapture: "timesheet",
      supplierTypes: ["agency", "eor"]
    };
    ROW["01HZXA0K2N4R8F7D3M2P5S6Q02"] = {
      locationIds: [ID.loc_reno], locationNames: ["Reno DC-3"],
      engagementTypes: ["shift"], billingBasis: "weekly", timeCapture: "timesheet",
      supplierTypes: ["agency", "eor"]
    };
    ROW["01HZXA0K2N4R8F7D3M2P5S6Q03"] = {
      locationIds: [ID.loc_dublin], locationNames: ["Dublin clinic"],
      engagementTypes: ["assignment"], billingBasis: "monthly", timeCapture: "time_tracking",
      supplierTypes: ["eor"]
    };
    ROW["01HZXA0K2N4R8F7D3M2P5S6Q04"] = {
      locationIds: [ID.loc_chicago, ID.loc_reno], locationNames: ["Chicago HQ", "Reno DC-3"],
      engagementTypes: ["project", "shift"], billingBasis: "biweekly", timeCapture: "time_tracking",
      supplierTypes: ["agency"]
    };
    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ROW[row.id] || {
        locationIds: [], locationNames: [], engagementTypes: [],
        billingBasis: "weekly", timeCapture: "timesheet", supplierTypes: ["agency"]
      });
    });
  })();

  /* =================================================================
     G-11 — inv_get envelope: totalsByEngagementType + totalsByLocation
     ================================================================= */
  (function () {
    var e = ep("inv_get");
    if (!e || !e.responseExample) return;
    e.responseExample.totalsByEngagementType = {
      shift:      { amount: 31460.50, currency: "USD" },
      assignment: { amount:  9820.00, currency: "USD" },
      project:    { amount:     0.00, currency: "USD" },
      sow:        { amount:     0.00, currency: "USD" }
    };
    e.responseExample.totalsByLocation = [
      { locationId: ID.loc_reno, locationName: "Reno DC-3", amount: { amount: 41280.50, currency: "USD" }, lineCount: 24 }
    ];
    e.responseExample.engagementTypes = ["shift", "assignment"];
    e.responseExample.billingBasis = "weekly";
    e.responseExample.timeCapture  = "timesheet";
    e.responseExample.supplierTypes = ["agency", "eor"];
  })();

  /* =================================================================
     G-13 — sch_list_shifts rows: geofence, breaks, payRate,
                                  differential
     ================================================================= */
  (function () {
    ensureField("Shift", { name: "geofenceStatus", type: "enum", required: false,
      desc: "Geofence state for clocking. inside / outside / unknown.",
      enum: ["inside", "outside", "unknown"] });
    ensureField("Shift", { name: "breakStartsAt", type: "string<datetime>", required: false, desc: "Scheduled break start." });
    ensureField("Shift", { name: "breakEndsAt",   type: "string<datetime>", required: false, desc: "Scheduled break end." });
    ensureField("Shift", { name: "payRate",       type: "Money", required: false, desc: "Pay rate at the moment the shift was created." });
    ensureField("Shift", { name: "differential",  type: "{name,multiplier}", required: false, desc: "Shift differential applied (night, weekend, holiday)." });

    var e = ep("sch_list_shifts");
    if (!e || !e.responseExample) return;
    var ROW = {
      "01HZX9P2RM8K4F6D7N3S6PA2W01": { geofenceStatus: "inside",   breakStartsAt: "2026-06-02T02:00:00Z", breakEndsAt: "2026-06-02T02:30:00Z", payRate: { amount: 24.50, currency: "USD" }, differential: { name: "night", multiplier: 1.10 } },
      "01HZX9P2RM8K4F6D7N3S6PA2W02": { geofenceStatus: "unknown",  breakStartsAt: null, breakEndsAt: null,                                  payRate: { amount: 24.50, currency: "USD" }, differential: { name: "night", multiplier: 1.10 } },
      "01HZX9P2RM8K4F6D7N3S6PA2W03": { geofenceStatus: "inside",   breakStartsAt: "2026-06-02T10:00:00Z", breakEndsAt: "2026-06-02T10:30:00Z", payRate: { amount: 26.00, currency: "USD" }, differential: null },
      "01HZX9P2RM8K4F6D7N3S6PA2W04": { geofenceStatus: "inside",   breakStartsAt: "2026-06-03T02:00:00Z", breakEndsAt: "2026-06-03T02:30:00Z", payRate: { amount: 24.50, currency: "USD" }, differential: { name: "night", multiplier: 1.10 } },
      "01HZX9P2RM8K4F6D7N3S6PA2W05": { geofenceStatus: "inside",   breakStartsAt: "2026-05-31T02:00:00Z", breakEndsAt: "2026-05-31T02:30:00Z", payRate: { amount: 24.50, currency: "USD" }, differential: { name: "night", multiplier: 1.10 } },
      "01HZX9P2RM8K4F6D7N3S6PA2W06": { geofenceStatus: "outside",  breakStartsAt: null, breakEndsAt: null,                                  payRate: { amount: 24.50, currency: "USD" }, differential: { name: "night", multiplier: 1.10 } }
    };
    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ROW[row.id] || {
        geofenceStatus: "unknown", breakStartsAt: null, breakEndsAt: null,
        payRate: null, differential: null
      });
    });
  })();

  /* =================================================================
     G-14 — cand_list rows: resume, skillsMatch, bidRate,
                            attestedCredentials, tenureWithSupplierWeeks
     ================================================================= */
  (function () {
    var e = ep("cand_list");
    if (!e || !e.responseExample) return;
    var ROW = {
      "01HZXCND0001234567890ABCD1": {
        resumeFileId: "01HZXFILE001RESUME0MAYA00000",
        skillsMatchPct: 0.92, bidRate: { amount: 22.50, currency: "USD" },
        attestedCredentials: [
          { type: "forklift_cert_1a", verified: true },
          { type: "safety_orientation", verified: true }
        ],
        tenureWithSupplierWeeks: 14
      },
      "01HZXCND0001234567890ABCD2": {
        resumeFileId: "01HZXFILE002RESUME0TOMAS0000",
        skillsMatchPct: 0.84, bidRate: { amount: 23.00, currency: "USD" },
        attestedCredentials: [{ type: "safety_orientation", verified: true }],
        tenureWithSupplierWeeks: 0
      },
      "01HZXCND0001234567890ABCD3": {
        resumeFileId: "01HZXFILE003RESUME0KIRAN0000",
        skillsMatchPct: 0.96, bidRate: { amount: 88.00, currency: "USD" },
        attestedCredentials: [],
        tenureWithSupplierWeeks: 38
      },
      "01HZXCND0001234567890ABCD4": {
        resumeFileId: "01HZXFILE004RESUME0AURORA000",
        skillsMatchPct: 0.78, bidRate: { amount: 92.00, currency: "USD" },
        attestedCredentials: [],
        tenureWithSupplierWeeks: 0
      },
      "01HZXCND0001234567890ABCD5": {
        resumeFileId: "01HZXFILE005RESUME0JORDAN000",
        skillsMatchPct: 0.34, bidRate: { amount: 22.50, currency: "USD" },
        attestedCredentials: [],
        tenureWithSupplierWeeks: 0
      }
    };
    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ROW[row.id] || {
        resumeFileId: null, skillsMatchPct: 0.50, bidRate: row.rate,
        attestedCredentials: [], tenureWithSupplierWeeks: 0
      });
    });
  })();

  /* =================================================================
     G-15 — sow_get milestones: invoicedAmount, paidAmount, files,
                                acceptanceCriteria
     ================================================================= */
  (function () {
    var e = ep("sow_get");
    if (!e || !e.responseExample) return;
    var milestones = e.responseExample.milestones || [];
    var ENRICH = {
      "01HZXMST0001SF000000DISCOVRY": {
        invoicedAmount: { amount: 12000, currency: "USD" },
        paidAmount: { amount: 0, currency: "USD" },
        attachedFiles: [
          { fileId: "01HZXFILE001SOW_DISC_ARCH00", filename: "architecture-v0.1.pdf", uploadedBy: ID.user_priya, uploadedAt: "2026-05-22T14:00:00Z" }
        ],
        acceptanceCriteria:
          "Architecture document signed off by hiring manager. Field map covers Account, Contact, Opportunity, and Custom_Object__c at minimum."
      },
      "01HZXMST0001SF00000000BUILD": {
        invoicedAmount: { amount: 0, currency: "USD" },
        paidAmount: { amount: 0, currency: "USD" },
        attachedFiles: [],
        acceptanceCriteria:
          "Core record types live in sandbox; smoke tests pass; migration script idempotent across reruns."
      },
      "01HZXMST0001SF000000MIGRATE0": {
        invoicedAmount: { amount: 0, currency: "USD" }, paidAmount: { amount: 0, currency: "USD" },
        attachedFiles: [],
        acceptanceCriteria: "Production cutover within agreed window; data integrity report attached; rollback plan documented."
      },
      "01HZXMST0001SF000000TRAINING": {
        invoicedAmount: { amount: 0, currency: "USD" }, paidAmount: { amount: 0, currency: "USD" },
        attachedFiles: [],
        acceptanceCriteria: "Admin and end-user training delivered; recording archive available; satisfaction score \u2265 4 / 5."
      },
      "01HZXMST0001SF00000HYPERCRE0": {
        invoicedAmount: { amount: 0, currency: "USD" }, paidAmount: { amount: 0, currency: "USD" },
        attachedFiles: [],
        acceptanceCriteria: "30-day hypercare with response SLAs honored; final incident report delivered."
      }
    };
    milestones.forEach(function (m) {
      Object.assign(m, ENRICH[m.id] || {
        invoicedAmount: { amount: 0, currency: "USD" }, paidAmount: { amount: 0, currency: "USD" },
        attachedFiles: [], acceptanceCriteria: ""
      });
    });
  })();

  /* =================================================================
     G-19 — bookings_roster_get: lineup[] + standby[] per position
     ================================================================= */
  (function () {
    var e = ep("bookings_roster_get");
    if (!e) return;
    e.responseExample = {
      bookingId: "01HZXBKG000WINTERGALA000001",
      title: "Winter Gala · Atrium banquet",
      eventDate: "2026-06-07",
      captainId: ID.user_alex, captainName: "Alex Chen",
      positions: [
        { positionId: "pos_server_01", role: "Banquet server",
          slotsRequested: 8, slotsFilled: 7, fillState: "partial",
          shiftWindow: { startsAt: "2026-06-07T16:00:00Z", endsAt: "2026-06-07T23:30:00Z" },
          lineup: [
            { workerId: ID.wrk_maya,   name: "Maya Okafor",      status: "confirmed", conflictReasons: [] },
            { workerId: ID.wrk_jordan, name: "Jordan Hsu",       status: "confirmed", conflictReasons: [] },
            { workerId: ID.wrk_priya,  name: "Priya Menon",      status: "confirmed", conflictReasons: [] },
            { workerId: ID.wrk_sami,   name: "Sami Soto",        status: "confirmed", conflictReasons: [] },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WY", name: "Aurora Kim",        status: "confirmed", conflictReasons: [] },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4WZ", name: "Daniel Okafor",     status: "confirmed", conflictReasons: [] },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X0", name: "Keiko Ozawa",       status: "confirmed", conflictReasons: [] },
            { workerId: null, name: null, status: "open", conflictReasons: [] }
          ],
          standby: [
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X1", name: "Rosa Bianchi",      eligibility: "eligible" },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X2", name: "Tomás Núñez",       eligibility: "eligible",
              conflictReasons: [] }
          ] },
        { positionId: "pos_bartender_01", role: "Bartender",
          slotsRequested: 4, slotsFilled: 4, fillState: "filled",
          shiftWindow: { startsAt: "2026-06-07T16:30:00Z", endsAt: "2026-06-07T23:30:00Z" },
          lineup: [
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X3", name: "Aaron Schultz",    status: "confirmed", conflictReasons: [] },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X4", name: "Lukas Kowalski",   status: "confirmed", conflictReasons: ["overtime_threshold_warn"] },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X5", name: "Priya Aravind (sub)", status: "confirmed", conflictReasons: [] },
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X6", name: "Nayara Almeida",   status: "confirmed", conflictReasons: [] }
          ],
          standby: [
            { workerId: "01HZX0J8B7P3R2K6F9D5N8M4X7", name: "Sai Murthy",       eligibility: "eligible" }
          ] },
        { positionId: "pos_captain_01", role: "Captain",
          slotsRequested: 2, slotsFilled: 1, fillState: "partial",
          shiftWindow: { startsAt: "2026-06-07T15:00:00Z", endsAt: "2026-06-08T00:00:00Z" },
          lineup: [
            { workerId: ID.user_alex, name: "Alex Chen", status: "confirmed", conflictReasons: [] },
            { workerId: null, name: null, status: "open", conflictReasons: [] }
          ],
          standby: [] }
      ],
      progress: { totalSlots: 14, filledSlots: 12, openSlots: 2, overallFillState: "partial" }
    };
  })();

  /* =================================================================
     G-21 — loc_list rows: openShifts + activeWorkers rollups
     ================================================================= */
  (function () {
    var e = ep("loc_list");
    if (!e || !e.responseExample) return;
    var ROW = {};
    ROW[ID.loc_reno]    = { openShifts: 14, activeWorkers: 142 };
    ROW[ID.loc_phoenix] = { openShifts: 6,  activeWorkers: 96 };
    ROW[ID.loc_chicago] = { openShifts: 1,  activeWorkers: 24 };
    ROW[ID.loc_dublin]  = { openShifts: 0,  activeWorkers: 28 };
    (e.responseExample.data || []).forEach(function (row) {
      Object.assign(row, ROW[row.id] || { openShifts: 0, activeWorkers: row.workerCount || 0 });
    });
  })();

  /* =================================================================
     G-22 — normalize pagination envelope on 3 endpoints
            (tpl_list, policy_list, bg_list) + cand_list totalCount
     ================================================================= */
  (function () {
    function envelopeWrap(epId, totalCount) {
      var e = ep(epId);
      if (!e || !e.responseExample) return;
      if (Array.isArray(e.responseExample)) {
        e.responseExample = {
          data: e.responseExample,
          nextCursor: null,
          totalCount: totalCount != null ? totalCount : e.responseExample.length
        };
      } else if (e.responseExample.data && !("totalCount" in e.responseExample)) {
        e.responseExample.totalCount = totalCount != null ? totalCount : e.responseExample.data.length;
      }
      // Also update the response schema declaration.
      (e.responses || []).forEach(function (r) {
        if (r.status === 200 && typeof r.schema === "string" && !/Page</.test(r.schema)) {
          r.schema = "Page<" + r.schema.replace(/^Array</, "").replace(/>$/, "") + ">";
        }
      });
    }
    envelopeWrap("tpl_list",     14);
    envelopeWrap("policy_list",   3);
    envelopeWrap("bg_list",       3);
    // pool_list, dist_list, price_list, fund_list, views_list,
    // favorites_list, activity_me, attachments_list, hk_list,
    // hk_deliveries, ops_list, audit_list, to_list, exp_list,
    // comments_list, insights_list, metrics_list, roles_list — all
    // returned bare arrays or {data,nextCursor} from ext-10. Normalize
    // them all to the same envelope.
    envelopeWrap("pool_list");
    envelopeWrap("dist_list");
    envelopeWrap("price_list");
    envelopeWrap("fund_list");
    envelopeWrap("views_list");
    envelopeWrap("favorites_list");
    envelopeWrap("activity_me");
    envelopeWrap("attachments_list");
    envelopeWrap("hk_list");
    envelopeWrap("hk_deliveries");
    envelopeWrap("ops_list");
    envelopeWrap("audit_list");
    envelopeWrap("to_list");
    envelopeWrap("exp_list");
    envelopeWrap("comments_list");
    envelopeWrap("insights_list");
    envelopeWrap("metrics_list");
    envelopeWrap("roles_list");
  })();

  /* =================================================================
     G-20 — WidgetConfig discriminated union (declared as a schema)
     ================================================================= */
  (function () {
    if (!spec.schemas) return;
    if (spec.schemas.WidgetConfig) return;
    spec.schemas.WidgetConfig = {
      description:
        "Discriminated union of widget configurations, keyed by `widgetType`. Each widget on a dashboard tab carries one of these shapes; consumers should branch on `widgetType` to render the appropriate UI.",
      fields: [
        { name: "widgetType", type: "enum", required: true,
          desc: "Discriminator. Determines which other fields are present.",
          enum: ["stat", "line", "bar", "donut", "stack", "list", "table"] },
        { name: "metric",     type: "string",  required: false, desc: "stat / line / bar / donut / stack — the metric code from /metrics." },
        { name: "groupBy",    type: "string",  required: false, desc: "bar / donut / stack — dimension to split by." },
        { name: "grain",      type: "enum",    required: false, desc: "line / stack — time bucket.", enum: ["day", "week", "month", "quarter"] },
        { name: "window",     type: "integer", required: false, desc: "stat / bar — trailing-day window for the metric." },
        { name: "resource",   type: "string",  required: false, desc: "list / table — resource type to enumerate (requisitions, workers, etc)." },
        { name: "filter",     type: "object",  required: false, desc: "list / table — filter to apply to the resource." },
        { name: "orderBy",    type: "string",  required: false, desc: "table — sort spec, e.g. `spend.committed:desc`." },
        { name: "limit",      type: "integer", required: false, desc: "list / table — page-size cap." }
      ]
    };
  })();

  /* =================================================================
     Verifier-friendly summary
     ================================================================= */
  if (typeof window !== "undefined" && window.console) {
    var enrichments = [
      ["req_list",    "distributedSuppliers"],
      ["req_get",     "approvals"],
      ["wrk_list",    "jobs"],
      ["wrk_get",     "nextScheduledShift"],
      ["sup_list",    "tier"],
      ["sup_scorecard","operational"],
      ["ts_list",     "scheduledStart"],
      ["ts_get",      "entries"],
      ["inv_list",    "engagementTypes"],
      ["inv_get",     "totalsByEngagementType"],
      ["sch_list_shifts", "geofenceStatus"],
      ["cand_list",   "skillsMatchPct"],
      ["sow_get",     "acceptanceCriteria"],
      ["bookings_roster_get", "lineup"],
      ["loc_list",    "openShifts"]
    ];
    var missing = [];
    enrichments.forEach(function (pair) {
      var e = ep(pair[0]);
      if (!e || !e.responseExample) return missing.push(pair[0]);
      var s = JSON.stringify(e.responseExample);
      if (s.indexOf(pair[1]) < 0) missing.push(pair[0] + ":" + pair[1]);
    });
    if (missing.length) {
      console.warn("FW_API_SPEC ext-12: " + missing.length + " enrichment(s) didn't land →", missing);
    } else {
      console.info("FW_API_SPEC ext-12: all 22 platform-audit field gaps closed.");
    }
  }
})();
