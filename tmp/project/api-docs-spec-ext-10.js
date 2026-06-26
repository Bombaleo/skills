/* =====================================================================
   Flex Work API · spec extension (part 10 — screen-grade examples)
   ---------------------------------------------------------------------
   Bulks up the responseExample (and select request body example)
   payloads so that "Try it" mode returns a realistic, multi-row,
   richly-populated body that a frontend can wire to a real screen.

   Loads LAST (after ext-9's taxonomy normalization). Mutates
   spec.paths[i].responseExample / .body.example in place. Field shapes
   stay consistent with each entity's schema; the canonical
   EngagementType, SupplierType, WorkerType, and JobCategory enums
   defined in ext-9 are the only allowed values.

   Conventions:
     - List endpoints return 3-5 rows with intentional variance —
       different engagement / supplier types, mixed statuses, mixed
       date ranges, mixed money totals — so list filters look useful.
     - Detail endpoints return full envelopes with embedded summaries
       (distribution, fill state, recent activity, credentials,
       contract, scorecard) — enough to render a single-entity page
       end to end without follow-up calls.
     - All ULIDs follow the project's `01HZX…` 26-char Crockford form
       and are stable across this file so cross-references resolve.
     - Money fields use the { amount, currency } shape consistently.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  /* ------ Stable ULID dictionary ----------------------------------- */
  // Centralized so list rows and detail envelopes cross-reference.
  var ID = {
    // Suppliers
    sup_staffwise:   "01HZX0J7X1K8N4F5R3S2D2YQAH", // agency
    sup_globalpath:  "01HZX0J7X1K8N4F5R3S2D2YQAJ", // eor
    sup_orion:       "01HZX0J7X1K8N4F5R3S2D2YQAK", // agency
    sup_riverbend:   "01HZX0J7X1K8N4F5R3S2D2YQAL", // sow vendor (via agency type)
    sup_float:       "01HZX0J7X1K8N4F5R3S2D2YQAM", // float pool sentinel
    // Locations
    loc_reno:        "01HZX0J5W1S9D8H7N3E6Q4R2YX",
    loc_phoenix:     "01HZX0J5W1S9D8H7N3E6Q4R2YY",
    loc_chicago:     "01HZX0J5W1S9D8H7N3E6Q4R2YZ",
    loc_dublin:      "01HZX0J5W1S9D8H7N3E6Q4R2Y0",
    // Jobs
    job_picker:      "01HZX0J9V6KM6H7TB1W3D7F2QH",
    job_forklift:    "01HZX0J9V6KM6H7TB1W3D7F2QJ",
    job_rn:          "01HZX0J9V6KM6H7TB1W3D7F2QK",
    job_devops:      "01HZX0J9V6KM6H7TB1W3D7F2QL",
    job_pm:          "01HZX0J9V6KM6H7TB1W3D7F2QM",
    job_cisco:       "01HZX0J9V6KM6H7TB1W3D7F2QN",
    // Users
    user_alex:       "01HZX0J0XM7R1F2N6K3L7S5VWE", // hiring manager
    user_priya:      "01HZX0J0XM7R1F2N6K3L7S5VWF", // approver
    user_jordan:     "01HZX0J0XM7R1F2N6K3L7S5VWG", // recruiter
    // Workers
    wrk_maya:        "01HZX0J8B7P3R2K6F9D5N8M4WT",
    wrk_jordan:      "01HZX0J8B7P3R2K6F9D5N8M4WU",
    wrk_lukas:       "01HZX0J8B7P3R2K6F9D5N8M4WV",
    wrk_sami:        "01HZX0J8B7P3R2K6F9D5N8M4WW",
    wrk_priya:       "01HZX0J8B7P3R2K6F9D5N8M4WX",
    // Requisitions
    req_picker:      "01HZX7K2QM4FN0R8VBSE6PA7CY",
    req_forklift:    "01HZX7K2QM4FN0R8VBSE6PA7CZ",
    req_devops:      "01HZX7K2QM4FN0R8VBSE6PA7D0",
    req_pm_sow:      "01HZX7K2QM4FN0R8VBSE6PA7D1",
    req_rn_eor:      "01HZX7K2QM4FN0R8VBSE6PA7D2",
    // Departments
    dept_ops:        "01HZX0JDEPOPS00000000000001",
    dept_eng:        "01HZX0JDEPOPS00000000000002",
    dept_clinical:   "01HZX0JDEPOPS00000000000003"
  };

  /* =================================================================
     REQUISITIONS
     ================================================================= */
  setExample("req_list", {
    data: [
      // Frontline · shift · agency
      { id: ID.req_picker, code: "REQ-08421", title: "Warehouse picker — overnight",
        engagementType: "shift", supplierType: "agency",
        jobId: ID.job_picker, jobTitle: "Warehouse picker",
        locationId: ID.loc_reno, locationName: "Reno DC-3",
        departmentId: ID.dept_ops,
        headcount: 8, headcountFilled: 5,
        startDate: "2026-06-01", endDate: "2026-09-30",
        payRate: { amount: 22.50, currency: "USD" },
        billRate: { amount: 31.75, currency: "USD" },
        priority: "high", riskFlag: null,
        distributedToSupplierIds: [ID.sup_staffwise, ID.sup_orion],
        primarySupplierId: ID.sup_staffwise,
        hiringManagerId: ID.user_alex, hiringManagerName: "Alex Chen",
        status: "open", openedDays: 6, lastActivityAt: "2026-05-26T16:42:11Z",
        createdAt: "2026-05-20T14:08:12Z", createdBy: ID.user_alex },
      // Frontline · assignment · agency
      { id: ID.req_forklift, code: "REQ-08422", title: "Forklift operator — DC-3",
        engagementType: "assignment", supplierType: "agency",
        jobId: ID.job_forklift, jobTitle: "Forklift operator",
        locationId: ID.loc_reno, locationName: "Reno DC-3",
        departmentId: ID.dept_ops,
        headcount: 3, headcountFilled: 3,
        startDate: "2026-06-15", endDate: "2026-12-15",
        payRate: { amount: 26.00, currency: "USD" },
        billRate: { amount: 36.40, currency: "USD" },
        priority: "normal", riskFlag: null,
        distributedToSupplierIds: [ID.sup_staffwise],
        primarySupplierId: ID.sup_staffwise,
        hiringManagerId: ID.user_alex, hiringManagerName: "Alex Chen",
        status: "filled", openedDays: 11, lastActivityAt: "2026-05-25T11:08:00Z",
        createdAt: "2026-05-15T09:12:44Z", createdBy: ID.user_alex },
      // Professional · project · agency (US engineer)
      { id: ID.req_devops, code: "REQ-08423", title: "Senior DevOps engineer (12-mo)",
        engagementType: "project", supplierType: "agency",
        jobId: ID.job_devops, jobTitle: "Senior DevOps engineer",
        locationId: ID.loc_chicago, locationName: "Chicago HQ",
        departmentId: ID.dept_eng,
        headcount: 1, headcountFilled: 0,
        startDate: "2026-07-01", endDate: "2027-06-30",
        payRate: { amount: 92.00, currency: "USD" },
        billRate: { amount: 138.00, currency: "USD" },
        priority: "high", riskFlag: "time_to_fill",
        distributedToSupplierIds: [ID.sup_orion],
        primarySupplierId: ID.sup_orion,
        hiringManagerId: ID.user_priya, hiringManagerName: "Priya Aravind",
        status: "open", openedDays: 19, lastActivityAt: "2026-05-26T09:14:22Z",
        createdAt: "2026-05-07T16:00:00Z", createdBy: ID.user_priya },
      // Professional · sow · vendor
      { id: ID.req_pm_sow, code: "REQ-08424", title: "Salesforce migration — Q3 statement of work",
        engagementType: "sow", supplierType: "agency",
        jobId: ID.job_pm, jobTitle: "Project manager (Salesforce)",
        locationId: ID.loc_chicago, locationName: "Chicago HQ",
        departmentId: ID.dept_eng,
        headcount: null, totalValue: { amount: 248000, currency: "USD" },
        startDate: "2026-07-01", endDate: "2026-09-30",
        priority: "normal", riskFlag: null,
        distributedToSupplierIds: [ID.sup_riverbend],
        primarySupplierId: ID.sup_riverbend,
        hiringManagerId: ID.user_priya, hiringManagerName: "Priya Aravind",
        status: "open", openedDays: 4, lastActivityAt: "2026-05-26T10:01:00Z",
        createdAt: "2026-05-22T13:45:00Z", createdBy: ID.user_priya },
      // International · assignment · eor (Dublin RN)
      { id: ID.req_rn_eor, code: "REQ-08425", title: "Registered nurse — Dublin clinic",
        engagementType: "assignment", supplierType: "eor",
        jobId: ID.job_rn, jobTitle: "Registered nurse",
        locationId: ID.loc_dublin, locationName: "Dublin clinic",
        departmentId: ID.dept_clinical,
        headcount: 2, headcountFilled: 1,
        startDate: "2026-06-08", endDate: "2027-06-07",
        payRate: { amount: 52.00, currency: "EUR" },
        billRate: { amount: 78.00, currency: "EUR" },
        priority: "normal", riskFlag: null,
        distributedToSupplierIds: [ID.sup_globalpath],
        primarySupplierId: ID.sup_globalpath,
        hiringManagerId: ID.user_priya, hiringManagerName: "Priya Aravind",
        status: "open", openedDays: 12, lastActivityAt: "2026-05-26T08:20:00Z",
        createdAt: "2026-05-14T07:55:00Z", createdBy: ID.user_priya }
    ],
    nextCursor: "eyJpZCI6IjAxSFpYN0sy…",
    totalCount: 248
  });

  setExample("req_get", {
    id: ID.req_picker, code: "REQ-08421",
    title: "Warehouse picker — overnight",
    engagementType: "shift", supplierType: "agency",
    jobId: ID.job_picker, jobTitle: "Warehouse picker",
    locationId: ID.loc_reno, locationName: "Reno DC-3", locationTimezone: "America/Los_Angeles",
    departmentId: ID.dept_ops, departmentName: "Operations · West",
    description:
      "Overnight warehouse picker, 22:00 – 06:00, Mon–Fri. RF scanner experience preferred. Steel-toe boots required.",
    headcount: 8, headcountFilled: 5, headcountStandby: 1,
    startDate: "2026-06-01", endDate: "2026-09-30",
    payRate: { amount: 22.50, currency: "USD" },
    billRate: { amount: 31.75, currency: "USD" },
    markupPct: 0.41,
    overtimePolicy: "1.5x after 40h/week",
    requiredCredentials: ["forklift_cert_1a", "safety_orientation"],
    priority: "high", riskFlag: null,
    distribution: [
      { supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        distributedAt: "2026-05-20T14:09:01Z", state: "accepted",
        submittals: 12, hired: 4, declined: 2 },
      { supplierId: ID.sup_orion, supplierName: "Orion Staffing",
        distributedAt: "2026-05-22T10:31:00Z", state: "in_progress",
        submittals: 6, hired: 1, declined: 0 }
    ],
    fillState: {
      open: 3, filledThisWeek: 1, candidatesInPipeline: 9,
      offerOut: 2, declined: 2
    },
    workers: [
      { id: ID.wrk_maya, displayName: "Maya Okafor", supplierId: ID.sup_staffwise, startedAt: "2026-06-01" }
    ],
    hiringManagerId: ID.user_alex, hiringManagerName: "Alex Chen",
    approverId: ID.user_priya, approverName: "Priya Aravind",
    auditSummary: { events: 18, lastChangeAt: "2026-05-26T16:42:11Z", lastChangeBy: ID.user_alex },
    status: "open", openedDays: 6,
    createdAt: "2026-05-20T14:08:12Z", createdBy: ID.user_alex,
    updatedAt: "2026-05-26T16:42:11Z"
  });

  setExample("req_create", {
    id: ID.req_picker, code: "REQ-08421",
    title: "Warehouse picker — overnight",
    engagementType: "shift", supplierType: "agency",
    jobId: ID.job_picker, locationId: ID.loc_reno, departmentId: ID.dept_ops,
    headcount: 8, headcountFilled: 0,
    startDate: "2026-06-01", endDate: "2026-09-30",
    payRate: { amount: 22.50, currency: "USD" },
    billRate: { amount: 31.75, currency: "USD" },
    status: "draft", priority: "normal",
    distribution: [], fillState: { open: 8, filledThisWeek: 0, candidatesInPipeline: 0 },
    auditSummary: { events: 1, lastChangeAt: "2026-05-26T17:22:01Z", lastChangeBy: ID.user_alex },
    createdAt: "2026-05-26T17:22:01Z", createdBy: ID.user_alex
  });

  setExample("req_update", {
    id: ID.req_picker, code: "REQ-08421",
    title: "Warehouse picker — overnight",
    engagementType: "shift", supplierType: "agency",
    jobId: ID.job_picker, locationId: ID.loc_reno,
    headcount: 10, headcountFilled: 5,
    startDate: "2026-06-01", endDate: "2026-10-15",
    status: "open",
    auditSummary: { events: 19, lastChangeAt: "2026-05-26T17:24:08Z", lastChangeBy: ID.user_alex },
    updatedAt: "2026-05-26T17:24:08Z"
  });

  setExample("req_audit", {
    data: [
      { eventId: "01HZXAUD0001REQ00000000001", at: "2026-05-26T17:24:08Z", actorId: ID.user_alex, action: "headcount.changed",
        before: { headcount: 8 }, after: { headcount: 10 } },
      { eventId: "01HZXAUD0001REQ00000000002", at: "2026-05-26T16:42:11Z", actorId: ID.user_alex, action: "worker.assigned",
        workerId: ID.wrk_maya, supplierId: ID.sup_staffwise },
      { eventId: "01HZXAUD0001REQ00000000003", at: "2026-05-22T10:31:00Z", actorId: ID.user_alex, action: "distribution.added",
        supplierId: ID.sup_orion },
      { eventId: "01HZXAUD0001REQ00000000004", at: "2026-05-20T14:09:01Z", actorId: ID.user_alex, action: "requisition.opened" },
      { eventId: "01HZXAUD0001REQ00000000005", at: "2026-05-20T14:08:12Z", actorId: ID.user_alex, action: "requisition.created" }
    ],
    nextCursor: null
  });

  /* =================================================================
     WORKERS
     ================================================================= */
  setExample("wrk_list", {
    data: [
      { id: ID.wrk_maya, displayName: "Maya Okafor", legalFirstName: "Maya", legalLastName: "Okafor",
        email: "maya.okafor@example.com", phone: "+1-775-555-0142",
        engagementType: "shift", supplierType: "agency",
        supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        currentRequisitionId: ID.req_picker, currentJobTitle: "Warehouse picker",
        locationId: ID.loc_reno, locationName: "Reno DC-3",
        tenureWeeks: 41, rating: 4.7, credentialIssues: 0,
        status: "active", startedAt: "2025-08-04", lastShiftAt: "2026-05-25T06:00:00Z" },
      { id: ID.wrk_lukas, displayName: "Lukas Kowalski", legalFirstName: "Lukas", legalLastName: "Kowalski",
        email: "lukas.kowalski@example.eu", phone: "+353-1-555-0188",
        engagementType: "assignment", supplierType: "eor",
        supplierId: ID.sup_globalpath, supplierName: "GlobalPath EOR",
        currentRequisitionId: ID.req_rn_eor, currentJobTitle: "Registered nurse",
        locationId: ID.loc_dublin, locationName: "Dublin clinic",
        tenureWeeks: 23, rating: 4.5, credentialIssues: 0,
        status: "active", startedAt: "2025-12-15", lastShiftAt: "2026-05-26T18:00:00Z" },
      { id: ID.wrk_sami, displayName: "Sami Soto", legalFirstName: "Sami", legalLastName: "Soto",
        email: "sami.soto@example.com", phone: "+1-312-555-0119",
        engagementType: "assignment", supplierType: "contractor",
        supplierId: null, supplierName: null,
        currentRequisitionId: null, currentJobTitle: "Senior DevOps engineer (1099)",
        locationId: ID.loc_chicago, locationName: "Chicago HQ",
        tenureWeeks: 67, rating: 4.8, credentialIssues: 0,
        status: "active", startedAt: "2024-12-02", lastShiftAt: "2026-05-26T22:00:00Z" },
      { id: ID.wrk_priya, displayName: "Priya Menon", legalFirstName: "Priya", legalLastName: "Menon",
        email: "priya.menon@flexwork.example", phone: "+1-602-555-0210",
        engagementType: "shift", supplierType: "float",
        supplierId: null, supplierName: null,
        currentRequisitionId: ID.req_forklift, currentJobTitle: "Forklift operator",
        locationId: ID.loc_phoenix, locationName: "Phoenix DC-1",
        tenureWeeks: 112, rating: 4.9, credentialIssues: 1,
        status: "active", startedAt: "2023-11-20", lastShiftAt: "2026-05-26T14:00:00Z" }
    ],
    nextCursor: "eyJpZCI6IjAxSFpYMEo4Qj…",
    totalCount: 1284
  });

  setExample("wrk_get", {
    id: ID.wrk_maya, displayName: "Maya Okafor",
    legalFirstName: "Maya", legalLastName: "Okafor",
    email: "maya.okafor@example.com", phone: "+1-775-555-0142",
    homeAddress: { line1: "182 Birch St", city: "Sparks", state: "NV", postalCode: "89431", country: "US" },
    engagementType: "shift", supplierType: "agency",
    supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
    currentRequisitionId: ID.req_picker, currentJobTitle: "Warehouse picker",
    currentLocationId: ID.loc_reno, currentLocationName: "Reno DC-3",
    payRate: { amount: 22.50, currency: "USD" },
    tenureWeeks: 41, totalHours: 1620,
    credentials: [
      { type: "forklift_cert_1a", status: "verified", expiresOn: "2027-04-12" },
      { type: "safety_orientation", status: "verified", expiresOn: "2026-12-01" },
      { type: "i9", status: "verified", expiresOn: null }
    ],
    rating: 4.7, ratingCount: 38,
    recentShifts: [
      { shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT", date: "2026-05-25", hours: 8.0, status: "completed" },
      { shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WU", date: "2026-05-24", hours: 8.0, status: "completed" },
      { shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WV", date: "2026-05-23", hours: 4.5, status: "completed" }
    ],
    placementHistory: { distinctRequisitions: 6, rehireEligible: true, longestRunWeeks: 28 },
    status: "active", startedAt: "2025-08-04",
    createdAt: "2025-07-29T11:08:00Z"
  });

  setExample("wrk_assign", {
    id: ID.wrk_maya, currentRequisitionId: ID.req_picker, status: "active",
    startedAt: "2026-06-01", payRate: { amount: 23.00, currency: "USD" },
    eligibility: { credentialsOK: true, conflictsFound: 0, talentPoolMatch: true }
  });

  setExample("wrk_credentials", {
    data: [
      { id: "01HZXWCR0001MAYA0000FORKL1FT", workerId: ID.wrk_maya,
        type: "forklift_cert_1a", typeLabel: "Forklift class 1A",
        status: "verified", issuedOn: "2025-04-12", expiresOn: "2027-04-12",
        verifiedBy: ID.user_jordan, verifiedAt: "2025-04-13T09:00:00Z",
        fileId: "01HZXFILE001FORKLIFT0000ABC" },
      { id: "01HZXWCR0001MAYA0000SAFETY0", workerId: ID.wrk_maya,
        type: "safety_orientation", typeLabel: "Safety orientation",
        status: "verified", issuedOn: "2025-08-04", expiresOn: "2026-12-01",
        verifiedBy: ID.user_jordan, verifiedAt: "2025-08-04T10:30:00Z" },
      { id: "01HZXWCR0001MAYA00000000I900", workerId: ID.wrk_maya,
        type: "i9", typeLabel: "I-9",
        status: "verified", issuedOn: "2025-08-04", expiresOn: null,
        verifiedBy: ID.user_jordan, verifiedAt: "2025-08-04T10:32:00Z" }
    ],
    nextCursor: null
  });

  setExample("wrk_tenure", {
    workerId: ID.wrk_maya,
    totalHoursWorked: 1620, totalWeeksOnAssignment: 41,
    distinctEngagements: 6, longestContinuousRunWeeks: 28,
    rehireEligible: true,
    byRequisition: [
      { requisitionId: ID.req_picker, code: "REQ-08421", weeks: 4, hours: 152, status: "active" },
      { requisitionId: ID.req_forklift, code: "REQ-08200", weeks: 12, hours: 480, status: "ended" },
      { requisitionId: "01HZX7K2QM4FN0R8VBSE6PA7BX", code: "REQ-07820", weeks: 28, hours: 1118, status: "ended" }
    ]
  });

  setExample("wrk_timeline", {
    data: [
      { kind: "shift_completed",  at: "2026-05-25T06:00:00Z", shiftId: "01HZX9P2RM8K4F6D7N3S6PA2WT", hours: 8.0 },
      { kind: "feedback_left",    at: "2026-05-25T06:30:00Z", actorId: ID.user_alex, rating: 5, note: "Punctual, great team player." },
      { kind: "credential_verified", at: "2026-05-20T10:00:00Z", credentialType: "safety_orientation" },
      { kind: "placement_started", at: "2026-06-01T00:00:00Z", requisitionId: ID.req_picker, supplierId: ID.sup_staffwise },
      { kind: "onboarded",        at: "2025-08-04T09:00:00Z", actorId: ID.user_jordan }
    ],
    nextCursor: null
  });

  /* =================================================================
     SUPPLIERS
     ================================================================= */
  setExample("sup_list", {
    data: [
      { id: ID.sup_staffwise, name: "StaffWise West", type: "agency",
        primaryContactName: "Renee Bauer", primaryContactEmail: "ops@staffwise.example",
        primaryContactPhone: "+1-775-555-0901",
        country: "US", workerCount: 142, openReqs: 8,
        contractStatus: "active", contractEffectiveStart: "2024-01-01", contractRenewsOn: "2027-01-01",
        markupPct: 0.41, paymentTermsDays: 30,
        fillRate: 0.86, timeToFillHours: 14.2, rating: 4.4,
        certifications: ["WBE", "ISO_9001"],
        status: "active", createdAt: "2024-11-04T10:31:00Z" },
      { id: ID.sup_orion, name: "Orion Staffing", type: "agency",
        primaryContactName: "Sai Murthy", primaryContactEmail: "sales@orionstaff.example",
        primaryContactPhone: "+1-312-555-0182",
        country: "US", workerCount: 87, openReqs: 4,
        contractStatus: "active", contractEffectiveStart: "2023-07-01", contractRenewsOn: "2026-07-01",
        markupPct: 0.45, paymentTermsDays: 45,
        fillRate: 0.74, timeToFillHours: 18.6, rating: 4.1,
        certifications: ["MBE"],
        status: "active", createdAt: "2023-06-12T15:22:00Z" },
      { id: ID.sup_globalpath, name: "GlobalPath EOR", type: "eor",
        primaryContactName: "Aoife Connor", primaryContactEmail: "amer@globalpath-eor.example",
        primaryContactPhone: "+353-1-555-0150",
        country: "IE", workerCount: 36, openReqs: 2,
        contractStatus: "active", contractEffectiveStart: "2024-09-01", contractRenewsOn: "2027-09-01",
        markupPct: 0.62, paymentTermsDays: 30,
        fillRate: 0.91, timeToFillHours: 96.0, rating: 4.6,
        certifications: ["ISO_27001", "GDPR_DPA"],
        status: "active", createdAt: "2024-08-22T09:00:00Z" },
      { id: ID.sup_riverbend, name: "Riverbend Consulting", type: "agency",
        primaryContactName: "Tomás Núñez", primaryContactEmail: "delivery@riverbend.example",
        primaryContactPhone: "+1-602-555-0224",
        country: "US", workerCount: 12, openReqs: 1,
        contractStatus: "active", contractEffectiveStart: "2025-02-01", contractRenewsOn: "2028-02-01",
        markupPct: 0.34, paymentTermsDays: 60,
        fillRate: 0.93, timeToFillHours: 48.0, rating: 4.8,
        certifications: ["SOC2_T2"],
        status: "active", createdAt: "2025-01-22T11:45:00Z" }
    ],
    nextCursor: null,
    totalCount: 4
  });

  setExample("sup_get", {
    id: ID.sup_staffwise, name: "StaffWise West", type: "agency",
    legalName: "StaffWise West Holdings LLC", taxId: "EIN-XX-XXXXXXX",
    primaryContact: { name: "Renee Bauer", email: "ops@staffwise.example", phone: "+1-775-555-0901", title: "Director of operations" },
    address: { line1: "1240 S Industrial Way", city: "Reno", state: "NV", postalCode: "89506", country: "US" },
    contract: {
      contractId: "01HZXCNT0001STAFFWISE00ACT1",
      status: "active", effectiveStart: "2024-01-01", effectiveEnd: "2027-01-01",
      markupPct: 0.41, paymentTermsDays: 30, billingCadence: "weekly",
      currency: "USD", autoRenew: true
    },
    scorecard: {
      window: "last_90d", fillRate: 0.86, timeToFillHours: 14.2,
      retention90Day: 0.92, qualityRating: 4.4, ncrCount: 1
    },
    certifications: [
      { code: "WBE", verifiedOn: "2024-11-04", expiresOn: "2027-11-04" },
      { code: "ISO_9001", verifiedOn: "2024-02-12", expiresOn: "2027-02-12" }
    ],
    contractStatus: "active", fillRate: 0.86, rating: 4.4,
    workerCount: 142, openReqs: 8,
    status: "active",
    createdAt: "2024-11-04T10:31:00Z", updatedAt: "2026-05-20T14:08:12Z"
  });

  setExample("sup_scorecard", {
    supplierId: ID.sup_staffwise, window: "last_90d",
    fillRate: 0.86, timeToFillHours: 14.2, retention90Day: 0.92, qualityRating: 4.4,
    submittals: 142, hires: 122, declines: 12, withdrawals: 8,
    monthlyFillRate: [
      { month: "2026-03", fillRate: 0.81 },
      { month: "2026-04", fillRate: 0.88 },
      { month: "2026-05", fillRate: 0.89 }
    ],
    rank: { percentile: 78, peerCount: 14 }
  });

  setExample("sup_contract", {
    id: "01HZXCNT0001STAFFWISE00ACT2", supplierId: ID.sup_staffwise,
    version: 4, status: "active",
    effectiveStart: "2026-06-01", effectiveEnd: "2029-06-01",
    markupPct: 0.43, paymentTermsDays: 30, billingCadence: "weekly",
    currency: "USD", autoRenew: true,
    documentUrl: "https://files.dayforce.com/contracts/01HZXCNT0001STAFFWISE00ACT2.pdf?sig=…",
    signedBy: [
      { name: "Renee Bauer", role: "Director, StaffWise West", signedAt: "2026-05-26T16:00:00Z" },
      { name: "Priya Aravind", role: "Director of vendor ops, Flex Work org", signedAt: "2026-05-26T16:02:11Z" }
    ],
    createdAt: "2026-05-26T17:22:01Z", createdBy: ID.user_priya
  });

  /* =================================================================
     TIMESHEETS
     ================================================================= */
  setExample("ts_list", {
    data: [
      { id: "01HZX9N1KD7H4F2R6S3P8M5V01", workerId: ID.wrk_maya, workerName: "Maya Okafor",
        requisitionId: ID.req_picker, supplierId: ID.sup_staffwise,
        weekStarting: "2026-05-18", hours: 38.5, overtimeHours: 0,
        totalBillable: { amount: 1222.38, currency: "USD" },
        status: "approved", submittedAt: "2026-05-25T12:00:00Z",
        approvedAt: "2026-05-25T17:08:11Z", approvedBy: ID.user_alex },
      { id: "01HZX9N1KD7H4F2R6S3P8M5V02", workerId: ID.wrk_lukas, workerName: "Lukas Kowalski",
        requisitionId: ID.req_rn_eor, supplierId: ID.sup_globalpath,
        weekStarting: "2026-05-18", hours: 40.0, overtimeHours: 2.5,
        totalBillable: { amount: 3315.00, currency: "EUR" },
        status: "submitted", submittedAt: "2026-05-26T11:00:00Z",
        approvedAt: null, approvedBy: null },
      { id: "01HZX9N1KD7H4F2R6S3P8M5V03", workerId: ID.wrk_sami, workerName: "Sami Soto",
        requisitionId: ID.req_devops, supplierId: null,
        weekStarting: "2026-05-18", hours: 32.0, overtimeHours: 0,
        totalBillable: { amount: 4416.00, currency: "USD" },
        status: "draft", submittedAt: null, approvedAt: null, approvedBy: null },
      { id: "01HZX9N1KD7H4F2R6S3P8M5V04", workerId: ID.wrk_priya, workerName: "Priya Menon",
        requisitionId: ID.req_forklift, supplierId: null,
        weekStarting: "2026-05-11", hours: 40.0, overtimeHours: 0,
        totalBillable: { amount: 1040.00, currency: "USD" },
        status: "exported", submittedAt: "2026-05-18T09:15:00Z",
        approvedAt: "2026-05-18T15:00:00Z", approvedBy: ID.user_alex,
        exportedAt: "2026-05-19T07:00:00Z" },
      { id: "01HZX9N1KD7H4F2R6S3P8M5V05", workerId: ID.wrk_maya, workerName: "Maya Okafor",
        requisitionId: ID.req_picker, supplierId: ID.sup_staffwise,
        weekStarting: "2026-05-11", hours: 36.0, overtimeHours: 0,
        totalBillable: { amount: 1143.00, currency: "USD" },
        status: "rejected", submittedAt: "2026-05-18T10:00:00Z",
        approvedAt: null, approvedBy: null,
        rejectedReason: "Missing punch-in on Wed" }
    ],
    nextCursor: null,
    totalCount: 1240
  });

  /* =================================================================
     SCHEDULES & SHIFTS
     ================================================================= */
  setExample("sch_list", {
    data: [
      { id: "01HZX0J6T4D9N7K8B5P3M2YQXR", locationId: ID.loc_reno, locationName: "Reno DC-3",
        weekStarting: "2026-06-01", weekEnding: "2026-06-07",
        shiftCount: 142, openShiftCount: 14, assignedShiftCount: 128,
        publishedAt: "2026-05-22T16:00:00Z", publishedBy: ID.user_alex,
        status: "published" },
      { id: "01HZX0J6T4D9N7K8B5P3M2YQXS", locationId: ID.loc_phoenix, locationName: "Phoenix DC-1",
        weekStarting: "2026-06-01", weekEnding: "2026-06-07",
        shiftCount: 96, openShiftCount: 6, assignedShiftCount: 90,
        publishedAt: "2026-05-23T11:30:00Z", publishedBy: ID.user_alex,
        status: "published" },
      { id: "01HZX0J6T4D9N7K8B5P3M2YQXT", locationId: ID.loc_chicago, locationName: "Chicago HQ",
        weekStarting: "2026-06-08", weekEnding: "2026-06-14",
        shiftCount: 18, openShiftCount: 18, assignedShiftCount: 0,
        publishedAt: null, publishedBy: null, status: "draft" }
    ],
    nextCursor: null,
    totalCount: 14
  });

  setExample("sch_list_shifts", {
    data: [
      { id: "01HZX9P2RM8K4F6D7N3S6PA2W01", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        workerId: ID.wrk_maya, workerName: "Maya Okafor",
        locationId: ID.loc_reno, jobId: ID.job_picker, jobTitle: "Warehouse picker",
        startsAt: "2026-06-01T22:00:00Z", endsAt: "2026-06-02T06:00:00Z",
        breakMinutes: 30, status: "assigned" },
      { id: "01HZX9P2RM8K4F6D7N3S6PA2W02", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        workerId: null, workerName: null,
        locationId: ID.loc_reno, jobId: ID.job_picker, jobTitle: "Warehouse picker",
        startsAt: "2026-06-01T22:00:00Z", endsAt: "2026-06-02T06:00:00Z",
        breakMinutes: 30, status: "open", offers: 4 },
      { id: "01HZX9P2RM8K4F6D7N3S6PA2W03", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        workerId: ID.wrk_priya, workerName: "Priya Menon",
        locationId: ID.loc_reno, jobId: ID.job_forklift, jobTitle: "Forklift operator",
        startsAt: "2026-06-02T06:00:00Z", endsAt: "2026-06-02T14:00:00Z",
        breakMinutes: 30, status: "confirmed" },
      { id: "01HZX9P2RM8K4F6D7N3S6PA2W04", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        workerId: ID.wrk_jordan, workerName: "Jordan Hsu",
        locationId: ID.loc_reno, jobId: ID.job_picker, jobTitle: "Warehouse picker",
        startsAt: "2026-06-02T22:00:00Z", endsAt: "2026-06-03T06:00:00Z",
        breakMinutes: 30, status: "in_progress" },
      { id: "01HZX9P2RM8K4F6D7N3S6PA2W05", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        workerId: ID.wrk_maya, workerName: "Maya Okafor",
        locationId: ID.loc_reno, jobId: ID.job_picker, jobTitle: "Warehouse picker",
        startsAt: "2026-05-30T22:00:00Z", endsAt: "2026-05-31T06:00:00Z",
        breakMinutes: 30, status: "completed",
        actualHours: 8.0, clockInAt: "2026-05-30T21:55:00Z", clockOutAt: "2026-05-31T06:02:00Z" },
      { id: "01HZX9P2RM8K4F6D7N3S6PA2W06", scheduleId: "01HZX0J6T4D9N7K8B5P3M2YQXR",
        workerId: ID.wrk_sami, workerName: "Sami Soto",
        locationId: ID.loc_reno, jobId: ID.job_picker, jobTitle: "Warehouse picker",
        startsAt: "2026-05-29T22:00:00Z", endsAt: "2026-05-30T06:00:00Z",
        breakMinutes: 30, status: "no_show" }
    ],
    nextCursor: null,
    totalCount: 280
  });

  /* =================================================================
     INVOICES
     ================================================================= */
  setExample("inv_list", {
    data: [
      { id: "01HZXA0K2N4R8F7D3M2P5S6Q01", number: "INV-2026-08421",
        supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        periodStart: "2026-05-04", periodEnd: "2026-05-17",
        subtotal: { amount: 41280.50, currency: "USD" },
        tax: { amount: 3302.44, currency: "USD" },
        total: { amount: 44582.94, currency: "USD" },
        dueDate: "2026-06-16",
        status: "issued", issuedAt: "2026-05-19T09:00:00Z",
        approvedAt: null, paidAt: null, lineCount: 24 },
      { id: "01HZXA0K2N4R8F7D3M2P5S6Q02", number: "INV-2026-08420",
        supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        periodStart: "2026-04-20", periodEnd: "2026-05-03",
        subtotal: { amount: 39820.00, currency: "USD" },
        tax: { amount: 3185.60, currency: "USD" },
        total: { amount: 43005.60, currency: "USD" },
        dueDate: "2026-06-02",
        status: "paid", issuedAt: "2026-05-05T09:00:00Z",
        approvedAt: "2026-05-06T11:14:00Z", paidAt: "2026-05-22T08:00:00Z", lineCount: 24 },
      { id: "01HZXA0K2N4R8F7D3M2P5S6Q03", number: "INV-2026-08418",
        supplierId: ID.sup_globalpath, supplierName: "GlobalPath EOR",
        periodStart: "2026-05-01", periodEnd: "2026-05-31",
        subtotal: { amount: 28480.00, currency: "EUR" },
        tax: { amount: 6555.20, currency: "EUR" },
        total: { amount: 35035.20, currency: "EUR" },
        dueDate: "2026-06-30",
        status: "approved", issuedAt: "2026-05-26T10:00:00Z",
        approvedAt: "2026-05-26T15:00:00Z", paidAt: null, lineCount: 6 },
      { id: "01HZXA0K2N4R8F7D3M2P5S6Q04", number: "INV-2026-08412",
        supplierId: ID.sup_orion, supplierName: "Orion Staffing",
        periodStart: "2026-04-20", periodEnd: "2026-05-03",
        subtotal: { amount: 12420.00, currency: "USD" },
        tax: { amount: 993.60, currency: "USD" },
        total: { amount: 13413.60, currency: "USD" },
        dueDate: "2026-06-02",
        status: "disputed", issuedAt: "2026-05-05T11:30:00Z",
        approvedAt: null, paidAt: null, lineCount: 8,
        disputeReason: "Two timesheets exceed approved hours" }
    ],
    nextCursor: null,
    totalCount: 1842
  });

  setExample("inv_get", {
    id: "01HZXA0K2N4R8F7D3M2P5S6Q01", number: "INV-2026-08421",
    supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
    billingAddress: { line1: "1240 S Industrial Way", city: "Reno", state: "NV", postalCode: "89506", country: "US" },
    periodStart: "2026-05-04", periodEnd: "2026-05-17",
    subtotal: { amount: 41280.50, currency: "USD" },
    tax: { amount: 3302.44, currency: "USD" },
    total: { amount: 44582.94, currency: "USD" },
    dueDate: "2026-06-16", paymentTermsDays: 30,
    status: "issued", issuedAt: "2026-05-19T09:00:00Z",
    approvedAt: null, paidAt: null,
    lineCount: 24,
    lines: [
      { id: "01HZXA1T7P2R8M4F5K6D9N3S2W", description: "Regular hours · week of May 11 · Reno DC-3",
        timesheetId: "01HZX9N1KD7H4F2R6S3P8M5V01", hours: 320, rate: 31.75, amount: 10160.00 },
      { id: "01HZXA1T7P2R8M4F5K6D9N3S2X", description: "Overtime hours · week of May 11 · Reno DC-3",
        timesheetId: "01HZX9N1KD7H4F2R6S3P8M5V01", hours: 18, rate: 47.63, amount: 857.34 },
      { id: "01HZXA1T7P2R8M4F5K6D9N3S2Y", description: "Regular hours · week of May 4 · Reno DC-3",
        timesheetId: "01HZX9N1KD7H4F2R6S3P8M5V05", hours: 312, rate: 31.75, amount: 9906.00 }
    ],
    glAccount: "6010 · Contingent labor · West region",
    disputeHistory: []
  });

  /* =================================================================
     CANDIDATES
     ================================================================= */
  setExample("cand_list", {
    data: [
      { id: "01HZXCND0001234567890ABCD1", requisitionId: ID.req_picker, requisitionCode: "REQ-08421",
        supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        firstName: "Maya", lastName: "Okafor",
        email: "maya.okafor@example.com",
        stage: "hired", outcome: "hired",
        rate: { amount: 22.50, currency: "USD" },
        submittedAt: "2026-05-22T09:30:00Z" },
      { id: "01HZXCND0001234567890ABCD2", requisitionId: ID.req_picker, requisitionCode: "REQ-08421",
        supplierId: ID.sup_staffwise, supplierName: "StaffWise West",
        firstName: "Tomás", lastName: "Núñez",
        email: "tomas.nunez@example.com",
        stage: "interview", outcome: null,
        rate: { amount: 22.50, currency: "USD" },
        submittedAt: "2026-05-24T11:08:00Z",
        interviewScheduledAt: "2026-05-28T15:00:00Z" },
      { id: "01HZXCND0001234567890ABCD3", requisitionId: ID.req_devops, requisitionCode: "REQ-08423",
        supplierId: ID.sup_orion, supplierName: "Orion Staffing",
        firstName: "Kiran", lastName: "Patel",
        email: "kiran.patel@example.com",
        stage: "offer", outcome: null,
        rate: { amount: 92.00, currency: "USD" },
        submittedAt: "2026-05-19T14:20:00Z",
        offerSentAt: "2026-05-25T16:00:00Z" },
      { id: "01HZXCND0001234567890ABCD4", requisitionId: ID.req_devops, requisitionCode: "REQ-08423",
        supplierId: ID.sup_orion, supplierName: "Orion Staffing",
        firstName: "Aurora", lastName: "Kim",
        email: "aurora.kim@example.com",
        stage: "screening", outcome: null,
        rate: { amount: 88.00, currency: "USD" },
        submittedAt: "2026-05-23T08:00:00Z" },
      { id: "01HZXCND0001234567890ABCD5", requisitionId: ID.req_picker, requisitionCode: "REQ-08421",
        supplierId: ID.sup_orion, supplierName: "Orion Staffing",
        firstName: "Jordan", lastName: "Riley",
        email: "jordan.riley@example.com",
        stage: "submitted", outcome: "rejected",
        rate: { amount: 22.50, currency: "USD" },
        submittedAt: "2026-05-24T09:00:00Z",
        rejectedReason: "Did not meet minimum experience" }
    ],
    nextCursor: null,
    totalCount: 27
  });

  /* =================================================================
     SOW
     ================================================================= */
  setExample("sow_list", {
    data: [
      { id: "01HZXSOW0001234567890ABCD1", number: "SOW-2026-1042",
        title: "Salesforce migration — Q3", supplierId: ID.sup_riverbend, supplierName: "Riverbend Consulting",
        engagementType: "sow", supplierType: "agency",
        totalValue: { amount: 248000, currency: "USD" },
        startDate: "2026-07-01", endDate: "2026-09-30",
        milestoneCount: 5, milestonesComplete: 0,
        progressPct: 0.00, status: "active" },
      { id: "01HZXSOW0001234567890ABCD2", number: "SOW-2026-1038",
        title: "Outage support — Q3", supplierId: ID.sup_orion, supplierName: "Orion Staffing",
        engagementType: "sow", supplierType: "agency",
        totalValue: { amount: 96000, currency: "USD" },
        startDate: "2026-07-01", endDate: "2026-09-30",
        milestoneCount: 3, milestonesComplete: 1,
        progressPct: 0.33, status: "active" },
      { id: "01HZXSOW0001234567890ABCD3", number: "SOW-2026-1024",
        title: "Compliance audit — annual", supplierId: ID.sup_riverbend, supplierName: "Riverbend Consulting",
        engagementType: "sow", supplierType: "agency",
        totalValue: { amount: 64000, currency: "USD" },
        startDate: "2026-03-01", endDate: "2026-05-31",
        milestoneCount: 4, milestonesComplete: 4,
        progressPct: 1.00, status: "completed", completedAt: "2026-05-26T17:00:00Z" }
    ],
    nextCursor: null,
    totalCount: 14
  });

  setExample("sow_get", {
    id: "01HZXSOW0001234567890ABCD1", number: "SOW-2026-1042",
    title: "Salesforce migration — Q3",
    description: "Implementation, data migration, training, hypercare. Fixed-fee delivery model.",
    supplierId: ID.sup_riverbend, supplierName: "Riverbend Consulting",
    engagementType: "sow", supplierType: "agency",
    totalValue: { amount: 248000, currency: "USD" },
    startDate: "2026-07-01", endDate: "2026-09-30",
    paymentSchedule: "on_milestone_approval",
    milestoneCount: 5, milestonesComplete: 0,
    milestones: [
      { id: "01HZXMST0001SF000000DISCOVRY", title: "Discovery & blueprint",
        dueAt: "2026-07-15", value: 48000, state: "in_progress",
        deliverables: ["Architecture document", "Field map"] },
      { id: "01HZXMST0001SF00000000BUILD", title: "Build phase 1 — accounts & contacts",
        dueAt: "2026-08-05", value: 60000, state: "planned" },
      { id: "01HZXMST0001SF000000MIGRATE0", title: "Data migration", dueAt: "2026-08-22",
        value: 60000, state: "planned" },
      { id: "01HZXMST0001SF000000TRAINING", title: "Admin & user training", dueAt: "2026-09-05",
        value: 40000, state: "planned" },
      { id: "01HZXMST0001SF00000HYPERCRE0", title: "Hypercare", dueAt: "2026-09-30",
        value: 40000, state: "planned" }
    ],
    contractDocumentUrl: "https://files.dayforce.com/sows/01HZXSOW0001234567890ABCD1.pdf?sig=…",
    status: "active",
    hiringManagerId: ID.user_priya, hiringManagerName: "Priya Aravind",
    createdAt: "2026-05-22T13:45:00Z", createdBy: ID.user_priya
  });

  setExample("sow_milestones_list", {
    data: [
      { id: "01HZXMST0001SF000000DISCOVRY", sowId: "01HZXSOW0001234567890ABCD1",
        title: "Discovery & blueprint", dueAt: "2026-07-15", value: 48000, state: "in_progress",
        completedAt: null, approvedAt: null, invoiceId: null },
      { id: "01HZXMST0001SF00000000BUILD", sowId: "01HZXSOW0001234567890ABCD1",
        title: "Build phase 1 — accounts & contacts", dueAt: "2026-08-05", value: 60000, state: "planned" }
    ],
    nextCursor: null
  });

  /* =================================================================
     CONTRACTORS
     ================================================================= */
  setExample("ctr_list", {
    data: [
      { id: ID.wrk_sami, displayName: "Sami Soto", supplierType: "contractor",
        engagementType: "assignment", currentRequisitionId: ID.req_devops,
        currentJobTitle: "Senior DevOps engineer (1099)",
        rate: { amount: 92.00, currency: "USD" },
        tenureWeeks: 67, classificationStatus: "verified", classificationRisk: "low",
        w9Status: "on_file", lastClassifiedAt: "2026-04-12T09:00:00Z",
        status: "active" },
      { id: "01HZXCTR000000123456789ABD", displayName: "Aurora Kim", supplierType: "contractor",
        engagementType: "project", currentRequisitionId: "01HZX7K2QM4FN0R8VBSE6PA7DZ",
        currentJobTitle: "Brand designer (1099)",
        rate: { amount: 145.00, currency: "USD" },
        tenureWeeks: 14, classificationStatus: "verified", classificationRisk: "low",
        w9Status: "on_file", lastClassifiedAt: "2026-02-19T14:00:00Z",
        status: "active" },
      { id: "01HZXCTR000000123456789ABE", displayName: "Jordan Bell", supplierType: "contractor",
        engagementType: "assignment", currentRequisitionId: null,
        currentJobTitle: "Technical writer (1099)",
        rate: { amount: 76.00, currency: "USD" },
        tenureWeeks: 6, classificationStatus: "needs_review", classificationRisk: "medium",
        w9Status: "pending", lastClassifiedAt: "2026-04-30T11:00:00Z",
        status: "onboarding" }
    ],
    nextCursor: null,
    totalCount: 24
  });

  setExample("ctr_classification_get", {
    workerId: ID.wrk_sami, status: "verified", risk: "low", riskScore: 12,
    lastEvaluatedAt: "2026-04-12T09:00:00Z",
    factors: {
      irs_20_factor:  { score: 14, threshold: 20, result: "pass" },
      abc_test:       { score: 18, threshold: 20, result: "pass", jurisdiction: "IL" },
      exclusivity:    { engagementsCount: 3, result: "pass" },
      tenure:         { weeks: 67, threshold: 104, result: "pass" }
    },
    recommendation: "no_action",
    nextReviewDate: "2026-10-12"
  });

  /* =================================================================
     BUDGETS
     ================================================================= */
  setExample("bg_list", [
    { id: "01HZXC0K2N4R8F7D3M2P5S6BUD1", fiscalYear: 2026, departmentId: ID.dept_ops, departmentName: "Operations · West",
      plan: { amount: 4200000, currency: "USD" },
      committed: { amount: 2710000, currency: "USD" },
      realized: { amount: 1840000, currency: "USD" },
      utilizationPct: 0.645, paceVsPlan: "on_track", alertLevel: null },
    { id: "01HZXC0K2N4R8F7D3M2P5S6BUD2", fiscalYear: 2026, departmentId: ID.dept_eng, departmentName: "Engineering",
      plan: { amount: 1800000, currency: "USD" },
      committed: { amount: 1620000, currency: "USD" },
      realized: { amount: 980000, currency: "USD" },
      utilizationPct: 0.900, paceVsPlan: "ahead", alertLevel: "warning" },
    { id: "01HZXC0K2N4R8F7D3M2P5S6BUD3", fiscalYear: 2026, departmentId: ID.dept_clinical, departmentName: "Clinical",
      plan: { amount: 920000, currency: "USD" },
      committed: { amount: 410000, currency: "USD" },
      realized: { amount: 248000, currency: "USD" },
      utilizationPct: 0.446, paceVsPlan: "behind", alertLevel: null }
  ]);

  setExample("bg_get", {
    id: "01HZXC0K2N4R8F7D3M2P5S6BUD1", fiscalYear: 2026,
    departmentId: ID.dept_ops, departmentName: "Operations · West",
    plan: { amount: 4200000, currency: "USD" },
    committed: { amount: 2710000, currency: "USD" },
    realized: { amount: 1840000, currency: "USD" },
    utilizationPct: 0.645, paceVsPlan: "on_track", forecastEoyAmount: { amount: 4080000, currency: "USD" },
    byCategory: [
      { category: "frontline_shift", committed: 1480000, realized: 1020000 },
      { category: "frontline_assignment", committed: 720000, realized: 410000 },
      { category: "professional_project", committed: 360000, realized: 240000 },
      { category: "sow",        committed: 150000, realized:  170000 }
    ],
    byLocation: [
      { locationId: ID.loc_reno, locationName: "Reno DC-3", realized: 1140000 },
      { locationId: ID.loc_phoenix, locationName: "Phoenix DC-1", realized: 700000 }
    ],
    alerts: [],
    updatedAt: "2026-05-26T08:00:00Z"
  });

  setExample("bg_alerts", {
    data: [
      { id: "01HZXALERT00BUDGET00ENG80", budgetId: "01HZXC0K2N4R8F7D3M2P5S6BUD2",
        threshold: 0.80, firedAt: "2026-05-18T07:00:00Z", level: "warning" },
      { id: "01HZXALERT00BUDGET00ENG90", budgetId: "01HZXC0K2N4R8F7D3M2P5S6BUD2",
        threshold: 0.90, firedAt: "2026-05-26T07:00:00Z", level: "critical" }
    ],
    nextCursor: null
  });

  /* =================================================================
     NOTIFICATIONS
     ================================================================= */
  setExample("notif_list", {
    data: [
      { id: "01HZXDNOT01F7D3M2P5S6QWE001", userId: ID.user_alex,
        kind: "approval_request", title: "3 timesheets awaiting your approval",
        body: "Maya Okafor, Lukas Kowalski, and Sami Soto submitted timesheets for week of May 18.",
        subjectType: "timesheet", subjectId: "01HZX9N1KD7H4F2R6S3P8M5V02",
        actionUrl: "/timesheets?status=submitted&approver=me",
        actionLabel: "Review timesheets",
        readAt: null, priority: "high",
        createdAt: "2026-05-26T17:12:08Z" },
      { id: "01HZXDNOT01F7D3M2P5S6QWE002", userId: ID.user_alex,
        kind: "candidate_submitted", title: "New candidate for REQ-08423",
        body: "Kiran Patel submitted by Orion Staffing.",
        subjectType: "candidate", subjectId: "01HZXCND0001234567890ABCD3",
        actionUrl: "/candidates/01HZXCND0001234567890ABCD3",
        actionLabel: "Open candidate",
        readAt: null, priority: "normal",
        createdAt: "2026-05-26T16:48:33Z" },
      { id: "01HZXDNOT01F7D3M2P5S6QWE003", userId: ID.user_alex,
        kind: "credential_expiring", title: "1 worker has a credential expiring soon",
        body: "Priya Menon's I-9 expires in 14 days.",
        subjectType: "worker", subjectId: ID.wrk_priya,
        actionUrl: "/workers/" + ID.wrk_priya,
        actionLabel: "Update credential",
        readAt: null, priority: "normal",
        createdAt: "2026-05-26T08:00:00Z" },
      { id: "01HZXDNOT01F7D3M2P5S6QWE004", userId: ID.user_alex,
        kind: "budget_alert", title: "Engineering budget at 90%",
        body: "Engineering FY26 budget is at 90% of plan with 7 months remaining.",
        subjectType: "budget", subjectId: "01HZXC0K2N4R8F7D3M2P5S6BUD2",
        actionUrl: "/budgets/01HZXC0K2N4R8F7D3M2P5S6BUD2",
        actionLabel: "Open budget",
        readAt: "2026-05-26T09:14:00Z", priority: "high",
        createdAt: "2026-05-26T07:00:00Z" },
      { id: "01HZXDNOT01F7D3M2P5S6QWE005", userId: ID.user_alex,
        kind: "invoice_dispute", title: "Invoice INV-2026-08412 disputed",
        body: "Two timesheets on this invoice exceed approved hours. Resolution required.",
        subjectType: "invoice", subjectId: "01HZXA0K2N4R8F7D3M2P5S6Q04",
        actionUrl: "/invoices/01HZXA0K2N4R8F7D3M2P5S6Q04",
        actionLabel: "Open invoice",
        readAt: "2026-05-25T15:30:00Z", priority: "high",
        createdAt: "2026-05-25T14:50:00Z" },
      { id: "01HZXDNOT01F7D3M2P5S6QWE006", userId: ID.user_alex,
        kind: "system", title: "Maintenance window: Sunday 04:00–06:00 UTC",
        body: "Planned maintenance for the US region. Mobile clocking will fail over to local cache.",
        subjectType: null, subjectId: null,
        actionUrl: "/help/incidents/2026-05-31-maintenance",
        actionLabel: "Read incident note",
        readAt: "2026-05-25T11:00:00Z", priority: "low",
        createdAt: "2026-05-24T20:00:00Z" }
    ],
    nextCursor: null,
    unreadCount: 3
  });

  /* =================================================================
     DASHBOARD
     ================================================================= */
  setExample("dash_get", {
    userId: ID.user_alex,
    tabs: [
      { id: "home", label: "Home", default: true,
        widgets: [
          { id: "open_reqs",     widgetType: "stat", title: "Open requisitions",
            pos: [0, 0, 3, 2], config: { metric: "requisitions.open" },
            data: { value: 27, delta: "+3 vs last week" } },
          { id: "fill_rate",     widgetType: "stat", title: "Fill rate (90d)",
            pos: [3, 0, 3, 2], config: { metric: "fill_rate", window: 90 },
            data: { value: 0.86, delta: "+2 pts" } },
          { id: "spend_pacing",  widgetType: "line", title: "Spend pacing FY26",
            pos: [6, 0, 6, 4], config: { metric: "spend.committed", grain: "month" } },
          { id: "submittals",    widgetType: "bar",  title: "Submittals by supplier (30d)",
            pos: [0, 2, 6, 4], config: { metric: "candidates.submitted", groupBy: "supplier", window: 30 } },
          { id: "credential_exp",widgetType: "list", title: "Credentials expiring next 30d",
            pos: [0, 6, 6, 4], config: { resource: "credentials", filter: { expiringWithinDays: 30 }, limit: 6 } },
          { id: "approvals_q",   widgetType: "list", title: "Approval queue",
            pos: [6, 4, 6, 6], config: { resource: "timesheets", filter: { status: "submitted", approver: "me" }, limit: 8 } }
        ] },
      { id: "spend", label: "Spend",
        widgets: [
          { id: "by_engtype",    widgetType: "stack", title: "Spend by EngagementType",
            pos: [0, 0, 8, 4], config: { metric: "spend.committed", groupBy: "engagementType", grain: "month" } },
          { id: "by_suptype",    widgetType: "donut", title: "Spend by SupplierType",
            pos: [8, 0, 4, 4], config: { metric: "spend.realized", groupBy: "supplierType" } },
          { id: "top_suppliers", widgetType: "table", title: "Top 10 suppliers (FY26)",
            pos: [0, 4, 12, 6], config: { resource: "suppliers", orderBy: "spend.committed:desc", limit: 10 } }
        ] }
    ],
    layoutVersion: 7, updatedAt: "2026-05-22T10:00:00Z"
  });

  setExample("dash_widgets", {
    data: [
      { id: "stat",  title: "Single number with delta",  configSchema: { metric: "string", window: "integer?" } },
      { id: "line",  title: "Line chart",                configSchema: { metric: "string", grain: "enum<day|week|month>" } },
      { id: "bar",   title: "Bar chart",                 configSchema: { metric: "string", groupBy: "string", window: "integer?" } },
      { id: "donut", title: "Donut chart",               configSchema: { metric: "string", groupBy: "string" } },
      { id: "stack", title: "Stacked area",              configSchema: { metric: "string", groupBy: "string", grain: "enum<day|week|month>" } },
      { id: "list",  title: "Compact entity list",       configSchema: { resource: "string", filter: "object?", limit: "integer" } },
      { id: "table", title: "Sortable table",            configSchema: { resource: "string", orderBy: "string", limit: "integer" } }
    ]
  });

  /* =================================================================
     LOCATIONS & JOBS
     ================================================================= */
  setExample("loc_list", {
    data: [
      { id: ID.loc_reno, name: "Reno DC-3", code: "RNO-DC3",
        timezone: "America/Los_Angeles",
        address: { line1: "1240 S Industrial Way", city: "Reno", state: "NV", postalCode: "89506", country: "US" },
        country: "US", state: "NV", postalCode: "89506",
        operatingHours: "24/7", managerId: ID.user_alex, managerName: "Alex Chen",
        workerCount: 142, openReqs: 4,
        status: "active" },
      { id: ID.loc_phoenix, name: "Phoenix DC-1", code: "PHX-DC1",
        timezone: "America/Phoenix",
        address: { line1: "440 W Buckeye Rd", city: "Phoenix", state: "AZ", postalCode: "85003", country: "US" },
        country: "US", state: "AZ", postalCode: "85003",
        operatingHours: "24/7", managerId: ID.user_alex, managerName: "Alex Chen",
        workerCount: 96, openReqs: 2,
        status: "active" },
      { id: ID.loc_chicago, name: "Chicago HQ", code: "CHI-HQ",
        timezone: "America/Chicago",
        address: { line1: "180 N Stetson Ave", city: "Chicago", state: "IL", postalCode: "60601", country: "US" },
        country: "US", state: "IL", postalCode: "60601",
        operatingHours: "08:00 – 18:00 weekdays", managerId: ID.user_priya, managerName: "Priya Aravind",
        workerCount: 38, openReqs: 3,
        status: "active" },
      { id: ID.loc_dublin, name: "Dublin clinic", code: "DUB-CL1",
        timezone: "Europe/Dublin",
        address: { line1: "12 Merrion Sq", city: "Dublin", state: null, postalCode: "D02 KX97", country: "IE" },
        country: "IE", state: null, postalCode: "D02 KX97",
        operatingHours: "07:00 – 21:00 daily", managerId: ID.user_priya, managerName: "Priya Aravind",
        workerCount: 28, openReqs: 1,
        status: "active" }
    ],
    nextCursor: null,
    totalCount: 14
  });

  setExample("loc_get", {
    id: ID.loc_reno, name: "Reno DC-3", code: "RNO-DC3",
    timezone: "America/Los_Angeles",
    address: { line1: "1240 S Industrial Way", city: "Reno", state: "NV", postalCode: "89506", country: "US" },
    coordinates: { lat: 39.4837, lng: -119.7984 },
    geofence: { kind: "radius", radiusMeters: 300 },
    operatingHours: [
      { day: "mon", windows: [{ open: "00:00", close: "23:59" }] },
      { day: "tue", windows: [{ open: "00:00", close: "23:59" }] },
      { day: "wed", windows: [{ open: "00:00", close: "23:59" }] },
      { day: "thu", windows: [{ open: "00:00", close: "23:59" }] },
      { day: "fri", windows: [{ open: "00:00", close: "23:59" }] },
      { day: "sat", windows: [{ open: "00:00", close: "23:59" }] },
      { day: "sun", windows: [{ open: "00:00", close: "23:59" }] }
    ],
    parentOrgUnitId: "01HZXOUS0001OPS00WEST00000",
    parentOrgUnitName: "Operations · West",
    taxJurisdiction: { state: "NV", county: "Washoe", localCodes: ["NV-WA-001"] },
    managers: [{ userId: ID.user_alex, name: "Alex Chen", role: "Site lead" }],
    workerCount: 142, openReqs: 4,
    status: "active",
    createdAt: "2024-08-04T09:00:00Z", updatedAt: "2026-05-26T07:00:00Z"
  });

  setExample("jobs_list", {
    data: [
      { id: ID.job_picker, title: "Warehouse picker", category: "frontline",
        code: "WP01", defaultPayRate: { amount: 22.50, currency: "USD" },
        requiredCredentials: ["safety_orientation"],
        activeRequisitions: 4, totalRequisitions: 38, status: "active" },
      { id: ID.job_forklift, title: "Forklift operator", category: "frontline",
        code: "FL01", defaultPayRate: { amount: 26.00, currency: "USD" },
        requiredCredentials: ["forklift_cert_1a", "safety_orientation"],
        activeRequisitions: 2, totalRequisitions: 14, status: "active" },
      { id: ID.job_rn, title: "Registered nurse", category: "frontline",
        code: "RN01", defaultPayRate: { amount: 52.00, currency: "USD" },
        requiredCredentials: ["rn_license", "bls_cert"],
        activeRequisitions: 3, totalRequisitions: 22, status: "active" },
      { id: ID.job_devops, title: "Senior DevOps engineer", category: "professional",
        code: "ENG-SDE-DO", defaultPayRate: null,
        payBand: { min: 80, mid: 95, max: 115, currency: "USD" },
        requiredCredentials: [],
        activeRequisitions: 1, totalRequisitions: 6, status: "active" },
      { id: ID.job_pm, title: "Project manager (Salesforce)", category: "professional",
        code: "ENG-PM-SF", defaultPayRate: null,
        payBand: { min: 75, mid: 90, max: 110, currency: "USD" },
        requiredCredentials: [],
        activeRequisitions: 1, totalRequisitions: 3, status: "active" },
      { id: ID.job_cisco, title: "Network engineer (CCNP)", category: "professional",
        code: "ENG-NET", defaultPayRate: null,
        payBand: { min: 85, mid: 100, max: 122, currency: "USD" },
        requiredCredentials: ["ccnp"],
        activeRequisitions: 0, totalRequisitions: 4, status: "active" }
    ],
    nextCursor: null,
    totalCount: 84
  });

  setExample("jobs_get", {
    id: ID.job_picker, title: "Warehouse picker", category: "frontline",
    code: "WP01", description: "Pick, pack, and stage outbound orders using RF scanner. 30 lb lift requirement.",
    defaultPayRate: { amount: 22.50, currency: "USD" },
    payBand: { min: 20, mid: 22.50, max: 26, currency: "USD" },
    requiredCredentials: [
      { type: "safety_orientation", required: true },
      { type: "forklift_cert_1a", required: false }
    ],
    descriptionTemplate: "warehouse_picker_v3",
    activeRequisitions: 4, totalRequisitions: 38,
    avgTimeToFillHours: 12.4,
    status: "active", createdAt: "2024-01-15T09:00:00Z", updatedAt: "2026-04-22T11:00:00Z"
  });

  /* =================================================================
     TEMPLATES
     ================================================================= */
  setExample("tpl_list", [
    { id: "01HZXTPL000WAREHOUSE000NIGHT", name: "Warehouse picker — overnight",
      category: "frontline", engagementType: "shift",
      jobId: ID.job_picker, locationId: ID.loc_reno,
      schedule: { rrule: "FREQ=WEEKLY;BYDAY=MO", timezone: "America/Los_Angeles" },
      paused: false, nextFireAt: "2026-06-01T05:00:00Z",
      usageCount: 124, lastUsedAt: "2026-05-19T10:02:00Z" },
    { id: "01HZXTPL001FORKLIFT00000DAY", name: "Forklift operator — day",
      category: "frontline", engagementType: "assignment",
      jobId: ID.job_forklift, locationId: ID.loc_reno,
      schedule: null, paused: false, nextFireAt: null,
      usageCount: 87, lastUsedAt: "2026-05-22T09:30:00Z" },
    { id: "01HZXTPL002RN00DUBLIN00CLINIC", name: "Registered nurse — Dublin clinic",
      category: "frontline", engagementType: "assignment",
      jobId: ID.job_rn, locationId: ID.loc_dublin,
      schedule: null, paused: false, nextFireAt: null,
      usageCount: 6, lastUsedAt: "2026-05-14T07:55:00Z" },
    { id: "01HZXTPL003DEVOPS0000CHICAGO", name: "Senior DevOps — Chicago",
      category: "professional", engagementType: "project",
      jobId: ID.job_devops, locationId: ID.loc_chicago,
      schedule: null, paused: true, nextFireAt: null,
      usageCount: 3, lastUsedAt: "2026-02-08T14:00:00Z" }
  ]);

  /* =================================================================
     TALENT POOLS
     ================================================================= */
  setExample("pool_list", {
    data: [
      { id: "01HZXPOOL01RENO00FLOATPICKER", name: "Reno · Float pickers",
        type: "rule_driven", memberCount: 38, lastRefreshAt: "2026-05-26T17:00:00Z",
        rules: { locationId: ID.loc_reno, jobIds: [ID.job_picker], credentialsAllOf: ["safety_orientation"] },
        autoRefresh: true },
      { id: "01HZXPOOL02CHI00DEVOPS00000", name: "Chicago · DevOps preferred",
        type: "manual", memberCount: 12, lastRefreshAt: "2026-05-26T17:00:00Z",
        rules: null, autoRefresh: false },
      { id: "01HZXPOOL03ENT00BENCH000ALL0", name: "Enterprise bench",
        type: "rule_driven", memberCount: 184, lastRefreshAt: "2026-05-26T17:00:00Z",
        rules: { tenureWeeksGte: 26, ratingGte: 4.5 }, autoRefresh: true }
    ],
    nextCursor: null
  });

  /* =================================================================
     DISTRIBUTION
     ================================================================= */
  setExample("dist_list", {
    data: [
      { id: "01HZXDST0001234567890ABCD1", scope: "global", scopeId: null,
        strategy: "tiered", tiers: [["t1"], ["t2"]],
        supplierTiers: { t1: [ID.sup_staffwise], t2: [ID.sup_orion] },
        tierWaitMinutes: 240, status: "active" },
      { id: "01HZXDST0001234567890ABCD2", scope: "location", scopeId: ID.loc_reno,
        strategy: "preferred", supplierIds: [ID.sup_staffwise], fallbackToParent: true,
        status: "active" },
      { id: "01HZXDST0001234567890ABCD3", scope: "orgUnit", scopeId: ID.dept_eng,
        strategy: "broadcast", supplierIds: [ID.sup_orion, ID.sup_riverbend],
        status: "active" }
    ],
    nextCursor: null
  });

  /* =================================================================
     POLICIES
     ================================================================= */
  setExample("policy_list", [
    { id: "01HZXPOL0001234567890ABCD1", name: "Standard background check",
      category: "background_check", scope: { supplierTypes: ["agency", "eor", "contractor"] },
      checks: ["criminal_7yr", "employment_3yr", "education"],
      active: true, appliedToWorkerCount: 184,
      createdAt: "2024-08-01T10:00:00Z", updatedAt: "2026-03-04T14:00:00Z" },
    { id: "01HZXPOL0001234567890ABCD2", name: "Healthcare drug screen + immunizations",
      category: "compliance", scope: { supplierTypes: ["agency", "eor"], jobCategories: ["frontline"], locationIds: [ID.loc_dublin] },
      checks: ["drug_screen_5_panel", "tb_test", "covid_vaccination"],
      active: true, appliedToWorkerCount: 28,
      createdAt: "2024-09-15T10:00:00Z", updatedAt: "2026-01-10T09:00:00Z" },
    { id: "01HZXPOL0001234567890ABCD3", name: "Contractor classification — quarterly review",
      category: "classification", scope: { supplierTypes: ["contractor"] },
      checks: ["irs_20_factor", "abc_test", "exclusivity"],
      active: true, appliedToWorkerCount: 24,
      createdAt: "2025-01-04T11:00:00Z", updatedAt: "2026-04-12T08:00:00Z" }
  ]);

  /* =================================================================
     PRICING & FUNDING
     ================================================================= */
  setExample("price_list", {
    data: [
      { id: "01HZXPRC0001RENO0PICKER00DAY", jobId: ID.job_picker, locationId: ID.loc_reno,
        shiftDifferentialId: null,
        payRate: { amount: 22.50, currency: "USD" },
        billRate: { amount: 31.75, currency: "USD" },
        markupPct: 0.41,
        effectiveStart: "2026-01-01", effectiveEnd: null, status: "active" },
      { id: "01HZXPRC0001RENO0PICKER0NIGHT", jobId: ID.job_picker, locationId: ID.loc_reno,
        shiftDifferentialId: "01HZXSHD0001NIGHT0000000000",
        payRate: { amount: 24.50, currency: "USD" },
        billRate: { amount: 34.50, currency: "USD" },
        markupPct: 0.41,
        effectiveStart: "2026-01-01", effectiveEnd: null, status: "active" },
      { id: "01HZXPRC0001CHI00DEVOPS00000", jobId: ID.job_devops, locationId: ID.loc_chicago,
        shiftDifferentialId: null,
        payRate: { amount: 92.00, currency: "USD" },
        billRate: { amount: 138.00, currency: "USD" },
        markupPct: 0.50,
        effectiveStart: "2026-05-01", effectiveEnd: null, status: "active" }
    ],
    nextCursor: null
  });

  setExample("fund_list", {
    data: [
      { supplierId: ID.sup_staffwise, paymentTermsDays: 30, currency: "USD",
        earlyPayDiscounts: [{ days: 10, discountPct: 0.02 }],
        factoringEnabled: true, factoringPartner: "PrismaCap" },
      { supplierId: ID.sup_orion,     paymentTermsDays: 45, currency: "USD",
        earlyPayDiscounts: [], factoringEnabled: false },
      { supplierId: ID.sup_globalpath,paymentTermsDays: 30, currency: "EUR",
        earlyPayDiscounts: [], factoringEnabled: false },
      { supplierId: ID.sup_riverbend, paymentTermsDays: 60, currency: "USD",
        earlyPayDiscounts: [{ days: 15, discountPct: 0.01 }], factoringEnabled: false }
    ],
    nextCursor: null
  });

  /* =================================================================
     SAVED VIEWS · ACTIVITY · FAVORITES
     ================================================================= */
  setExample("views_list", {
    data: [
      { id: "01HZXVW00012345670000ABCDE", resource: "requisitions",
        name: "Open · Reno · agency", default: true, shared: false,
        filters: { status: "open", supplierType: "agency", locationId: ID.loc_reno },
        columns: ["code", "title", "engagementType", "headcount", "headcountFilled", "primarySupplierId", "lastActivityAt"],
        sort: { field: "lastActivityAt", direction: "desc" },
        ownerId: ID.user_alex, createdAt: "2025-09-12T11:00:00Z" },
      { id: "01HZXVW00012345670000ABCDF", resource: "workers",
        name: "Float pool · active", default: false, shared: true,
        filters: { supplierType: "float", status: "active" },
        columns: ["displayName", "currentJobTitle", "locationName", "tenureWeeks", "rating"],
        sort: { field: "tenureWeeks", direction: "desc" },
        ownerId: ID.user_priya, adoptedByUserCount: 14,
        createdAt: "2025-11-08T15:00:00Z" }
    ],
    nextCursor: null
  });

  setExample("favorites_list", {
    data: [
      { id: "01HZXFAV001", resource: "requisitions", subjectId: ID.req_devops, label: "REQ-08423 · DevOps", favoritedAt: "2026-05-22T11:00:00Z" },
      { id: "01HZXFAV002", resource: "suppliers",    subjectId: ID.sup_staffwise, label: "StaffWise West", favoritedAt: "2026-04-08T08:30:00Z" },
      { id: "01HZXFAV003", resource: "workers",      subjectId: ID.wrk_sami,      label: "Sami Soto", favoritedAt: "2026-05-19T16:00:00Z" }
    ],
    nextCursor: null
  });

  setExample("activity_me", {
    data: [
      { at: "2026-05-26T17:24:08Z", action: "requisition.updated", subjectId: ID.req_picker, subjectLabel: "REQ-08421" },
      { at: "2026-05-26T16:42:11Z", action: "worker.assigned",     subjectId: ID.wrk_maya, subjectLabel: "Maya Okafor" },
      { at: "2026-05-26T15:08:00Z", action: "timesheet.approved",  subjectId: "01HZX9N1KD7H4F2R6S3P8M5V01", subjectLabel: "Timesheet · week of May 18" },
      { at: "2026-05-26T11:30:00Z", action: "candidate.advanced",  subjectId: "01HZXCND0001234567890ABCD3", subjectLabel: "Kiran Patel" }
    ],
    nextCursor: null
  });

  /* =================================================================
     INBOX METRICS · INSIGHTS
     ================================================================= */
  setExample("insights_list", {
    data: [
      { id: "01HZXINS001SPENDOVERSHOOT", title: "Engineering FY26 will overshoot plan",
        category: "spend", confidence: 0.86,
        bodyMarkdown:
          "Engineering's FY26 contingent spend is pacing 8% ahead of plan; at current velocity, " +
          "year-end will land at **$1.96M** against a plan of **$1.80M**. Two open project requisitions " +
          "(REQ-08423, REQ-08427) account for the bulk of the overshoot.",
        supportingData: { metric: "spend.committed", departmentId: ID.dept_eng, forecast: 1960000, plan: 1800000 },
        createdAt: "2026-05-26T05:00:00Z" },
      { id: "01HZXINS002SUPRISKDROP",   title: "Orion fill rate has dropped to 74%",
        category: "supplier_risk", confidence: 0.91,
        bodyMarkdown:
          "Orion Staffing's 30-day fill rate has dropped from 84% (March) to 74% (May). " +
          "Three open requisitions distributed solely to Orion (REQ-08423 included) carry " +
          "time-to-fill risk if not rebalanced.",
        supportingData: { supplierId: ID.sup_orion, fillRateTrend: [0.84, 0.81, 0.74] },
        createdAt: "2026-05-25T05:00:00Z" }
    ],
    nextCursor: null
  });

  setExample("metrics_list", {
    data: [
      { code: "spend.committed", name: "Committed spend", unit: "money",
        dimensions: ["location", "supplier", "supplierType", "engagementType", "department"], grains: ["day","week","month","quarter"] },
      { code: "spend.realized",  name: "Realized spend",  unit: "money",
        dimensions: ["location", "supplier", "supplierType", "engagementType", "department"], grains: ["day","week","month","quarter"] },
      { code: "fill_rate",       name: "Fill rate",       unit: "ratio",
        dimensions: ["location", "supplier", "job"], grains: ["day","week","month"] },
      { code: "time_to_fill",    name: "Time to fill",    unit: "hours",
        dimensions: ["location", "supplier", "engagementType"], grains: ["week","month"] },
      { code: "retention_at_90d",name: "Retention at 90 days", unit: "ratio",
        dimensions: ["supplier", "location"], grains: ["month","quarter"] },
      { code: "cost_per_hour",   name: "Cost per hour",   unit: "money",
        dimensions: ["job", "location", "supplier"], grains: ["week","month"] }
    ]
  });

  /* =================================================================
     AUDIT
     ================================================================= */
  var audit = findEp("audit_list");
  if (audit) {
    audit.responseExample = {
      data: [
        { eventId: "01HZXAUD0001REQ00000000001", at: "2026-05-26T17:24:08Z",
          actorId: ID.user_alex, actorName: "Alex Chen", actorIp: "10.20.30.40",
          action: "requisition.headcount.changed", resource: "requisition",
          subjectId: ID.req_picker, traceId: "00-d4cb1c8f-1b1a4e89-01",
          before: { headcount: 8 }, after: { headcount: 10 } },
        { eventId: "01HZXAUD0001REQ00000000002", at: "2026-05-26T16:42:11Z",
          actorId: ID.user_alex, actorName: "Alex Chen", actorIp: "10.20.30.40",
          action: "worker.assigned", resource: "worker",
          subjectId: ID.wrk_maya, traceId: "00-d4cb1c8f-1b1a4e89-02",
          before: null, after: { requisitionId: ID.req_picker } },
        { eventId: "01HZXAUD0001REQ00000000003", at: "2026-05-26T15:08:00Z",
          actorId: ID.user_alex, actorName: "Alex Chen", actorIp: "10.20.30.40",
          action: "timesheet.approved", resource: "timesheet",
          subjectId: "01HZX9N1KD7H4F2R6S3P8M5V01", traceId: "00-d4cb1c8f-1b1a4e89-03",
          before: { status: "submitted" }, after: { status: "approved" } },
        { eventId: "01HZXAUD0001REQ00000000004", at: "2026-05-26T14:00:00Z",
          actorId: "system", actorName: "System", actorIp: null,
          action: "policy.applied", resource: "worker",
          subjectId: ID.wrk_priya, traceId: "00-d4cb1c8f-1b1a4e89-04",
          before: null, after: { policyId: "01HZXPOL0001234567890ABCD1" } }
      ],
      nextCursor: null,
      totalCount: 18420
    };
  }

  /* =================================================================
     WEBHOOKS
     ================================================================= */
  setExample("hk_list", {
    data: [
      { id: "01HZXHK001REQ00LIFECYCLE", url: "https://api.dayforce.com/integrations/flexwork/hooks",
        events: ["requisition.created", "requisition.opened", "requisition.filled", "requisition.closed"],
        active: true, secretLastRotatedAt: "2026-04-01T08:00:00Z",
        lastDeliveryAt: "2026-05-26T17:24:08Z", lastDeliveryStatus: 200,
        last24hDeliveries: 142, last24hFailures: 0,
        createdAt: "2024-11-04T10:31:00Z" },
      { id: "01HZXHK002TIMESHEET00ALL0", url: "https://hooks.payroll.example/flexwork-timesheets",
        events: ["timesheet.submitted", "timesheet.approved", "timesheet.rejected", "timesheet.exported"],
        active: true, secretLastRotatedAt: "2026-02-15T08:00:00Z",
        lastDeliveryAt: "2026-05-26T15:08:00Z", lastDeliveryStatus: 200,
        last24hDeliveries: 38, last24hFailures: 1,
        createdAt: "2024-09-12T15:00:00Z" }
    ],
    nextCursor: null
  });

  setExample("hk_deliveries", {
    data: [
      { id: "01HZXHKD001LATEST",     at: "2026-05-26T17:24:08Z", event: "requisition.opened",
        statusCode: 200, latencyMs: 184, generation: 1 },
      { id: "01HZXHKD002RETRY",      at: "2026-05-26T13:00:00Z", event: "timesheet.approved",
        statusCode: 502, latencyMs: 12031, generation: 1, errorBody: "Bad gateway from upstream" },
      { id: "01HZXHKD003RETRYNOW",   at: "2026-05-26T13:01:30Z", event: "timesheet.approved",
        statusCode: 200, latencyMs: 220, generation: 2 }
    ],
    nextCursor: null
  });

  /* =================================================================
     ASYNC JOBS
     ================================================================= */
  setExample("ops_list", {
    data: [
      { id: "01HZXOPN0001234567890AUDX1", type: "audit.export", status: "completed",
        progress: 1.0, startedAt: "2026-05-26T16:00:00Z", completedAt: "2026-05-26T16:18:22Z",
        resultUrl: "https://files.dayforce.com/exports/audit-export-01HZXOPN0001234567890AUDX1.csv?sig=…",
        triggeredBy: ID.user_priya },
      { id: "01HZXOPN0002REQDIST",       type: "distribution.fanout", status: "running",
        progress: 0.42, startedAt: "2026-05-26T17:20:00Z", completedAt: null,
        triggeredBy: ID.user_alex,
        subject: { requisitionId: ID.req_devops, supplierCount: 3 } },
      { id: "01HZXOPN0003AISUM",         type: "ai.requisition_summary", status: "queued",
        progress: 0, startedAt: null, completedAt: null,
        triggeredBy: ID.user_alex }
    ],
    nextCursor: null
  });

  /* =================================================================
     TIME OFF
     ================================================================= */
  setExample("to_list", {
    data: [
      { id: "01HZXTO0001MAYA0000VACATION", workerId: ID.wrk_maya, workerName: "Maya Okafor",
        startsOn: "2026-07-06", endsOn: "2026-07-12", days: 5, hours: 40,
        category: "vacation", status: "approved", approvedBy: ID.user_alex,
        affectedShifts: 5, createdAt: "2026-05-12T09:00:00Z" },
      { id: "01HZXTO0002LUKAS00SICK0000", workerId: ID.wrk_lukas, workerName: "Lukas Kowalski",
        startsOn: "2026-05-26", endsOn: "2026-05-26", days: 1, hours: 8,
        category: "sick", status: "approved", approvedBy: ID.user_priya,
        affectedShifts: 1, createdAt: "2026-05-26T07:00:00Z" },
      { id: "01HZXTO0003PRIYA00PENDIN001", workerId: ID.wrk_priya, workerName: "Priya Menon",
        startsOn: "2026-06-15", endsOn: "2026-06-19", days: 5, hours: 40,
        category: "vacation", status: "pending", approvedBy: null,
        affectedShifts: 3, createdAt: "2026-05-25T14:00:00Z" }
    ],
    nextCursor: null
  });

  /* =================================================================
     EXPENSES
     ================================================================= */
  var expList = findEp("exp_list");
  if (expList) {
    expList.responseExample = {
      data: [
        { id: "01HZXEXP001LODGING000RENO00", workerId: ID.wrk_sami, requisitionId: ID.req_devops,
          category: "lodging", incurredOn: "2026-05-21",
          amount: { amount: 318.42, currency: "USD" }, merchant: "Aloft Hotel · Reno",
          status: "approved", approvedBy: ID.user_priya, approvedAt: "2026-05-23T11:00:00Z",
          receiptFileId: "01HZXFILE001ALOFT0000RECEIPT" },
        { id: "01HZXEXP002MEALS0000CHICAGO", workerId: ID.wrk_sami, requisitionId: ID.req_devops,
          category: "meals", incurredOn: "2026-05-20",
          amount: { amount: 64.18, currency: "USD" }, merchant: "Lou Malnati's",
          status: "submitted", approvedBy: null, approvedAt: null,
          receiptFileId: "01HZXFILE002LOUMALN00RECEIPT" },
        { id: "01HZXEXP003AIRFARE0DUBLIN00", workerId: ID.wrk_lukas, requisitionId: ID.req_rn_eor,
          category: "airfare", incurredOn: "2026-05-15",
          amount: { amount: 612.00, currency: "EUR" }, merchant: "Aer Lingus",
          status: "approved", approvedBy: ID.user_priya, approvedAt: "2026-05-16T09:00:00Z" }
      ],
      nextCursor: null,
      totalCount: 184
    };
  }

  /* =================================================================
     COMMENTS · ATTACHMENTS
     ================================================================= */
  var comments = findEp("comments_list");
  if (comments) {
    comments.responseExample = {
      data: [
        { id: "01HZXCOMMENT01REQ08421A", threadId: "thr_01HZX7K2QM4FN0R8VBSE6PA7CY",
          subjectType: "requisition", subjectId: ID.req_picker,
          authorId: ID.user_alex, authorName: "Alex Chen",
          body: "Bumped headcount to 10. Reno is seeing higher inbound from the new contract.",
          mentions: [],
          attachments: [],
          createdAt: "2026-05-26T17:24:30Z", editedAt: null },
        { id: "01HZXCOMMENT01REQ08421B", threadId: "thr_01HZX7K2QM4FN0R8VBSE6PA7CY",
          subjectType: "requisition", subjectId: ID.req_picker,
          authorId: ID.user_priya, authorName: "Priya Aravind",
          body: "@Alex Chen looks good — approved.",
          mentions: [ID.user_alex],
          attachments: [],
          createdAt: "2026-05-26T17:31:08Z", editedAt: null }
      ],
      nextCursor: null
    };
  }

  var attList = findEp("attachments_list");
  if (attList) {
    attList.responseExample = {
      data: [
        { id: "01HZXATT001REQDESC0PDF", fileId: "01HZXFILE001REQDESC00PDFFILE",
          filename: "warehouse-picker-job-desc-v3.pdf", mimeType: "application/pdf",
          sizeBytes: 184221, label: "Job description",
          uploadedBy: ID.user_alex, uploadedAt: "2026-05-20T14:08:30Z",
          url: "https://files.dayforce.com/01HZXFILE001REQDESC00PDFFILE?sig=…&exp=1748376000" },
        { id: "01HZXATT002SAFETYORIENT", fileId: "01HZXFILE002SAFETYORIENT00",
          filename: "safety-orientation-checklist.pdf", mimeType: "application/pdf",
          sizeBytes: 92110, label: "Safety orientation",
          uploadedBy: ID.user_alex, uploadedAt: "2026-05-21T09:00:00Z",
          url: "https://files.dayforce.com/01HZXFILE002SAFETYORIENT00?sig=…&exp=1748376000" }
      ],
      nextCursor: null
    };
  }

  /* =================================================================
     CONFIG · USERS · ROLES (small detail bumps)
     ================================================================= */
  var usersList = findEp("users_list");
  if (usersList) {
    usersList.responseExample = {
      data: [
        { id: ID.user_alex, name: "Alex Chen", email: "alex.chen@flexwork.example",
          role: "Manager", scope: "Operations · West",
          lastSeenAt: "2026-05-26T17:25:00Z", status: "active", invitedAt: "2024-08-04T09:00:00Z" },
        { id: ID.user_priya, name: "Priya Aravind", email: "priya.aravind@flexwork.example",
          role: "Admin", scope: "Org-wide",
          lastSeenAt: "2026-05-26T17:08:00Z", status: "active", invitedAt: "2024-01-04T09:00:00Z" },
        { id: ID.user_jordan, name: "Jordan Hsu", email: "jordan.hsu@flexwork.example",
          role: "Recruiter", scope: "Operations · West",
          lastSeenAt: "2026-05-25T15:00:00Z", status: "active", invitedAt: "2025-02-10T11:00:00Z" },
        { id: "01HZX0J0XM7R1F2N6K3L7S5VWH", name: "Tomás Núñez",
          email: "tomas.nunez@flexwork.example",
          role: "Approver", scope: "Phoenix",
          lastSeenAt: null, status: "invited", invitedAt: "2026-05-26T16:00:00Z" }
      ],
      nextCursor: null,
      totalCount: 18
    };
  }

  var rolesList = findEp("roles_list");
  if (rolesList) {
    rolesList.responseExample = {
      data: [
        { id: "role_admin",     name: "Admin",      builtIn: true,  memberCount: 4,  permissions: ["org.write", "users.write", "roles.write", "billing.write"] },
        { id: "role_manager",   name: "Manager",    builtIn: true,  memberCount: 12, permissions: ["requisitions.write", "timesheets.approve", "workers.read"] },
        { id: "role_approver",  name: "Approver",   builtIn: true,  memberCount: 8,  permissions: ["timesheets.approve", "expenses.approve"] },
        { id: "role_recruiter", name: "Recruiter",  builtIn: true,  memberCount: 6,  permissions: ["candidates.write", "requisitions.read"] },
        { id: "role_supplier",  name: "Supplier",   builtIn: true,  memberCount: 38, permissions: ["candidates.submit", "timesheets.submit"] },
        { id: "role_finance",   name: "Finance",    builtIn: false, memberCount: 3,  permissions: ["invoices.write", "budgets.write", "exports.run"] }
      ],
      nextCursor: null
    };
  }

  /* =================================================================
     ANALYTICS QUERY (metrics_query) — keep shape, add multiple rows
     ================================================================= */
  var mq = findEp("metrics_query");
  if (mq && mq.responseExample) {
    mq.responseExample = {
      metric: "spend.committed", unit: "money", currency: "USD",
      rows: [
        { engagementType: "shift",       week: "2026-05-04", value: 380200 },
        { engagementType: "assignment",  week: "2026-05-04", value: 142500 },
        { engagementType: "project",     week: "2026-05-04", value: 96000  },
        { engagementType: "sow",         week: "2026-05-04", value: 24000  },
        { engagementType: "shift",       week: "2026-05-11", value: 401800 },
        { engagementType: "assignment",  week: "2026-05-11", value: 138900 },
        { engagementType: "project",     week: "2026-05-11", value: 96000  },
        { engagementType: "sow",         week: "2026-05-11", value: 24000  },
        { engagementType: "shift",       week: "2026-05-18", value: 412800 },
        { engagementType: "assignment",  week: "2026-05-18", value: 148000 },
        { engagementType: "project",     week: "2026-05-18", value: 96000  },
        { engagementType: "sow",         week: "2026-05-18", value: 48000  }
      ]
    };
  }

  /* =================================================================
     Helper functions
     ================================================================= */
  function findEp(id) { return (spec.paths || []).find(function (p) { return p.id === id; }); }
  function setExample(id, payload) {
    var ep = findEp(id);
    if (!ep) { return; }
    ep.responseExample = payload;
  }

  if (typeof window !== "undefined" && window.console) {
    var enriched = 0;
    var thin = [];
    (spec.paths || []).forEach(function (p) {
      var r = p.responseExample;
      if (!r) return;
      var rows = r.data && Array.isArray(r.data) ? r.data : (Array.isArray(r) ? r : null);
      var rowFields = rows && rows[0] ? Object.keys(rows[0]).length : 0;
      var detailFields = !rows && typeof r === "object" ? Object.keys(r).length : 0;
      var fields = Math.max(rowFields, detailFields);
      if (fields >= 6) enriched++;
      else if (fields < 4) thin.push(p.id + "(" + fields + ")");
    });
    console.info("FW_API_SPEC ext-10: " + enriched + " endpoints carry screen-grade responseExamples.");
    if (thin.length) {
      console.info("FW_API_SPEC ext-10: " + thin.length + " endpoints still have light examples — likely action endpoints (POST :action). First few:",
        thin.slice(0, 8));
    }
  }
})();
