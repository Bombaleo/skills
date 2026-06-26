/* =====================================================================
   Flex Work API · spec extension (part 7 — audit fixes)
   ---------------------------------------------------------------------
   Applies every finding from Flex Work API Reference Audit.html.

   Loads LAST. Mutates spec.tags / spec.paths / spec.groups / spec.schemas
   in place; no new endpoints are added here — only re-organization,
   re-labeling, and schema collapse.

   Findings → file mapping:
     P0-01 Orphan tags ............ rebuilt groups (bottom of file)
     P0-02 operations id collision  group rename + tag rename
     P0-11 engagementType/sourcing  Requisition schema collapse
     P1-03 split users → me ........ retag + new tag
     P1-04 system tag scope ........ files / search / devices already
                                     retagged in ext-6 — no change needed
     P1-05 Security group .......... rebuilt groups
     P1-06 Personalization group ... rebuilt groups
     P1-07 Fold thin tags .......... events+cdc+webhook-encryption →
                                     webhooks; attachments → files;
                                     ip-allowlist → api-keys
     P1-08 Endpoint sort ........... handled in api-docs-renderer.js
     P1-12 Worker-type enum ........ schema-level collapse
     P1-13 statementOfWork → sow ... global enum scrub
     P1-14 "Users & roles" → Users.. rename
     P1-15 "Credentials & ..." ..... rename
     P1-16 Fold org-tree ........... retag → organization
     P2-09 Tag order in group ...... rebuilt groups (canonical order)
     P2-10 Webhooks / Events ....... fold via P1-07
     P2-17 "AI · Labs" → AI ........ rename
     P2-18 "MSP mode" → MSP programs rename
     P2-19 Noun-only tag naming .... renames
     P2-20 expense-policies merge .. retag → expenses
   ===================================================================== */
