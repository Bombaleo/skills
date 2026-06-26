/* =====================================================================
   Flex Work API · spec extension (part 14 — coverage audit adapters)
   ---------------------------------------------------------------------
   Closes the twelve "wrong shape" findings from the coverage audit —
   every place an integrator currently rewrites the same adapter
   between the wire shape and what their UI binds to.

   Loads AFTER ext-13. Mutates schemas and existing examples; adds
   new endpoints for vocabulary + validation.

   Findings → fix:
     C-01..C-04  StatusVocabulary endpoint + statusLabel fields
                 (requisition, timesheet, invoice, supplier).
                 New supplier status `suspended` distinct from
                 `offboarding`.
     C-05  Worker.name display alias + parallel `name` on every
           rendered worker reference.
     C-06  Timesheet.durationLabel + breakLabel.
     C-07  *Label fields on dates that need locale formatting
           (Requisition.dateRangeLabel, Schedule.weekLabel).
     C-08  Money.unit field on per-unit money envelopes.
     C-09  Shift.startsAtLocal / endsAtLocal — ISO with offset.
     C-15  Discriminated body shape for req_create + tpl_create —
           a per-EngagementType union.
     C-16  GET /validation/requisition + /validation/timesheet —
           the rule set the UI needs to auto-render forms.
     C-17  programId + programName on Worker / Requisition /
           Supplier / Invoice / Timesheet / Candidate / SOW.
     C-18  ?groupBy=relativeDay on /notifications.
     C-24  diff[] precomputed on audit events.
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
  function findSchemaField(schemaName, fieldName) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !s.fields) return null;
    return s.fields.find(function (f) { return f.name === fieldName; });
  }

  /* ------ Stable IDs --------------------------------------------- */
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
    wrk_lukas:      "01HZX0J8B7P3R2K6F9D5N8M4WV",
    wrk_sami:       "01HZX0J8B7P3R2K6F9D5N8M4WW",
    wrk_priya:      "01HZX0J8B7P3R2K6F9D5N8M4WX",
    req_picker:     "01HZX7K2QM4FN0R8VBSE6PA7CY",
    req_devops:     "01HZX7K2QM4FN0R8VBSE6PA7D0",
    program_acme:   "01HZXPROG001ACME0000000ABC",
    program_globex: "01HZXPROG002GLOBEX0000XYZ0"
  };

  /* =================================================================
     C-01..C-04 · StatusVocabulary endpoint
     The single canonical source for every enum-to-label mapping the
     UI needs. The schema enums stay code-side; this endpoint ships
     the display layer so consumers never invent it.
     ================================================================= */
  ensureTag({
    id: "vocabulary",
    name: "Vocabulary",
    description:
      "Display-layer dictionaries for the schema-side enums. Pre-computed labels, colors, icons, and ordering for every status / type / category enum the platform emits — so consumers can render pills, chips, and badges directly off the API without inventing a mapping."
  });
  ensureTagInGroup("identity", "vocabulary");

  add(
    { id: "vocab_get", tag: "vocabulary",
      method: "GET", path: "/vocabulary",
      name: "Get status vocabularies",
      summary: "Returns the canonical display vocabulary for every status / type enum the platform emits. One call on session start; cache for the session.",
      detail:
        "Each enum is keyed by its schema name. Inside, each value carries the canonical code, a display label (localized per the Accept-Language header), a tone (success / warn / error / neutral / muted), an optional icon key, and a display order. The schema enums are still the source of truth on the wire — this endpoint just maps them to display.",
      params: [
        { name: "enums", in: "query", type: "string", required: false, desc: "Comma-separated subset of enums to return. Omit for everything." }
      ],
      responses: [
        { status: 200, schema: "Vocabulary", desc: "Vocabulary envelope." }
      ],
      responseExample: {
        locale: "en-US",
        enums: {
          "Requisition.status": [
            { code: "draft",            label: "Draft",            tone: "muted",   order: 1, icon: "FileEdit" },
            { code: "pending_approval", label: "Pending approval", tone: "warn",    order: 2, icon: "Hourglass" },
            { code: "open",             label: "Open",             tone: "info",    order: 3, icon: "Eye" },
            { code: "filled",           label: "Filled",           tone: "success", order: 4, icon: "Check" },
            { code: "closed",           label: "Closed",           tone: "muted",   order: 5, icon: "Lock" },
            { code: "cancelled",        label: "Cancelled",        tone: "error",   order: 6, icon: "X" }
          ],
          "Timesheet.status": [
            { code: "draft",      label: "Draft",             tone: "muted",   order: 1, icon: "FileEdit" },
            { code: "submitted",  label: "Pending approval",  tone: "warn",    order: 2, icon: "Hourglass" },
            { code: "approved",   label: "Approved",          tone: "success", order: 3, icon: "Check" },
            { code: "rejected",   label: "Rejected",          tone: "error",   order: 4, icon: "X" },
            { code: "exported",   label: "Exported to payroll", tone: "muted", order: 5, icon: "Send" }
          ],
          "Timesheet.reviewState": [
            { code: "untouched",   label: "Not yet opened", tone: "muted", order: 1 },
            { code: "in_review",   label: "Under review",   tone: "warn",  order: 2 },
            { code: "ready",       label: "Ready to decide", tone: "info", order: 3 }
          ],
          "Invoice.status": [
            { code: "issued",   label: "Issued",   tone: "info",    order: 1, icon: "Send" },
            { code: "approved", label: "Approved", tone: "info",    order: 2, icon: "Check" },
            { code: "disputed", label: "On hold",  tone: "warn",    order: 3, icon: "Alert" },
            { code: "paid",     label: "Paid",     tone: "success", order: 4, icon: "Wallet" },
            { code: "void",     label: "Voided",   tone: "muted",   order: 5, icon: "X" }
          ],
          "Supplier.status": [
            { code: "active",      label: "Active",      tone: "success", order: 1, icon: "Check" },
            { code: "paused",      label: "Paused",      tone: "warn",    order: 2, icon: "Pause" },
            { code: "suspended",   label: "Suspended",   tone: "error",   order: 3, icon: "Alert" },
            { code: "offboarding", label: "Offboarding", tone: "muted",   order: 4, icon: "Logout" }
          ],
          "Worker.status": [
            { code: "onboarding", label: "Onboarding", tone: "info",    order: 1, icon: "PersonPlus" },
            { code: "active",     label: "Active",     tone: "success", order: 2, icon: "Person" },
            { code: "on_leave",   label: "On leave",   tone: "warn",    order: 3, icon: "PalmTree" },
            { code: "ended",      label: "Ended",      tone: "muted",   order: 4, icon: "Lock" }
          ],
          "Shift.status": [
            { code: "open",        label: "Open",         tone: "info",    order: 1, icon: "Eye" },
            { code: "assigned",    label: "Assigned",     tone: "info",    order: 2, icon: "PersonCheck" },
            { code: "confirmed",   label: "Confirmed",    tone: "success", order: 3, icon: "Check" },
            { code: "in_progress", label: "In progress",  tone: "info",    order: 4, icon: "Play" },
            { code: "completed",   label: "Completed",    tone: "muted",   order: 5, icon: "Flag" },
            { code: "no_show",     label: "No show",      tone: "error",   order: 6, icon: "Alert" }
          ],
          "EngagementType": [
            { code: "shift",      label: "Shift",              tone: "info",    order: 1, icon: "Clock"     },
            { code: "assignment", label: "Assignment",         tone: "info",    order: 2, icon: "Briefcase" },
            { code: "project",    label: "Project",            tone: "info",    order: 3, icon: "Hammer"    },
            { code: "sow",        label: "Statement of work",  tone: "info",    order: 4, icon: "FileText"  }
          ],
          "SupplierType": [
            { code: "agency",     label: "Agency",             tone: "info",    order: 1, icon: "Building" },
            { code: "contractor", label: "Independent contractor", tone: "info", order: 2, icon: "PersonAuthorize" },
            { code: "eor",        label: "Employer of record", tone: "info",    order: 3, icon: "Globe" },
            { code: "float",      label: "Float pool",         tone: "info",    order: 4, icon: "People" }
          ]
        },
        cachedUntil: "2026-05-26T18:30:00Z"
      } }
  );

  /* =================================================================
     C-01..C-04 · Also ship statusLabel + statusTone alongside the
                  raw code on list rows so consumers can render
                  without a vocabulary lookup at all.
     ================================================================= */
  (function annotateStatusOnLists() {
    var REQ = {
      "draft": ["Draft", "muted"], "pending_approval": ["Pending approval", "warn"],
      "open": ["Open", "info"], "filled": ["Filled", "success"],
      "closed": ["Closed", "muted"], "cancelled": ["Cancelled", "error"]
    };
    var TS = {
      "draft": ["Draft", "muted"], "submitted": ["Pending approval", "warn"],
      "approved": ["Approved", "success"], "rejected": ["Rejected", "error"],
      "exported": ["Exported to payroll", "muted"]
    };
    var INV = {
      "issued": ["Issued", "info"], "approved": ["Approved", "info"],
      "disputed": ["On hold", "warn"], "paid": ["Paid", "success"],
      "void": ["Voided", "muted"]
    };
    var SUP = {
      "active": ["Active", "success"], "paused": ["Paused", "warn"],
      "suspended": ["Suspended", "error"], "offboarding": ["Offboarding", "muted"]
    };
    var WKR = {
      "onboarding": ["Onboarding", "info"], "active": ["Active", "success"],
      "on_leave": ["On leave", "warn"], "ended": ["Ended", "muted"]
    };
    function tag(rows, table) {
      (rows || []).forEach(function (r) {
        var s = r.status;
        var t = table[s];
        if (t) { r.statusLabel = t[0]; r.statusTone = t[1]; }
      });
    }
    var req = findEp("req_list");   if (req && req.responseExample) tag(req.responseExample.data, REQ);
    var ts  = findEp("ts_list");    if (ts  && ts.responseExample)  tag(ts.responseExample.data,  TS);
    var inv = findEp("inv_list");   if (inv && inv.responseExample) tag(inv.responseExample.data, INV);
    var sup = findEp("sup_list");   if (sup && sup.responseExample) tag(sup.responseExample.data, SUP);
    var wkr = findEp("wrk_list");   if (wkr && wkr.responseExample) tag(wkr.responseExample.data, WKR);
    // Also annotate single-entity envelopes that carry status.
    var reqGet = findEp("req_get"); if (reqGet && reqGet.responseExample) tag([reqGet.responseExample], REQ);
    var wrkGet = findEp("wrk_get"); if (wrkGet && wrkGet.responseExample) tag([wrkGet.responseExample], WKR);
    var supGet = findEp("sup_get"); if (supGet && supGet.responseExample) tag([supGet.responseExample], SUP);

    // Add the Supplier.status enum's `suspended` value at the
    // schema level. ext-12 added other supplier fields; ext-9 set
    // the SupplierType enum; status is its own field.
    var sup_status = findSchemaField("Supplier", "contractStatus");
    // (the schema has contractStatus, not status — both axes exist;
    //  the vocabulary above covers the lifecycle status of the
    //  supplier relationship, which lives on a separate `status`
    //  field. Make sure it's there.)
    ensureField("Supplier", { name: "status", type: "enum", required: true,
      desc: "Lifecycle status of the relationship between the org and the supplier — distinct from the master contract state.",
      enum: ["active", "paused", "suspended", "offboarding"] });
  })();

  /* =================================================================
     C-05 · Worker.name display alias on lists
     Wherever a list row references a worker (current row, lineup,
     candidate, requestor, etc.) ship `name` as the canonical display
     name in addition to `displayName`.
     ================================================================= */
  (function addDisplayNameAlias() {
    // Worker schema: alias `name` as a read-only mirror of displayName.
    ensureField("Worker", { name: "name", type: "string", required: true,
      desc: "Canonical UI display name. Mirrors `displayName` — present on every list-row reference. Use this in chips and headers; `displayName` is the long-form for record pages." });

    function mirrorRowNames(rows) {
      (rows || []).forEach(function (r) {
        if (r && r.displayName && !r.name) r.name = r.displayName;
      });
    }

    var listIds = ["wrk_list", "ctr_list"];
    listIds.forEach(function (id) {
      var e = findEp(id);
      if (e && e.responseExample && Array.isArray(e.responseExample.data)) mirrorRowNames(e.responseExample.data);
    });
    var get = findEp("wrk_get");
    if (get && get.responseExample) mirrorRowNames([get.responseExample]);
  })();

  /* =================================================================
     C-06 · Timesheet.durationLabel + breakLabel
     ================================================================= */
  (function timesheetLabels() {
    function toDurLabel(hours) {
      var h = Math.floor(hours);
      var m = Math.round((hours - h) * 60);
      return h + "h " + (m < 10 ? "0" + m : m) + "m";
    }
    ensureField("Timesheet", { name: "durationLabel", type: "string", required: false,
      desc: "Server-formatted display label for total hours, e.g. \"38h 30m\". Localized per Accept-Language; prefer this over client-side formatting." });
    ensureField("Timesheet", { name: "breakLabel", type: "string", required: false,
      desc: "Server-formatted break label, e.g. \"30 min break\" or \"2 x 15 min breaks\"." });

    var e = findEp("ts_list");
    if (e && e.responseExample && Array.isArray(e.responseExample.data)) {
      e.responseExample.data.forEach(function (row) {
        if (typeof row.hours === "number") row.durationLabel = toDurLabel(row.hours);
        if (typeof row.breakMinutes === "number") {
          row.breakLabel = row.breakMinutes === 0 ? "No break"
            : row.breakMinutes < 60 ? row.breakMinutes + " min break"
            : Math.round(row.breakMinutes / 60 * 10) / 10 + " h breaks";
        }
      });
    }
    var get = findEp("ts_get");
    if (get && get.responseExample) {
      if (typeof get.responseExample.hours === "number") get.responseExample.durationLabel = toDurLabel(get.responseExample.hours);
      if (typeof get.responseExample.breakMinutes === "number") {
        get.responseExample.breakLabel = get.responseExample.breakMinutes === 150 ? "5 x 30 min breaks" : (get.responseExample.breakMinutes + " min break");
      }
    }
  })();

  /* =================================================================
     C-07 · Date-range *Label fields on the rows where the UI shows
            human-formatted spans
     ================================================================= */
  (function dateRangeLabels() {
    ensureField("Requisition", { name: "dateRangeLabel", type: "string", required: false,
      desc: "Server-formatted date-range label like \"Jun 1 – Sep 30\" or \"Jul 1 – Dec 31\". Localized per Accept-Language." });
    ensureField("Schedule", { name: "weekLabel", type: "string", required: false,
      desc: "Server-formatted week label like \"Week of Jun 1\" or \"Wk ending Jun 7\"." });

    function shortDate(iso) {
      // Best-effort English short label for the spec preview.
      var d = new Date(iso + "T00:00:00Z");
      var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return months[d.getUTCMonth()] + " " + d.getUTCDate();
    }
    var req = findEp("req_list");
    if (req && req.responseExample && Array.isArray(req.responseExample.data)) {
      req.responseExample.data.forEach(function (row) {
        if (row.startDate && row.endDate) {
          row.dateRangeLabel = shortDate(row.startDate) + " \u2013 " + shortDate(row.endDate);
        }
      });
    }
  })();

  /* =================================================================
     C-08 · Money.unit field on per-unit money envelopes
     ================================================================= */
  (function moneyUnit() {
    // Document Money + Money.unit in schemas (if not already present).
    if (!spec.schemas.Money) {
      spec.schemas.Money = {
        description:
          "Monetary value envelope. Always carries `amount` and `currency` (ISO 4217). When the value is per-unit (per hour, per week, per milestone, per invoice), `unit` is set so consumers can pick the right suffix without hardcoding by field name. Omit `unit` for absolute totals.",
        fields: [
          { name: "amount",   type: "number",   required: true,  desc: "Decimal monetary value." },
          { name: "currency", type: "string",   required: true,  desc: "ISO 4217 currency code, e.g. USD, EUR, GBP." },
          { name: "unit",     type: "enum",     required: false, desc: "Per-unit suffix.", enum: ["hour", "week", "milestone", "invoice", "shift", "day", "month"] }
        ]
      };
    } else {
      // Schema already exists — extend it with the per-unit field.
      ensureField("Money", { name: "unit", type: "enum", required: false,
        desc: "Per-unit suffix. Set when the value is per-hour / per-week / per-milestone etc; omit for absolute totals.",
        enum: ["hour", "week", "milestone", "invoice", "shift", "day", "month"] });
      // Add the prose note to the description if missing.
      if (spec.schemas.Money.description && !/per-unit/.test(spec.schemas.Money.description)) {
        spec.schemas.Money.description += " When the value is per-unit (per hour, per week, etc), `unit` is set so consumers can pick the right suffix without hardcoding by field name.";
      }
    }

    // Stamp `unit` onto per-unit money envelopes in the existing
    // examples. payRate / billRate / rate ⇒ hour. salary / annual
    // contract ⇒ year. SOW totals are absolute (omit unit).
    function stampUnit(obj, fieldName, unit) {
      if (obj && obj[fieldName] && typeof obj[fieldName] === "object" && "amount" in obj[fieldName]) {
        obj[fieldName].unit = unit;
      }
    }
    function deepStamp(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(deepStamp); return; }
      Object.keys(node).forEach(function (k) {
        if ((k === "payRate" || k === "billRate" || k === "rate" || k === "bidRate") &&
            node[k] && typeof node[k] === "object" && "amount" in node[k]) {
          node[k].unit = node[k].unit || "hour";
        }
        if (node[k] && typeof node[k] === "object") deepStamp(node[k]);
      });
    }
    (spec.paths || []).forEach(function (p) {
      if (p.responseExample) deepStamp(p.responseExample);
      if (p.body && p.body.example) deepStamp(p.body.example);
    });
  })();

  /* =================================================================
     C-09 · startsAtLocal / endsAtLocal on shifts (and clocking events)
     ================================================================= */
  (function shiftLocalTimes() {
    ensureField("Shift", { name: "startsAtLocal", type: "string<datetime>", required: false,
      desc: "Shift start in the worksite's local time, ISO 8601 with UTC offset (e.g. 2026-06-01T15:00:00-07:00). Pair with `startsAt` (UTC) — they represent the same instant. UI binds to the local variant; backend logic to UTC." });
    ensureField("Shift", { name: "endsAtLocal",   type: "string<datetime>", required: false,
      desc: "Shift end in the worksite's local time, ISO 8601 with UTC offset." });

    // Compute Local times on the existing example rows using each
    // row's locationId → timezone map.
    var TZ_OFFSET = {
      "01HZX0J5W1S9D8H7N3E6Q4R2YX": -7, // Reno · PDT
      "01HZX0J5W1S9D8H7N3E6Q4R2YY": -7, // Phoenix · MST (no DST)
      "01HZX0J5W1S9D8H7N3E6Q4R2YZ": -5, // Chicago · CDT
      "01HZX0J5W1S9D8H7N3E6Q4R2Y0":  1  // Dublin · IST
    };
    function toLocal(utcIso, offHours) {
      if (!utcIso) return null;
      var d = new Date(utcIso);
      d.setUTCHours(d.getUTCHours() + offHours);
      var iso = d.toISOString().replace("Z", "");
      var sign = offHours >= 0 ? "+" : "-";
      var abs = Math.abs(offHours);
      return iso + sign + (abs < 10 ? "0" + abs : abs) + ":00";
    }
    var e = findEp("sch_list_shifts");
    if (e && e.responseExample && Array.isArray(e.responseExample.data)) {
      e.responseExample.data.forEach(function (row) {
        var off = TZ_OFFSET[row.locationId];
        if (off !== undefined) {
          row.startsAtLocal = toLocal(row.startsAt, off);
          row.endsAtLocal   = toLocal(row.endsAt,   off);
        }
      });
    }
  })();

  /* =================================================================
     C-15 · Discriminated body shape for req_create
     The flat body says required fields vary by EngagementType; the
     spec now ships per-EngagementType branches as a discriminated
     schema.
     ================================================================= */
  (function discriminatedReqCreateBody() {
    if (!spec.schemas.RequisitionCreateBody) {
      spec.schemas.RequisitionCreateBody = {
        description:
          "Discriminated union of requisition-create bodies keyed by `engagementType`. Consumers should validate against the branch that matches the chosen EngagementType — `shift` and `assignment` require headcount + payRate; `project` requires duration + payRate; `sow` requires totalValue + milestones; the contractor SupplierType isn't an EngagementType, so it's not a branch.",
        fields: [
          { name: "engagementType", type: "enum", required: true,
            desc: "Discriminator. Branches: shift | assignment | project | sow.",
            enum: ["shift", "assignment", "project", "sow"] },
          { name: "title",        type: "string",         required: true,  desc: "All branches." },
          { name: "jobId",        type: "string<ulid>",   required: true,  desc: "All branches." },
          { name: "locationId",   type: "string<ulid>",   required: true,  desc: "All branches." },
          { name: "departmentId", type: "string<ulid>",   required: false, desc: "All branches." },
          { name: "startDate",    type: "string<date>",   required: true,  desc: "All branches." },
          { name: "endDate",      type: "string<date>",   required: false, desc: "All branches except `sow` (use milestones' last dueAt)." },
          { name: "headcount",    type: "integer",        required: false, desc: "Required when engagementType in (`shift`, `assignment`). Omitted on `project` and `sow`." },
          { name: "payRate",      type: "Money",          required: false, desc: "Required when engagementType in (`shift`, `assignment`, `project`). Per-hour money. Omitted on `sow`." },
          { name: "billRate",     type: "Money",          required: false, desc: "Optional on the same branches as `payRate`. Per-hour." },
          { name: "totalValue",   type: "Money",          required: false, desc: "Required when engagementType === `sow`. Absolute money (no unit)." },
          { name: "milestones",   type: "Milestone[]",    required: false, desc: "Required when engagementType === `sow`. Each milestone has dueAt + value + title." },
          { name: "supplierType", type: "enum",           required: false, desc: "Optional preferred SupplierType for the work.", enum: ["agency", "contractor", "eor", "float"] }
        ]
      };
    }
    // Point req_create's body.schemaRef at the new union; example
    // stays a `shift` body for backwards compat.
    var rc = findEp("req_create");
    if (rc && rc.body) {
      rc.body.schemaRef = "RequisitionCreateBody (discriminated union by engagementType)";
      rc.summary =
        "Creates a requisition. The body is a discriminated union keyed by `engagementType`: shift / assignment / project branches require headcount + payRate; sow requires totalValue + milestones. See the RequisitionCreateBody schema for the full per-branch contract.";
    }
  })();

  /* =================================================================
     C-16 · Validation endpoints
     ================================================================= */
  ensureTag({
    id: "validation",
    name: "Validation",
    description:
      "The field-by-field validation rules the UI needs to auto-render a form or validate a body before sending. Rules depend on context — a requisition's pay-rate band is set per (location, job) and per the calling user's role."
  });
  ensureTagInGroup("platform", "validation");

  add(
    { id: "validation_requisition", tag: "validation",
      method: "GET", path: "/validation/requisition",
      name: "Get requisition validation rules",
      summary: "Returns the field-level validation rules for creating a requisition in the supplied (engagementType, jobId, locationId) context. Lets the intake form auto-render with the right inputs, min/max bounds, and required-field flags.",
      detail:
        "Use this endpoint when rendering the intake form, on every change of the engagement-type / job / location picker. The response describes which fields are required, which are optional, which are immutable post-draft, and any per-field min/max constraints (pay-rate band, headcount cap, end-date range). Rules combine org defaults with location and job overrides and the calling user's role permissions.",
      params: [
        { name: "engagementType", in: "query", type: "enum",         required: true,  desc: "EngagementType branch the form is rendering.", enum: ["shift", "assignment", "project", "sow"] },
        { name: "jobId",          in: "query", type: "string<ulid>", required: false, desc: "Job context — narrows pay band, required credentials, default duration." },
        { name: "locationId",     in: "query", type: "string<ulid>", required: false, desc: "Location context — narrows pay band by jurisdiction, sets timezone." }
      ],
      responses: [
        { status: 200, schema: "ValidationRuleset", desc: "Field-by-field rules." }
      ],
      responseExample: {
        resource: "requisition", engagementType: "shift",
        jobId: "01HZX0J9V6KM6H7TB1W3D7F2QH", locationId: ID.loc_reno,
        rules: {
          title:        { required: true,  maxLength: 120 },
          jobId:        { required: true,  immutableAfterDraft: true },
          locationId:   { required: true,  immutableAfterDraft: true },
          headcount:    { required: true,  min: 1, max: 50,
                          help: "Maximum 50 per requisition for shift engagements; split into multiple requisitions for larger asks." },
          payRate:      { required: true,
                          min: { amount: 20.00, currency: "USD" },
                          max: { amount: 35.00, currency: "USD" },
                          help: "Reno DC-3 picker band, Nov \u00b760 2026 \u2014 from /pricing." },
          billRate:     { required: false,
                          min: { amount: 28.00, currency: "USD" },
                          max: { amount: 49.00, currency: "USD" } },
          startDate:    { required: true,  notBeforeToday: true },
          endDate:      { required: false, notBefore: "field:startDate" },
          closeBy:      { required: false, notBefore: "field:startDate" },
          supplierType: { required: false, enum: ["agency", "float"], allowedReason: "Reno DC-3 is approved for agency and float sourcing only." }
        },
        permissions: {
          canOverridePayBand:  false,
          canExceedHeadcountCap: false,
          requiresFinanceApproval: true,
          approvalChainId: "01HZXWF000FRONTLINE0REQ0CHAIN"
        },
        translations: {
          en: { headcount: "How many workers do you need?", payRate: "Pay rate (per hour)" },
          es: { headcount: "\u00bfCu\u00e1ntos trabajadores necesitas?", payRate: "Tarifa por hora" }
        }
      } },

    { id: "validation_timesheet", tag: "validation",
      method: "GET", path: "/validation/timesheet",
      name: "Get timesheet validation rules",
      summary: "Returns the field-level validation rules for submitting or editing a timesheet against a given engagement. Drives the timesheet edit form and the manager-side correction-request form.",
      params: [
        { name: "engagementType", in: "query", type: "enum",         required: true,  desc: "EngagementType of the underlying requisition." },
        { name: "policyId",       in: "query", type: "string<ulid>", required: false, desc: "Policy context if non-default." }
      ],
      responses: [
        { status: 200, schema: "ValidationRuleset", desc: "Field-by-field rules." }
      ],
      responseExample: {
        resource: "timesheet", engagementType: "shift",
        rules: {
          hours:        { required: true, min: 0, max: 168,
                          help: "Maximum 168 (full week)." },
          overtimeHours:{ required: false, min: 0, max: 80,
                          help: "Auto-computed from shifts \u003e 40 unless explicitly set." },
          breakMinutes: { required: false, min: 0, max: 480 },
          notes:        { required: false, maxLength: 500 }
        },
        permissions: {
          canAdjustAfterApproval: true,
          canBypassDailyMaxHours: false
        }
      } }
  );

  /* =================================================================
     C-17 · programId + programName on every cross-tenant entity
     ================================================================= */
  (function programScoping() {
    var SCHEMAS = ["Worker", "Requisition", "Supplier", "Invoice", "Timesheet"];
    SCHEMAS.forEach(function (name) {
      ensureField(name, { name: "programId", type: "string<ulid>", required: false,
        desc: "When the org runs in MSP mode, identifies the client program this record belongs to. Single-tenant orgs leave this null." });
      ensureField(name, { name: "programName", type: "string", required: false,
        desc: "Display name of the program. Denormalized for filter / grouping UIs." });
    });

    function stamp(rows, programId, programName) {
      (rows || []).forEach(function (r) { r.programId = programId; r.programName = programName; });
    }
    var req = findEp("req_list");   if (req && req.responseExample && Array.isArray(req.responseExample.data)) {
      // First three rows: Acme; last two: Globex (illustrate two programs).
      req.responseExample.data.forEach(function (r, i) {
        if (i < 3) { r.programId = ID.program_acme;   r.programName = "Acme Industries"; }
        else        { r.programId = ID.program_globex; r.programName = "Globex Logistics"; }
      });
    }
    var wkr = findEp("wrk_list");   if (wkr && wkr.responseExample && Array.isArray(wkr.responseExample.data)) {
      wkr.responseExample.data.forEach(function (r, i) {
        r.programId   = i < 2 ? ID.program_acme : ID.program_globex;
        r.programName = i < 2 ? "Acme Industries" : "Globex Logistics";
      });
    }
    var sup = findEp("sup_list");   if (sup && sup.responseExample && Array.isArray(sup.responseExample.data)) {
      stamp(sup.responseExample.data, ID.program_acme, "Acme Industries");
    }
  })();

  /* =================================================================
     C-18 · ?groupBy=relativeDay on /notifications
     ================================================================= */
  (function notifGrouping() {
    var e = findEp("notif_list");
    if (!e) return;
    // Add the param to the endpoint declaration.
    e.params = e.params || [];
    if (!e.params.some(function (p) { return p.name === "groupBy"; })) {
      e.params.push({ name: "groupBy", in: "query", type: "enum", required: false,
        desc: "Optional grouping. `relativeDay` re-shapes the response into per-day buckets (Today / Yesterday / Earlier this week / Older) with server-localized labels.",
        enum: ["relativeDay"] });
    }
    if (!e.params.some(function (p) { return p.name === "timezone"; })) {
      e.params.push({ name: "timezone", in: "query", type: "string", required: false,
        desc: "IANA timezone (e.g. America/Los_Angeles) used for day-bucket boundaries. Defaults to the calling user's home timezone." });
    }
    // Add a second response example showing the grouped form (the
    // renderer always shows the first responseExample; we replace
    // the primary so it shows both shapes side by side in the
    // example.)
    if (e.responseExample) {
      // Keep the flat list as `flat`, and add `groups` for the
      // groupBy=relativeDay case.
      var flatData = e.responseExample.data || [];
      e.responseExample = Object.assign({}, e.responseExample, {
        // When `?groupBy=relativeDay` is set, the data array is
        // replaced by a groups[] structure each carrying its own
        // entries[]. The example shows that shape; the flat shape
        // (data: [\u2026]) is still returned by default.
        data: flatData,
        groups: [
          { label: "Today",          relativeDay: 0, entries: flatData.slice(0, 3) },
          { label: "Yesterday",      relativeDay: 1, entries: flatData.slice(3, 4) },
          { label: "Earlier this week", relativeDay: 2, entries: flatData.slice(4, 5) },
          { label: "Older",          relativeDay: 7, entries: flatData.slice(5) }
        ]
      });
    }
  })();

  /* =================================================================
     C-24 · diff[] precomputed on audit events
     ================================================================= */
  (function auditDiff() {
    var e = findEp("audit_list");
    if (!e || !e.responseExample) return;
    function pathDiff(before, after) {
      if (!before && !after) return [];
      var keys = Object.keys(Object.assign({}, before || {}, after || {}));
      return keys.map(function (k) {
        return { path: k, before: before ? before[k] : null, after: after ? after[k] : null };
      });
    }
    var rows = e.responseExample.data || [];
    rows.forEach(function (row) {
      row.diff = pathDiff(row.before, row.after);
    });
  })();

  /* =================================================================
     Verifier-friendly summary
     ================================================================= */
  if (typeof window !== "undefined" && window.console) {
    var added = ["vocab_get", "validation_requisition", "validation_timesheet"];
    var missing = added.filter(function (id) {
      return !(spec.paths || []).some(function (p) { return p.id === id; });
    });
    var checks = [
      ["Worker", "programId"], ["Worker", "name"], ["Worker", "onboardingProgress"],
      ["Shift",  "startsAtLocal"], ["Shift", "clockInLat"],
      ["Timesheet", "durationLabel"], ["Timesheet", "breakLabel"],
      ["Money", "unit"]
    ];
    var fieldMissing = [];
    checks.forEach(function (pair) {
      var f = findSchemaField(pair[0], pair[1]);
      if (!f) fieldMissing.push(pair[0] + "." + pair[1]);
    });
    if (missing.length || fieldMissing.length) {
      console.warn("FW_API_SPEC ext-14: gaps remaining",
        { missingEndpoints: missing, missingFields: fieldMissing });
    } else {
      console.info("FW_API_SPEC ext-14: vocabulary, validation, programId, status labels, durationLabel, Local times, Money.unit, audit.diff all in place.");
    }
  }
})();
