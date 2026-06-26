/* =====================================================================
   Flex Work API · spec extension (part 9 — taxonomy normalization)
   ---------------------------------------------------------------------
   Closes every finding from Flex Work API Taxonomy Audit.html AND
   re-aligns the reference to the project's canonical taxonomy.

   Loads LAST (after ext-7's first attempt at the engagementType
   collapse and ext-8's per-endpoint detail prose). Mutates spec
   in place; never creates new endpoints.

   Canonical vocabulary after this patch (one term per axis, used
   everywhere — schemas, params, bodies, examples, configs, tag copy):

     EngagementType   shift · assignment · project · sow
                      ("the shape of the work" — four values, snake-case
                      short forms. ext-7 had prefixed these with
                      frontline_ / professional_; we revert that — the
                      worker's pay model decides the shape, the supplier
                      decides who provides them.)

     SupplierType     agency · contractor · eor · float
                      ("who provides the worker". "contractor" replaces
                      the legacy "independent" label; "float" is the
                      internal float-pool supplier — for workers the org
                      itself provides without an external party. The
                      legacy "sow_vendor" is gone — SOW is an
                      EngagementType, the supplier on a SOW is whichever
                      of the four SupplierType values applies.)

     WorkerType       frontline · professional · contractor · sow
                      (org-level worker classification — drives cadence,
                      document defaults, tax treatment. "sow_resource"
                      renamed to "sow" for consistency.)

     JobCategory      frontline · professional
                      (which side of the catalog a role lives in. The
                      coincidence with the WorkerType names is real but
                      they answer different questions.)

   The legacy sourcingChannel field is gone from every surface —
   schemas, query params, request bodies, response examples.

   Findings → file mapping:
     F-01 req_list engagementType param enum ........ canonical 4
     F-02 req_list sourcingChannel param ............ dropped
     F-03 wrk_list engagementType param enum ........ canonical 4
     F-04 Worker.sourcingChannel field .............. dropped (Worker
                                                      gains supplierType
                                                      instead)
     F-05 tpl_create body schema + example .......... rebuilt
     F-06 cfg_engtypes_get / set examples ........... canonical 4 keys
     F-07 org_settings_get / update examples ........ canonical arrays
     F-08 supplier-types config (+ Supplier.type) ... canonical 4
     F-09 Requisitions / Workers / Suppliers tag copy rewritten
     F-10 Sweep every example / responseExample ..... value-walk
     F-11 Policy.scope.workerTypes → supplierTypes .. field + example
     F-12 worker-type config: sow_resource → sow .... renamed key
     F-13 ctr_list summary + example ................ supplierType
                                                      discriminator
     F-14 Taxonomy info page ........................ skipped — every
                                                      page speaks one
                                                      vocabulary
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  /* ------ Canonical enums ------------------------------------------ */
  var ENGAGEMENT_TYPE = ["shift", "assignment", "project", "sow"];
  var SUPPLIER_TYPE   = ["agency", "contractor", "eor", "float"];
  var WORKER_TYPE     = ["frontline", "professional", "contractor", "sow"];
  var JOB_CATEGORY    = ["frontline", "professional"];

  // Old value → canonical value, applied wherever a stale string
  // shows up inside example / responseExample payloads.
  var ENG_REMAP = {
    "statementOfWork":      "sow",
    "frontline_shift":      "shift",
    "frontline_assignment": "assignment",
    "professional_project": "project",
    // ext-7 briefly added "contractor" to EngagementType; we revert it
    // back to a supplier-side concept and map any straggling example
    // rows to an assignment.
    "contractor":           "assignment"
  };
  var SUP_REMAP = {
    // Legacy sourcingChannel / supplier-type values → canonical
    // SupplierType.
    "independent": "contractor",
    "sow_vendor":  "agency", // SOW vendors fold into agency by default;
                              // SOW is the engagement, not the supplier
    "sow":         "agency", // pre-collapse Supplier.type sometimes
                              // carried "sow" — same fallback.
    "frontline":   "float"   // legacy sourcingChannel "frontline"
                              // (internal pool) → SupplierType float.
    // agency, contractor, eor, float pass through unchanged.
  };

  /* ------ Helpers --------------------------------------------------- */
  function findEp(id) {
    return (spec.paths || []).find(function (p) { return p.id === id; });
  }
  function findParam(ep, name) {
    return ep && ep.params ? ep.params.find(function (p) { return p.name === name; }) : null;
  }
  function dropParam(ep, name) {
    if (!ep || !ep.params) return;
    ep.params = ep.params.filter(function (p) { return p.name !== name; });
  }
  function findBodyField(ep, name) {
    if (!ep || !ep.body || !Array.isArray(ep.body.schema)) return null;
    return ep.body.schema.find(function (f) { return f.name === name; });
  }
  function dropBodyField(ep, name) {
    if (!ep || !ep.body || !Array.isArray(ep.body.schema)) return;
    ep.body.schema = ep.body.schema.filter(function (f) { return f.name !== name; });
  }
  function findSchemaField(schemaName, fieldName) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !s.fields) return null;
    return s.fields.find(function (f) { return f.name === fieldName; });
  }
  function dropSchemaField(schemaName, fieldName) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !s.fields) return;
    s.fields = s.fields.filter(function (f) { return f.name !== fieldName; });
  }
  function ensureSchemaFieldAfter(schemaName, afterName, field) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !Array.isArray(s.fields)) return;
    if (s.fields.some(function (f) { return f.name === field.name; })) return;
    var idx = s.fields.findIndex(function (f) { return f.name === afterName; });
    if (idx < 0) { s.fields.push(field); return; }
    s.fields.splice(idx + 1, 0, field);
  }

  // Deep walk of example payloads:
  //   - delete any sourcingChannel key
  //   - remap engagementType values through ENG_REMAP
  //   - remap supplierType values through SUP_REMAP
  //   - remap engagementTypes / supplierTypes array values
  function scrubExamples(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(scrubExamples); return; }
    Object.keys(node).forEach(function (k) {
      var v = node[k];
      if (k === "sourcingChannel") { delete node[k]; return; }
      if (k === "engagementType" && typeof v === "string") {
        if (ENG_REMAP[v]) node[k] = ENG_REMAP[v];
        return;
      }
      if (k === "supplierType" && typeof v === "string") {
        if (SUP_REMAP[v]) node[k] = SUP_REMAP[v];
        return;
      }
      if (k === "engagementTypes" && Array.isArray(v)) {
        node[k] = v.map(function (x) { return typeof x === "string" && ENG_REMAP[x] ? ENG_REMAP[x] : x; });
        return;
      }
      if (k === "supplierTypes" && Array.isArray(v)) {
        node[k] = v.map(function (x) { return typeof x === "string" && SUP_REMAP[x] ? SUP_REMAP[x] : x; });
        return;
      }
      if (v && typeof v === "object") scrubExamples(v);
    });
  }

  /* =================================================================
     F-01 — GET /requisitions engagementType param enum
     ================================================================= */
  (function () {
    var ep = findEp("req_list");
    if (!ep) return;
    var p = findParam(ep, "engagementType");
    if (p) {
      p.enum = ENGAGEMENT_TYPE.slice();
      p.desc = "Filter by canonical EngagementType — shift, assignment, project, sow.";
    }
    // Also offer a SupplierType filter, since req_list previously
    // composed engagementType × sourcingChannel and we just dropped
    // half of that.
    if (!findParam(ep, "supplierType")) {
      var sup = { name: "supplierType", in: "query", type: "enum", required: false,
        desc: "Filter by SupplierType — the supplier organization's business form.",
        enum: SUPPLIER_TYPE.slice() };
      // Insert it adjacent to engagementType for symmetry.
      var idx = ep.params.findIndex(function (q) { return q.name === "engagementType"; });
      if (idx < 0) ep.params.push(sup); else ep.params.splice(idx + 1, 0, sup);
    }
  })();

  /* =================================================================
     F-02 — GET /requisitions sourcingChannel filter
     ================================================================= */
  (function () {
    var ep = findEp("req_list");
    if (ep) dropParam(ep, "sourcingChannel");
  })();

  /* =================================================================
     F-03 — GET /workers engagementType param enum + add supplierType
     ================================================================= */
  (function () {
    var ep = findEp("wrk_list");
    if (!ep) return;
    var p = findParam(ep, "engagementType");
    if (p) {
      p.enum = ENGAGEMENT_TYPE.slice();
      p.desc = "Filter by canonical EngagementType — same enum as on Requisition.";
    }
    dropParam(ep, "sourcingChannel");
    // Replacement filter: supplierType.
    if (!findParam(ep, "supplierType")) {
      var sup = { name: "supplierType", in: "query", type: "enum", required: false,
        desc: "Filter by SupplierType — agency, contractor, eor, float.",
        enum: SUPPLIER_TYPE.slice() };
      var idx = ep.params.findIndex(function (q) { return q.name === "engagementType"; });
      if (idx < 0) ep.params.push(sup); else ep.params.splice(idx + 1, 0, sup);
    }
  })();

  /* =================================================================
     F-04 — Worker schema: drop sourcingChannel, add supplierType,
            re-key engagementType to canonical enum.
     ================================================================= */
  (function () {
    dropSchemaField("Worker", "sourcingChannel");

    var et = findSchemaField("Worker", "engagementType");
    if (et) {
      et.enum = ENGAGEMENT_TYPE.slice();
      et.desc = "Canonical EngagementType — the shape of work this worker is currently engaged in.";
    }
    // Add a denormalized supplierType to Worker so callers can filter
    // /workers by SupplierType without a join. Stays in sync with
    // Supplier.type on the supplier referenced by supplierId.
    ensureSchemaFieldAfter("Worker", "supplierId", {
      name: "supplierType", type: "enum", required: false,
      desc: "Denormalized SupplierType from the worker's supplier (or `float` for direct/internal workers).",
      enum: SUPPLIER_TYPE.slice()
    });

    var ret = findSchemaField("Requisition", "engagementType");
    if (ret) {
      ret.enum = ENGAGEMENT_TYPE.slice();
      ret.desc = "Canonical EngagementType — shift, assignment, project, sow.";
    }
    // Update the supplierId description to mention SupplierType.
    var sid = findSchemaField("Worker", "supplierId");
    if (sid) {
      sid.desc = "Supplier of record. Null for `float` workers (no external supplier — the org itself provides the worker).";
    }
  })();

  /* =================================================================
     F-05 — POST /requisition-templates body schema + example
     ================================================================= */
  (function () {
    var ep = findEp("tpl_create");
    if (!ep || !ep.body) return;
    dropBodyField(ep, "sourcingChannel");
    var et = findBodyField(ep, "engagementType");
    if (et) {
      et.enum = ENGAGEMENT_TYPE.slice();
      et.desc = "Canonical EngagementType for requisitions spawned from this template.";
    }
    if (ep.body.example) {
      delete ep.body.example.sourcingChannel;
      if (ep.body.example.engagementType && ENG_REMAP[ep.body.example.engagementType]) {
        ep.body.example.engagementType = ENG_REMAP[ep.body.example.engagementType];
      }
    }
  })();

  /* =================================================================
     F-06 — /config/engagement-types examples
     ================================================================= */
  (function () {
    var getEp = findEp("cfg_engtypes_get");
    if (getEp) {
      getEp.summary = "Returns the four canonical EngagementType values with their per-org enabled flag and display label. Drives the EngagementType picker at requisition intake and the EngagementType filter on list views.";
      getEp.responseExample = {
        shift:      { enabled: true, label: "Shift" },
        assignment: { enabled: true, label: "Assignment" },
        project:    { enabled: true, label: "Project" },
        sow:        { enabled: true, label: "Statement of work" }
      };
    }
    var setEp = findEp("cfg_engtypes_set");
    if (setEp) {
      setEp.summary = "Bulk-replace which of the four canonical EngagementType values are enabled for the org. Disabling a type currently in use is allowed but does not affect in-flight engagements.";
      if (setEp.body) {
        setEp.body.example = {
          shift:      { enabled: true },
          assignment: { enabled: true },
          project:    { enabled: false },
          sow:        { enabled: true }
        };
      }
      setEp.responseExample = {
        shift:      { enabled: true },
        assignment: { enabled: true },
        project:    { enabled: false },
        sow:        { enabled: true }
      };
    }
  })();

  /* =================================================================
     F-07 — /org/settings examples
     ================================================================= */
  (function () {
    var getEp = findEp("org_settings_get");
    if (getEp && getEp.responseExample) {
      getEp.responseExample.engagementTypes = ENGAGEMENT_TYPE.slice();
      getEp.responseExample.supplierTypes   = SUPPLIER_TYPE.slice();
    }
    var setEp = findEp("org_settings_update");
    if (setEp) {
      if (setEp.body && setEp.body.example) {
        setEp.body.example = { engagementTypes: ENGAGEMENT_TYPE.slice() };
      }
      if (setEp.responseExample) {
        setEp.responseExample = { engagementTypes: ENGAGEMENT_TYPE.slice() };
      }
    }
    // The summary on org_settings_get still says "engagement types,
    // supplier types" — that's still accurate, leave alone.
  })();

  /* =================================================================
     F-08 — supplier-types config + Supplier.type enum
     ================================================================= */
  (function () {
    var getEp = findEp("cfg_suptypes_get");
    if (getEp) {
      getEp.summary = "Returns the four canonical SupplierType values (Agency, Contractor, EOR, Float) with their per-org enabled flag. SupplierType describes who provides the worker — orthogonal to EngagementType, which describes how work is shaped.";
      getEp.responseExample = {
        agency:     { enabled: true, label: "Agency" },
        contractor: { enabled: true, label: "Independent contractor" },
        eor:        { enabled: true, label: "Employer of record" },
        float:      { enabled: true, label: "Float pool" }
      };
    }
    var setEp = findEp("cfg_suptypes_set");
    if (setEp) {
      setEp.summary = "Bulk-replace the four-value SupplierType enabled set. Disabling a SupplierType currently in use is allowed but no new suppliers of that form can be onboarded until it is re-enabled.";
      if (setEp.body) {
        setEp.body.example = {
          agency:     { enabled: true },
          contractor: { enabled: true },
          eor:        { enabled: true },
          float:      { enabled: true }
        };
      }
      setEp.responseExample = {
        agency:     { enabled: true },
        contractor: { enabled: true },
        eor:        { enabled: true },
        float:      { enabled: true }
      };
    }
    var sty = findSchemaField("Supplier", "type");
    if (sty) {
      sty.enum = SUPPLIER_TYPE.slice();
      sty.desc = "Canonical SupplierType — the supplier's business form. Orthogonal to EngagementType.";
    }
  })();

  /* =================================================================
     F-09 — Requisitions / Workers / Suppliers / Contractors tag copy
     ================================================================= */
  (function () {
    var reqTag = (spec.tags || []).find(function (t) { return t.id === "requisitions"; });
    if (reqTag) {
      reqTag.description =
        "Requisitions are the unit of demand in Flex Work. Every requisition has one EngagementType " +
        "(shift, assignment, project, sow) that describes the shape of the work. Sourcing — which " +
        "supplier organization, and that supplier's SupplierType (agency, contractor, eor, float) — " +
        "lives on the candidate and worker records.";
    }
    var wkrTag = (spec.tags || []).find(function (t) { return t.id === "workers"; });
    if (wkrTag) {
      wkrTag.description =
        "A worker is a person engaged through Flex Work. Workers carry tenure across requisitions; " +
        "the API surfaces the active engagement (with its EngagementType), the worker's SupplierType, " +
        "credentials, and shift history.";
    }
    var supTag = (spec.tags || []).find(function (t) { return t.id === "suppliers"; });
    if (supTag) {
      supTag.description =
        "Staffing agencies, independent contractors, EOR partners, and the internal float pool — " +
        "the four SupplierType values. Contracts, distribution lists, and funding rules are all " +
        "addressable via this API.";
    }
    var ctrTag = (spec.tags || []).find(function (t) { return t.id === "contractors"; });
    if (ctrTag) {
      ctrTag.description =
        "Workers whose SupplierType is `contractor` — 1099 independent contractors engaged directly " +
        "rather than through an agency or EOR. Onboarding, classification testing, and tax-form " +
        "issuance live here.";
    }

    // req_list `detail` enrichment that ext-3 wrote — restate in
    // post-collapse language.
    var reqList = findEp("req_list");
    if (reqList && reqList.detail && /sourcingChannel|frontline_shift/i.test(reqList.detail)) {
      reqList.detail =
        "This is the entry point most integrations start at. The default page size is 50 and the " +
        "maximum is 200. Combine `engagementType`, `supplierType`, and `status` to slice the work " +
        "— for example, fetching every open shift requisition staffed by an agency is one call " +
        "with three filters. For very large result sets, pass `count=false` (the default) — " +
        "including the total adds a non-trivial COUNT(*) query at the storage layer. Records " +
        "that the caller can't see (different org, different scope) are quietly omitted; they " +
        "DO NOT count toward totalCount.";
    }
  })();

  /* =================================================================
     F-10 — sweep every example / responseExample for stale values
     ================================================================= */
  (function () {
    (spec.paths || []).forEach(function (p) {
      if (p.responseExample) scrubExamples(p.responseExample);
      if (p.body && p.body.example) scrubExamples(p.body.example);
    });
  })();

  /* =================================================================
     F-11 — Policy.scope.workerTypes → scope.supplierTypes
     ================================================================= */
  (function () {
    function fixScope(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(fixScope); return; }
      Object.keys(node).forEach(function (k) {
        if (k === "scope" && node[k] && typeof node[k] === "object" && Array.isArray(node[k].workerTypes)) {
          node[k].supplierTypes = node[k].workerTypes.map(function (v) {
            return SUP_REMAP[v] || v;
          });
          delete node[k].workerTypes;
        } else if (k === "scope" && node[k] && Array.isArray(node[k].supplierTypes)) {
          node[k].supplierTypes = node[k].supplierTypes.map(function (v) {
            return SUP_REMAP[v] || v;
          });
        }
        if (node[k] && typeof node[k] === "object") fixScope(node[k]);
      });
    }
    var ids = ["policy_list", "policy_create", "policy_update"];
    ids.forEach(function (id) {
      var ep = findEp(id);
      if (!ep) return;
      if (ep.responseExample) fixScope(ep.responseExample);
      if (ep.body && ep.body.example) fixScope(ep.body.example);
    });
  })();

  /* =================================================================
     F-12 — worker-type config: sow_resource → sow
     ================================================================= */
  (function () {
    function rekey(obj) {
      if (!obj || typeof obj !== "object" || !("sow_resource" in obj)) return obj;
      obj.sow = obj.sow_resource;
      delete obj.sow_resource;
      return obj;
    }
    var getEp = findEp("cfg_workertypes_get");
    if (getEp) {
      if (getEp.responseExample) rekey(getEp.responseExample);
      if (getEp.detail) getEp.detail = getEp.detail.replace(/SOW Resources/g, "SOW");
      getEp.summary = "Returns the four canonical WorkerType values (frontline, professional, contractor, sow) and their per-type configuration — agreement template, classification policy, approval thresholds.";
    }
    var setEp = findEp("cfg_workertypes_set");
    if (setEp) {
      if (setEp.body && setEp.body.example) rekey(setEp.body.example);
      if (setEp.responseExample) rekey(setEp.responseExample);
    }
  })();

  /* =================================================================
     F-13 — /contractors summary + example
     The "contractor" discriminator now lives on SupplierType (not on
     EngagementType, which doesn't carry "contractor" anymore).
     ================================================================= */
  (function () {
    var ep = findEp("ctr_list");
    if (!ep) return;
    ep.summary =
      "Returns the subset of workers whose SupplierType is `contractor` — 1099 independent " +
      "contractors engaged directly. For all workers regardless of SupplierType, use /workers.";
    if (ep.responseExample && Array.isArray(ep.responseExample.data)) {
      ep.responseExample.data.forEach(function (row) {
        delete row.sourcingChannel;
        // Strip any leftover stale engagementType from ext-9 v1 (set
        // when the audit briefly framed "contractor" as an
        // EngagementType).
        if (row.engagementType === "contractor") delete row.engagementType;
        row.supplierType = "contractor";
        if (!row.engagementType) row.engagementType = "assignment";
      });
    }
  })();

  /* ============ Verifier-friendly summary =========================== */
  if (typeof window !== "undefined" && window.console) {
    var stale = [];
    (spec.paths || []).forEach(function (p) {
      var s = JSON.stringify({ a: p.params, b: p.body, c: p.responseExample });
      if (/sourcingChannel/.test(s)) stale.push(p.id + ":sourcingChannel");
      if (/"engagementType"\s*:\s*"(statementOfWork|frontline_shift|frontline_assignment|professional_project|contractor)"/.test(s)) {
        stale.push(p.id + ":legacy-engagementType");
      }
      if (/"supplierType"\s*:\s*"(independent|sow_vendor|sow|frontline)"/.test(s)) {
        stale.push(p.id + ":legacy-supplierType");
      }
    });
    if (stale.length) {
      console.warn("FW_API_SPEC ext-9: " + stale.length + " residual taxonomy refs →", stale);
    } else {
      console.info("FW_API_SPEC ext-9: taxonomy clean — every endpoint speaks the canonical vocabulary.");
    }
  }
})();