(function () {
  var spec = window.FW_API_SPEC;
  if (!spec) { console.error("FW_API_SPEC missing"); return; }

  /* ------------- helpers -------------------------------------------- */
  function findTag(id)  { return spec.tags.find(function (t) { return t.id === id; }); }
  function dropTag(id)  {
    var i = spec.tags.findIndex(function (t) { return t.id === id; });
    if (i >= 0) spec.tags.splice(i, 1);
  }
  function retag(fromId, toId) {
    spec.paths.forEach(function (p) { if (p.tag === fromId) p.tag = toId; });
  }
  function retagOne(epId, toId) {
    var ep = spec.paths.find(function (p) { return p.id === epId; });
    if (ep) ep.tag = toId;
  }
  function renameTag(id, newName, newDesc) {
    var t = findTag(id);
    if (!t) return;
    if (newName) t.name = newName;
    if (newDesc) t.description = newDesc;
  }
  function changeTagId(oldId, newId, newName) {
    var t = findTag(oldId);
    if (!t) return;
    t.id = newId;
    if (newName) t.name = newName;
    retag(oldId, newId);
    // Also rewrite any group's tags array.
    (spec.groups || []).forEach(function (g) {
      g.tags = (g.tags || []).map(function (x) { return x === oldId ? newId : x; });
    });
  }

  /* =========== P0-02 — operations id collision ====================== */
  // Group "operations" (Time & attendance) → id "time-attendance".
  var timeAtt = (spec.groups || []).find(function (g) { return g.id === "operations"; });
  if (timeAtt) {
    timeAtt.id = "time-attendance";
    timeAtt.name = "Time & attendance";
    timeAtt.summary = "Schedules and shifts, time-off, timesheets, clock punches, expenses, and the workflows that hand them off to payroll.";
  }
  // Tag "operations" (Long-running operations) → id "async-jobs".
  changeTagId("operations", "async-jobs", "Async jobs");
  var asyncTag = findTag("async-jobs");
  if (asyncTag) {
    asyncTag.description = "Unified async-job primitive. Every long-running operation in the platform — imports, exports, bulk-publish, distribution fan-out, AI summaries — returns a 202 with a Location header that points back at one of these.";
  }

  /* =========== P0-11 + P1-12 + P1-13 — taxonomy collapse ============ */
  // Collapse the Requisition engagementType / sourcingChannel pair into
  // one canonical engagementType enum. Drop the sourcingChannel field;
  // sourcing detail lives on the supplier record.
  var req = spec.schemas && spec.schemas.Requisition;
  if (req && req.fields) {
    req.fields = req.fields.filter(function (f) { return f.name !== "sourcingChannel"; });
    var et = req.fields.find(function (f) { return f.name === "engagementType"; });
    if (et) {
      et.enum = ["frontline_shift", "frontline_assignment", "professional_project", "sow", "contractor"];
      et.desc = "Canonical engagement type — replaces the legacy engagementType + sourcingChannel pair. Sourcing detail (agency / EOR / independent) lives on the supplier record.";
    }
    req.description = (req.description || "") +
      " Engagement type is the single source of truth for how work is shaped; the deprecated sourcingChannel field has been removed.";
  }
  // Worker schema carries the same engagementType enum.
  var wkr = spec.schemas && spec.schemas.Worker;
  if (wkr && wkr.fields) {
    var wet = wkr.fields.find(function (f) { return f.name === "engagementType"; });
    if (wet) {
      wet.enum = ["frontline_shift", "frontline_assignment", "professional_project", "sow", "contractor"];
    }
  }
  // Sweep every other enum that still says statementOfWork.
  function scrubEnum(arr) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(function (v) { return v === "statementOfWork" ? "sow" : v; });
  }
  (spec.paths || []).forEach(function (p) {
    (p.params || []).forEach(function (param) {
      if (param.enum) param.enum = scrubEnum(param.enum);
    });
    if (p.body && Array.isArray(p.body.schema)) {
      p.body.schema.forEach(function (f) { if (f.enum) f.enum = scrubEnum(f.enum); });
    }
  });
  Object.keys(spec.schemas || {}).forEach(function (k) {
    var s = spec.schemas[k];
    if (!s.fields) return;
    s.fields.forEach(function (f) { if (f.enum) f.enum = scrubEnum(f.enum); });
  });

  /* =========== P1-03 — split users → me ============================= */
  if (!findTag("me")) {
    spec.tags.push({
      id: "me",
      name: "Current user",
      description: "Endpoints scoped to the calling user — profile, UI preferences, and effective permissions. Use these for client-side feature gating without round-tripping role definitions."
    });
  }
  ["users_me", "me_prefs_get", "me_prefs_set", "me_perms_resolve"].forEach(function (id) {
    retagOne(id, "me");
  });

  /* =========== P1-14 — "Users & roles" → "Users" ==================== */
  renameTag("users", "Users",
    "Internal users with seats on the platform. List, invite, get, update, deactivate, and resend invitations. Roles and effective permissions live under separate tags.");

  /* =========== P1-15 — "Credentials & compliance" → "Credentials" === */
  renameTag("credentials", "Credentials",
    "Credential definitions and worker-issued credentials. Each credential carries an expiry; expiry events fan out to the notifications and audit surfaces.");

  /* =========== P2-17 — "AI · Labs" → "AI" =========================== */
  renameTag("ai", "AI");

  /* =========== P2-18 — "MSP mode" → "MSP programs" ================== */
  renameTag("msp", "MSP programs",
    "Cross-tenant routing for managed-service partners. MSP users hold seats on multiple programs and need both a per-program view and a panoramic across-program view; these endpoints power the program switcher and the cross-tenant scope filter.");

  /* =========== P2-19 — noun-only tag labels ========================= */
  renameTag("candidates",  "Candidates");
  renameTag("comments",    "Comments");
  renameTag("favorites",   "Favorites");
  renameTag("devices",     "Devices");
  renameTag("feedback",    "Feedback");
  renameTag("analytics",   "Analytics");
  renameTag("roles",       "Roles");
  renameTag("saved-views", "Saved views");
  renameTag("reports",     "Reports");
  // Keep ampersand pairs that name two genuinely-distinct surfaces:
  //   Pricing & funding, Banking & direct deposit.

  /* =========== P1-16 — fold org-tree into organization ============== */
  retag("org-tree", "organization");
  dropTag("org-tree");

  /* =========== P1-07 + P2-10 — fold thin tags ======================= */
  retag("events",             "webhooks");           dropTag("events");
  retag("cdc",                "webhooks");           dropTag("cdc");
  retag("webhook-encryption", "webhooks");           dropTag("webhook-encryption");
  retag("attachments",        "files");              dropTag("attachments");
  retag("ip-allowlist",       "api-keys");           dropTag("ip-allowlist");

  /* =========== P2-20 — expense-policies → expenses ================== */
  retag("expense-policies", "expenses"); dropTag("expense-policies");

  // Refresh fold-target tag descriptions to mention the absorbed scope.
  renameTag("webhooks", "Webhooks",
    "Subscribe to platform events with a signed HTTPS callback. This tag covers webhook subscriptions, the full event catalog, the change-data-capture stream, and envelope encryption for payloads.");
  renameTag("files", "Files",
    "Centralized blob storage — receipts, contracts, credential PDFs, tax forms, timesheet exports — plus the attachment join records that bind files to entities like requisitions, timesheets, and threads.");
  renameTag("api-keys", "API keys",
    "Server-to-server API keys provisioned in the developer portal. Each key is scoped, optionally bound to a client certificate (mTLS), and optionally restricted by IP allowlist.");
  renameTag("expenses", "Expenses",
    "Receipt-backed expense lines submitted by workers and the org's expense policy (categories, ceilings, per-diems, mileage). Reimbursements ride alongside timesheet pay.");

  /* =========== P1-05 + P1-06 + P2-09 — rebuild groups =============== */
  // Canonical group order + canonical tag order within each group.
  // Get-started has its own renderer special-case (info pages); its
  // tags array is intentionally empty.
  spec.groups = [
    {
      id: "get-started",
      name: "Get started",
      summary: "Auth, error handling, pagination, idempotency, rate limits, and the conventions every Flex Work request follows.",
      tags: []
    },
    {
      id: "identity",
      name: "Identity",
      summary: "Who can use Flex Work and what they can see — orgs, users, the current user, roles, and platform configuration.",
      tags: ["organization", "users", "me", "roles", "config"]
    },
    {
      id: "demand",
      name: "Demand",
      summary: "How work enters Flex Work — requisitions, templates, supplier distribution, candidates, and statements of work.",
      tags: ["requisitions", "requisition-templates", "distribution", "candidates", "sow"]
    },
    {
      id: "workforce",
      name: "Workforce",
      summary: "The people doing the work — workers, contractors, credentials, talent pools, rostered events, and end-of-shift feedback.",
      tags: ["workers", "contractors", "credentials", "talent-pools", "rosters", "feedback"]
    },
    {
      id: "time-attendance",
      name: "Time & attendance",
      summary: "Schedules and shifts, time-off, timesheets, clock punches, and expenses — the surfaces that feed payroll.",
      tags: ["schedules", "time-off", "timesheets", "clocking", "expenses"]
    },
    {
      id: "money",
      name: "Money",
      summary: "Where the spend goes — invoices, pricing rules, budgets, tax forms, direct deposit, and currency.",
      tags: ["invoices", "pricing", "budgets", "tax-forms", "banking", "fx"]
    },
    {
      id: "suppliers",
      name: "Suppliers",
      summary: "Staffing agencies, EOR partners, and SOW vendors — onboarding, contracts, scorecards, broadcasts, and document signing.",
      tags: ["suppliers", "signing"]
    },
    {
      id: "platform",
      name: "Platform",
      summary: "The structural pieces of a Flex Work tenant — locations, jobs catalog, policies, approval workflows, files, and universal search.",
      tags: ["locations", "jobs", "policies", "workflows", "files", "search"]
    },
    {
      id: "personalization",
      name: "Inbox & personalization",
      summary: "Per-user surfaces — the inbox, saved list views, favorites and recent activity, comment threads, registered devices, and the help center.",
      tags: ["notifications", "saved-views", "favorites", "comments", "devices", "help"]
    },
    {
      id: "insights",
      name: "Insights",
      summary: "Reads of the platform's state — metrics, ad-hoc queries, dashboards, generated insights, and scheduled reports.",
      tags: ["analytics", "dashboards", "reports"]
    },
    {
      id: "security",
      name: "Security & compliance",
      summary: "Auth, identity federation, mutual-TLS binding, audit retention, right-to-erasure orchestration, and the standards-mandated discovery endpoints.",
      tags: ["auth", "scim", "mtls", "privacy", "audit", "discovery"]
    },
    {
      id: "developers",
      name: "Developers",
      summary: "Programmatic surface for integrators — webhooks (events + CDC + encryption), API keys, platform status, async jobs, AI / Labs, and MSP cross-tenant routing.",
      tags: ["webhooks", "api-keys", "system", "async-jobs", "ai", "msp"]
    }
  ];

  /* ============ sanity ============================================== */
  // Log a one-shot summary so the verifier can spot regressions cheaply.
  if (typeof window !== "undefined" && window.console) {
    var orphaned = spec.tags.filter(function (t) {
      return !(spec.groups || []).some(function (g) { return (g.tags || []).indexOf(t.id) >= 0; });
    });
    if (orphaned.length) {
      console.warn("FW_API_SPEC: orphan tags after rebuild →",
        orphaned.map(function (t) { return t.id; }));
    }
  }
})();
