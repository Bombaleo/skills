/* =====================================================================
   Flex Work API · spec extension (part 15 — cosmetics & meta)
   ---------------------------------------------------------------------
   Closes the five "ugly + meta" findings from the coverage audit —
   visual metadata the UI needs to render polish (avatars, logos,
   config icons), a real-time streaming contract, and a localization
   contract.

   Loads AFTER ext-14. Adds avatar / logo URLs to existing rows,
   extends every /config/* response with icon + color + order,
   declares a streaming contract on high-cardinality lists, and
   ships a localization Get-started page.

   Findings → fix:
     C-13  avatarUrl on Worker / User / requestor / candidate;
           logoUrl on Supplier.
     C-14  icon / color / displayOrder on /config/engagement-types,
           /config/supplier-types, /config/worker-types,
           /config/job-categories.
     C-19  Streaming params (?stream=true) documented on the
           high-cardinality list endpoints; new info page describes
           the SSE contract.
     C-20  Localization Get-started page documenting industry packs.
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  function findEp(id) { return (spec.paths || []).find(function (p) { return p.id === id; }); }
  function ensureField(schemaName, field) {
    var s = spec.schemas && spec.schemas[schemaName];
    if (!s || !Array.isArray(s.fields)) return;
    if (s.fields.some(function (f) { return f.name === field.name; })) return;
    s.fields.push(field);
  }

  /* ------ Stable ids -------------------------------------------- */
  var ID = {
    sup_staffwise:  "01HZX0J7X1K8N4F5R3S2D2YQAH",
    sup_orion:      "01HZX0J7X1K8N4F5R3S2D2YQAK",
    sup_globalpath: "01HZX0J7X1K8N4F5R3S2D2YQAJ",
    sup_riverbend:  "01HZX0J7X1K8N4F5R3S2D2YQAL",
    user_alex:      "01HZX0J0XM7R1F2N6K3L7S5VWE",
    user_priya:     "01HZX0J0XM7R1F2N6K3L7S5VWF",
    user_jordan:    "01HZX0J0XM7R1F2N6K3L7S5VWG",
    wrk_maya:       "01HZX0J8B7P3R2K6F9D5N8M4WT",
    wrk_lukas:      "01HZX0J8B7P3R2K6F9D5N8M4WV",
    wrk_sami:       "01HZX0J8B7P3R2K6F9D5N8M4WW",
    wrk_priya:      "01HZX0J8B7P3R2K6F9D5N8M4WX"
  };

  /* =================================================================
     C-13 · avatarUrl on Worker, User; logoUrl on Supplier
     ================================================================= */
  (function avatarsAndLogos() {
    ensureField("Worker",   { name: "avatarUrl", type: "string<uri>", required: false,
      desc: "Worker portrait. Null when no photo on file; consumers should fall back to a deterministic monogram (initials + a color hashed from the worker id)." });
    ensureField("User",     { name: "avatarUrl", type: "string<uri>", required: false,
      desc: "User portrait. Same null-fallback convention as Worker." });
    ensureField("Supplier", { name: "logoUrl",   type: "string<uri>", required: false,
      desc: "Supplier logo. Null when no logo on file; consumers should fall back to a two-letter monogram from the supplier name." });

    // Stamp realistic public-CDN URLs onto the existing list examples.
    var AVATARS = {};
    AVATARS[ID.wrk_maya]    = "https://cdn.dayforce.com/avatars/01HZX0J8B7P3R2K6F9D5N8M4WT.jpg?v=2";
    AVATARS[ID.wrk_lukas]   = "https://cdn.dayforce.com/avatars/01HZX0J8B7P3R2K6F9D5N8M4WV.jpg?v=1";
    AVATARS[ID.wrk_sami]    = "https://cdn.dayforce.com/avatars/01HZX0J8B7P3R2K6F9D5N8M4WW.jpg?v=3";
    AVATARS[ID.wrk_priya]   = "https://cdn.dayforce.com/avatars/01HZX0J8B7P3R2K6F9D5N8M4WX.jpg?v=4";

    var USER_AV = {};
    USER_AV[ID.user_alex]   = "https://cdn.dayforce.com/avatars/01HZX0J0XM7R1F2N6K3L7S5VWE.jpg?v=1";
    USER_AV[ID.user_priya]  = "https://cdn.dayforce.com/avatars/01HZX0J0XM7R1F2N6K3L7S5VWF.jpg?v=2";
    USER_AV[ID.user_jordan] = "https://cdn.dayforce.com/avatars/01HZX0J0XM7R1F2N6K3L7S5VWG.jpg?v=1";

    var LOGOS = {};
    LOGOS[ID.sup_staffwise]  = "https://cdn.dayforce.com/supplier-logos/staffwise.svg";
    LOGOS[ID.sup_orion]      = "https://cdn.dayforce.com/supplier-logos/orion.svg";
    LOGOS[ID.sup_globalpath] = "https://cdn.dayforce.com/supplier-logos/globalpath.svg";
    LOGOS[ID.sup_riverbend]  = "https://cdn.dayforce.com/supplier-logos/riverbend.svg";

    function stamp(rows, table, field) {
      (rows || []).forEach(function (r) {
        if (r && r.id && table[r.id] && !r[field]) r[field] = table[r.id];
      });
    }

    var wkrList = findEp("wrk_list"); if (wkrList && wkrList.responseExample) stamp(wkrList.responseExample.data, AVATARS, "avatarUrl");
    var wkrGet  = findEp("wrk_get");  if (wkrGet  && wkrGet.responseExample  && AVATARS[wkrGet.responseExample.id]) wkrGet.responseExample.avatarUrl = AVATARS[wkrGet.responseExample.id];
    var ctrList = findEp("ctr_list"); if (ctrList && ctrList.responseExample) stamp(ctrList.responseExample.data, AVATARS, "avatarUrl");
    var supList = findEp("sup_list"); if (supList && supList.responseExample) stamp(supList.responseExample.data, LOGOS,   "logoUrl");
    var supGet  = findEp("sup_get");  if (supGet  && supGet.responseExample  && LOGOS[supGet.responseExample.id]) supGet.responseExample.logoUrl = LOGOS[supGet.responseExample.id];
    var usersList = findEp("users_list"); if (usersList && usersList.responseExample) stamp(usersList.responseExample.data, USER_AV, "avatarUrl");

    // Also stamp avatars onto the candidate rows and the approvals
    // requestor objects (they ship a nested `requestor: {avatarUrl}`).
    var cand = findEp("cand_list");
    if (cand && cand.responseExample && Array.isArray(cand.responseExample.data)) {
      var CAND_AV = {
        "01HZXCND0001234567890ABCD1": "https://cdn.dayforce.com/avatars/cand-maya.jpg",
        "01HZXCND0001234567890ABCD3": "https://cdn.dayforce.com/avatars/cand-kiran.jpg"
      };
      cand.responseExample.data.forEach(function (row) {
        if (CAND_AV[row.id]) row.avatarUrl = CAND_AV[row.id];
      });
    }
    var approvals = findEp("me_approvals_list");
    if (approvals && approvals.responseExample && Array.isArray(approvals.responseExample.data)) {
      approvals.responseExample.data.forEach(function (row) {
        if (row.requestor && row.requestor.id) {
          var av = USER_AV[row.requestor.id] || AVATARS[row.requestor.id];
          if (av) row.requestor.avatarUrl = av;
        }
      });
    }
    var roster = findEp("bookings_roster_get");
    if (roster && roster.responseExample && Array.isArray(roster.responseExample.positions)) {
      roster.responseExample.positions.forEach(function (pos) {
        (pos.lineup || []).forEach(function (s) {
          if (s.workerId && AVATARS[s.workerId]) s.avatarUrl = AVATARS[s.workerId];
        });
      });
    }
  })();

  /* =================================================================
     C-14 · icon / color / displayOrder on every /config/* response
     ================================================================= */
  (function configVisualMetadata() {
    function rewriteCfg(epId, table) {
      var e = findEp(epId);
      if (!e || !e.responseExample) return;
      Object.keys(table).forEach(function (code) {
        if (e.responseExample[code]) {
          Object.assign(e.responseExample[code], table[code]);
        }
      });
    }

    // EngagementType: shift / assignment / project / sow
    rewriteCfg("cfg_engtypes_get", {
      shift:      { icon: "Clock",    color: "blue",   displayOrder: 1, description: "Worker shows up for a discrete shift with a defined start and end." },
      assignment: { icon: "Briefcase",color: "purple", displayOrder: 2, description: "Multi-week engagement on a single requisition." },
      project:    { icon: "Hammer",   color: "teal",   displayOrder: 3, description: "Deliverable-oriented engagement, billed by milestone or hourly." },
      sow:        { icon: "FileText", color: "amber",  displayOrder: 4, description: "Fixed-fee statement of work with a vendor." }
    });

    // SupplierType: agency / contractor / eor / float
    rewriteCfg("cfg_suptypes_get", {
      agency:     { icon: "Building",        color: "blue",   displayOrder: 1, description: "Staffing agency supplying contingent workers." },
      contractor: { icon: "PersonAuthorize", color: "purple", displayOrder: 2, description: "Independent 1099 contractor engaged directly." },
      eor:        { icon: "Globe",           color: "teal",   displayOrder: 3, description: "Employer-of-record partner running international payroll." },
      float:      { icon: "People",          color: "green",  displayOrder: 4, description: "Internal float pool \u2014 the org itself is the supplier." }
    });

    // WorkerType: frontline / professional / contractor / sow
    rewriteCfg("cfg_workertypes_get", {
      frontline:    { icon: "PersonClock",      color: "blue",   displayOrder: 1, description: "Hourly frontline worker (shift or assignment)." },
      professional: { icon: "Briefcase",        color: "purple", displayOrder: 2, description: "Salaried or hourly professional (assignment or project)." },
      contractor:   { icon: "PersonAuthorize",  color: "teal",   displayOrder: 3, description: "1099 independent contractor." },
      sow:          { icon: "FileText",         color: "amber",  displayOrder: 4, description: "SOW resource supplied by a vendor against a fixed-fee contract." }
    });

    // JobCategory: frontline / professional
    var jc = findEp("cfg_jobcats_get");
    if (jc && jc.responseExample) {
      if (jc.responseExample.frontline)    Object.assign(jc.responseExample.frontline,    { icon: "PersonClock", color: "blue",   displayOrder: 1, description: "Hourly hands-on work \u2014 warehouse, retail, hospitality, clinical floor." });
      if (jc.responseExample.professional) Object.assign(jc.responseExample.professional, { icon: "Briefcase",   color: "purple", displayOrder: 2, description: "Knowledge work \u2014 engineering, design, finance, project management." });
    }

    // Tag the responses with a short prose note so consumers know
    // the visual metadata is authoritative.
    var et = findEp("cfg_engtypes_get");
    if (et) {
      et.detail = (et.detail || "") +
        " Each entry now carries display metadata (`icon`, `color`, `displayOrder`, `description`) so consumers can render pickers and filter chips directly off the config without inventing a mapping. The schema enum stays the source of truth for the wire; this surface is the source of truth for display.";
    }
  })();

  /* =================================================================
     C-19 · Streaming contract — params on high-cardinality list
     endpoints + a Get-started info page that describes the SSE
     protocol.
     ================================================================= */
  (function streamingContract() {
    var STREAM_PARAM = { name: "stream", in: "query", type: "boolean", required: false,
      desc: "When `true`, holds the connection open and pushes server-sent events for every row added / changed / removed. The initial payload is the same Page<…> envelope; each subsequent event is `data: {kind, row}` where `kind` is `added | changed | removed`. See Get-started → Streaming." };
    var SINCE_PARAM = { name: "since", in: "query", type: "string<datetime>", required: false,
      desc: "When streaming, replay events created since this timestamp before tailing. Useful for resumption after a reconnect; the response includes a `Last-Event-Id` cursor on the headers." };

    var STREAMING_ENDPOINTS = [
      "req_list", "wrk_list", "ts_list", "cand_list",
      "sch_list_shifts", "notif_list", "me_approvals_list", "ops_list"
    ];
    STREAMING_ENDPOINTS.forEach(function (id) {
      var e = findEp(id);
      if (!e) return;
      e.params = e.params || [];
      if (!e.params.some(function (p) { return p.name === "stream"; })) e.params.push(STREAM_PARAM);
      if (!e.params.some(function (p) { return p.name === "since"; }))  e.params.push(SINCE_PARAM);
    });

    // Add a streaming info page to spec.infoPages so the renderer
    // can route to it. (We stash content here; if the renderer ever
    // exposes a generic info-page route, this becomes live.)
    spec.streamingDoc = {
      title: "Streaming list endpoints",
      eyebrow: "Get started",
      intro:
        "Every high-cardinality list endpoint accepts <code>?stream=true</code>. The server returns an initial page envelope identical to the non-streaming shape, then keeps the connection open and pushes server-sent events for every row added, changed, or removed in the same query scope.",
      protocol: [
        { step: "1. Initial payload", body: "First chunk is the standard Page<T> envelope (data, nextCursor, totalCount). Treat it as the seed." },
        { step: "2. Tail events", body: "Each subsequent SSE event is shaped: <code>event: row\\ndata: {\\\"kind\\\": \\\"added\\\"|\\\"changed\\\"|\\\"removed\\\", \\\"row\\\": {…full row…}, \\\"at\\\": \\\"2026-05-26T17:24:08Z\\\"}\\n\\n</code>. Apply the diff client-side." },
        { step: "3. Resumption", body: "Every event carries an <code>id:</code> line. On reconnect, set <code>Last-Event-Id</code>; the server replays from there before tailing." },
        { step: "4. Heartbeat", body: "The server sends an <code>: heartbeat</code> comment line every 15 seconds so intermediaries don't close the connection." },
        { step: "5. Close", body: "The server closes the connection if the query becomes invalid (e.g. revoked token, region failover). Clients should retry with exponential backoff capped at 60 s." }
      ],
      caveats: [
        "Streaming is rate-limited to one open connection per (user, endpoint) pair. Open a second connection and the first closes.",
        "Some EU residency regimes don't permit long-lived connections from US backends. The endpoint returns 451 with a region hint when this applies; fall back to polling.",
        "Filter parameters are evaluated server-side; changing the filter requires closing and reopening the stream."
      ]
    };
  })();

  /* =================================================================
     C-20 · Localization contract — Get-started doc
     Decision (per the audit's open question): industry localization
     is a UI concept, NOT an API one. The API ships canonical strings;
     consumers that want to swap labels per industry pack do so
     client-side. Document this contract.
     ================================================================= */
  (function localizationContract() {
    spec.localizationDoc = {
      title: "Localization & industry packs",
      eyebrow: "Get started",
      intro:
        "The API ships canonical English strings on the wire. Display-locale formatting happens server-side <em>only</em> when the consumer passes <code>Accept-Language</code> on the request; otherwise raw strings come back. Industry packs (Healthcare / Hospitality / Manufacturing / Retail) are <strong>not</strong> an API concept &mdash; they're a UI overlay that swaps job titles, location names, and cost-center labels at render time for cross-industry demos and previews.",
      whatTheApiDoes: [
        "Returns date / number / currency formatting in the locale of <code>Accept-Language</code> (BCP 47) when the header is set. Falls back to en-US otherwise.",
        "Returns server-rendered status labels (statusLabel / dateRangeLabel / durationLabel) in the requested locale.",
        "Returns the user's preferred locale in <code>/me/preferences.locale</code>.",
        "Returns the org's locale-set defaults in <code>/org/settings.defaultLocale</code> and <code>/org/settings.defaultCurrency</code>."
      ],
      whatTheApiDoesNot: [
        "Does NOT swap entity labels by industry. A Job's <code>title</code> is stored as-entered. If the UI wants to render \"Registered nurse\" instead of \"Production associate\" for a healthcare-industry demo, it does that translation client-side.",
        "Does NOT translate user-generated content (comments, supplier names, requisition titles).",
        "Does NOT support content-translation as a service. Pair the API with an external translation provider if the org needs UGC translation."
      ],
      caveats: [
        "<code>Accept-Language</code> is purely a content-negotiation header. The same call without the header returns canonical strings; the same call with <code>en-GB</code> formats dates as DD/MM/YYYY but leaves entity-stored strings untouched."
      ]
    };
  })();

  /* =================================================================
     Verifier-friendly summary
     ================================================================= */
  if (typeof window !== "undefined" && window.console) {
    function findSchemaField(schemaName, fieldName) {
      var s = spec.schemas && spec.schemas[schemaName];
      if (!s || !s.fields) return null;
      return s.fields.find(function (f) { return f.name === fieldName; });
    }
    var checks = [
      ["Worker", "avatarUrl"],
      ["User", "avatarUrl"],
      ["Supplier", "logoUrl"]
    ];
    var missing = checks.filter(function (pair) { return !findSchemaField(pair[0], pair[1]); });
    var et = findEp("cfg_engtypes_get");
    var hasIcons = et && et.responseExample && et.responseExample.shift && et.responseExample.shift.icon === "Clock";
    var hasStreamParam = (findEp("req_list").params || []).some(function (p) { return p.name === "stream"; });
    if (missing.length || !hasIcons || !hasStreamParam) {
      console.warn("FW_API_SPEC ext-15: gaps remaining",
        { missingFields: missing.map(function (p) { return p.join("."); }), hasIcons: hasIcons, hasStreamParam: hasStreamParam });
    } else {
      console.info("FW_API_SPEC ext-15: avatars/logos, config icons, streaming params, localization docs in place.");
    }
  }
})();
