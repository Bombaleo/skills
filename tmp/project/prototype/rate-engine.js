/* =====================================================================
   Settings · Rate Engine   (window.RE)   v0.01
   ---------------------------------------------------------------------
   Implements uploads/Rate_Engine_Architecture.md — the STRUCTURE-ONLY
   engine that defines HOW a pay rate and a bill rate are calculated, and
   AT WHAT LEVELS, so the rate-card import ends up with exactly the right
   columns. The engine contains NO VALUES (§1, §3): every quantity a rule
   needs is declared only by the LEVEL at which its value will later be
   supplied in the rate-card import.

   Model (§2): a configuration is an ordered stack of GROUPS, each an
   ordered stack of RULES. A rule is a typed, scoped, conditional,
   optionally-banded operation on a running value — PAY at the
   worker-payable boundary, BILL at the end (§6). Every rule reduces to
   four generic types: Base · Adjustment · Markup · Tax/Fee (§4).

   This view RENDERS that structure (organize / inspect / author) and the
   COMPILED OUTPUT: the value-free rate-card schema (§5, §12) plus
   config-time validation (§11) and precedence policy (§10).

   Distinct from the upload's "Pay rate engine" step (§13.5). Self-
   contained: mounts into #re-root from Settings → Rate Engine. Does not
   touch rate-model.js (Rate Model) or rate-cards.js (Rate Simulator).
   IA version: V1.  Everest tokens only.
   ===================================================================== */
(function () {
  "use strict";
  function P() { return window.Proto || {}; }
  function ico(n, c) { return P().ico ? P().ico(n, c) : ""; }
  function esc(s) { return P().escapeHtml ? P().escapeHtml(s) : String(s); }
  function toast(m) { if (P().toast) P().toast(m); }

  // ---- structural vocabularies (no values anywhere) ----------------
  var TYPE_META = {
    "Base":          { label: "Base",                 color: "blue" },
    "Floor":         { label: "Floor / Cap",          color: "teal" },
    "adj-markup":    { label: "Adjustment \u00b7 Markup",    color: "green" },
    "adj-deduction": { label: "Adjustment \u00b7 Deduction", color: "orange" },
    "Markup":        { label: "Markup",               color: "purple" },
    "Tax":           { label: "Tax / Fee",            color: "yellow" },
  };
  var RECIP_META = {
    "Worker":         { color: "blue" },
    "Statutory body": { color: "orange" },
    "Agency":         { color: "purple" },
    "Client":         { color: "teal" },
  };
  var CALC_OPTS = ["Multiplier", "Percentage", "Absolute", "Banded", "Formula", "\u2014"];
  var RECIP_OPTS = ["Worker", "Statutory body", "Agency", "Client"];
  var COND_OPTS = ["\u2014", "Hours threshold", "Specific dates", "Time window", "Days of week", "Tenure", "Earnings threshold", "Age-band relief", "Dimension match"];
  var LEVEL_OPTS = ["Global", "Per Role", "Per Site", "Per Supplier", "Per Role \u00d7 Site \u00d7 Day-type \u00d7 Parity", "Per Supplier \u00d7 Role-group"];

  // ---- in-group conflict resolution (Part A) -----------------------
  //  Every group declares HOW the rules that match a given context combine.
  //  This is STRUCTURE — the policy travels in the compiled output contract
  //  (no values). The calculating layer executes it at runtime; the engine
  //  only declares it. Default "stack" is the historical behaviour, so any
  //  config that does not deliberately set a policy behaves exactly as before.
  var RESOLUTION_META = {
    "stack":       { label: "All apply (stack)",     verb: function (n) { return "all " + n + " stack"; },        desc: "Every matching rule applies, in order, on the running value.", tiebreak: false },
    "highest":     { label: "Highest applies",       verb: function (n) { return "highest of " + n + " applies"; }, desc: "Only the matching rule with the largest \u00a3/hr effect applies.", tiebreak: true },
    "lowest":      { label: "Lowest applies",        verb: function (n) { return "lowest of " + n + " applies"; },  desc: "Only the matching rule with the smallest \u00a3/hr effect applies.", tiebreak: true },
    "first-match": { label: "First match applies",   verb: function (n) { return "first of " + n + " applies"; },   desc: "Matching rules are read top-to-bottom; the first applies, the rest are skipped.", tiebreak: false },
    "exclusive":   { label: "Only one may apply",    verb: function (n) { return "one of " + n + " may apply"; },   desc: "At most one rule may match. If more than one matches, the engine surfaces a conflict rather than silently picking.", tiebreak: false },
  };
  var RESOLUTION_OPTS = ["stack", "highest", "lowest", "first-match", "exclusive"];
  function groupResolution(g) { return (g && RESOLUTION_META[g.resolution]) ? g.resolution : "stack"; }
  // A rule's matching identity for provable-overlap checks: its condition, or a
  // sentinel for "no condition" (always matches). Two rules provably overlap when
  // both are unconditional, or share the same condition.
  function condKey(r) { return (r && r.cond && r.cond !== "\u2014") ? r.cond : "__uncond__"; }
  // Config-time validation for exclusive groups (\u00a7A.4) \u2014 structural only, never
  // inspects values. Returns the provable-overlap warnings for this group.
  function groupIssues(g) {
    var out = [];
    if (!g || groupResolution(g) !== "exclusive") return out;
    var rules = (g.rules || []).filter(function (r) { return !r.synthetic; });
    if (rules.length < 2) return out;
    var uncond = rules.filter(function (r) { return condKey(r) === "__uncond__"; }).length;
    if (uncond >= 1) {
      out.push((uncond === rules.length ? "Every rule here" : (uncond + " rule" + (uncond === 1 ? "" : "s") + " here")) +
        " " + (uncond === 1 ? "has" : "have") + " no condition, so " + (uncond === 1 ? "it always matches" : "they always match") +
        " \u2014 an exclusive group allows at most one match. Add distinguishing conditions, or change the policy.");
      return out;
    }
    var byCond = {};
    rules.forEach(function (r) { var k = condKey(r); byCond[k] = (byCond[k] || 0) + 1; });
    Object.keys(byCond).forEach(function (k) {
      if (byCond[k] >= 2) out.push("Two rules share the \u201c" + k + "\u201d condition, so they can match together \u2014 an exclusive group allows at most one match.");
    });
    return out;
  }

  // Rules an author may add more than once, so several overlapping variants can
  // sit in one group and be combined by that group's resolution policy. Part A
  // retires the old hard "single-instance" block in favour of this — adding a
  // second copy is allowed and resolved by policy, not prevented at add-time.
  var MULTI_ADD_RULES = {
    "uplift": true, "daily overtime": true, "weekly overtime": true,
    "day specific pay": true, "wtr holiday pay": true, "shift differential": true, "holiday pay": true,
  };
  function isMultiAdd(name) { return !!MULTI_ADD_RULES[String(name || "").toLowerCase()]; }

  // ---- Pay / Bill component model (Part B) --------------------------
  //  Five booleans decide the MATH. `recipient` and `side` stay for labelling
  //  and tab placement, but no longer single-handedly decide pay-vs-bill or the
  //  taxable base. Rules carrying explicit flags use them; rules without (every
  //  pre-Part-B config) fall back to the legacy recipient-driven derivation, so
  //  existing behaviour is unchanged. The flags are STRUCTURE — they travel in
  //  the compiled contract; the amounts remain Rate Card inputs.
  var COMPONENT_FLAGS = [
    { k: "paidToWorker",  label: "Paid to the worker",         hint: "Increases the worker\u2019s take-home pay." },
    { k: "inPayBase",     label: "Part of the taxable base",   hint: "Employer NI, pension and WTR holiday are computed on it." },
    { k: "inBill",        label: "Flows into the client bill", hint: "Appears on the client invoice." },
    { k: "markupApplies", label: "Agency markup applies",      hint: "When billed, agency margin is added on top." },
    { k: "taxable",       label: "Output tax (VAT) applies",   hint: "When billed, VAT is charged on it." },
  ];
  function hasExplicitFlags(r) { return !!r && (r.paidToWorker !== undefined || r.inBill !== undefined || r.inPayBase !== undefined); }
  // Resolve a rule's five treatment flags, with a legacy fallback that mirrors
  // the old recipient-only model exactly.
  function ruleFlags(r) {
    if (hasExplicitFlags(r)) {
      return {
        paidToWorker:  !!r.paidToWorker,
        inPayBase:     r.inPayBase !== undefined ? !!r.inPayBase : !!r.paidToWorker,
        inBill:        !!r.inBill,
        markupApplies: !!r.markupApplies,
        taxable:       !!r.taxable,
      };
    }
    var worker = !!r && r.recipient === "Worker";
    var isTax = !!r && r.type === "Tax";
    return {
      paidToWorker:  worker,
      inPayBase:     worker,
      inBill:        !worker,
      markupApplies: false,
      taxable:       !worker && !isTax,
    };
  }

  // ---- Pricing-rule library (add a rule) ---------------------------
  //  The catalogue of rules a configuration can draw from, organized by
  //  scope: Global (everywhere) · Region (e.g. Europe) · Country (e.g. the
  //  UK statutory pack) · Organization (bespoke). Each entry carries the
  //  same structure-only shape a configured rule has, plus `group` (the
  //  target group it lands in) and `desc` (one-line library blurb).
  function libRule(name, def) {
    return Object.assign({
      name: name, type: "adj-markup", calc: "\u2014", base: "Running value",
      recipient: "Worker", scope: "All", cond: "\u2014", banded: null,
      level: "Global", supplies: "the parameters this rule needs",
      vis: ["breakdown"], packSourced: false, group: "allowances", desc: "",
    }, def);
  }
  function RULE_LIBRARY() {
    return [
      { scope: "Global", note: "Available in every configuration", icon: "Globe", rules: [
        libRule("Base Pay Rate", { type: "Base", calc: "Absolute", base: "Pay rate", recipient: "Worker", scope: "per Role \u00d7 Site \u00d7 Day-type \u00d7 Parity", cond: "\u2014", level: "Per Role \u00d7 Site \u00d7 Day-type", supplies: "the standard worker pay rate", group: "base", desc: "The worker\u2019s standard hourly pay rate" }),
        libRule("Markup", { type: "Markup", recipient: "Agency", scope: "per Supplier \u00d7 Role-group", level: "Per Supplier \u00d7 Role-group", supplies: "the markup", vis: ["invoice", "breakdown"], group: "markup", desc: "Agency margin on the burdened cost" }),
        libRule("Holiday pay", { calc: "Percentage", base: "Pay rate", recipient: "Worker", level: "Global", config: "holidaypay", dates: ["01-01", "12-25", "12-26"], params: { multiplier: 1.0, source: "config" }, supplies: "the holiday accrual percentage, multiplier and the holiday dates", group: "holiday", desc: "Rolled-up holiday accrual on pay" }),
        libRule("Shift differential", { calc: "Percentage", recipient: "Worker", cond: "Time window", level: "Per Role \u00d7 Day-type", config: "shiftdiff", bands: [], supplies: "the shift premium per time band", group: "allowances", desc: "Premium for nights and unsocial hours" }),
        libRule("Uplift", { calc: "Absolute", recipient: "Worker", scope: "per Site", cond: "Dimension match", level: "Per Site", config: "uplift", params: { source: "config", valueType: "Absolute", value: 0 }, supplies: "the uplift amount and where it applies", group: "allowances", desc: "Pay uplift over a site, date window or other dimension" }),
        libRule("Daily overtime", { type: "adj-markup", calc: "Multiplier", base: "Pay rate", recipient: "Worker", scope: "per Role", cond: "Daily hours threshold", level: "Per Role", config: "dailyot", params: { hours: 8, multiplier: 1.5, source: "config", valueType: "Percentage" }, supplies: "the daily hours threshold, value type and value", group: "allowances", desc: "Premium pay above an hours-per-day threshold" }),
        libRule("Weekly overtime", { type: "adj-markup", calc: "Multiplier", base: "Pay rate", recipient: "Worker", scope: "per Role", cond: "Weekly hours threshold", level: "Per Role", config: "weeklyot", params: { weeks: 1, hours: 40, multiplier: 1.5, source: "config", valueType: "Percentage" }, supplies: "the averaging period, weekly hours threshold, value type and value", group: "allowances", desc: "Premium pay above an hours-per-week threshold" }),
        libRule("Day Specific Pay", { calc: "Absolute", recipient: "Worker", scope: "per Role \u00d7 Day", cond: "Selected days", level: "Per Role \u00d7 Day", config: "dayspecific", days: ["Saturday", "Sunday"], params: { source: "config", valueType: "Absolute" }, supplies: "a custom pay rate and value type per selected day", group: "allowances", desc: "Set a custom pay rate for chosen days" }),
        libRule("Sick pay", { calc: "Absolute", recipient: "Agency", scope: "per Supplier", level: "Per Supplier", supplies: "the sick-pay amount (\u00a3/hr \u00b7 % of pay \u00b7 none)", group: "employer", desc: "Supplier sick-pay cost" }),
        libRule("Tenure margin reduction", { type: "adj-deduction", calc: "Banded", base: "Margin", recipient: "Agency", scope: "per Role", cond: "Tenure", banded: "by tenure", level: "Per Role (bands)", supplies: "band boundaries and amounts", group: "deductions", desc: "Reduces the margin as tenure grows" }),
      ] },
      { scope: "Extra payments to the worker", note: "Paid on top of the base \u2014 each is pre-set to behave correctly", icon: "PersonPlus", rules: [
        libRule("Tips / Gratuities", { type: "adj-markup", calc: "Absolute", recipient: "Worker", level: "Per Role", config: "extrapay", params: { source: "ratecard", valueType: "Absolute" }, supplies: "the tip amount", group: "additional",
          paidToWorker: true, inPayBase: false, inBill: false, markupApplies: false, taxable: false,
          behaviorNote: "Paid to the worker. Not taxed, not billed to the client.",
          desc: "Gratuities paid to the worker, outside taxable pay and the bill" }),
        libRule("Bonus (taxable)", { type: "adj-markup", calc: "Absolute", recipient: "Worker", level: "Per Role", config: "extrapay", params: { source: "ratecard", valueType: "Absolute" }, supplies: "the bonus amount", group: "additional",
          paidToWorker: true, inPayBase: true, inBill: false, markupApplies: false, taxable: false,
          behaviorNote: "Extra taxable pay to the worker.",
          desc: "Extra taxable pay to the worker" }),
        libRule("Per-diem / Allowance (non-taxable)", { type: "adj-markup", calc: "Absolute", recipient: "Worker", level: "Per Role", config: "extrapay", params: { source: "ratecard", valueType: "Absolute" }, supplies: "the allowance amount", group: "additional",
          paidToWorker: true, inPayBase: false, inBill: false, markupApplies: false, taxable: false,
          behaviorNote: "Allowance paid to the worker, not taxed.",
          desc: "Allowance paid to the worker, outside taxable pay" }),
        libRule("One-off payout", { type: "adj-markup", calc: "Absolute", recipient: "Worker", level: "Per Role", config: "extrapay", params: { source: "ratecard", valueType: "Absolute" }, supplies: "the payout amount", group: "additional",
          paidToWorker: true, inPayBase: true, inBill: false, markupApplies: false, taxable: false,
          behaviorNote: "A one-off payment to the worker, taxed as pay by default.",
          desc: "Sign-on or other one-off worker payment" }),
      ] },
      { scope: "Pass-through costs", note: "Reimbursed to the worker and billed to the client at cost", icon: "Row", rules: [
        libRule("Mileage / Expense reimbursement", { type: "adj-markup", calc: "Absolute", recipient: "Worker", level: "Per Role", config: "extrapay", params: { source: "ratecard", valueType: "Absolute" }, supplies: "the reimbursement amount", group: "additional",
          paidToWorker: true, inPayBase: false, inBill: true, markupApplies: false, taxable: false,
          behaviorNote: "Reimbursed to the worker and billed to the client at cost \u2014 no markup, no tax.",
          desc: "Mileage or expenses reimbursed at cost and passed through to the bill" }),
      ] },
      { scope: "Region \u00b7 Europe", note: "Applies across European markets", icon: "Globe", rules: [
        libRule("VAT", { type: "Tax", calc: "Percentage", recipient: "Client", level: "Statutory pack", packSourced: true, supplies: "nothing \u2014 the standard VAT rate is read from the pack", vis: ["invoice"], group: "taxes", desc: "Standard-rate VAT on the bill" }),
      ] },
      { scope: "Country \u00b7 United Kingdom", note: "UK statutory pack", icon: "Row", rules: [
        libRule("Pension auto-enrolment", { calc: "Percentage", base: "Qualifying-earnings band", recipient: "Statutory body", scope: "per Supplier", cond: "Earnings threshold", level: "Per Supplier", supplies: "the pension percentage on the qualifying band", group: "employer", desc: "Employer pension contribution" }),
        libRule("WTR holiday pay", { calc: "Percentage", base: "Pay rate", recipient: "Worker", level: "Statutory pack", packSourced: true, supplies: "nothing \u2014 the holiday percentage is read from the pack", group: "holiday", desc: "Working Time Regulations holiday" }),
        libRule("Employer NI", { calc: "Percentage", base: "Qualifying earnings", recipient: "Statutory body", cond: "Age-band relief", level: "Statutory pack", packSourced: true, supplies: "nothing \u2014 rate and threshold from the pack", group: "employer", desc: "Employer National Insurance" }),
        libRule("Apprenticeship levy", { calc: "Percentage", base: "Paybill", recipient: "Statutory body", level: "Statutory pack", packSourced: true, supplies: "nothing \u2014 rate from the pack; per-supplier inclusion flag", group: "employer", desc: "0.5% apprenticeship levy" }),
      ] },
    ];
  }
  function groupNameFor(id) {
    var names = { allowances: "Allowances", holiday: "Holiday pay", employer: "Employer contributions", deductions: "Deductions", markup: "Markup", taxes: "Taxes", additional: "Additional payments" };
    return names[id] || "Rules";
  }
  function findLibRule(name) {
    var found = null;
    RULE_LIBRARY().forEach(function (sec) { sec.rules.forEach(function (r) { if (r.name === name) found = r; }); });
    return found;
  }

  // ---- the Evri configuration (UK pack + Staffing template, §4.1) ---
  //  Each rule lists ONLY structure. `supplies` names what the import
  //  later collects at `level`; it is documentation, not a value.
  function CONFIG() {
    return {
      name: "Evri pricing configuration",
      version: "v4",
      pack: "United Kingdom",
      template: "Staffing",
      unit: "Hourly",
      currency: "GBP",
      variantAxis: "Parity",
      dimensions: ["Region tier", "Site", "Position (role)", "Parity", "Day-type"],
      // The five agency-level variables the Agency Rate Configuration step owns
      // and the only supplier-set inputs that feed the bill rate (spec C8 / \u00a73).
      // Everything else is pay-side (Pay Rate Configuration) or pack-owned (read-only).
      agencyVars: [
        { name: "Markup", detail: "\u00a3/hr", level: "per supplier \u00d7 position group", varies: true },
        { name: "Pension %", detail: "% of qualifying band", level: "per supplier \u00d7 position group", varies: true },
        { name: "Weekly hours", detail: "35 \u00b7 37.5 \u00b7 40", level: "per supplier \u00d7 position group", varies: true },
        { name: "Sick pay", detail: "\u00a3/hr \u00b7 % of pay \u00b7 none", level: "per supplier", applyAll: true },
        { name: "Levy inclusion", detail: "Y / N", level: "per supplier", applyAll: true },
      ],
      groups: [
        { id: "base", side: "pay", name: "Base Pay Rate", kicker: "base", locked: true, resolution: "stack", rules: [
          { id: "r-base", name: "Base Pay Rate", type: "Base", calc: "\u2014", base: "\u2014", recipient: "Worker", scope: "per Role \u00d7 Site \u00d7 Day-type \u00d7 Parity", cond: "\u2014", banded: null, level: "Per Role \u00d7 Site \u00d7 Day-type \u00d7 Parity", supplies: "The base pay rates per role, site, day-type and parity", vis: ["breakdown"], locked: true, paidToWorker: true, inPayBase: true, inBill: true, markupApplies: true, taxable: true, behaviorNote: "Standard worker pay \u2014 taxed, builds the bill, marked up." },
        ] },
        { id: "markup", side: "bill", name: "Markup", locked: true, resolution: "stack", rules: [
          { id: "r-markup", name: "Markup", type: "Markup", calc: "\u2014", base: "Running value", recipient: "Agency", scope: "per Supplier \u00d7 Role-group", cond: "\u2014", banded: null, level: "Per Supplier \u00d7 Role-group", supplies: "The markup", vis: ["invoice", "breakdown"], locked: true, paidToWorker: false, inPayBase: false, inBill: true, markupApplies: false, taxable: true, behaviorNote: "Agency margin \u2014 added to the bill and taxed, not paid to the worker." },
        ] },
        { id: "taxes", side: "bill", name: "Taxes", resolution: "stack", rules: [
          { id: "r-vat", name: "VAT", type: "Tax", calc: "Percentage", base: "Running value", recipient: "Client", scope: "All", cond: "\u2014", banded: null, level: "Statutory pack", packSourced: true, supplies: "nothing \u2014 the 20% rate is read from the pack", vis: ["invoice"], locked: true, paidToWorker: false, inPayBase: false, inBill: true, markupApplies: false, taxable: false, behaviorNote: "Output tax on the bill \u2014 not paid to the worker, not itself taxed." },
        ] },
      ],
    };
  }

  // ============================================================ configs
  //  v0.02 — Multiple pricing configurations, each with its own versions.
  //  CONFIG() above is the canonical Evri structure; the registry below
  //  wraps it (and a few sibling contracts) into per-legal-entity
  //  configurations, each carrying an ordered version history. The active
  //  config's active version supplies the live `groups` via syncCfg(), so
  //  every existing S.cfg.* path keeps working. Structure is versioned:
  //  only a DRAFT is editable; published / archived versions are read-only
  //  (§12). A configuration is identified by its legal entity — no name.
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function todayLabel() { try { return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return "Today"; } }
  function CONFIGS() {
    var evri = CONFIG();
    // A version owns its own deep-cloned structure so edits never bleed across versions.
    function v(id, label, status, date, author, note) {
      return { id: id, label: label, status: status, date: date, author: author, note: note, groups: clone(evri.groups) };
    }
    function entity(id, legalEntity) {
      return { id: id, legalEntity: legalEntity, pack: "United Kingdom", template: "Staffing", unit: "Hourly", currency: "GBP", variantAxis: "Parity",
        dimensions: clone(evri.dimensions), agencyVars: clone(evri.agencyVars), activeVersionId: null, versions: [] };
    }
    var configs = [
      { id: "evri", legalEntity: "Evri UK Ltd", pack: evri.pack, template: evri.template, unit: evri.unit, currency: evri.currency, variantAxis: evri.variantAxis,
        dimensions: evri.dimensions, agencyVars: evri.agencyVars, activeVersionId: "evri-v4",
        versions: [
          Object.assign(v("evri-v5", "v5", "draft",     "2 Jun 2026",  "Elijah Bilokur",   "Adds the sick-pay supplier cost and age-band NI relief; not yet live."),     { conditions: { legalEntity: ["Evri UK Ltd"], tenureStatus: [], location: [], position: [], jobType: [] } }),
          Object.assign(v("evri-v4", "v4", "published", "12 May 2026", "Dmitry Grechko",    "Current live structure \u2014 parity uplift with the split WTR holiday rate."), { conditions: { legalEntity: ["Evri UK Ltd"], tenureStatus: ["any", "new"], location: [], position: [], jobType: ["HGV Driver"] } }),
          Object.assign(v("evri-v3", "v3", "archived",  "18 Feb 2026", "Dmitry Grechko",    "Pre-parity baseline, before the holiday-rate split."),                       { conditions: { legalEntity: ["Evri UK Ltd"], tenureStatus: ["any"], location: [], position: [], jobType: [] } }),
          Object.assign(v("evri-v2", "v2", "archived",  "4 Nov 2025",  "Dominic Esposito",  "Added employer NI and pension auto-enrolment."),                            { conditions: { legalEntity: ["Evri UK Ltd"], tenureStatus: [], location: [], position: [], jobType: [] } }),
          Object.assign(v("evri-v1", "v1", "archived",  "20 Aug 2025", "Dominic Esposito",  "Initial base, markup and VAT only."),                                       { conditions: {} }),
        ] },
    ];
    var prem = entity("evrip", "Evri Premium Ltd"); prem.activeVersionId = "evrip-v2";
    prem.versions = [
      Object.assign(v("evrip-v3", "v3", "draft",     "5 Jun 2026",  "Elijah Bilokur",   "Premium uplift under review; not yet live."),  { conditions: { legalEntity: ["Evri Premium Ltd"], tenureStatus: [], location: [], position: [], jobType: [] } }),
      Object.assign(v("evrip-v2", "v2", "published", "20 May 2026", "Dmitry Grechko",   "Live premium structure \u2014 higher markup band."), { conditions: { legalEntity: ["Evri Premium Ltd"], tenureStatus: ["tenured", "senior"], location: [], position: [], jobType: ["HGV Driver"] } }),
      Object.assign(v("evrip-v1", "v1", "archived",  "10 Feb 2026", "Dominic Esposito", "Initial premium structure."),                     { conditions: { legalEntity: ["Evri Premium Ltd"], tenureStatus: [], location: [], position: [], jobType: [] } }),
    ];
    configs.push(prem);
    return configs;
  }

  function activeConfig() { for (var i = 0; i < S.configs.length; i++) if (S.configs[i].id === S.activeConfigId) return S.configs[i]; return S.configs[0]; }
  function activeVersion() { var c = activeConfig(); for (var i = 0; i < c.versions.length; i++) if (c.versions[i].id === c.activeVersionId) return c.versions[i]; return c.versions[0]; }
  function isEditable() { return activeVersion().status === "draft"; }
  // ---- unsaved-changes tracking (Save the pricing structure) ----------
  //  Structural edits to a draft are staged in memory and only "committed"
  //  when the user saves. We track a dirty flag per version id so switching
  //  versions doesn't carry another version's pending state.
  function markDirty() { if (!isEditable()) return; if (!S.dirty) S.dirty = {}; S.dirty[activeVersion().id] = true; }
  function isDirty() { return !!(S.dirty && S.dirty[activeVersion().id]); }
  function saveStructure() {
    if (!isEditable()) { toast("Only a draft version can be saved"); return; }
    if (!isDirty()) { toast("No changes to save"); return; }
    var av = activeVersion();
    delete S.dirty[av.id];
    av.date = todayLabel();          // stamp the draft with the save date
    av.note = "Edited \u2014 saved " + av.date + ".";
    toast("Pricing structure saved"); RE._render();
  }
  // Expose the active version's structure + label on the active config so all
  // existing S.cfg.groups / S.cfg.name / S.cfg.version code keeps working.
  function syncCfg() { var c = activeConfig(), av = activeVersion(); c.groups = av.groups; c.version = av.label; S.cfg = c; return c; }
  // The pay rate is the worker-payable portion of the chain: every rule whose
  // recipient is the Worker (base pay, allowances, holiday pay). There is no
  // per-rule "payable" flag — pay-side membership is derived from the recipient.
  // Pay-side membership is now flag-driven: a component is paid to the worker
  // when its resolved `paidToWorker` flag is set (Part B). Rules without explicit
  // flags fall back to the legacy recipient === "Worker" rule via ruleFlags().
  function isPayRule(r) { return ruleFlags(r).paidToWorker; }

  // ---- compiled rate-card schema (§5) — derived from rule levels -----
  function compiledSchema(cfg) {
    var perRow = [], site = [], supplier = [], global = [], pack = [];
    cfg.groups.forEach(function (g) {
      g.rules.forEach(function (r) {
        var lv = r.level;
        // Pack-owned values are read-only statutory inputs, not rate-card columns.
        if (r.packSourced) { pack.push(r.name); return; }
        // Part D — Custom (in-engine) values are held on the rule, not imported,
        // so only Rate card-sourced values become columns here.
        if (!ruleIsRateCardSourced(r)) return;
        if (/Role \u00d7 Site/.test(lv) || lv.indexOf("Day-type") >= 0) perRow.push(r.name);
        else if (lv.indexOf("Per Site") === 0) site.push(r.name);
        else if (lv.indexOf("Per Supplier") === 0) supplier.push(r.name); // superseded by agencyVars below
        else if (lv.indexOf("Per Role") === 0) perRow.push(r.name);
        else global.push(r.name);
      });
    });
    // Part A — per-group resolution policy travels in the contract.
    var policies = [];
    cfg.groups.forEach(function (g) {
      if (g.synthetic) return;
      var res = groupResolution(g);
      policies.push({ group: g.name, id: g.id, resolution: res, tiebreaker: "array-order (top wins)", rules: (g.rules || []).length });
    });
    // Part B — each component's treatment (the five flags) travels in the
    // contract too, so downstream consumers compute pay/base/bill correctly.
    var treatments = [];
    cfg.groups.forEach(function (g) {
      if (g.synthetic) return;
      g.rules.forEach(function (r) {
        var f = ruleFlags(r);
        treatments.push({ name: r.name, paidToWorker: f.paidToWorker, inPayBase: f.inPayBase, inBill: f.inBill, markupApplies: f.markupApplies, taxable: f.taxable });
      });
    });
    return { keys: cfg.dimensions, perRow: perRow, site: site, supplier: cfg.agencyVars, global: global, pack: pack, policies: policies, treatments: treatments };
  }

  // ====================================== Rate Card custom Lookup (keys)
  //  The keying dimensions a rate card varies pay by. POSITION is the
  //  always-present, locked first key (you can't change or remove it).
  //  The rest are optional conditions the user adds; their left-to-right
  //  order is the lookup priority. "Tenure status" is the AWR pre/post
  //  parity split, derived from the worker's 12-week tenure.
  var LOOKUP_CONDS = {
    jobtype:  { key: "jobtype",  label: "Job type",      values: ["Warehouse", "HGV Driver", "Van Driver"], note: "from rate cards" },
    tenure:   { key: "tenure",   label: "Tenure status", values: ["Pre-parity", "Post-parity"], note: "AWR 12-week rule" },
    entity:   { key: "entity",   label: "Legal entity",  values: ["Evri", "Evri Premium"] },
    location: { key: "location", label: "Location",      values: ["Birmingham", "Eurocentral", "Warrington", "Rugby", "Nuneaton"] },
    agency:   { key: "agency",   label: "Agency",        values: ["DCS Recruitment", "Staffline Group", "The Recruitment Crowd"] },
  };
  var LOOKUP_ADD_ORDER = ["jobtype", "tenure", "entity", "location", "agency"]; // offer order in the Add menu
  // Lookup is split into independent Pay and Bill configs.
  function lookupActiveFor(side) {
    var arr = side === "bill" ? (S.lookupBill || []) : (S.lookupPay || []);
    return arr.filter(function (k) { return LOOKUP_CONDS[k]; });
  }
  function lookupActive() { return lookupActiveFor("pay"); }
  function lookupKeyLabelsFor(side) { return ["Position"].concat(lookupActiveFor(side).map(function (k) { return LOOKUP_CONDS[k].label; })); }
  function lookupKeyLabels() { return lookupKeyLabelsFor("pay"); }
  // Value columns the rate card must supply — every pricing rule whose value
  // the import fills (pack/statutory rules are computed, so excluded). This
  // is what ties the template to the Pricing rules section: add or remove a
  // rule there and a column appears or disappears here.
  // ---- Part D: per-value source — Custom (in-engine) vs Rate card ----
  //  Source is a first-class property of every authorable (non-statutory) value.
  //  The old hardcoded allowlist is gone: every rule whose value the author owns
  //  gets the Custom / Rate card choice. Statutory-pack values stay read-only.
  //  Default is by level — a Global org-wide constant defaults to Custom; a
  //  per-dimension value defaults to Rate card.
  var SOURCE_TOGGLE_CONFIGS = ["uplift","holidaypay","holidaydates","dayspecific","dailyot","weeklyot"];
  var SOURCE_TOGGLE_NAMES   = ["Sick pay","Tenure margin reduction","Pension auto-enrolment","Employer NI","Apprenticeship levy"];
  // Statutory / pack values are read-only (supplied by the jurisdiction pack);
  // synthetic carry-ins have no value. Everything else is author-owned.
  function ruleSourceReadOnly(r) { return !!r && (r.packSourced || r.synthetic || r.recipient === "Statutory body"); }
  function ruleHasSourceToggle(r) { return !!r && !ruleSourceReadOnly(r); }
  // Level-based default: Global authorable → Custom ("config"); per-dimension → Rate card.
  function ruleDefaultSource(r) {
    if (!r || !r.level || r.level === "\u2014" || r.level === "Global") return "config";
    return "ratecard";
  }
  // Effective source: "pack" (read-only), explicit params.source, or the level default.
  function ruleEffectiveSource(r) {
    if (ruleSourceReadOnly(r)) return "pack";
    if (r.params && r.params.source) return r.params.source;
    return ruleDefaultSource(r);
  }
  function ruleIsRateCardSourced(r) {
    // Only Rate card-sourced values become import columns. Custom (in-engine)
    // and pack values are excluded, so the import shape mirrors the source choices.
    if (ruleSourceReadOnly(r)) return false;
    return ruleEffectiveSource(r) === "ratecard";
  }
  function ruleValueColumns() {
    var out = [], seen = {};
    (S.cfg.groups || []).forEach(function (g) {
      g.rules.forEach(function (r) {
        if (r.packSourced) return;
        if (!ruleIsRateCardSourced(r)) return;
        if (seen[r.name]) return; seen[r.name] = 1;
        out.push(ruleColLabel(r));
      });
    });
    return out;
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadRateCardCsv() {
    try {
      var cols = lookupKeyLabels().concat(ruleValueColumns());
      var c = activeConfig();
      var fname = (c.legalEntity || "rate-card").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") + "-rate-card-template.csv";
      var blob = new Blob([cols.map(csvCell).join(",") + "\n"], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
      toast("CSV template downloaded \u2014 " + cols.length + " columns from your lookup and pricing rules");
    } catch (err) {
      try { if (window.console && console.error) console.error("[RateEngine] CSV download failed:", err); } catch (x) {}
      toast("Couldn\u2019t generate the CSV template");
    }
  }
  function lookupAdd(sideKey) {
    var p = sideKey.split(":"), side = p[0], k = p[1];
    if (!isEditable() || !LOOKUP_CONDS[k]) return;
    var arr = lookupActiveFor(side);
    if (arr.indexOf(k) >= 0) return;
    arr.push(k);
    if (side === "bill") S.lookupBill = arr; else S.lookupPay = arr;
    markDirty(); RE._render();
  }
  function lookupRemove(sideKey) {
    var p = sideKey.split(":"), side = p[0], k = p[1];
    if (!isEditable()) return;
    var arr = lookupActiveFor(side).filter(function (x) { return x !== k; });
    if (side === "bill") S.lookupBill = arr; else S.lookupPay = arr;
    markDirty(); RE._render();
  }
  function lookupMove(sideKey, dir) {
    if (!isEditable()) return;
    var p = sideKey.split(":"), side = p[0], k = p[1];
    var a = lookupActiveFor(side), i = a.indexOf(k), j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return;
    var t = a[i]; a[i] = a[j]; a[j] = t;
    if (side === "bill") S.lookupBill = a; else S.lookupPay = a;
    markDirty(); RE._render();
  }

  // ============================================================ state
  var RE = {};
  window.RE = RE;
  var S = null;
  var dragRuleId = null;   // id of the rule currently being dragged (reorder)
  var dragGroupId = null;  // id of the group currently being dragged (reorder)
  var dragLkKey = null;    // "side:key" of the lookup chip being dragged (reorder)

  RE.reset = function () { RE.state = null; };

  // Public: compute value columns for a specific config + version.
  // Returns { pay: [...labels], bill: [...labels] } or null.
  // Used by rate-cards-v2 to show the expected column structure for the
  // user's chosen Rate Engine version during the upload flow.
  RE.getVersionColumns = function (engineId, versionId) {
    try {
      if (!RE.state) return null;
      var cfg = null;
      RE.state.configs.forEach(function (c) { if (c.id === engineId) cfg = c; });
      if (!cfg || !cfg.versions || !cfg.versions.length) return null;
      var version = null;
      cfg.versions.forEach(function (v) {
        if (v.id === versionId) version = v;
      });
      if (!version) {
        cfg.versions.forEach(function (v) { if (v.id === cfg.activeVersionId && !version) version = v; });
        if (!version) version = cfg.versions[0];
      }
      if (!version || !version.groups) return null;
      var grps = version.groups;
      function grpSide(g) { return g && g.side === "pay" ? "pay" : "bill"; }
      function colsFor(side) {
        var out = [], seen = {};
        grps.filter(function (g) { return grpSide(g) === side && !g.synthetic; }).forEach(function (g) {
          g.rules.forEach(function (r) {
            if (r.packSourced) return;
            if (!ruleIsRateCardSourced(r)) return;
            if (seen[r.name]) return; seen[r.name] = 1;
            out.push(ruleColLabel(r));
          });
        });
        return out;
      }
      return { pay: colsFor("pay"), bill: colsFor("bill") };
    } catch (e) { return null; }
  };
  RE._build = function () {
    RE.state = {
      configs: CONFIGS(),
      activeConfigId: "evri",
      configMenuOpen: false,
      versionMenuOpen: false,
      variant: "Pre",
      density: "summary",
      q: "",
      collapsed: { base:true, markup:true, taxes:true },
      expanded: {},
      sectionCollapsed: { rules: true, lookup: true },  // both sections start collapsed
      lookupStripCollapsed: true,  // lookup strip inside Pricing rules starts collapsed
      side: "pay",
      // Rate Card custom Lookup — the optional condition keys (in lookup
      // priority order) the rate card varies by. Position is the implicit,
      // always-first, locked key and is NOT stored here.
      lookupPay:  ["jobtype", "tenure", "entity", "location", "agency"],
      lookupBill: ["jobtype", "tenure", "entity", "location", "agency"],
      sheet: "pay",   // C10 — active template sheet (in the View template overlay)
      tplOpen: false, // C10 — View template overlay visibility
      tplFmt:  "xlsx", // preferred template download format ("xlsx" | "csv")
      libOpen: false, // add-a-pricing-rule library modal visibility
      libQuery: "",   // type-to-search filter inside the library modal
      libTargetGroup: null, // when set, library "Add" lands the rule in this group
      groupEdit: null, // { open, groupId|null, isNew, name, selected:{nameLower:true} }
      dirty: {},      // unsaved structural edits, keyed by version id
      selectedRule: null, // which rule's config panel is open on the right
      _seq: 1,
      view: "table",   // "table" = landing overview, "detail" = per-entity editor
      conditionsForm: null, // null | { conditions: {} } — set while creating a new version
    };
  };
  RE.mount = function (root) {
    RE._root = root;
    if (!root) return;
    try {
      if (!RE.state) RE._build();
      S = RE.state;
      RE._render();
      RE._wireOnce();
    } catch (err) {
      crashFallback(root, err);
    }
  };

  // Crash-proof fallback — never leave the surface blank. The engine is a
  // structure-only authoring tool; a render error must degrade to a legible
  // notice (with a retry) rather than a white screen or a console-only throw.
  function crashFallback(root, err) {
    try { if (window.console && console.error) console.error("[RateEngine] render failed:", err); } catch (x) {}
    var msg = (err && err.message) ? err.message : "Unexpected error";
    root.innerHTML =
      '<div class="re-crash" role="alert">' +
        '<div class="re-crash-head">' + ico("Alert") + '<span>The Rate Engine couldn\u2019t finish drawing.</span></div>' +
        '<p class="re-crash-body">No configuration was changed \u2014 nothing is saved until you author it. You can retry the view safely.</p>' +
        '<pre class="re-crash-detail">' + esc(String(msg)) + '</pre>' +
        '<div class="re-crash-actions">' +
          '<button class="re-btn" data-re-retry>Retry</button>' +
          '<button class="re-link" data-re-reset>Reset to default configuration</button>' +
        '</div>' +
      '</div>';
    if (window.Proto) try { window.Proto.fillIcons(root); } catch (x) {}
    // Minimal, self-contained wiring so the fallback always responds.
    if (!root.__reCrashWired) {
      root.__reCrashWired = true;
      root.addEventListener("click", function (e) {
        if (e.target.closest("[data-re-retry]")) { RE.mount(root); }
        else if (e.target.closest("[data-re-reset]")) { RE.reset(); RE.mount(root); }
      });
    }
  }

  // ============================================================ render
  RE._render = function () {
    if (!RE._root) return;
    S = RE.state;
    syncCfg();
    try {
      if (S.view === "table") {
        RE._root.innerHTML = tableView();
        if (window.Proto) window.Proto.fillIcons(RE._root);
        return;
      }
      RE._root.innerHTML =
        breadcrumb() +
        principleBar() +
        header() +
        section("rules", "1", "Pricing rules", "How the pay and bill rate are calculated, in order \u2014 structure only, no values.",
          tabsBar() + lookupStrip(S.side === "bill" ? "bill" : "pay") + subbar() +
          '<div class="re-layout' + (S.selectedRule ? ' has-panel' : '') + '">' +
            '<div class="re-stack">' + stack() + '</div>' +
            (S.selectedRule ? '<div class="re-rpanel">' + rulePanel() + '</div>' : '') +
          '</div>') +
        connector() +
        section("lookup", "2", "Rate card structure", "The columns that form each rate card \u2014 key columns from the lookup above, plus value columns from the pricing rules.",
          rateStructureSection()) +
        templateModal() +
        libraryModal() +
        groupEditorModal() +
        (S.removeCfgConfirm ? removeConfigModal() : '');
      if (window.Proto) window.Proto.fillIcons(RE._root);
      // The group editor owns focus while open — focus its name field once.
      if (S.groupEdit && S.groupEdit.open && !S.groupEdit._focused) {
        var geName = RE._root.querySelector("[data-re-gename]");
        if (geName) { S.groupEdit._focused = true; try { geName.focus(); geName.select(); } catch (x) {} }
      }
      // Auto-focus the library search when the add-a-rule modal first opens.
      if (S.libOpen && !S._libFocused) {
        var lqEl = RE._root.querySelector("[data-re-libq]");
        if (lqEl) { S._libFocused = true; try { lqEl.focus(); } catch (x) {} }
      }
      if (!S.libOpen && S._libFocused) S._libFocused = false;
      // Just added a custom group? Focus + select its name so it's renamed on the spot.
      if (S._focusGroupId) {
        var gnameEl = RE._root.querySelector('[data-re-grpname="' + S._focusGroupId + '"]');
        S._focusGroupId = null;
        if (gnameEl) { try { gnameEl.focus(); gnameEl.select(); } catch (x) {} }
      }
      // Restore focus to a param input after a value edit re-render.
      if (S._focusParam) {
        var pEl = RE._root.querySelector('[data-re-ruleparam="' + S._focusParam + '"]');
        S._focusParam = null;
        if (pEl) { try { pEl.focus(); } catch (x) {} }
      }
    } catch (err) {
      crashFallback(RE._root, err);
    }
  };

  // Download both pay and bill templates in the user’s preferred format.
  function downloadTemplatesBoth() {
    var fmt = S.tplFmt || "xlsx";
    try { downloadTemplate("pay", false, fmt); } catch (ex) {}
    setTimeout(function () { try { downloadTemplate("bill", false, fmt); } catch (ex) {} }, 400);
  }
  // Exposed so the Rate Cards page can trigger template downloads with engine context.
  RE.downloadBothTemplates = function (engineId, versionId) {
    if (!RE.state) RE._build();
    S = RE.state;
    syncCfg();
    // Temporarily switch to the requested engine config + version
    var prevConfigId = S.activeConfigId;
    var prevVerIds = {};
    if (engineId) {
      var targetCfg = null;
      S.configs.forEach(function(c){ if(c.id===engineId) targetCfg=c; });
      if (targetCfg) {
        S.configs.forEach(function(c){ prevVerIds[c.id]=c.activeVersionId; });
        S.activeConfigId = engineId;
        if (versionId) targetCfg.activeVersionId = versionId;
        syncCfg();
      }
    }
    var fmt = S.tplFmt || "xlsx";
    try { downloadTemplate("pay", true, fmt); } catch (ex) {}
    setTimeout(function () {
      try { downloadTemplate("bill", true, fmt); } catch (ex) {}
      // Restore original config/version
      if (engineId) {
        S.activeConfigId = prevConfigId;
        S.configs.forEach(function(c){ if(prevVerIds[c.id]!==undefined) c.activeVersionId=prevVerIds[c.id]; });
        syncCfg();
      }
    }, 400);
  };

  // ---- remove configuration confirm dialog -------------------------
  function removeConfigModal() {
    var cid = S.removeCfgConfirm; if (!cid) return '';
    var cfg = null; S.configs.forEach(function (c) { if (c.id === cid) cfg = c; });
    if (!cfg) return '';
    return '<div class="re-confirm-overlay">' +
      '<div class="re-confirm-modal" role="dialog" aria-modal="true">' +
        '<div class="re-confirm-ico">' + ico('TrashCan') + '</div>' +
        '<h2 class="re-confirm-title">Remove pricing configuration?</h2>' +
        '<p class="re-confirm-body"><strong>' + esc(cfg.legalEntity) + ' pricing configuration</strong> and all its version history will be permanently removed. This cannot be undone.</p>' +
        '<div class="re-confirm-actions">' +
          '<button class="re-btn" data-re-removecfg-cancel>Cancel</button>' +
          '<button class="re-btn re-btn--danger" data-re-removecfg-confirm>Remove configuration</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- table view: landing page listing all legal entities ----------
  function tableView() {
    var rows = S.configs.map(function (c) {
      // find the active (published) version and any draft
      var active = null, draft = null;
      c.versions.forEach(function (v) {
        if (v.id === c.activeVersionId) active = v;
        if (v.status === "draft" && !draft) draft = v;
      });
      if (!active) active = c.versions[0];
      var metaChips = [
        c.pack, c.template, c.currency
      ].map(function (v) {
        return '<span class="re-tv-chip">' + esc(v) + '</span>';
      }).join('');
      return '<tr class="re-tv-row re-tv-row--clickable" data-re-viewentity="' + esc(c.id) + '">' +
        '<td class="re-tv-name">' +
          '<span class="re-tv-entity">' + esc(c.legalEntity) + '</span>' +
        '</td>' +
        '<td class="re-tv-cfgname">' +
          '<span class="re-tv-cfgnametext">' + esc(c.legalEntity) + ' pricing configuration</span>' +
        '</td>' +
        '<td class="re-tv-version">' +
          '<span class="re-tv-verlabel">' + esc(active.label) + '</span>' +
        '</td>' +
        '<td class="re-tv-action">' +
          '<button class="re-tv-remove-btn" data-re-removecfg="' + esc(c.id) + '" title="Remove configuration">' + ico('TrashCan') + '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    return '<div class="re-tv-wrap">' +
      '<div class="re-tv-toolbar">' +
        '<div class="re-tv-titles">' +
          '<h2 class="re-tv-heading">Rate engine</h2>' +
          '<p class="re-tv-sub">Structure-only pricing configurations per legal entity — no values, no rates. Each defines how pay and bill are calculated.</p>' +
        '</div>' +
        '<button class="re-btn re-btn--primary" data-re-newcfg>' + ico('AddCircle') + 'Add pricing configuration</button>' +
      '</div>' +
      '<div class="re-principle">' + ico("Information") +
        '<span><strong>Structure only — no values.</strong> The engine defines the method and level of every value, then emits a value-free schema. Every rate, multiplier and threshold is entered later in the rate-card import.</span>' +
      '</div>' +
      '<table class="re-tv-table">' +
        '<thead>' +
          '<tr>' +
            '<th class="re-tv-th">Legal entity</th>' +
            '<th class="re-tv-th">Name</th>' +
            '<th class="re-tv-th re-tv-th--ver">Active version</th>' +
            '<th class="re-tv-th re-tv-th--action"></th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    (S.removeCfgConfirm ? removeConfigModal() : '');
  }

  // ---- breadcrumb: back to table from detail view -----------------
  function breadcrumb() {
    return '<nav class="re-breadcrumb">' +
      '<button class="re-breadcrumb-back" data-re-backtotable>' +
        ico('ChevronLeft') +
        '<span>Rate engine</span>' +
      '</button>' +
      '<span class="re-breadcrumb-sep" aria-hidden="true">/</span>' +
      '<span class="re-breadcrumb-cur">' + esc(activeConfig().legalEntity) + '</span>' +
    '</nav>';
  }

  function principleBar() {
    return '<div class="re-principle">' + ico("Information") +
      '<span><strong>Structure only \u2014 no values.</strong> The engine defines the method and the level of every value, then emits a value-free schema. Every rate, multiplier, percentage and threshold is entered later in the rate-card import, at the level declared here.</span>' +
    '</div>';
  }

  // ---- status pill (Published / Draft / Archived) ------------------
  var STATUS_META = {
    published: { label: "Active",   cls: "ok",    word: "active" },
    draft:     { label: "Draft",    cls: "draft", word: "draft" },
    archived:  { label: "Archived", cls: "arch",  word: "archived" },
  };
  function statusPill(status) {
    var m = STATUS_META[status] || { label: status, cls: "arch", word: status };
    return '<span class="re-status re-status--' + m.cls + '">' + (status === "published" ? ico("Check") : "") + m.label + '</span>';
  }
  function statusWord(status) { return (STATUS_META[status] || { word: status }).word; }

  function header() {
    var c = activeConfig(), av = activeVersion();
    var chips = [
      ["Pack", c.pack], ["Template", c.template], ["Unit", c.unit], ["Currency", c.currency], ["Variant axis", c.variantAxis],
    ].map(function (m) { return '<span class="re-meta"><span class="re-meta-l">' + m[0] + '</span><span class="re-meta-v">' + esc(m[1]) + '</span></span>'; }).join("");
    return '<div class="re-header">' +
      '<div class="re-header-top">' +
        '<div class="re-title-wrap">' +
          '<div class="re-idrow">' +
            '<button class="re-verpill' + (S.versionMenuOpen ? " is-open" : "") + '" data-re-vermenu aria-haspopup="listbox" aria-expanded="' + S.versionMenuOpen + '" title="Version history">' +
              '<span class="re-verpill-l">' + esc(av.label) + '</span>' + statusPill(av.status) + ico("ChevronDown", "re-verpill-chev") +
            '</button>' +
            versionMenu() +
          '</div>' +
        '</div>' +
        '<button class="re-btn re-btn--danger-ghost re-header-remove-btn" data-re-removecfg="' + c.id + '">' + ico('TrashCan') + 'Remove</button>' +
      '</div>' +
      conditionsPanel() +
      readonlyBanner() +
      saveBar() +
      ((S.configMenuOpen || S.versionMenuOpen) ? '<div class="re-menu-backdrop" data-re-menuclose></div>' : "") +
    '</div>';
  }

  // ---- conditions panel: read-only on existing versions, form when creating new ----
  function conditionsPanel() {
    var proto = (typeof window !== 'undefined') && window.Proto;
    var chainTypes = proto && proto.getChainTypes ? proto.getChainTypes() : [];
    if (!chainTypes.length) return "";

    // ---- Form: creating a new version ----
    if (S.conditionsForm) {
      var conds = S.conditionsForm.conditions || {};
      var fields = chainTypes.map(function (t) {
        var opts = proto.getChainOpts ? proto.getChainOpts(t.id) : [];
        var checks = opts.map(function (o) {
          var sel = (conds[t.id] || []).indexOf(o.v) >= 0;
          return '<label class="re-cond-check"><input type="checkbox" data-re-cond-type="' + esc(t.id) + '" data-re-cond-val="' + esc(o.v) + '"' + (sel ? " checked" : "") + '> ' + esc(o.l) + '</label>';
        }).join("");
        return '<div class="re-cond-form-type"><div class="re-cond-type-label">' + esc(t.label) + '</div>' +
          '<div class="re-cond-checks">' + (checks || '<span class="re-cond-empty">No options available</span>') + '</div></div>';
      }).join("");
      return '<div class="re-conditions re-conditions--form">' +
        '<div class="re-conditions-head">' +
          '<span class="re-conditions-title">Set conditions for new version</span>' +
          '<span class="re-conditions-hint">Select which lookup values this version applies to. Leave unchecked to match all.</span>' +
        '</div>' +
        '<div class="re-cond-form-fields">' + fields + '</div>' +
        '<div class="re-cond-form-footer">' +
          '<button class="re-cond-btn re-cond-btn--primary" data-re-cond-confirm>Create version</button>' +
          '<button class="re-cond-btn re-cond-btn--ghost" data-re-cond-cancel>Cancel</button>' +
        '</div>' +
      '</div>';
    }

    // ---- Read-only: show conditions of the active version ----
    var av = activeVersion();
    var conds2 = av.conditions || {};
    var hasAny = chainTypes.some(function (t) { return (conds2[t.id] || []).length > 0; });
    if (!hasAny) {
      return '<div class="re-conditions">' +
        '<div class="re-conditions-head">' +
          '<span class="re-conditions-title">Conditions</span>' +
          '<span class="re-conditions-hint re-conditions-all">Applies to all — no conditions set</span>' +
        '</div>' +
      '</div>';
    }
    var rows = chainTypes.map(function (t) {
      var vals = conds2[t.id] || [];
      if (!vals.length) return '';
      var proto2 = window.Proto;
      var opts = proto2 && proto2.getChainOpts ? proto2.getChainOpts(t.id) : [];
      var chips = vals.map(function (v) {
        var opt = opts.filter(function (o) { return o.v === v; })[0];
        return '<span class="re-cond-chip">' + esc(opt ? opt.l : v) + '</span>';
      }).join("");
      return '<div class="re-cond-row"><span class="re-cond-type-label">' + esc(t.label) + '</span>' +
        '<div class="re-cond-chips">' + chips + '</div></div>';
    }).join("");
    return '<div class="re-conditions">' +
      '<div class="re-conditions-head">' +
        '<span class="re-conditions-title">Conditions</span>' +
        '<span class="re-conditions-hint">This version applies when the following lookup values match</span>' +
      '</div>' +
      '<div class="re-cond-rows">' + rows + '</div>' +
    '</div>';
  }

  // ---- configuration switcher menu ---------------------------------
  function configMenu() {
    if (!S.configMenuOpen) return "";
    var rows = S.configs.map(function (c) {
      var on = c.id === S.activeConfigId;
      var head = null;
      c.versions.forEach(function (vv) { if (vv.status === "published" && !head) head = vv; });
      if (!head) head = c.versions[0];
      var n = c.versions.length;
      return '<button class="re-menuitem' + (on ? " is-on" : "") + '" data-re-pickcfg="' + c.id + '" role="option" aria-selected="' + on + '">' +
        '<span class="re-menuitem-check">' + (on ? ico("Check") : "") + '</span>' +
        '<span class="re-menuitem-main">' +
          '<span class="re-menuitem-name">' + esc(c.legalEntity) + '</span>' +
          '<span class="re-menuitem-meta">' + esc(c.pack) + ' \u00b7 ' + esc(c.template) + ' \u00b7 ' + esc(c.currency) + '</span>' +
        '</span>' +
        '<span class="re-menuitem-right">' + statusPill(head.status) + '<span class="re-menuitem-vcount">' + n + ' version' + (n === 1 ? "" : "s") + '</span></span>' +
      '</button>';
    }).join("");
    return '<div class="re-menu re-cfgmenu" role="listbox" aria-label="Legal entities">' +
      '<div class="re-menu-head">Legal entities<span class="re-menu-head-count">' + S.configs.length + '</span></div>' +
      '<div class="re-menu-list">' + rows + '</div>' +
      '<div class="re-menu-foots"><button class="re-menu-foot" data-re-newcfg>' + ico("AddCircle") + 'Add legal entity</button></div>' +
    '</div>';
  }

  // ---- version history menu ----------------------------------------
  function versionMenu() {
    if (!S.versionMenuOpen) return "";
    var c = activeConfig();
    var rows = c.versions.map(function (vv) {
      var on = vv.id === c.activeVersionId;
      return '<button class="re-menuitem re-menuitem--ver' + (on ? " is-on" : "") + '" data-re-pickver="' + vv.id + '" role="option" aria-selected="' + on + '">' +
        '<span class="re-menuitem-check">' + (on ? ico("Check") : "") + '</span>' +
        '<span class="re-menuitem-main">' +
          '<span class="re-menuitem-name">' + esc(vv.label) + statusPill(vv.status) + '</span>' +
          '<span class="re-menuitem-meta">' + esc(vv.date) + ' \u00b7 ' + esc(vv.author) + '</span>' +
          '<span class="re-menuitem-note">' + esc(vv.note) + '</span>' +
        '</span>' +
      '</button>';
    }).join("");
    var av = activeVersion();
    var foots = '<button class="re-menu-foot" data-re-newver>' + ico("Copy") + 'Create new version</button>';
    if (av.status === "draft") foots += '<button class="re-menu-foot re-menu-foot--pub" data-re-publish>' + ico("Check") + 'Publish ' + esc(av.label) + '</button>';
    return '<div class="re-menu re-vermenu" role="listbox" aria-label="Version history">' +
      '<div class="re-menu-head">Versions of ' + esc(c.legalEntity) + '<span class="re-menu-head-count">' + c.versions.length + '</span></div>' +
      '<div class="re-menu-list">' + rows + '</div>' +
      '<div class="re-menu-foots">' + foots + '</div>' +
    '</div>';
  }

  // ---- save bar: unsaved-changes status + Save (draft only) ---------
  function saveBar() {
    if (!isEditable()) return "";
    var dirty = isDirty();
    return '<div class="re-savebar' + (dirty ? " is-dirty" : "") + '">' +
      '<span class="re-savebar-status">' + ico(dirty ? "Information" : "Check") +
        '<span>' + (dirty ? "You have unsaved changes to this draft structure." : "All changes saved.") + '</span>' +
      '</span>' +
      '<button class="re-btn re-btn--primary re-savebtn" data-re-savestruct' + (dirty ? "" : " disabled") + '>' + ico("Check") + 'Save changes</button>' +
    '</div>';
  }

  // ---- read-only banner shown on published / archived versions ------
  function readonlyBanner() {
    if (isEditable()) return "";
    var c = activeConfig(), av = activeVersion();
    var draft = null; c.versions.forEach(function (vv) { if (vv.status === "draft" && !draft) draft = vv; });
    var acts = "";
    if (draft) acts += '<button class="re-btn" data-re-switchdraft>' + ico("Copy") + 'Switch to draft ' + esc(draft.label) + '</button>';
    acts += '<button class="re-btn re-btn--primary" data-re-newver>' + ico("AddCircle") + 'Create new version</button>';
    return '<div class="re-readonly">' + ico("Lock") +
      '<span class="re-readonly-text"><strong>You\u2019re viewing the ' + esc(av.label) + ' (' + statusWord(av.status) + ') structure.</strong> It\u2019s read-only. Create a new version or switch to a draft to make changes.</span>' +
      '<span class="re-readonly-acts">' + acts + '</span>' +
    '</div>';
  }

  // ---- primary Pay / Bill tabs (below the config name) -------------
  //  One toggle drives the whole surface: the stack shows only the rules
  //  that build that side, and the Calculation view explains that side.
  function payAfterIndex() {
    var gs = S.cfg.groups, i = gs.findIndex(function (g) { return g.payAfter; });
    return i < 0 ? gs.length - 1 : i;
  }
  function totalRuleCount() {
    var n = 0; S.cfg.groups.forEach(function (g) { n += g.rules.length; }); return n;
  }
  // ---- two non-intersecting custom lookups ---------------------------
  //  The engine holds ONE ordered chain, but it surfaces as TWO custom
  //  lookups split at the worker-payable boundary:
  //    · Pay rate lookup  = the worker-paid groups (up to & incl. the
  //                         payAfter group) — it resolves the worker pay.
  //    · Bill rate lookup = a LOCKED "Net worker pay" starting group (the
  //                         pay rate carried in) + every group after the
  //                         boundary (employer, deductions, markup, tax).
  //  A component therefore lives in exactly ONE lookup — the two never
  //  share a component; the Net worker pay group is the only bridge.
  function payGroupList() { return S.cfg.groups.filter(function (g) { return groupSide(g) === "pay"; }); }
  function billGroupList() { return S.cfg.groups.filter(function (g) { return groupSide(g) === "bill"; }); }
  // Which lookup a group belongs to. Default groups carry an explicit side;
  // custom groups inherit the side of the tab they were created on. The split
  // no longer depends on the payAfter marker, so a pay group can be removed
  // or reordered without moving the boundary.
  function groupSide(g) { return g && g.side === "pay" ? "pay" : "bill"; }
  function billRuleCount() { var n = 0; billGroupList().forEach(function (g) { n += g.rules.length; }); return n; }
  // A worker-paid rule belongs to the Pay lookup; everything else (agency /
  // statutory / client) to the Bill lookup. Mirrors isPayRule — this is what
  // keeps the two component libraries disjoint.
  function libRuleIsPay(r) { return ruleFlags(r).paidToWorker; }
  // Value source label for a rule: shows where its value is supplied.
  // Used on rule cards to orient the user. Pack-sourced rules are already
  // flagged with the “pack” badge, so they don’t need a second label.
  function ruleValueSource(r) {
    if (!r || r.synthetic) return null;
    if (ruleSourceReadOnly(r)) return null; // pack badge is shown separately
    var src = ruleEffectiveSource(r);
    if (src === "ratecard") return /Supplier/i.test(r.level || "") ? "Agency" : "Rate card";
    return "Custom";
  }
  // Statutory components: pack-sourced statutory inputs, or anything paid to a
  // statutory body — Employer NI, pension, apprenticeship levy, WTR holiday, VAT.
  function isStatutory(r) { return !!r && (r.packSourced || r.recipient === "Statutory body"); }
  // The locked starting group of the Bill lookup: the pay rate, carried in.
  // Synthetic — not part of S.cfg.groups and never editable.
  function netWorkerPayGroup() {
    return { id: "netpay", name: "Net worker pay", kicker: "carried in", locked: true, synthetic: true, rules: [
      { id: "r-netpay", name: "Total Worker Pay", type: "Base", calc: "\u2014", base: "Pay rate lookup", recipient: "Worker", scope: "per Role \u00d7 Site \u00d7 Day-type \u00d7 Parity", cond: "\u2014", banded: null, level: "From the Pay rate lookup", supplies: "the worker pay rate, carried in from the Pay rate lookup", vis: ["breakdown"], locked: true, synthetic: true },
    ] };
  }
  function tabsBar() {
    var side = S.side === "bill" ? "bill" : "pay";
    var tabs = [
      ["pay", "Pay rate", "What the worker is paid", payRuleCount()],
      ["bill", "Bill rate", "What the client is charged", billRuleCount() + 1],
    ].map(function (t) {
      return '<button class="re-tab' + (t[0] === side ? " is-on" : "") + '" data-re-side="' + t[0] + '" role="tab" aria-selected="' + (t[0] === side) + '">' +
        '<span class="re-tab-l">' + t[1] + '<span class="re-tab-count">' + t[3] + '</span></span>' +
        '<span class="re-tab-sub">' + t[2] + '</span>' +
      '</button>';
    }).join("");
    return '<div class="re-tabsbar">' +
      '<div class="re-tabs" role="tablist" aria-label="Calculation side">' + tabs + '</div>' +
    '</div>';
  }

  function subbar() {
    return '<div class="re-subbar">' +
      '<div class="re-search">' + ico("Search") +
        '<input class="re-search-in" type="text" placeholder="Search rules\u2026" value="' + esc(S.q) + '" data-re-q aria-label="Search rules" />' +
        (S.q ? '<button class="re-search-x" data-re-qclear aria-label="Clear">' + ico("Cancel") + '</button>' : "") +
      '</div>' +
      '<span class="re-subbar-sp"></span>' +
      (isEditable() ? '<button class="re-btn re-btn--primary" data-re-addgroup>' + ico("Adjustment") + 'Add custom group</button>' : "") +
    '</div>';
  }

  // ---- the rule stack ----------------------------------------------
  function matches(r) {
    var q = S.q.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().indexOf(q) >= 0 ||
      (TYPE_META[r.type] && TYPE_META[r.type].label.toLowerCase().indexOf(q) >= 0) ||
      r.recipient.toLowerCase().indexOf(q) >= 0 ||
      r.level.toLowerCase().indexOf(q) >= 0;
  }

  function stack() {
    var out = [], qActive = !!S.q.trim();
    var side = S.side === "bill" ? "bill" : "pay";

    // ---- Pay rate lookup — the worker-paid groups only ------------
    if (side === "pay") {
      var any = false;
      payGroupList().forEach(function (g) {
        var gi = S.cfg.groups.indexOf(g);
        var visRules = g.rules.filter(matches);
        if (qActive && !visRules.length) return;
        any = true;
        out.push(groupBlock(g, gi, visRules, qActive));
      });
      if (!any) out.push('<div class="re-emptypay">' + ico("Information") + '<span>No pay components match. Clear the search, or add a pay component.</span></div>');
      else out.push(boundary("PAY", "Net worker pay \u2014 these components build the worker pay rate, which carries into the Bill rate lookup"));
      return out.join("");
    }

    // ---- Bill rate lookup — a LOCKED "Net worker pay" start, then the
    //      bill-only groups. Pay components never appear here, so the two
    //      lookups share no components. -----------------------------
    var np = netWorkerPayGroup();
    out.push(groupBlock(np, -1, np.rules.filter(matches), qActive));
    billGroupList().forEach(function (g) {
      var gi = S.cfg.groups.indexOf(g);
      var visRules = g.rules.filter(matches);
      if (qActive && !visRules.length) return;
      out.push(groupBlock(g, gi, visRules, qActive));
    });
    out.push(boundary("BILL", "Bill rate \u2014 the final value after employer contributions, deductions, margin and taxes"));
    return out.join("");
  }

  // Bill view starts from the already-computed pay rate.
  function billLeadIn() {
    return '<div class="re-boundary re-boundary--start">' +
      '<span class="re-boundary-tag">PAY \u2192</span>' +
      '<span class="re-boundary-note">The bill rate builds on the worker-payable pay rate \u2014 switch to the Pay rate tab to see how it is formed.</span>' +
    '</div>';
  }

  function boundary(kind, note) {
    return '<div class="re-boundary re-boundary--' + kind.toLowerCase() + '">' +
      '<span class="re-boundary-rail"></span>' +
      '<span class="re-boundary-tag">= ' + kind + '</span>' +
      '<span class="re-boundary-note">' + note + '</span>' +
    '</div>';
  }

  function groupBlock(g, gi, visRules, qActive) {
    var col = !!S.collapsed[g.id] && !qActive;
    var n = g.rules.length;
    var canEditGrp = isEditable() && !g.locked && !g.synthetic;

    var grip = canEditGrp
      ? '<span class="re-grp-grip" draggable="true" data-re-grpgrip="' + g.id + '" title="Drag to reorder group">' + ico("ArrowsUpDownSmall") + '</span>'
      : "";
    var chevAndName = canEditGrp
      ? '<button class="re-grp-toggle re-grp-toggle--chev" data-re-grptoggle="' + g.id + '" aria-expanded="' + (col ? "false" : "true") + '" aria-label="Collapse group"><span class="re-grp-chev">' + ico(col ? "ChevronRight" : "ChevronDown") + '</span></button>' +
        '<button class="re-grp-editname" data-re-grpedit="' + g.id + '" title="Edit group \u2014 name and rule set">' +
          '<span class="re-grp-name">' + esc(g.name) + '</span>' +
          (g.custom ? '<span class="re-grp-kicker re-grp-kicker--custom">Custom</span>' : "") +
          ico("Edit", "re-grp-editpen") +
        '</button>' +
        '<span class="re-grp-count">' + n + ' rule' + (n === 1 ? "" : "s") + '</span>'
      : '<button class="re-grp-toggle" data-re-grptoggle="' + g.id + '" aria-expanded="' + (col ? "false" : "true") + '">' +
          '<span class="re-grp-chev">' + ico(col ? "ChevronRight" : "ChevronDown") + '</span>' +
          '<span class="re-grp-name">' + esc(g.name) + '</span>' +
          (g.kicker ? '<span class="re-grp-kicker">' + esc(g.kicker) + '</span>' : "") +
          (g.locked ? '<span class="re-lock" title="Default group \u2014 locked">' + ico("Lock") + '</span>' : "") +
          '<span class="re-grp-count">' + n + ' rule' + (n === 1 ? "" : "s") + '</span>' +
        '</button>';

    var res = groupResolution(g);
    var resMeta = RESOLUTION_META[res];
    var grpIssues = groupIssues(g);
    var showPolicy = !g.synthetic && !g.locked && n >= 2;
    var policyKicker = (!g.synthetic && n >= 2)
      ? '<span class="re-grp-policy-kick re-grp-policy-kick--' + res + '">' + esc(resMeta.verb(n)) + '</span>'
      : "";
    var warnBadge = grpIssues.length
      ? '<span class="re-grp-warn" title="' + esc(grpIssues.join(" ")) + '">' + ico("Alert") + grpIssues.length + '</span>'
      : "";
    var policyBar = "";
    if (showPolicy) {
      var control = canEditGrp
        ? '<select class="re-grp-policy-sel" data-re-grpres="' + g.id + '" aria-label="Conflict resolution for ' + esc(g.name) + '">' +
            RESOLUTION_OPTS.map(function (k) {
              return '<option value="' + k + '"' + (k === res ? " selected" : "") + '>' + esc(RESOLUTION_META[k].label) + '</option>';
            }).join("") +
          '</select>'
        : '<span class="re-grp-policy-ro">' + esc(resMeta.label) + '</span>';
      policyBar = '<div class="re-grp-policy' + (grpIssues.length ? " has-conflict" : "") + '">' +
        ico("Row", "re-grp-policy-ico") +
        '<span class="re-grp-policy-label">When rules overlap</span>' +
        control +
        '<span class="re-grp-policy-desc">' + esc(resMeta.desc) + (resMeta.tiebreak ? " Ties break by order \u2014 the upper rule wins." : "") + '</span>' +
      '</div>';
      if (grpIssues.length) {
        policyBar += '<div class="re-grp-policy-issues">' + grpIssues.map(function (m) {
          return '<div class="re-issue re-issue--grp">' + ico("Alert") + '<span>' + esc(m) + '</span></div>';
        }).join("") + '</div>';
      }
    }

    var head = '<div class="re-grp-head">' +
      grip + chevAndName + policyKicker + warnBadge +
      '<div class="re-grp-ord">' +
        (canEditGrp ? '<button class="re-grp-del" data-re-grpdel="' + g.id + '" aria-label="Remove ' + esc(g.name) + ' group" title="Remove group">' + ico("TrashCan") + '</button>' : "") +
      '</div>' +
    '</div>';

    var npCls = g.synthetic ? " re-grp--netpay" : "";
    var secOpen = '<section class="re-grp' + npCls + (canEditGrp ? " re-grp--drag" : "") + '"' + (canEditGrp ? ' data-re-grpdrag="' + g.id + '"' : "") + '>';
    var secColl = '<section class="re-grp is-collapsed' + npCls + (canEditGrp ? " re-grp--drag" : "") + '"' + (canEditGrp ? ' data-re-grpdrag="' + g.id + '"' : "") + '>';
    if (col) return secColl + head + '</section>';
    var rules = visRules.map(function (r) { return ruleCard(r, g); }).join("");
    var add = (!groupAddable(g) || !isEditable() || g.synthetic) ? "" : '<button class="re-addrule" data-re-addrule="' + g.id + '">' + ico("PersonPlus") + 'Add rule</button>';
    return secOpen + head + policyBar + '<div class="re-rules">' + rules + add + '</div></section>';
  }

  function ordBtn(act, id, disabled, icon, label) {
    return '<button class="re-ord" data-re-' + act + '="' + id + '"' + (disabled ? " disabled" : "") + ' aria-label="' + label + '">' + ico(icon) + '</button>';
  }

  function chip(kind, text, extra) {
    return '<span class="re-chip re-chip--' + kind + (extra ? " " + extra : "") + '">' + text + '</span>';
  }

  // Validation lives inline on the rules now (no separate panel). Issues
  // surface on the rule in the left stack — where you'd fix them.
  function ruleIssues(r) {
    var out = [];
    if (r.draft && (!r.level || r.level === "Global")) out.push("Set the value level so the compiled schema knows where this value is supplied.");
    if (r.draft && (!r.name || r.name === "New rule")) out.push("Give this rule a name.");
    // Part B — flag sanity (structural; never inspects values). Only checked once
    // a rule carries explicit flags, so legacy recipient-only rules are untouched.
    if (hasExplicitFlags(r)) {
      var f = ruleFlags(r);
      if (!f.paidToWorker && !f.inBill) out.push("This component is neither paid to the worker nor billed to the client \u2014 it would go nowhere. Turn on at least one.");
      if (f.markupApplies && !f.inBill) out.push("Markup only applies to billed components. Turn on \u201cFlows into the client bill\u201d, or turn off \u201cAgency markup applies\u201d.");
      if (f.taxable && !f.inBill) out.push("Output tax only applies to billed components. Turn on \u201cFlows into the client bill\u201d, or turn off \u201cOutput tax (VAT) applies\u201d.");
    }
    return out;
  }

  function ruleCard(r, g) {
    var tm = TYPE_META[r.type] || { label: r.type, color: "blue" };
    var rm = RECIP_META[r.recipient] || { color: "blue" };
    var detail = false; // config always opens in rulePanel, never inline
    var isOverride = false;
    var issues = ruleIssues(r);
    // Rules are reorderable (drag the grip) when editing the configuration.
    var canDrag = isEditable() && !r.locked && !g.locked && !g.synthetic;
    // Pre-compute detail fields to determine whether this rule is expandable.
    var canEdit = isEditable() && !r.locked && !g.synthetic;
    var NO_RENAME_RULES = ["Sick pay", "Tenure margin reduction", "Pension auto-enrolment", "Employer NI", "Apprenticeship levy"];
    var canRename = canEdit && r.config !== "dayspecific" && NO_RENAME_RULES.indexOf(r.name) < 0;
    var configBody = ruleConfigBody(r, canEdit);
    var ruleVs = ruleValueSource(r);
    var hasDetail = !!(configBody || issues.length || canRename);

    var head = '<div class="re-rule-head" data-re-ruletoggle="' + r.id + '">' +
      '<span class="re-rule-grip' + (canDrag ? " is-draghandle" : "") + '"' + (canDrag ? ' draggable="true" data-re-grip="' + r.id + '" title="Drag to reorder"' : ' aria-hidden="true"') + '>' + ico("ArrowsUpDownSmall") + '</span>' +
      '<span class="re-rule-name">' + esc(r.name) +
        (r.draft ? '<span class="re-draft">Draft</span>' : "") +
        (isOverride ? '<span class="re-override">Post override</span>' : "") +
        (issues.length ? '<span class="re-rule-warn" title="Needs attention">' + ico("Alert") + issues.length + '</span>' : "") +
      '</span>' +
      '<span class="re-chips">' +
        ((r.params && r.params.valueType) || r.calc !== "\u2014" ? chip("calc", (r.params && r.params.valueType) || r.calc) : "") +
        (ruleVs ? chip("vs-" + (ruleVs === "Agency" ? "agency" : ruleVs === "Custom" ? "engine" : "ratecard"), ruleVs) : (r.packSourced ? chip("vs-pack", "Statutory pack") : "")) +
      '</span>' +
      (isEditable() && !r.locked && !g.synthetic && groupAddable(g)
        ? '<button class="re-rule-del" data-re-delrule="' + r.id + '" aria-label="Remove ' + esc(r.name) + '" title="Remove rule">' + ico("TrashCan") + '</button>'
        : "") +
      '<span class="re-rule-exp">' + ico("ChevronRight") + '</span>' +
    '</div>';

    var isSel = S.selectedRule === r.id;
    var cardNote = r.behaviorNote ? '<div class="re-rule-note">' + ico("Information") + '<span>' + esc(r.behaviorNote) + '</span></div>' : "";
    return '<div class="re-rule' + (isSel ? " is-selected" : "") + (isOverride ? " is-override" : "") + (issues.length ? " has-issue" : "") + (canDrag ? " re-rule--drag" : "") + '"' + (canDrag ? ' data-re-ruledrag="' + r.id + '"' : "") + '>' + head + cardNote + '</div>';

    var nameRow = canRename
      ? '<div class="re-rule-nameedit"><span class="re-field-k">Rule name</span>' +
          '<input class="re-fname" type="text" value="' + esc(r.name) + '" data-re-fname="' + r.id + '" aria-label="Rule name" />' +
        '</div>'
      : "";

    // Per-rule configuration. Generic structure fields were removed — each rule
    // type defines its own config. Day Specific Pay picks the days made custom.
    var actions = (!groupAddable(g) || r.locked || !isEditable()) ? "" : '<div class="re-rule-actions"><button class="re-link re-link--danger" data-re-delrule="' + r.id + '">' + ico("TrashCan") + 'Remove rule</button></div>';

    var issuesBlock = issues.length ? '<div class="re-rule-issues">' + issues.map(function (i) { return '<div class="re-issue">' + ico("Alert") + '<span>' + esc(i) + '</span></div>'; }).join("") + '</div>' : "";

    var payRow = "";

    // (detail block no longer rendered inline - see rulePanel)
    return '<div class="re-rule' + (isSel ? " is-selected" : "") + (isOverride ? " is-override" : "") + (issues.length ? " has-issue" : "") + (canDrag ? " re-rule--drag" : "") + '"' + (canDrag ? ' data-re-ruledrag="' + r.id + '"' : "") + '>' + head + '</div>';
  }

  // ---- Shared pricing value-type helpers (used across rule configs) ----
  var PRICING_VTYPES = [
    { v: "Percentage", l: "Percentage", suffix: "%" },
    { v: "Markup",     l: "Markup",     suffix: "/hr" },
    { v: "Deduction",  l: "Deduction",  suffix: "/hr" },
    { v: "Absolute",   l: "Absolute",   suffix: "/hr" },
  ];
  function pvtMeta(vt) { return PRICING_VTYPES.filter(function(t) { return t.v === vt; })[0] || PRICING_VTYPES[0]; }
  function pvtypeField(rid, vt, ce) {
    if (!ce) return '<label class="re-param"><span class="re-param-k">Value type</span><span class="re-param-val">' + esc(pvtMeta(vt).l) + '</span></label>';
    return '<label class="re-param"><span class="re-param-k">Value type</span><span class="re-param-ctrl">' +
      '<select class="re-fsel" data-re-rulelitparam="' + rid + ':valueType">' +
        PRICING_VTYPES.map(function(o) { return '<option value="' + o.v + '"' + (vt === o.v ? ' selected' : '') + '>' + o.l + '</option>'; }).join('') +
      '</select></span></label>';
  }
  function pvSrcToggle(rid, src, ce) {
    if (!ce) return '<div class="re-rule-source"><span class="re-field-k">Value source</span><span class="re-param-val">' + (src === "ratecard" ? "Rate card" : "Custom") + '</span></div>';
    return '<div class="re-rule-source"><span class="re-field-k">Value source</span>' +
      '<div class="re-seg">' +
        '<button type="button" class="re-seg-btn' + (src !== "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + rid + ':config">Custom</button>' +
        '<button type="button" class="re-seg-btn' + (src === "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + rid + ':ratecard">Rate card</button>' +
      '</div></div>';
  }
  // Plain-language note: which version a value's source ties it to (Part D).
  function pvSrcVersionNote(src) {
    return src === "ratecard"
      ? '<div class="re-src-vnote">' + ico("Information") + '<span>Supplied by the rate-card import \u2014 changing it is a new <strong>rate-card version</strong>.</span></div>'
      : '<div class="re-src-vnote">' + ico("Information") + '<span>Entered here in the engine \u2014 changing it is a new <strong>engine version</strong>, and it creates no import column.</span></div>';
  }
  // Generic value-source control for authorable rules whose bespoke config body
  // doesn't already carry one (Part D — the source choice is now universal).
  function pvSrcSection(r, ce) {
    var src = ruleEffectiveSource(r);
    return '<div class="re-rule-config">' +
      '<div class="re-rule-config-head">' + ico("DataGridView") + '<span class="re-rule-config-t">Value source</span></div>' +
      '<div class="re-rule-config-note">Custom is entered here in the engine; Rate card makes it an import column at this value\u2019s level.</div>' +
      pvSrcToggle(r.id, src, ce) +
      (src === "ratecard" ? pvRcTemplatePreview([ruleColLabel(r)]) : "") +
      pvSrcVersionNote(src) +
    '</div>';
  }
  function pvRcNote(msg) { return '<div class="re-rule-rcnote">' + ico("DataGridView") + '<span>' + msg + '</span></div>'; }
  // Column-name pattern: "Rule name - Component (if any) - (Value type notation)"
  function ruleVtNotation(vt) {
    var map = { "Percentage":"(%)","pct":"(%)","Absolute":"(\u00a3/hr)","flat":"(\u00a3/hr)","Multiplier":"(\u00d7)","Banded":"(banded)","Formula":"(formula)" };
    return map[vt] || (vt && vt.charAt(0) === "(" ? vt : "(" + vt + ")");
  }
  function ruleColLabel(r, componentOverride, vtOverride) {
    var vt = ruleVtNotation(vtOverride || (r.calc && r.calc !== "\u2014" ? r.calc : "Absolute"));
    return componentOverride ? r.name + " - " + componentOverride + " - " + vt : r.name + " - " + vt;
  }
  function pvRcColumnField(r) {
    var col = ruleColLabel(r);
    return '<div class="re-rule-colfield">' +
      '<span class="re-field-k">Column</span>' +
      '<span class="re-fname re-fname--ro">' + esc(col) + '</span>' +
    '</div>';
  }
  function pvRcTemplatePreview(valueCols) {
    function chip(l, k) { return '<span class="re-col re-col--' + k + '">' + esc(l) + '</span>'; }
    var valContent = (valueCols && valueCols.length)
      ? valueCols.map(function(l){ return chip(l,'val'); }).join('')
      : '<span class="re-rule-tpl-ph">Select days to see columns</span>';
    return '<div class="re-rule-tpl">' +
      '<div class="re-rule-tpl-head">' + ico("DataGridView") + 'Rate card column</div>' +
      '<div class="re-rule-tpl-row">' + valContent + '</div>' +
    '</div>';
  }
  function workerNote() { return '<div class="re-worker-note">→ Worker — absolute rate paid directly</div>'; }
  // Per-rule bespoke configuration. Only rules that declare a `config` get one;
  // everything else has just name + remove for now (each rule type
  // will define its own config over time).
  function ruleConfigBody(r, canEdit) {
    if (r.name === "Shift differential" && !r.config) {
      var vt = r.shiftValueType || "pct";
      var src = r.sourceLabel || "";
      var vtCtrl = canEdit
        ? '<div class="re-seg" role="group">' +
            '<button class="re-seg-btn' + (vt === "pct" ? " is-on" : "") + '" data-re-shifttype="' + r.id + ':pct">Percentage</button>' +
            '<button class="re-seg-btn' + (vt === "flat" ? " is-on" : "") + '" data-re-shifttype="' + r.id + ':flat">\u00a3/hr flat</button>' +
          '</div>'
        : '<div class="re-rule-config-note">' + (vt === "pct" ? "Percentage" : "\u00a3/hr flat") + '</div>';
      var srcCtrl = canEdit
        ? '<input class="re-fname" type="text" value="' + esc(src) + '" placeholder="e.g. Shift premium" data-re-shiftsrc="' + r.id + '" aria-label="Rate card source column" />'
        : '<div class="re-rule-config-note">' + (src ? esc(src) : '\u2014 not set') + '</div>';
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("DataGridView") + '<span class="re-rule-config-t">Value type</span></div>' +
        vtCtrl +
        '<div class="re-rule-config-head" style="margin-top:10px">' + ico("DataGridView") + '<span class="re-rule-config-t">Rate card source</span></div>' +
        '<div class="re-rule-config-note">Column name for this rule\u2019s values in the rate-card template.</div>' +
        srcCtrl +
        (src ? '<div class="re-rule-config-foot">' + ico("Check") + 'Adds \u201c' + esc(src) + '\u201d column to the rate card</div>' : '') +
      '</div>';
    }
    if (r.config === "dayspecific") {
      var days = r.days || [];
      var dsp = r.params || {};
      var dssrc = dsp.source || "config";
      var dsvtype = dsp.valueType || "Absolute";
      var chips = WEEK_DAYS.map(function (day) {
        var on = days.indexOf(day) >= 0;
        var attrs = canEdit ? ' data-re-ruleday="' + r.id + ':' + day + '" role="checkbox" aria-checked="' + on + '"' : ' disabled aria-disabled="true"';
        return '<button type="button" class="re-day' + (on ? " is-on" : "") + '"' + attrs + '>' +
          '<span class="re-day-box">' + (on ? ico("Check") : "") + '</span>' + day.slice(0, 3) +
        '</button>';
      }).join("");
      var n = days.length;
      var dsPricingSection = dssrc !== "ratecard"
        ? (dsvtype === "Absolute" ? workerNote() : "")
        : pvRcTemplatePreview(n ? days.map(function(d){ return r.name + " - " + d.substring(0,3) + " - " + ruleVtNotation(dsvtype); }) : null);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Calendar") + '<span class="re-rule-config-t">Day-specific pay</span></div>' +
        pvtypeField(r.id, dsvtype, canEdit) +
        pvSrcToggle(r.id, dssrc, canEdit) +
        dsPricingSection +
        '<div class="re-rule-config-subhead">' + ico("Calendar") + '<span class="re-rule-config-t">Custom days</span></div>' +
        '<div class="re-rule-config-note">Each selected day adds a pay-rate column to the rate-card template.</div>' +
        '<div class="re-days">' + chips + '</div>' +
        '<div class="re-rule-config-foot">' + (n ? n + ' day' + (n === 1 ? "" : "s") + ' made custom \u2014 ' + esc(days.join(", ")) : "No days selected yet") + '</div>' +
      '</div>';
    }
    if (r.config === "uplift") {
      var up = r.params || {};
      var usrc = up.source || "config";
      var uvtype = up.valueType || "Absolute";
      var uvtMeta = pvtMeta(uvtype);
      var upValueSection = usrc !== "ratecard"
        ? '<div class="re-params">' +
            paramField(r.id, "value", uvtype === "Absolute" ? "Absolute rate" : "Value", up.value !== undefined ? up.value : 0, canEdit, { min: 0, step: 0.01, suffix: uvtMeta.suffix }) +
            (uvtype === "Absolute" ? workerNote() : "") +
          '</div>'
        : pvRcTemplatePreview([ruleColLabel(r, null, uvtype)]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("ArrowUp") + '<span class="re-rule-config-t">Uplift</span></div>' +
        '<div class="re-rule-config-note">Additional pay above the base rate for this site or dimension.</div>' +
        pvtypeField(r.id, uvtype, canEdit) +
        pvSrcToggle(r.id, usrc, canEdit) +
        upValueSection +
        '<div class="re-rule-config-foot">' + (usrc === "ratecard" ? "Value sourced from rate card" : uvtMeta.l + " uplift \u2192 Worker") + '</div>' +
      '</div>';
    }
    if (r.config === "holidaypay" || r.config === "holidaydates") {
      var dates = (r.dates || []).slice().sort();
      var hparams = r.params || {};
      var hsource = hparams.source || "config";
      var hvtype = hparams.valueType || "Percentage"; // declared first so hvtMeta can use it
      var hSrcToggle = canEdit
        ? '<div class="re-rule-source">' +
            '<span class="re-field-k">Value source</span>' +
            '<div class="re-seg">' +
              '<button type="button" class="re-seg-btn' + (hsource !== "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + r.id + ':config">Custom</button>' +
              '<button type="button" class="re-seg-btn' + (hsource === "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + r.id + ':ratecard">Rate card</button>' +
            '</div>' +
          '</div>'
        : '<div class="re-rule-source"><span class="re-field-k">Value source</span><span class="re-param-val">' + (hsource === "ratecard" ? "Rate card" : "Custom") + '</span></div>';
      var hvtMeta = pvtMeta(hvtype);
      var hValLabel = hvtype === "Percentage" ? "Multiplier" : hvtype === "Absolute" ? "Absolute rate" : hvtype + " value";
      var hMinVal = hvtype === "Percentage" ? 0.01 : 0;
      var hMultiplier = hsource !== "ratecard"
        ? '<div class="re-params">' + paramField(r.id, "multiplier", hValLabel, hparams.multiplier !== undefined ? hparams.multiplier : (hvtype === "Percentage" ? 1.0 : 0), canEdit, { min: hMinVal, step: 0.01, suffix: hvtMeta.suffix }) + '</div>'
        : pvRcTemplatePreview([ruleColLabel(r, null, hvtype)]);
      var dateChips = dates.length
        ? dates.map(function (key) {
            return '<span class="re-date">' + esc(fmtHolidayDate(key)) +
              (canEdit ? '<button type="button" class="re-date-x" data-re-ruledatedel="' + r.id + ':' + key + '" aria-label="Remove ' + esc(fmtHolidayDate(key)) + '">' + ico("Cancel") + '</button>' : "") +
            '</span>';
          }).join("")
        : '<span class="re-date-none">No holiday dates yet</span>';
      var addRow = canEdit
        ? '<div class="re-date-add">' +
            '<select class="re-fsel re-date-m" data-re-datem="' + r.id + '" aria-label="Month">' +
              MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join("") +
            '</select>' +
            '<select class="re-fsel re-date-d" data-re-dated="' + r.id + '" aria-label="Day">' +
              Array.apply(null, { length: 31 }).map(function (_, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + '</option>'; }).join("") +
            '</select>' +
            '<button class="re-btn re-date-addbtn" data-re-dateadd="' + r.id + '">' + ico("AddCircle") + 'Add date</button>' +
          '</div>'
        : "";
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Calendar") + '<span class="re-rule-config-t">Holiday pay</span></div>' +
        pvtypeField(r.id, hvtype, canEdit) +
        hSrcToggle +
        hMultiplier +
        '<div class="re-rule-config-subhead">' + ico("Calendar") + '<span class="re-rule-config-t">Holiday dates</span></div>' +
        '<div class="re-rule-config-note">Pick the dates this holiday rate applies on. Dates repeat every year \u2014 no year is stored.</div>' +
        '<div class="re-dates">' + dateChips + '</div>' +
        addRow +
        '<div class="re-rule-config-foot">' + (dates.length ? dates.length + ' date' + (dates.length === 1 ? "" : "s") + ' selected' : "No dates selected yet") + '</div>' +
      '</div>';
    }
    if (r.config === "dailyot") {
      var dp = r.params || {};
      var dsource = dp.source || "config";
      var dSrcToggle = canEdit
        ? '<div class="re-rule-source">' +
            '<span class="re-field-k">Value source</span>' +
            '<div class="re-seg">' +
              '<button type="button" class="re-seg-btn' + (dsource !== "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + r.id + ':config">Custom</button>' +
              '<button type="button" class="re-seg-btn' + (dsource === "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + r.id + ':ratecard">Rate card</button>' +
            '</div>' +
          '</div>'
        : '<div class="re-rule-source"><span class="re-field-k">Value source</span><span class="re-param-val">' + (dsource === "ratecard" ? "Rate card" : "Custom") + '</span></div>';
      var dvtype = dp.valueType || "Percentage";
      var dvtMeta = pvtMeta(dvtype);
      var dParamsOrNote = dsource !== "ratecard"
        ? '<div class="re-params">' +
            paramField(r.id, "hours", "Daily threshold", dp.hours, canEdit, { min: 0, step: 0.5, suffix: "hrs / day" }) +
            paramField(r.id, "multiplier", dvtype === "Absolute" ? "Absolute rate" : "Value", dp.multiplier, canEdit, { min: 0, step: 0.01, suffix: dvtMeta.suffix }) +
            (dvtype === "Absolute" ? workerNote() : "") +
          '</div>'
        : pvRcTemplatePreview([r.name+" - Threshold - (hrs/day)",r.name+" - Multiplier - (\u00d7)"]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("TimeAdd") + '<span class="re-rule-config-t">Daily overtime</span></div>' +
        '<div class="re-rule-config-note">Hours worked above the daily threshold are paid at the multiplier.</div>' +
        pvtypeField(r.id, dvtype, canEdit) +
        dSrcToggle +
        dParamsOrNote +
        '<div class="re-rule-config-foot">' + (dsource === "ratecard" ? "Threshold and multiplier sourced from rate card" : otSummary("Above " + fmtNum(dp.hours) + " hrs in a day", dp.multiplier)) + '</div>' +
      '</div>';
    }
    if (r.config === "weeklyot") {
      var wp = r.params || {};
      var wsource = wp.source || "config";
      var wSrcToggle = canEdit
        ? '<div class="re-rule-source">' +
            '<span class="re-field-k">Value source</span>' +
            '<div class="re-seg">' +
              '<button type="button" class="re-seg-btn' + (wsource !== "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + r.id + ':config">Custom</button>' +
              '<button type="button" class="re-seg-btn' + (wsource === "ratecard" ? " is-on" : "") + '" data-re-rulesource="' + r.id + ':ratecard">Rate card</button>' +
            '</div>' +
          '</div>'
        : '<div class="re-rule-source"><span class="re-field-k">Value source</span><span class="re-param-val">' + (wsource === "ratecard" ? "Rate card" : "Custom") + '</span></div>';
      var wvtype = wp.valueType || "Percentage";
      var wvtMeta = pvtMeta(wvtype);
      var wParamsOrNote = wsource !== "ratecard"
        ? '<div class="re-params">' +
            paramField(r.id, "weeks", "Averaging period", wp.weeks, canEdit, { min: 1, step: 1, suffix: "week(s)" }) +
            paramField(r.id, "hours", "Weekly threshold", wp.hours, canEdit, { min: 0, step: 1, suffix: "hrs / week" }) +
            paramField(r.id, "multiplier", wvtype === "Absolute" ? "Absolute rate" : "Value", wp.multiplier, canEdit, { min: 0, step: 0.01, suffix: wvtMeta.suffix }) +
            (wvtype === "Absolute" ? workerNote() : "") +
          '</div>'
        : pvRcTemplatePreview([r.name+" - Period - (weeks)",r.name+" - Threshold - (hrs/wk)",r.name+" - Multiplier - (\u00d7)"]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("TimeAdd") + '<span class="re-rule-config-t">Weekly overtime</span></div>' +
        '<div class="re-rule-config-note">Hours above the threshold, averaged over the period, are paid at the multiplier.</div>' +
        pvtypeField(r.id, wvtype, canEdit) +
        wSrcToggle +
        wParamsOrNote +
        '<div class="re-rule-config-foot">' + (wsource === "ratecard" ? "Threshold, period and multiplier sourced from rate card" : otSummary("Above " + fmtNum(wp.hours) + " hrs / week over " + fmtNum(wp.weeks) + " week" + (Number(wp.weeks) === 1 ? "" : "s"), wp.multiplier)) + '</div>' +
      '</div>';
    }
    if (r.config === "shiftdiff") {
      var sdbands = r.bands || [];
      function sdTimeOpts(sel) {
        var o = [];
        for (var sh = 0; sh < 24; sh++) {
          for (var sm = 0; sm < 60; sm += 30) {
            var val = (sh < 10 ? "0" + sh : "" + sh) + ":" + (sm === 0 ? "00" : "30");
            var ap = sh < 12 ? "AM" : "PM"; var h12 = sh % 12 || 12;
            var lbl = h12 + ":" + (sm === 0 ? "00" : "30") + "\u202f" + ap;
            o.push('<option value="' + val + '"' + (val === sel ? ' selected' : '') + '>' + lbl + '</option>');
          }
        }
        return o.join("");
      }
      function sdToMins(t) { var p = (t || "00:00").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
      var sdOverlap = {};
      for (var sdi = 0; sdi < sdbands.length; sdi++) {
        for (var sdj = sdi + 1; sdj < sdbands.length; sdj++) {
          var af = sdToMins(sdbands[sdi].from), at2 = sdToMins(sdbands[sdi].to);
          var bf = sdToMins(sdbands[sdj].from), bt2 = sdToMins(sdbands[sdj].to);
          var w1 = at2 <= af, w2 = bt2 <= bf, sdov = false;
          if (!w1 && !w2) { sdov = af < bt2 && bf < at2; }
          else if (w1 && !w2) { sdov = bf < at2 || bf >= af; }
          else if (!w1 && w2) { sdov = af < bt2 || af >= bf; }
          else { sdov = true; }
          if (sdov) { sdOverlap[sdbands[sdi].id] = true; sdOverlap[sdbands[sdj].id] = true; }
        }
      }
      var SD_VTYPES = [
        { v: "Percentage", l: "Percentage", suffix: "%" },
        { v: "Markup",     l: "Markup",     suffix: "/hr" },
        { v: "Deduction",  l: "Deduction",  suffix: "/hr" },
        { v: "Absolute",   l: "Absolute",   suffix: "/hr" },
      ];
      var sdBandRows = sdbands.map(function(b, bi) {
        // normalise legacy source values
        var rawSrc = b.source || "pricing-rule";
        var bsrc = (rawSrc === "ratecard-rate" || rawSrc === "ratecard-multiplier") ? "ratecard"
                 : (rawSrc === "multiplier") ? "pricing-rule" : rawSrc;
        var bvtype = b.valueType || "Percentage";
        var bvtMeta = SD_VTYPES.filter(function(t) { return t.v === bvtype; })[0] || SD_VTYPES[0];
        var hasOv = !!sdOverlap[b.id];
        var sdLabelF = canEdit
          ? '<input class="re-band-labelinput" type="text" value="' + esc(b.label || "") + '" placeholder="Label (optional)" data-re-bandlabel="' + r.id + ':' + b.id + '" />'
          : '<span class="re-band-labelro">' + esc(b.label || ("Band " + (bi + 1))) + '</span>';
        var sdTimeF = canEdit
          ? '<select class="re-band-tsel" data-re-bandtime="' + r.id + ':' + b.id + ':from">' + sdTimeOpts(b.from || "08:00") + '</select>' +
            '<span class="re-band-sep">to</span>' +
            '<select class="re-band-tsel" data-re-bandtime="' + r.id + ':' + b.id + ':to">' + sdTimeOpts(b.to || "14:00") + '</select>'
          : '<span class="re-param-val">' + esc(b.from || "\u2014") + ' \u2013 ' + esc(b.to || "\u2014") + '</span>';
        // Source: Pricing rule | Rate card (button toggle)
        var sdSrcF = canEdit
          ? '<div class="re-seg re-band-seg">' +
              '<button type="button" class="re-seg-btn' + (bsrc !== "ratecard" ? " is-on" : "") + '" data-re-bandsource="' + r.id + ':' + b.id + ':pricing-rule">Custom</button>' +
              '<button type="button" class="re-seg-btn' + (bsrc === "ratecard" ? " is-on" : "") + '" data-re-bandsource="' + r.id + ':' + b.id + ':ratecard">Rate card</button>' +
            '</div>'
          : '<span class="re-param-val">' + (bsrc === "ratecard" ? "Rate card" : "Custom") + '</span>';
        // value type selector (always shown — above source)
        var vtypeF = canEdit
          ? '<select class="re-band-srcsel" data-re-bandvaluetype="' + r.id + ':' + b.id + '">' +
              SD_VTYPES.map(function(o) { return '<option value="' + o.v + '"' + (bvtype === o.v ? ' selected' : '') + '>' + o.l + '</option>'; }).join("") +
            '</select>'
          : '<span class="re-param-val">' + esc(bvtMeta.l) + '</span>';
        var sdVtypeRow = '<div class="re-band-body re-band-body--vtype">' +
          '<label class="re-param"><span class="re-param-k">Value type</span><span class="re-param-ctrl">' + vtypeF + '</span></label>' +
        '</div>';
        // value input (below source)
        var sdValSection = "";
        if (bsrc !== "ratecard") {
          var sdValF = canEdit
            ? '<input class="re-param-input" type="number" min="0" step="0.01" value="' + esc(String(b.value !== undefined ? b.value : 1.0)) + '" data-re-bandvalue="' + r.id + ':' + b.id + '" /><span class="re-param-suffix">' + esc(bvtMeta.suffix) + '</span>'
            : '<span class="re-param-val">' + fmtNum(b.value !== undefined ? b.value : 1.0) + '\u202f' + esc(bvtMeta.suffix) + '</span>';
          sdValSection = '<div class="re-band-body re-band-body--val">' +
            '<label class="re-param"><span class="re-param-k">' + (bvtype === "Absolute" ? "Absolute rate" : "Value") + '</span><span class="re-param-ctrl">' + sdValF + '</span></label>' +
            (bvtype === "Absolute" ? workerNote() : "") +
          '</div>';
        } else {
          var sdColName = r.name + " - " + (b.label || ("Band " + (bi + 1))) + " - " + ruleVtNotation(b.valueType || "Percentage");
          sdValSection = pvRcTemplatePreview([sdColName]);
        }
        var sdDelB = canEdit ? '<button class="re-band-del" data-re-banddel="' + r.id + ':' + b.id + '" aria-label="Remove band">' + ico("TrashCan") + '</button>' : "";
        return '<div class="re-band' + (hasOv ? " re-band--overlap" : "") + '">' +
          '<div class="re-band-head">' +
            '<span class="re-band-num">' + (bi + 1) + '</span>' +
            sdLabelF +
            (hasOv ? '<span class="re-band-overlapwarn">' + ico("Alert") + 'Overlap</span>' : '') +
            sdDelB +
          '</div>' +
          '<div class="re-band-body">' +
            '<label class="re-param"><span class="re-param-k">From \u2013 To</span><span class="re-param-ctrl re-band-timerow">' + sdTimeF + '</span></label>' +
          '</div>' +
          sdVtypeRow +
          '<div class="re-band-body re-band-body--src">' +
            '<label class="re-param"><span class="re-param-k">Source</span><span class="re-param-ctrl">' + sdSrcF + '</span></label>' +
          '</div>' +
          sdValSection +
        '</div>';
      }).join("");
      var sdAddBtn = canEdit ? '<button class="re-btn re-band-addbtn" data-re-bandadd="' + r.id + '">' + ico("AddCircle") + 'Add time band</button>' : '';
      var sdOvCount = Object.keys(sdOverlap).length;
      var sdFoot = sdbands.length
        ? sdbands.length + ' band' + (sdbands.length === 1 ? '' : 's') + (sdOvCount ? ' \u00b7 ' + sdOvCount + ' overlapping' : '')
        : "No time bands yet";
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("TimeAdd") + '<span class="re-rule-config-t">Shift differential \u00b7 Time bands</span></div>' +
        '<div class="re-rule-config-note">Each band applies a premium for hours worked in that time range. Bands must not overlap.</div>' +
        (sdbands.length ? '<div class="re-bands">' + sdBandRows + '</div>' : '<div class="re-bands-empty">' + ico("Information") + '<span>No time bands configured yet. Add a band to define when the differential applies.</span></div>') +
        sdAddBtn +
        '<div class="re-rule-config-foot">' + sdFoot + '</div>' +
      '</div>';
    }
    // ---- Markup — value type (Percentage / Absolute); source always Rate card ----
    if (r.name === "Markup") {
      var mkEd = isEditable();
      var mkVt = (r.params && r.params.valueType) || "Percentage";
      var mkSel = mkEd
        ? '<select class="re-fsel" data-re-rulelitparam="' + r.id + ':valueType">' +
            '<option value="Percentage"' + (mkVt === "Percentage" ? " selected" : "") + '>Percentage</option>' +
            '<option value="Absolute"' + (mkVt === "Absolute" ? " selected" : "") + '>Absolute (\u00a3/hr)</option>' +
          '</select>'
        : '<span class="re-param-val">' + esc(mkVt) + '</span>';
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("DataGridView") + '<span class="re-rule-config-t">Markup</span></div>' +
        '<label class="re-param"><span class="re-param-k">Value type</span><span class="re-param-ctrl">' + mkSel + '</span></label>' +
        pvRcNote("The markup value is always taken from the rate card \u2014 select the format here.") +
      '</div>';
    }
    // ---- VAT — configurable percentage (overrides pack default) ----
    if (r.name === "VAT") {
      var vatEd = isEditable();
      var vatPct = (r.params && r.params.percentage !== undefined) ? r.params.percentage : 20;
      var vatCtrl = vatEd
        ? '<input class="re-param-input" type="number" min="0" max="100" step="0.01" value="' + esc(String(vatPct)) + '" data-re-ruleparam="' + r.id + ':percentage" aria-label="VAT percentage" /><span class="re-param-suffix">%</span>'
        : '<span class="re-param-val">' + esc(fmtNum(vatPct)) + '%</span>';
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Percentage") + '<span class="re-rule-config-t">VAT</span></div>' +
        '<div class="re-rule-config-note">Standard-rate VAT applied to the bill. The pack default is 20% \u2014 override here if needed.</div>' +
        '<label class="re-param"><span class="re-param-k">Percentage</span><span class="re-param-ctrl">' + vatCtrl + '</span></label>' +
      '</div>';
    }
    // ---- Shared value-type + source-type config (Sick pay / Tenure / Pension / Employer NI / Levy) ----
    function simpleVtSrcBlock(rId, vt, src, headIco, headLabel, noteText, ce) {
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico(headIco) + '<span class="re-rule-config-t">' + esc(headLabel) + '</span></div>' +
        (noteText ? '<div class="re-rule-config-note">' + esc(noteText) + '</div>' : '') +
        pvtypeField(rId, vt, ce) +
        pvSrcToggle(rId, src, ce) +
        (src === "ratecard" ? pvRcTemplatePreview([ruleColLabel(r, null, vt)]) : '') +
      '</div>';
    }
    if (r.name === "Sick pay") {
      return simpleVtSrcBlock(r.id, (r.params && r.params.valueType) || "Absolute", (r.params && r.params.source) || "config", "PersonPlus", "Sick pay", "Employer sick-pay cost per supplier.", canEdit);
    }
    if (r.name === "Tenure margin reduction") {
      var tvt  = (r.params && r.params.valueType) || "Percentage";
      var tsrc = (r.params && r.params.source)    || "config";
      var tvtMeta = pvtMeta(tvt);
      var tbands  = r.bands || [];
      // overlap detection
      var tbOv = {};
      for (var tbi = 0; tbi < tbands.length; tbi++) {
        for (var tbj = tbi + 1; tbj < tbands.length; tbj++) {
          var taf = Number(tbands[tbi].fromWeek || 1), tat = Number(tbands[tbi].toWeek  || 99999);
          var tbf = Number(tbands[tbj].fromWeek || 1), tbt = Number(tbands[tbj].toWeek  || 99999);
          if (taf <= tbt && tbf <= tat) { tbOv[tbands[tbi].id] = true; tbOv[tbands[tbj].id] = true; }
        }
      }
      var tbRows = tbands.map(function(b, bi) {
        var hasOv = !!tbOv[b.id];
        var bval  = b.value !== undefined ? b.value : 0;
        var fromF = canEdit
          ? '<input class="re-param-input" type="number" min="1" step="1" value="' + esc(String(b.fromWeek || 1)) + '" data-re-bandwk="' + r.id + ':' + b.id + ':fromWeek" aria-label="From week" />'
          : '<span class="re-param-val">' + esc(String(b.fromWeek || 1)) + '</span>';
        var toF = canEdit
          ? '<input class="re-param-input" type="number" min="1" step="1" value="' + esc(String(b.toWeek || '')) + '" placeholder="\u221e" data-re-bandwk="' + r.id + ':' + b.id + ':toWeek" aria-label="To week" />'
          : '<span class="re-param-val">' + (b.toWeek ? esc(String(b.toWeek)) : '\u221e') + '</span>';
        var valF = canEdit
          ? '<input class="re-param-input" type="number" min="0" step="0.01" value="' + esc(String(bval)) + '" data-re-bandvalue="' + r.id + ':' + b.id + '" aria-label="Value" /><span class="re-param-suffix">' + esc(tvtMeta.suffix) + '</span>'
          : '<span class="re-param-val">' + fmtNum(bval) + '\u202f' + esc(tvtMeta.suffix) + '</span>';
        var delB = canEdit ? '<button class="re-band-del" data-re-banddel="' + r.id + ':' + b.id + '" aria-label="Remove band">' + ico("TrashCan") + '</button>' : '';
        return '<div class="re-band' + (hasOv ? ' re-band--overlap' : '') + '">' +
          '<div class="re-band-head">' +
            '<span class="re-band-num">' + (bi + 1) + '</span>' +
            '<span class="re-band-labelro">Week ' + esc(String(b.fromWeek || 1)) + '\u2013' + (b.toWeek ? esc(String(b.toWeek)) : '\u221e') + '</span>' +
            (hasOv ? '<span class="re-band-overlapwarn">' + ico("Alert") + 'Overlap</span>' : '') +
            delB +
          '</div>' +
          '<div class="re-band-body">' +
            '<label class="re-param"><span class="re-param-k">From week</span><span class="re-param-ctrl">' + fromF + '</span></label>' +
            '<label class="re-param"><span class="re-param-k">To week</span><span class="re-param-ctrl">' + toF + '</span></label>' +
          '</div>' +
          '<div class="re-band-body re-band-body--val">' +
            '<label class="re-param"><span class="re-param-k">Value</span><span class="re-param-ctrl">' + valF + '</span></label>' +
          '</div>' +
        '</div>';
      }).join('');
      var tbOvCount = Object.keys(tbOv).length;
      var tbAddBtn  = canEdit ? '<button class="re-btn re-band-addbtn" data-re-tbadd="' + r.id + '">' + ico("AddCircle") + 'Add week band</button>' : '';
      var tbFoot    = tbands.length
        ? tbands.length + ' band' + (tbands.length === 1 ? '' : 's') + (tbOvCount ? ' \u00b7 ' + tbOvCount + ' overlapping' : '')
        : 'No week bands yet';
      var tbBody = tsrc !== 'ratecard'
        ? (tbands.length ? '<div class="re-bands">' + tbRows + '</div>' : '<div class="re-bands-empty">' + ico("Information") + '<span>No week bands yet \u2014 add a band to define the reduction schedule.</span></div>') +
          tbAddBtn + '<div class="re-rule-config-foot">' + tbFoot + '</div>'
        : pvRcTemplatePreview([ruleColLabel(r, null, tvt)]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Adjustment") + '<span class="re-rule-config-t">Tenure margin reduction</span></div>' +
        '<div class="re-rule-config-note">Margin reduction applied as worker tenure grows \u2014 set a value per week range.</div>' +
        pvtypeField(r.id, tvt, canEdit) +
        pvSrcToggle(r.id, tsrc, canEdit) +
        tbBody +
      '</div>';
    }
    if (r.name === "Pension auto-enrolment") {
      var pnVt  = (r.params && r.params.valueType) || "Percentage";
      var pnSrc = (r.params && r.params.source)    || "config";
      var pnVal = (r.params && r.params.value     !== undefined) ? r.params.value     : 3.0;
      var pnThr = (r.params && r.params.threshold !== undefined) ? r.params.threshold : 6240;
      var pnVtMeta = pvtMeta(pnVt);
      var pnSection = pnSrc !== "ratecard"
        ? '<div class="re-params">' +
            paramField(r.id, "value",     "Employer rate",             pnVal, canEdit, { min: 0, step: 0.01, suffix: pnVtMeta.suffix }) +
            paramField(r.id, "threshold", "Lower qualifying threshold", pnThr, canEdit, { min: 0, step: 1,    suffix: "\u00a3/yr" }) +
          '</div>'
        : pvRcTemplatePreview(["Pension rate", "Pension lower threshold"]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Information") + '<span class="re-rule-config-t">Pension auto-enrolment</span></div>' +
        '<div class="re-rule-config-note">Employer pension contribution on the qualifying-earnings band.</div>' +
        pvtypeField(r.id, pnVt, canEdit) +
        pvSrcToggle(r.id, pnSrc, canEdit) +
        pnSection +
      '</div>';
    }
    if (r.name === "Employer NI") {
      var niVt  = (r.params && r.params.valueType) || "Percentage";
      var niSrc = (r.params && r.params.source)    || "config";
      var niVal = (r.params && r.params.value     !== undefined) ? r.params.value     : 13.8;
      var niThr = (r.params && r.params.threshold !== undefined) ? r.params.threshold : 9100;
      var niVtMeta = pvtMeta(niVt);
      var niSection = niSrc !== "ratecard"
        ? '<div class="re-params">' +
            paramField(r.id, "value",     "Rate",                niVal, canEdit, { min: 0, step: 0.01, suffix: niVtMeta.suffix }) +
            paramField(r.id, "threshold", "Secondary threshold", niThr, canEdit, { min: 0, step: 1,    suffix: "\u00a3/yr" }) +
          '</div>'
        : pvRcTemplatePreview(["Employer NI rate", "Employer NI threshold"]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Information") + '<span class="re-rule-config-t">Employer NI</span></div>' +
        '<div class="re-rule-config-note">Employer National Insurance on qualifying earnings.</div>' +
        pvtypeField(r.id, niVt, canEdit) +
        pvSrcToggle(r.id, niSrc, canEdit) +
        niSection +
      '</div>';
    }
    if (r.name === "Apprenticeship levy") {
      var alSrc = (r.params && r.params.source) || "config";
      var alVal = (r.params && r.params.value  !== undefined) ? r.params.value : 0.5;
      var alSection = alSrc !== "ratecard"
        ? '<div class="re-params">' +
            paramField(r.id, "value", "Rate", alVal, canEdit, { min: 0, step: 0.001, suffix: "%" }) +
          '</div>'
        : pvRcTemplatePreview(["Apprenticeship levy rate"]);
      return '<div class="re-rule-config">' +
        '<div class="re-rule-config-head">' + ico("Information") + '<span class="re-rule-config-t">Apprenticeship levy</span></div>' +
        '<div class="re-rule-config-note">0.5% apprenticeship levy on the paybill \u2014 always calculated as a percentage.</div>' +
        pvSrcToggle(r.id, alSrc, canEdit) +
        alSection +
      '</div>';
    }
    return "";
  }
  // A labelled numeric input for a rule's `params`.
  function paramField(rid, key, label, value, canEdit, opts) {
    opts = opts || {};
    var v = (value === undefined || value === null) ? "" : value;
    var control = canEdit
      ? '<input class="re-param-input" type="number" value="' + esc(String(v)) + '"' +
          (opts.min !== undefined ? ' min="' + opts.min + '"' : "") +
          (opts.step !== undefined ? ' step="' + opts.step + '"' : "") +
          ' data-re-ruleparam="' + rid + ':' + key + '" aria-label="' + esc(label) + '" />'
      : '<span class="re-param-val">' + esc(fmtNum(v)) + '</span>';
    return '<label class="re-param">' +
      '<span class="re-param-k">' + esc(label) + '</span>' +
      '<span class="re-param-ctrl">' + control + (opts.suffix ? '<span class="re-param-suffix">' + esc(opts.suffix) + '</span>' : "") + '</span>' +
    '</label>';
  }
  function fmtNum(n) { if (n === undefined || n === null || n === "") return "\u2014"; var x = Number(n); return isNaN(x) ? String(n) : String(x); }
  function otSummary(threshold, mult) {
    var m = Number(mult);
    return threshold + ", pay " + (isNaN(m) ? "\u2014" : fmtNum(m) + "\u00d7") + " the pay rate.";
  }

  // ---- right rail: the single consolidated Calculation view ---------
  //  Spec: the rail is the Calculation view ONLY. It absorbs the former
  //  Compiled-schema tile (now the per-line source-level), the Precedence
  //  tile (now the line order + inline conditions) and the Validation tile
  //  (now flagged inline on the rules in the left stack). The compiled
  //  schema still exists as the derived value-free output contract that
  //  template generation consumes -- it is just no longer a UI tile.
  function rail() { return ""; } // calc view removed — config now in rulePanel()

  // ---- Part B: component treatment (behaviorNote + Advanced flags) ----
  //  Plain-language line the user reads; raw flags only via the collapsed
  //  Advanced escape-hatch. Catalogued components ship a behaviorNote; custom
  //  ones get one derived from their flags.
  function deriveBehaviorNote(r) {
    var f = ruleFlags(r), parts = [];
    parts.push(f.paidToWorker ? "Paid to the worker" : "Not paid to the worker");
    if (f.paidToWorker) parts.push(f.inPayBase ? "taxed as pay" : "not taxed");
    parts.push(f.inBill ? (f.markupApplies ? "billed with markup" : "billed at cost") : "not billed to the client");
    if (f.inBill && f.taxable) parts.push("VAT applies");
    return parts.join(" \u00b7 ") + ".";
  }
  function behaviorNoteBlock(r) {
    var note = r.behaviorNote || deriveBehaviorNote(r);
    if (!note) return "";
    return '<div class="re-behavior">' + ico("Information") +
      '<div class="re-behavior-body"><span class="re-behavior-k">How this is treated</span>' +
      '<p class="re-behavior-note">' + esc(note) + '</p></div></div>';
  }
  function advancedFlagsBlock(r, canEdit) {
    var f = ruleFlags(r);
    var open = !!(S.advExpanded && S.advExpanded[r.id]);
    var rows = COMPONENT_FLAGS.map(function (fl) {
      var on = f[fl.k];
      var toggle = canEdit
        ? '<button class="re-flag-toggle' + (on ? " is-on" : "") + '" role="switch" aria-checked="' + on + '" data-re-flag="' + r.id + ':' + fl.k + '" aria-label="' + esc(fl.label) + '"><span class="re-flag-knob"></span></button>'
        : '<span class="re-flag-ro' + (on ? " is-on" : "") + '">' + (on ? "Yes" : "No") + '</span>';
      return '<div class="re-flag-row"><div class="re-flag-main"><span class="re-flag-label">' + esc(fl.label) + '</span><span class="re-flag-hint">' + esc(fl.hint) + '</span></div>' + toggle + '</div>';
    }).join("");
    return '<div class="re-advanced' + (open ? " is-open" : "") + '">' +
      '<button class="re-advanced-head" data-re-advtoggle="' + r.id + '" aria-expanded="' + open + '">' +
        ico(open ? "ChevronDown" : "ChevronRight", "re-advanced-chev") +
        '<span class="re-advanced-t">Advanced \u2014 how this is treated</span>' +
        '<span class="re-advanced-sub">' + (canEdit ? "Override the built-in treatment" : "Treatment flags") + '</span>' +
      '</button>' +
      (open ? '<div class="re-advanced-body">' + rows + '</div>' : "") +
    '</div>';
  }

  function rulePanel() {
    if (!S.selectedRule) return '';
    var f = findRule(S.selectedRule); if (!f) { S.selectedRule = null; return ''; }
    var r = f.r, g = f.g;

    // Info-only panel for the synthetic "Total Worker Pay" carry-in rule
    if (r.id === "r-netpay") {
      return '<div class="re-rpanel-head">' +
          '<div class="re-rpanel-title">' + esc(r.name) + '</div>' +
          '<button class="re-rpanel-close" data-re-ruletoggle="' + r.id + '" aria-label="Close">' + ico("Cancel") + '</button>' +
        '</div>' +
        '<div class="re-rpanel-body">' +
          '<div class="re-rpanel-info">' +
            ico("Information") +
            '<div class="re-rpanel-info-body">' +
              '<strong>Total worker pay — carried in from the pay rate card</strong>' +
              '<p>This is the resolved worker pay rate from the Pay rate lookup — the sum of the base pay rate and any pay-side adjustments, keyed by position, tenure, location and day-type. It is not configured here; its value comes entirely from the pay rate card upload.</p>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    var tm = TYPE_META[r.type] || { label: r.type, color: "blue" };
    var rm = RECIP_META[r.recipient] || { color: "blue" };
    var canEdit = isEditable() && !r.locked && !g.synthetic;
    var NO_RENAME_RULES = ["Sick pay", "Tenure margin reduction", "Pension auto-enrolment", "Employer NI", "Apprenticeship levy"];
    var canRename = canEdit && r.config !== "dayspecific" && NO_RENAME_RULES.indexOf(r.name) < 0;
    var configBody = ruleConfigBody(r, canEdit);
    var issues = ruleIssues(r);
    var issuesBlock = issues.length
      ? '<div class="re-rule-issues">' + issues.map(function(i){return '<div class="re-issue">'+ico("Alert")+'<span>'+esc(i)+'</span></div>';}).join("") + '</div>'
      : "";
    var nameRow = canRename
      ? '<div class="re-rule-nameedit"><span class="re-field-k">Rule name</span>' +
          '<input class="re-fname" type="text" value="' + esc(r.name) + '" data-re-fname="' + r.id + '" aria-label="Rule name" />' +
        '</div>'
      : "";
    var actions = (!groupAddable(g) || r.locked || !isEditable()) ? "" :
      '<div class="re-rule-actions"><button class="re-link re-link--danger" data-re-delrule="' + r.id + '">' + ico("TrashCan") + 'Remove rule</button></div>';
    var meta = '<div class="re-rpanel-meta">' +
      '<span class="re-chip re-chip--type-' + tm.color + '">' + tm.label + '</span>' +
      (r.calc && r.calc !== "\u2014" ? '<span class="re-chip re-chip--calc">' + esc(r.calc) + '</span>' : "") +
      '<span class="re-chip re-chip--recip-' + rm.color + '">' + esc(r.recipient) + '</span>' +
      // level/scope removed (Per Role × Site × Day-type × Parity hidden per UX) +
    '</div>';
    var advanced = (r.id === "r-netpay") ? "" : advancedFlagsBlock(r, canEdit);
    var behavior = (r.id === "r-netpay") ? "" : behaviorNoteBlock(r);
    // Part D — add the generic source control for authorable rules whose bespoke
    // config body doesn't already carry one (or per-band sources).
    var hasInlineSrc = configBody && (configBody.indexOf("data-re-rulesource") >= 0 || configBody.indexOf("data-re-bandsource") >= 0);
    var srcSection = (r.id !== "r-netpay" && ruleHasSourceToggle(r) && !hasInlineSrc) ? pvSrcSection(r, canEdit) : "";
    var body = issuesBlock || nameRow || configBody || srcSection || actions
      ? (meta + behavior + issuesBlock + nameRow + (configBody || (srcSection ? "" : '<div class="re-rpanel-noconfig">'+ico("Information")+'<span>This rule type has no configurable settings — structure is defined by the pricing pack.</span></div>')) + srcSection + advanced + actions)
      : meta + behavior + '<div class="re-rpanel-noconfig">'+ico("Information")+'<span>No configuration required for this rule.</span></div>' + advanced;
    return '<div class="re-rpanel-head">' +
        '<div class="re-rpanel-title">' + esc(r.name) + '</div>' +
        '<button class="re-rpanel-close" data-re-ruletoggle="' + r.id + '" aria-label="Close configuration panel">' + ico("Cancel") + '</button>' +
      '</div>' +
      '<div class="re-rpanel-body">' + body + '</div>';
  }

  // ---- C9 \u2014 Calculation view (follows the Pay / Bill tabs) ---------
  //  A plain-language, VALUE-FREE explanation of HOW each side is built.
  //  No amounts \u2014 just the method and the tier each step belongs to.
  //  Tier chips: Pay (worker pay side) \u00b7 Engine (pack/statutory) \u00b7
  //  Agency (agency-set variable).
  var CALC = {
    pay: {
      eyebrow: "Base Pay Rate · 4 rules",
      summary: "How the worker-payable rate is built, in order — structure only, no values.",
      rows: [
        { tier: "Pay",    name: "Base Pay Rate", calc: "base", level: "per-row · keyed by all dimensions" },
        { tier: "Pay",    name: "Geo allowance", calc: "adjustment · absolute", level: "site-level input" },
        { tier: "Engine", name: "NMW floor", calc: "floor · banded", level: "statutory pack · age-banded · locked" },
        { tier: "Pay",    name: "WTR holiday pay", calc: "adjustment · percentage", level: "statutory rate · accrues to worker", cond: "Parity: 12.07% → 14.04%" },
        { boundary: "total", tag: "= PAY", label: "Pay rate — worker-payable boundary" },
      ],
    },
    bill: {
      eyebrow: "Client bill rate · 7 rules",
      summary: "Carries the pay rate in, then adds the employment burden, the margin and tax — structure only, no values.",
      rows: [
        { tier: "Pay",    name: "Pay rate", calc: "carried in", level: "worker-payable rate · from the Pay tab", carry: true },
        { tier: "Engine", name: "Employer NI", calc: "percentage", level: "statutory pack · uses supplier weekly hours", cond: "0% for under-21 / apprentice under 25" },
        { tier: "Agency", name: "Pension", calc: "percentage", level: "supplier % on the statutory band · uses weekly hours" },
        { tier: "Engine", name: "Apprenticeship levy", calc: "percentage", level: "statutory rate · supplier inclusion (Y/N)" },
        { tier: "Agency", name: "Sick pay", calc: "absolute / percentage", level: "supplier-level · £/hr · % · none" },
        { boundary: "sub", tag: "=", label: "Fully-burdened cost" },
        { tier: "Engine", name: "Tenure margin reduction", calc: "banded · deduction", level: "per-row · per role", cond: "reduces margin by tenure" },
        { tier: "Agency", name: "Markup", calc: "markup", level: "supplier-level · £/hr · per position group" },
        { boundary: "sub", tag: "=", label: "Bill rate (pre-VAT)" },
        { tier: "Engine", name: "VAT", calc: "tax / fee · percentage", level: "statutory · 20%" },
        { boundary: "total", tag: "= BILL", label: "Bill rate (incl VAT)" },
      ],
    },
  };
  var KEYED_BY = "Region tier × Site × Position × Parity × Day-type";
  var CALC_FOOT = [
    "Within a group, matching rules combine by the group's resolution policy; order is the tiebreaker within that policy (the upper rule wins).",
    "Value-free \u00b7 versioned \u2014 changing the structure migrates every rate card on this version.",
  ];
  var TIER_META = {
    Pay:    { cls: "pay",    label: "Pay" },
    Engine: { cls: "engine", label: "Engine" },
    Agency: { cls: "agency", label: "Agency" },
  };

  function tierForRule(r) {
    if (r.recipient === "Worker") return "Pay";
    if (r.recipient === "Agency") return "Agency";
    return "Engine";
  }

  function calcCard() {
    var side = S.side === "bill" ? "bill" : "pay";

    var legend = ["Pay", "Engine", "Agency"].map(function (k) {
      var m = TIER_META[k];
      return '<span class="re-tier re-tier--' + m.cls + '">' + m.label + '</span>';
    }).join("");

    // Rules feeding this side, in order — derived live so it tracks the toggles.
    var ruleRows = [];
    S.cfg.groups.forEach(function (g) {
      g.rules.forEach(function (r) {
        if (side === "pay" && !isPayRule(r)) return;
        ruleRows.push(r);
      });
    });

    var eyebrow, summary, sub;
    if (side === "pay") {
      eyebrow = "Base Pay Rate · " + ruleRows.length + " rule" + (ruleRows.length === 1 ? "" : "s");
      summary = "Only the rules paid to the worker build this rate \u2014 structure only, no values.";
      sub = "How the pay rate is built \u2014 tier \u00b7 calc type \u00b7 source-level, in order";
    } else {
      eyebrow = "Client bill rate \u00b7 " + ruleRows.length + " rule" + (ruleRows.length === 1 ? "" : "s");
      summary = "Carries the worker-payable rate, then adds the employment burden, the margin and tax \u2014 structure only, no values.";
      sub = "How the bill rate is built \u2014 tier \u00b7 calc type \u00b7 source-level, in order";
    }

    var head = '<div class="re-calc-summary">' +
      '<div class="re-calc-sum-eye">' + esc(eyebrow) + '</div>' +
      '<p class="re-calc-sum-text">' + esc(summary) + '</p>' +
    '</div>';

    var keyed = '<div class="re-calc-keyed">' +
      '<div class="re-calc-keyed-top">' + ico("DataGridView") +
        '<span class="re-calc-keyed-l">Keyed by</span>' +
        '<span class="re-calc-keyed-v">' + esc(lookupKeyLabels().join(" \u00d7 ")) + '</span>' +
      '</div>' +
      '<div class="re-calc-keyed-note">These are the rate-card key columns from your custom lookup (Section 2) — the base rate is held once per combination.</div>' +
    '</div>';

    var rows = ruleRows.map(function (r) {
      var m = TIER_META[tierForRule(r)] || TIER_META.Pay;
      var tmL = (TYPE_META[r.type] || { label: r.type }).label;
      var calcTxt = (r.calc && r.calc !== "\u2014") ? (tmL + " \u00b7 " + r.calc) : tmL;
      var lvl = r.packSourced ? (r.level + " \u00b7 read-only") : r.level;
      // Part B — flag-driven tags: burden runs on inPayBase only, so flag the
      // components held out of it; pass-through = billed without markup.
      var fl = ruleFlags(r), tags = [];
      if (fl.paidToWorker && !fl.inPayBase) tags.push("not taxed");
      if (fl.inBill && !fl.markupApplies) tags.push("pass-through \u00b7 no markup");
      var tagHtml = tags.length ? '<span class="re-calc-rtag">' + tags.map(esc).join(" \u00b7 ") + '</span>' : "";
      var noteHtml = r.behaviorNote ? '<span class="re-calc-rnote">' + esc(r.behaviorNote) + '</span>' : "";
      return '<div class="re-calc-row">' +
        '<span class="re-tier re-tier--' + m.cls + '">' + m.label + '</span>' +
        '<span class="re-calc-rmain">' +
          '<span class="re-calc-rlabel">' + esc(r.name) + tagHtml + '</span>' +
          '<span class="re-calc-rmeta">' +
            '<span class="re-calc-rcalc">' + esc(calcTxt.toLowerCase()) + '</span>' +
            '<span class="re-calc-rlevel">' + esc(lvl) + '</span>' +
          '</span>' +
          noteHtml +
        '</span>' +
      '</div>';
    }).join("");

    if (side === "pay") {
      rows += '<div class="re-calc-row re-calc-row--total"><span class="re-calc-teq">= PAY</span><span class="re-calc-rlabel">Pay rate \u2014 worker-payable boundary</span></div>';
    } else if (side === "bill") {
      rows += '<div class="re-calc-row re-calc-row--total"><span class="re-calc-teq">= BILL</span><span class="re-calc-rlabel">Bill rate (incl VAT)</span></div>';
    }

    var foot = CALC_FOOT.map(function (t) {
      return '<div class="re-calc-footnote">' + esc(t) + '</div>';
    }).join("");

    return '<div class="re-card re-calc">' +
      '<div class="re-card-head">' + ico("Calculate") + '<div><div class="re-card-title">Calculation view</div>' +
        '<div class="re-card-sub">' + esc(sub) + '</div></div></div>' +
      '<div class="re-card-body">' +
        head +
        keyed +
        '<div class="re-calc-rows">' + rows + '</div>' +
      '</div>' +
      '<div class="re-card-foot re-calc-foot">' +
        '<span class="re-calc-legend">' + ico("Information") + 'Tier ' + legend + '</span>' +
        '<div class="re-calc-footnotes">' + foot + '</div>' +
      '</div>' +
    '</div>';
  }

  // ---- section shell + connector ------------------------------------
  //  The surface is two connected sections: Pricing rules (the rule stack)
  //  and Rate Card custom Lookup (the keys). The connector states the link;
  //  the lookup section makes it concrete by previewing the template columns.
  function section(id, num, title, sub, body) {
    var col = !!S.sectionCollapsed[id];
    return '<section class="re-section' + (col ? " is-collapsed" : "") + '">' +
      '<div class="re-section-head" data-re-sectoggle="' + id + '" role="button" tabindex="0" aria-expanded="' + (!col) + '" aria-label="' + esc(title) + ' \u2014 ' + (col ? "expand" : "collapse") + '">' +
        '<span class="re-section-num">' + esc(num) + '</span>' +
        '<div class="re-section-titles">' +
          '<h3 class="re-section-title">' + esc(title) + '</h3>' +
          '<p class="re-section-sub">' + esc(sub) + '</p>' +
        '</div>' +
        '<span class="re-section-chev" aria-hidden="true">' + ico(col ? "ChevronDown" : "ChevronUp") + '</span>' +
      '</div>' +
      (col ? "" : '<div class="re-section-body">' + body + '</div>') +
    '</section>';
  }

  function connector() {
    return '<div class="re-connector">' +
      '<span class="re-connector-line" aria-hidden="true"></span>' +
      '<span class="re-connector-chip">' + ico("ChevronDown") +
        '<span>The pricing rules supply the <strong>value columns</strong>; the lookup below supplies the <strong>key columns</strong>. Together they are the rate-card template.</span>' +
      '</span>' +
    '</div>';
  }

  // ---- Section 2 \u2014 Rate Card custom Lookup --------------------------
  // Inline lookup strip rendered at the top of the Pricing rules section.
  // Matches the chip-based lookup style from the Rate Grid — bolt icon, numbered
  // pill chips, drag-to-reorder, add/remove conditions.
  function lookupStrip(side) {
    var active = lookupActiveFor(side);
    var ed = isEditable();
    var arrow = '<span class="re-lk-arrow" aria-hidden="true">' + ico("ArrowRight") + '</span>';
    var posChip = '<div class="re-lk-chip re-lk-chip--locked" title="Position is always first">' +
      '<span class="re-lk-num">1</span><span class="re-lk-label">Position</span>' + ico("Lock", "re-lk-lockico") + '</div>';
    var chips = active.map(function (k, i) {
      var c = LOOKUP_CONDS[k];
      var dragAttrs = ed ? (' draggable="true" data-re-lkdrag="' + side + ':' + k + '" data-re-lkdrop="' + side + ':' + k + '"') : '';
      return arrow +
        '<div class="re-lk-chip re-lkstrip-chip"' + dragAttrs + '>' +
          '<span class="re-lk-num">' + (i + 2) + '</span>' +
          '<span class="re-lk-label">' + esc(c.label) + '</span>' +
          (ed ? '<button class="re-lk-x" data-re-lkremove="' + side + ':' + k + '" aria-label="Remove ' + esc(c.label) + '">' + ico("Cancel") + '</button>' : '') +
        '</div>';
    }).join('');
    var addable = LOOKUP_ADD_ORDER.filter(function (k) { return active.indexOf(k) < 0; });
    var addBtns = (ed && addable.length) ? addable.map(function (k) {
      var c = LOOKUP_CONDS[k];
      return arrow + '<button class="re-lkstrip-addbtn" data-re-lkadd="' + side + ':' + k + '">' +
        ico("AddCircle") + esc(c.label) + '</button>';
    }).join('') : '';
    var col = !!S.lookupStripCollapsed;
    return '<div class="re-lkstrip' + (col ? ' is-collapsed' : '') + '">' +
      '<div class="re-lkstrip-head">' +
        '<span class="re-lkstrip-bolt">' + ico("Bolt") + '</span>' +
        '<span class="re-lkstrip-title">' + esc(side === "pay" ? "Pay rate card" : "Bill rate card") + ' lookup</span>' +
        '<span class="re-lkstrip-desc"> \u2014 field priority order for rate resolution</span>' +
        '<button class="re-lkstrip-toggle" data-re-lkstriptoggle aria-expanded="' + (!col) + '" aria-label="' + (col ? 'Expand' : 'Collapse') + ' lookup">' + ico(col ? 'ChevronDown' : 'ChevronUp') + '</button>' +
      '</div>' +
      (col ? '' : '<div class="re-lkstrip-chain">' + posChip + chips + addBtns + '</div>' +
      (ed ? '<p class="re-lkstrip-hint">Drag chips to reorder \u00b7 leftmost field has highest lookup priority</p>' : '')) +
    '</div>';
  }

  // Render one lookup panel for a given side ("pay" or "bill").
  function lookupPanel(side) {
    var active = lookupActiveFor(side);
    var ed = isEditable();
    var arrow = '<span class="re-lk-arrow" aria-hidden="true">' + ico("ArrowRight") + '</span>';
    var posChip = '<div class="re-lk-chip re-lk-chip--locked" title="Position is always first">' +
      '<span class="re-lk-num">1</span><span class="re-lk-label">Position</span>' + ico("Lock", "re-lk-lockico") + '</div>';
    var chips = active.map(function (k, i) {
      var c = LOOKUP_CONDS[k];
      var controls = ed
        ? '<span class="re-lk-ord">' +
            '<button class="re-lk-mv" data-re-lkmove="' + side + ':' + k + ':-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Move ' + esc(c.label) + ' earlier">' + ico("ChevronLeft") + '</button>' +
            '<button class="re-lk-mv" data-re-lkmove="' + side + ':' + k + ':1"' + (i === active.length - 1 ? " disabled" : "") + ' aria-label="Move ' + esc(c.label) + ' later">' + ico("ChevronRight") + '</button>' +
          '</span>' +
          '<button class="re-lk-x" data-re-lkremove="' + side + ':' + k + '" aria-label="Remove ' + esc(c.label) + '">' + ico("Cancel") + '</button>'
        : "";
      return arrow + '<div class="re-lk-chip' + (ed ? "" : " re-lk-chip--ro") + '">' +
        '<span class="re-lk-num">' + (i + 2) + '</span>' +
        '<span class="re-lk-label">' + esc(c.label) + '</span>' + controls + '</div>';
    }).join("");
    var chain = '<div class="re-lk-chain">' + posChip + chips + '</div>';
    var addRow;
    if (!ed) {
      addRow = '<div class="re-lk-ro">' + ico("Lock") + '<span>Locked \u2014 switch to a draft to change.</span></div>';
    } else {
      var addable = LOOKUP_ADD_ORDER.filter(function (k) { return active.indexOf(k) < 0; });
      addRow = addable.length
        ? '<div class="re-lk-add"><span class="re-lk-add-l">Add condition</span>' +
            addable.map(function (k) {
              var c = LOOKUP_CONDS[k];
              return '<button class="re-lk-addbtn" data-re-lkadd="' + side + ':' + k + '">' + ico("AddCircle") + esc(c.label) +
                (c.note ? '<span class="re-lk-addnote">' + esc(c.note) + '</span>' : "") + '</button>';
            }).join("") + '</div>'
        : '<div class="re-lk-add re-lk-add--full">' + ico("Check") + 'Every condition is in this lookup.</div>';
    }
    return '<div class="re-lk-pane">' +
      '<div class="re-lk-pane-head">' + esc(side === "pay" ? "Pay rate card" : "Bill rate card") + '</div>' +
      chain + addRow +
    '</div>';
  }

  // Value columns split by side — pay card shows pay-rule values; bill card shows all.
  function ruleValueColumnsFor(side) {
    var out = [], seen = {};
    var groups = side === "pay" ? payGroupList() : billGroupList();
    groups.forEach(function (g) {
      if (g.synthetic) return;
      g.rules.forEach(function (r) {
        if (r.packSourced) return;
        if (!ruleIsRateCardSourced(r)) return;
        if (seen[r.name]) return; seen[r.name] = 1;
        out.push(ruleColLabel(r));
      });
    });
    return out;
  }
  // Section 2: shows the compiled rate-card schema for each side (key + value
  // columns) so the user can see exactly what each rate card will look like.
  function rateStructureSection() {
    function kv(label, kind) { return '<span class="re-col re-col--' + kind + '">' + esc(label) + '</span>'; }
    function panel(side) {
      var keys = lookupKeyLabelsFor(side);
      var vals = ruleValueColumnsFor(side);
      return '<div class="re-struct-pane">' +
        '<div class="re-struct-pane-head">' + esc(side === "pay" ? "Pay rate card" : "Bill rate card") + '</div>' +
        '<div class="re-struct-row">' +
          '<span class="re-struct-l">' + ico("DataGridView") + 'Key columns<span class="re-struct-n">' + keys.length + '</span></span>' +
          '<div class="re-cols">' + keys.map(function (l) { return kv(l, "key"); }).join("") + '</div>' +
        '</div>' +
        '<div class="re-struct-row">' +
          '<span class="re-struct-l">' + ico("Calculate") + 'Value columns<span class="re-struct-n">' + vals.length + '</span></span>' +
          '<div class="re-cols">' + vals.map(function (l) { return kv(l, "val"); }).join("") + '</div>' +
        '</div>' +
      '</div>';
    }
    var payKeys = lookupKeyLabelsFor("pay"), payVals = ruleValueColumnsFor("pay");
    var tplFmt = S.tplFmt || "xlsx";
    var dl = '<div class="re-lk-dl">' +
      '<div class="re-lk-dl-text">' +
        '<div class="re-lk-dl-title">Rate-card template</div>' +
        '<div class="re-lk-dl-sub">' + (payKeys.length + payVals.length) + ' columns \u00b7 keyed by ' + esc(payKeys.join(" \u00d7 ")) + '</div>' +
      '</div>' +
      '<div class="re-seg re-tplfmt-seg" role="group" aria-label="File format">' +
        '<button class="re-seg-btn' + (tplFmt === "xlsx" ? " is-on" : "") + '" data-re-tplfmt="xlsx">' + ico("Excel") + 'Excel</button>' +
        '<button class="re-seg-btn' + (tplFmt === "csv" ? " is-on" : "") + '" data-re-tplfmt="csv">' + ico("FileDownload") + 'CSV</button>' +
      '</div>' +
      '<button class="re-btn re-btn--primary" data-re-csv>' + ico("FileDownload") + 'Download templates</button>' +
    '</div>';
    return '<div class="re-struct">' +
      '<div class="re-lk-dual">' + panel("pay") + panel("bill") + '</div>' +
      '<div class="re-lk-out">' + dl + '</div>' +
    '</div>';
  }

  function lookupSection() {
    var active = lookupActive();
    var ed = isEditable();
    var arrow = '<span class="re-lk-arrow" aria-hidden="true">' + ico("ArrowRight") + '</span>';

    var posChip = '<div class="re-lk-chip re-lk-chip--locked" title="Position is always the first key and can\u2019t be changed">' +
      '<span class="re-lk-num">1</span>' +
      '<span class="re-lk-label">Position</span>' +
      ico("Lock", "re-lk-lockico") +
    '</div>';

    var chips = active.map(function (k, i) {
      var c = LOOKUP_CONDS[k];
      var controls = ed
        ? '<span class="re-lk-ord">' +
            '<button class="re-lk-mv" data-re-lkmove="' + k + ':-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Move ' + esc(c.label) + ' earlier">' + ico("ChevronLeft") + '</button>' +
            '<button class="re-lk-mv" data-re-lkmove="' + k + ':1"' + (i === active.length - 1 ? " disabled" : "") + ' aria-label="Move ' + esc(c.label) + ' later">' + ico("ChevronRight") + '</button>' +
          '</span>' +
          '<button class="re-lk-x" data-re-lkremove="' + k + '" aria-label="Remove ' + esc(c.label) + '">' + ico("Cancel") + '</button>'
        : "";
      return arrow + '<div class="re-lk-chip' + (ed ? "" : " re-lk-chip--ro") + '" data-lk="' + k + '">' +
        '<span class="re-lk-num">' + (i + 2) + '</span>' +
        '<span class="re-lk-label">' + esc(c.label) + '</span>' +
        controls +
      '</div>';
    }).join("");

    var chain = '<div class="re-lk-chain">' + posChip + chips + '</div>';

    var addRow;
    if (!ed) {
      addRow = '<div class="re-lk-ro">' + ico("Lock") +
        '<span>The lookup is locked on this ' + statusWord(activeVersion().status) + ' configuration. Switch to a draft version to change the keys a rate card varies pay by.</span>' +
      '</div>';
    } else {
      var addable = LOOKUP_ADD_ORDER.filter(function (k) { return active.indexOf(k) < 0; });
      addRow = addable.length
        ? '<div class="re-lk-add">' +
            '<span class="re-lk-add-l">Add condition</span>' +
            addable.map(function (k) {
              var c = LOOKUP_CONDS[k];
              return '<button class="re-lk-addbtn" data-re-lkadd="' + k + '">' + ico("AddCircle") + esc(c.label) +
                (c.note ? '<span class="re-lk-addnote">' + esc(c.note) + '</span>' : "") + '</button>';
            }).join("") +
          '</div>'
        : '<div class="re-lk-add re-lk-add--full">' + ico("Check") + 'Every condition is in the lookup.</div>';
    }

    var hint = '<p class="re-lk-hint">' + ico("Information") +
      'Position is always the first key. The left-to-right order is the lookup priority \u2014 the leftmost condition wins when two lines could match.</p>';

    // ---- connected column preview: keys (lookup) + values (rules) ----
    var keyCols = lookupKeyLabels();
    var valCols = ruleValueColumns();
    var keyChips = keyCols.map(function (l) { return '<span class="re-col re-col--key">' + esc(l) + '</span>'; }).join("");
    var valChips = valCols.map(function (l) { return '<span class="re-col re-col--val">' + esc(l) + '</span>'; }).join("");
    var preview = '<div class="re-lk-preview">' +
      '<div class="re-lk-pv-group">' +
        '<div class="re-lk-pv-h">' + ico("DataGridView") + '<span class="re-lk-pv-t">Key columns</span><span class="re-lk-pv-n">' + keyCols.length + '</span><span class="re-lk-pv-src">from this lookup</span></div>' +
        '<div class="re-cols">' + keyChips + '</div>' +
      '</div>' +
      '<div class="re-lk-pv-group">' +
        '<div class="re-lk-pv-h">' + ico("Calculate") + '<span class="re-lk-pv-t">Value columns</span><span class="re-lk-pv-n">' + valCols.length + '</span><span class="re-lk-pv-src">from the pricing rules</span></div>' +
        '<div class="re-cols">' + valChips + '</div>' +
      '</div>' +
    '</div>';

    var dl = '<div class="re-lk-dl">' +
      '<div class="re-lk-dl-text">' +
        '<div class="re-lk-dl-title">Rate-card CSV template</div>' +
        '<div class="re-lk-dl-sub">' + (keyCols.length + valCols.length) + ' columns \u00b7 ' + keyCols.length + ' key + ' + valCols.length + ' value \u00b7 keyed by ' + esc(keyCols.join(" \u00d7 ")) + '</div>' +
      '</div>' +
      '<button class="re-btn re-btn--primary" data-re-csv>' + ico("FileDownload") + 'Download CSV template</button>' +
    '</div>';

    return '<div class="re-lk">' +
      '<div class="re-lk-dual">' + lookupPanel("pay") + lookupPanel("bill") + '</div>' +
      hint +
      '<div class="re-lk-out">' + preview + dl + '</div>' +
    '</div>';
  }

  function schemaCard() {
    var sc = compiledSchema(S.cfg);
    function list(title, items, note) {
      if (!items.length) return "";
      return '<div class="re-sc-block">' +
        '<div class="re-sc-bt">' + title + (note ? '<span class="re-sc-note">' + note + '</span>' : "") + '</div>' +
        '<div class="re-sc-items">' + items.map(function (i) { return '<span class="re-sc-item">' + esc(i) + '</span>'; }).join("") + '</div>' +
      '</div>';
    }
    // C8 \u2014 the five agency-level variables, each shown with its level + apply scope.
    function supplierList() {
      var items = sc.supplier.map(function (v) {
        var tag = v.applyAll
          ? '<span class="re-sc-vtag re-sc-vtag--all">apply to all groups</span>'
          : '<span class="re-sc-vtag">varies by group</span>';
        return '<span class="re-sc-item re-sc-item--var">' +
          '<span class="re-sc-vname">' + esc(v.name) + '</span>' +
          '<span class="re-sc-vmeta">' + esc(v.detail) + ' \u00b7 ' + esc(v.level) + '</span>' +
          tag +
        '</span>';
      }).join("");
      return '<div class="re-sc-block">' +
        '<div class="re-sc-bt">Supplier-level inputs <span class="re-sc-note">the agency variables \u2014 ' + sc.supplier.length + '</span></div>' +
        '<div class="re-sc-items re-sc-items--vars">' + items + '</div>' +
      '</div>';
    }
    return '<div class="re-card">' +
      '<div class="re-card-head">' + ico("DataGridView") + '<div><div class="re-card-title">Compiled rate-card schema</div>' +
        '<div class="re-card-sub">The "right columns" \u2014 the value-free recipe the Pay Rate Configuration step consumes</div></div></div>' +
      '<div class="re-card-body">' +
        '<div class="re-sc-block re-sc-keys">' +
          '<div class="re-sc-bt">Key columns <span class="re-sc-note">dimensions</span></div>' +
          '<div class="re-sc-items">' + sc.keys.map(function (k) { return '<span class="re-sc-item re-sc-item--key">' + esc(k) + '</span>'; }).join("") + '</div>' +
        '</div>' +
        list("Per-row value columns", sc.perRow, "keyed by the dimensions") +
        list("Site-level inputs", sc.site, "one per site") +
        supplierList() +
        list("Global / reference inputs", sc.global, "single header fields") +
        (sc.pack.length ? '<div class="re-sc-block re-sc-pack">' +
          '<div class="re-sc-bt">Pack / statutory <span class="re-sc-note">read-only \u2014 not agency-set</span></div>' +
          '<div class="re-sc-items">' + sc.pack.map(function (i) { return '<span class="re-sc-item re-sc-item--pack">' + ico("Lock") + esc(i) + '</span>'; }).join("") + '</div>' +
        '</div>' : "") +
      '</div>' +
      '<div class="re-card-foot">' + ico("Lock") + 'Versioned, value-free. Changing it migrates every rate card on this version.</div>' +
    '</div>';
  }

  function precedenceCard() {
    // Per-group resolution policy (Part A) — one row per group stating its mode,
    // with order as the tiebreaker within that mode. Synthetic bridges excluded.
    var groupRows = (S.cfg.groups || []).filter(function (g) { return !g.synthetic; }).map(function (g) {
      var rm = RESOLUTION_META[groupResolution(g)];
      var n = (g.rules || []).length;
      return ['<strong>' + esc(g.name) + '</strong> \u2014 ' + esc(rm.verb(n)),
              esc(rm.desc) + (rm.tiebreak ? " Order is the tiebreaker \u2014 the upper rule wins." : " Order is the tiebreaker within this policy.")];
    });
    var rows = [
      ["Resolution", "Each group declares how its matching rules combine; order is the tiebreaker within the chosen policy."],
      ["Day-type variation", "Modelled once \u2014 in the base (per row), never also as a premium. Prevents double-counting weekend/overtime."],
      ["NMW floor", "Applied immediately after the base; downstream rules run on the floored pay."],
      ["Age-band relief", "Employer NI is 0% for under-21s and apprentices under 25, otherwise 15% over the threshold."],
    ];
    return '<div class="re-card">' +
      '<div class="re-card-head">' + ico("Row") + '<div><div class="re-card-title">Precedence &amp; resolution</div>' +
        '<div class="re-card-sub">Structural \u2014 travels in the output contract</div></div></div>' +
      '<div class="re-card-body">' +
        groupRows.map(function (r) {
          return '<div class="re-prec"><span class="re-prec-k">' + r[0] + '</span><span class="re-prec-v">' + r[1] + '</span></div>';
        }).join("") +
        rows.map(function (r) {
          return '<div class="re-prec"><span class="re-prec-k">' + esc(r[0]) + '</span><span class="re-prec-v">' + esc(r[1]) + '</span></div>';
        }).join("") + '</div>' +
    '</div>';
  }

  function validationCard() {
    var checks = [
      { ok: true, t: "Both pipelines compute one coherent pay and bill" },
      { ok: true, t: "No orphan or circular rules" },
      { ok: true, t: "Every component is paid to the worker or billed \u2014 none goes nowhere" },
      { ok: true, t: "Markup / VAT flags only on billed components" },
      { ok: true, t: "Burden (NI, pension, WTR) computes on the taxable base only" },
      { ok: true, t: "PAY boundary is set (after Holiday pay)" },
      { ok: true, t: "Every value has a declared level \u2014 schema complete" },
      { ok: true, t: "Conditions are well-formed (incl. NI age-band relief)" },
      { ok: true, t: "Day-type lives in the base \u2014 no premium double-count" },
      { ok: true, t: "NMW floor sourced from the age-banded statutory pack" },
      { ok: true, t: "Supplier inputs match the five agency variables" },
      { ok: true, t: "Bands declare a covering axis (tenure)" },
      { ok: true, t: "Pack structure consistent (United Kingdom)" },
      { ok: true, t: "Unit & currency set before bill/tax rules (Hourly \u00b7 GBP)" },
    ];
    // Part B — surface any live flag conflicts found on configured rules.
    var flagWarns = [];
    (S.cfg.groups || []).forEach(function (g) { (g.rules || []).forEach(function (r) {
      if (!hasExplicitFlags(r)) return;
      var f = ruleFlags(r);
      if (!f.paidToWorker && !f.inBill) flagWarns.push('"' + r.name + '" is neither paid nor billed');
      if (f.markupApplies && !f.inBill) flagWarns.push('"' + r.name + '" has markup but is not billed');
      if (f.taxable && !f.inBill) flagWarns.push('"' + r.name + '" has VAT but is not billed');
    }); });
    flagWarns.forEach(function (w) { checks.push({ ok: false, t: w }); });
    var nWarn = checks.filter(function (c) { return !c.ok; }).length;
    return '<div class="re-card">' +
      '<div class="re-card-head">' + ico("ClipboardCircleCheck") + '<div><div class="re-card-title">Config-time validation</div>' +
        '<div class="re-card-sub">Value-free guardrails (\u00a711)</div></div>' +
        '<span class="re-valstate' + (nWarn ? " is-warn" : "") + '">' + ico(nWarn ? "Alert" : "Check") + (nWarn ? (nWarn + " to review") : "All clear") + '</span>' +
      '</div>' +
      '<div class="re-card-body">' + checks.map(function (c) {
        return '<div class="re-check' + (c.ok ? "" : " is-warn") + '">' + ico(c.ok ? "Check" : "Alert") + '<span>' + esc(c.t) + '</span></div>';
      }).join("") + '</div>' +
    '</div>';
  }

  // ============================================================ C10 — View template overlay + download
  //  The compiled schema compiles ONE step further into the fillable
  //  artifact the user downloads, completes and uploads in Rate Cards.
  //  This is a STRUCTURE-ONLY view: it shows the template's Excel FIELDS
  //  (the columns the import collects) and their kind — never example
  //  pricing. Opened from the "View template" button; the file downloads
  //  from inside the overlay. Field kinds: K key · I fillable input ·
  //  C calculated/formula · L locked (statutory, read from the pack).
  var SHEETS = [
    { id: "pay",    name: "Pay Rates",           sub: "Site × role × parity × day-type" },
    { id: "agency", name: "Agency Rate Config",  sub: "Supplier × site × job type" },
    { id: "ref",    name: "Statutory Reference", sub: "Pack constants · read-only" },
    { id: "guide",  name: "Instructions",        sub: "How to fill the template" },
  ];
  // The PAY template carries only the worker pay-rate sheet (keys + the pay
  // elements from the Pay rate tab). The BILL template carries the full chain:
  // pay rates, the agency variables and the statutory reference.
  function sheetsFor(scope) {
    var ids = scope === "bill" ? ["pay", "agency", "ref", "guide"] : ["pay", "guide"];
    return SHEETS.filter(function (s) { return ids.indexOf(s.id) >= 0; });
  }
  // Pay-sheet INPUT columns (the day-type rates + allowances). The KEY
  // columns are prepended dynamically from the custom lookup so the
  // template always matches Section 2.
  var PAY_INPUT_FIELDS = [
    { l: "Standard", k: "I", d: "Net pay rate — standard day" },
    { l: "Overtime", k: "I", d: "Net pay rate — overtime day-type" },
  ];
  var WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Format a year-less "MM-DD" key as "25 Dec".
  function fmtHolidayDate(key) {
    var p = key.split("-"), m = parseInt(p[0], 10), d = parseInt(p[1], 10);
    return d + " " + (MONTHS[m - 1] || "?");
  }
  // Day Specific Pay rules contribute one INPUT column per selected day, so the
  // rate-card template always carries a cell for every day made custom.
  function daySpecificColumns() {
    var cols = [], seen = {};
    (S.cfg && S.cfg.groups ? S.cfg.groups : []).forEach(function (g) {
      g.rules.forEach(function (r) {
        if (r.config !== "dayspecific" || !r.days) return;
        r.days.forEach(function (day) {
          var label = day;
          if (seen[label.toLowerCase()]) return;
          seen[label.toLowerCase()] = 1;
          cols.push({ l: label, k: "I", d: "Net pay rate \u2014 " + day + " (day-specific)" });
        });
      });
    });
    return cols;
  }
  function lookupKeyFields() {
    return lookupKeyLabels().map(function (l) {
      return { l: l, k: "K", d: l === "Position" ? "Position / labour category (always keyed)" : "Lookup key — " + l };
    });
  }
  function payRuleCount() {
    var n = 0; S.cfg.groups.forEach(function (g) { g.rules.forEach(function (r) { if (isPayRule(r)) n++; }); }); return n;
  }
  // Worker pay elements beyond the base day-type rates each contribute one
  // column to the PAY template, so it tracks the Pay rate tab: a fill-in column
  // when the import supplies the value, a calculated/locked one when the value
  // is read from the statutory pack (e.g. WTR holiday pay).
  function payRuleColumns() {
    var cols = [], seen = {};
    (S.cfg && S.cfg.groups ? S.cfg.groups : []).forEach(function (g) {
      g.rules.forEach(function (r) {
        if (!isPayRule(r)) return;
        if (r.type === "Base") return;            // base = the Standard / Overtime columns
        if (r.config === "dayspecific") return;   // already expanded by daySpecificColumns()
        if (seen[r.name]) return; seen[r.name] = 1;
        cols.push({ l: ruleColLabel(r), k: r.packSourced ? "C" : "I", d: r.packSourced ? "Calculated \u2014 read from the statutory pack" : (r.supplies || "Worker pay element") });
      });
    });
    return cols;
  }
  // PAY template fields: lookup keys + the day-type pay inputs + day-specific
  // columns + one column per worker pay rule (request: the pay template reflects
  // the options available on the Pay rate tab).
  function payFields() { return lookupKeyFields().concat(PAY_INPUT_FIELDS).concat(daySpecificColumns()).concat(payRuleColumns()); }
  var AGY_FIELDS = [
    { l: "Supplier", k: "K", d: "Agency / supplier" },
    { l: "Site", k: "K", d: "Site" },
    { l: "Job type", k: "K", d: "Position group" },
    { l: "Markup", k: "I", d: "£/hr — per supplier × position group" },
    { l: "Pension %", k: "I", d: "% of the qualifying band" },
    { l: "Weekly hours", k: "I", d: "35 · 37.5 · 40" },
    { l: "Sick pay", k: "I", d: "£/hr · % of pay · none" },
    { l: "Levy inclusion", k: "I", d: "Y / N" },
    { l: "Pay rate", k: "C", d: "Resolved from Pay Rates" },
    { l: "Fully-burdened cost", k: "C", d: "Pay + WTR + NI + pension + levy + sick" },
    { l: "Bill rate", k: "C", d: "Fully-burdened + markup" },
    { l: "Bill incl VAT", k: "C", d: "Bill + VAT" },
  ];
  var REF_ROWS = [
    ["WTR holiday — Pre-parity", "12.07%"],
    ["WTR holiday — Post-parity", "14.04%"],
    ["Employer NI", "15% above £96 / week"],
    ["Pension qualifying band", "£120 – £967 / week"],
    ["Apprenticeship levy", "0.5%"],
    ["VAT", "20%"],
    ["NMW · 21 and over", "£12.21"],
    ["NMW · 18 – 20", "£10.00"],
    ["NMW · 16 – 17", "£7.55"],
  ];
  var KIND_LABEL = { k: "Key", i: "Fill in", c: "Calculated", l: "Locked" };
  function kindOf(col) { return ((col && col.k) || "K").toLowerCase(); }

  function fieldList(fields) {
    return '<ul class="re-flds">' + fields.map(function (f) {
      var kind = kindOf(f);
      return '<li class="re-fld">' +
        '<span class="re-fld-kind re-fld-kind--' + kind + '">' + KIND_LABEL[kind] + '</span>' +
        '<span class="re-fld-main">' +
          '<span class="re-fld-name">' + esc(f.l) + '</span>' +
          (f.d ? '<span class="re-fld-desc">' + esc(f.d) + '</span>' : "") +
        '</span>' +
      '</li>';
    }).join("") + '</ul>';
  }

  function refList() {
    return '<ul class="re-flds re-flds--ref">' + REF_ROWS.map(function (r) {
      return '<li class="re-fld">' +
        '<span class="re-fld-kind re-fld-kind--l">' + ico("Lock") + 'Locked</span>' +
        '<span class="re-fld-main"><span class="re-fld-name">' + esc(r[0]) + '</span></span>' +
        '<span class="re-fld-val">' + esc(r[1]) + '</span>' +
      '</li>';
    }).join("") + '</ul>';
  }

  function guideBody() {
    var steps = [
      ["Fill only the highlighted cells", "Input cells are the day-type pay rates on Pay Rates and the five agency variables on Agency Rate Config. Everything else is computed."],
      ["Pay Rates", "Enter the net rate for each day-type per site, role and parity. A cell below the age-banded NMW floor is lifted to the floor on upload."],
      ["Agency Rate Config", "Enter markup, pension %, weekly hours, sick pay and levy inclusion per supplier and position group. Sick pay and levy inclusion can apply to all groups."],
      ["Locked cells are computed", "The Statutory Reference and every derived column — WTR, NI, pension, levy, sick, fully-burdened cost, bill, VAT — carry the engine formulas."],
      ["Recompute on upload", "When you upload the completed file in Rate Cards, the platform recomputes every bill rate authoritatively from the rules — it never trusts the file’s own formulas."],
    ];
    return '<ol class="re-guide">' + steps.map(function (s, i) {
      return '<li class="re-guide-step"><span class="re-guide-num">' + (i + 1) + '</span>' +
        '<div class="re-guide-text"><strong>' + esc(s[0]) + '</strong><span>' + esc(s[1]) + '</span></div></li>';
    }).join("") + '</ol>';
  }

  function sheetLegend(sheet) {
    if (sheet === "guide" || sheet === "ref") return "";
    var items = [["k", "Key"], ["i", "Fill in"], ["c", "Calculated"], ["l", "Locked"]];
    return '<div class="re-tpl-legend">' + items.map(function (i) {
      return '<span class="re-leg re-leg--' + i[0] + '"><span class="re-leg-sw"></span>' + esc(i[1]) + '</span>';
    }).join("") + '</div>';
  }

  function sheetBody(sheet) {
    if (sheet === "agency") return fieldList(AGY_FIELDS);
    if (sheet === "ref")    return refList();
    if (sheet === "guide")  return guideBody();
    return fieldList(payFields());
  }

  function libraryModal() {
    if (!S.libOpen) return "";
    var editable = isEditable();
    var targetGroup = S.libTargetGroup ? groupById(S.libTargetGroup) : null;
    // Multi-add rules (uplift + the conflict-prone premiums/overtime/holiday set)
    // may be added more than once and resolved by a group's resolution policy
    // (Part A). All others still de-dupe against the current side's groups so
    // they read as "In configuration" once present.
    var payLib = S.side !== "bill";
    var existing = {};
    var sideGroupsForLib = payLib ? payGroupList() : billGroupList();
    sideGroupsForLib.forEach(function (g) {
      g.rules.forEach(function (r) {
        if (!isMultiAdd(r.name)) existing[r.name.toLowerCase()] = true;
      });
    });
    var inUseLabel = "In configuration";
    // Type-to-search: match the query against a rule's name and one-line blurb.
    var q = (S.libQuery || "").trim().toLowerCase();
    var ruleMatches = function (r) {
      if (!q) return true;
      return r.name.toLowerCase().indexOf(q) >= 0 ||
        (r.desc || "").toLowerCase().indexOf(q) >= 0;
    };
    var matchCount = 0;
    // Each side draws from a disjoint slice of the library: the Pay lookup
    // offers only worker-paid components, the Bill lookup only the rest — so
    // a component can never be added to both lookups. The Statutory filter
    // narrows either side to its regulatory components (NI, pension, levy,
    // WTR holiday, VAT).
    var statOnly = S.libFilter === "statutory";
    var sideMatch = function (r) { return payLib ? libRuleIsPay(r) : !libRuleIsPay(r); };
    var sections = RULE_LIBRARY().map(function (sec) {
      var items = sec.rules.filter(function (r) { return sideMatch(r) && (!statOnly || isStatutory(r)) && ruleMatches(r); }).map(function (r) {
        matchCount++;
        var inUse = existing[r.name.toLowerCase()];
        var isWorkerPay = r.type === "Base" || r.name === "Base Pay Rate";
        if (isWorkerPay) inUse = true; // always present, cannot be added
        var tm = TYPE_META[r.type] || { label: r.type, color: "blue" };
        var right;
        if (inUse) right = isWorkerPay
          ? '<span class="re-lib-inuse re-lib-inuse--fixed">' + ico("Lock") + 'Always present</span>'
          : '<span class="re-lib-inuse">' + ico("Check") + inUseLabel + '</span>';
        else if (!editable) right = '<span class="re-lib-locked">' + ico("Lock") + 'Draft only</span>';
        else right = '<button class="re-btn re-btn--primary re-lib-add" data-re-libadd="' + esc(r.name) + '">' + ico("AddCircle") + 'Add</button>';
        return '<div class="re-lib-item' + (inUse ? " is-inuse" : "") + '">' +
          '<div class="re-lib-main">' +
            '<div class="re-lib-name">' + esc(r.name) + (isStatutory(r) ? '<span class="re-lib-stat">Statutory</span>' : "") + (r.packSourced ? '<span class="re-lib-pack">' + ico("Lock") + 'pack</span>' : "") + '</div>' +
            '<div class="re-lib-desc">' + esc(r.desc || "") + '</div>' +
          '</div>' +
          right +
        '</div>';
      }).join("");
      if (!items) return "";
      return '<div class="re-lib-sec">' +
        '<div class="re-lib-sec-head">' + ico(sec.icon, "re-lib-sec-ico") + '<span class="re-lib-sec-t">' + esc(sec.scope) + '</span><span class="re-lib-sec-note">' + esc(sec.note) + '</span></div>' +
        '<div class="re-lib-list">' + items + '</div>' +
      '</div>';
    }).join("");
    var banner = editable ? "" : '<div class="re-lib-banner">' + ico("Lock") + '<span>You\u2019re viewing a ' + statusWord(activeVersion().status) + ' version. Switch to a draft to add rules \u2014 the library is read-only here.</span></div>';
    var sub = targetGroup
      ? 'Pick a rule from the library to add to the <strong>' + esc(targetGroup.name) + '</strong> group. Its values are entered later in the rate-card import.'
      : (payLib
          ? 'Pick a component for the <strong>Pay rate</strong> lookup \u2014 only worker-paid elements are offered, so it never overlaps the Bill rate lookup. Set its values later in the rate-card import.'
          : 'Pick a component for the <strong>Bill rate</strong> lookup \u2014 only agency, statutory and client elements are offered, so it never overlaps the Pay rate lookup. Set its values later in the rate-card import.');
    var searchBar = '<div class="re-lib-search-wrap"><div class="re-search re-lib-search">' + ico("Search") +
      '<input class="re-search-in" type="text" placeholder="Search rules by name\u2026" value="' + esc(S.libQuery || "") + '" data-re-libq aria-label="Search rules by name" />' +
      (q ? '<button class="re-search-x" data-re-libqclear aria-label="Clear search">' + ico("Cancel") + '</button>' : "") +
      '</div>' +
      '<div class="re-seg re-lib-filter" role="group" aria-label="Filter components">' +
        '<button class="re-seg-btn' + (!statOnly ? " is-on" : "") + '" data-re-libfilter="all">All components</button>' +
        '<button class="re-seg-btn' + (statOnly ? " is-on" : "") + '" data-re-libfilter="statutory">Statutory only</button>' +
      '</div></div>';
    var listBody = matchCount
      ? '<div class="re-lib">' + sections + '</div>'
      : '<div class="re-lib-empty">' + ico("Search") + '<div class="re-lib-empty-t">No ' + (statOnly ? "statutory " : "") + 'components' + ((S.libQuery || "").trim() ? ' match \u201c' + esc((S.libQuery || "").trim()) + '\u201d' : "") + '</div>' +
        '<div class="re-lib-empty-s">' + (statOnly ? 'Show <button class="re-linkbtn" data-re-libfilter="all">all components</button>, or try a different name.' : 'Try a different name, or <button class="re-linkbtn" data-re-libqclear>clear the search</button>.') + '</div></div>';
    return '<div class="re-modal-scrim" data-re-libscrim role="dialog" aria-modal="true" aria-label="Add a pricing rule">' +
      '<div class="re-modal re-libmodal">' +
        '<div class="re-modal-head">' + ico("AddCircle") +
          '<div class="re-modal-titles">' +
            '<div class="re-modal-title">' + (targetGroup ? "Add a rule to " + esc(targetGroup.name) : (payLib ? "Add a pay component" : "Add a bill component")) + '</div>' +
            '<div class="re-modal-sub">' + sub + '</div>' +
          '</div>' +
          '<button class="re-modal-close" data-re-libclose aria-label="Close">' + ico("Cancel") + '</button>' +
        '</div>' +
        '<div class="re-modal-body">' + banner + searchBar + listBody + '</div>' +
      '</div>' +
    '</div>';
  }

  function groupEditorModal() {
    var ge = S.groupEdit; if (!ge || !ge.open) return "";
    var libNames = {};
    var geSide = ge.side === "pay" ? "pay" : "bill";
    var libSections = RULE_LIBRARY().map(function (sec) {
      var items = sec.rules.filter(function (r) { return !r.custom && (geSide === "pay" ? libRuleIsPay(r) : !libRuleIsPay(r)); }).map(function (r) {
        libNames[r.name.toLowerCase()] = true;
        return geRow(r, !!ge.selected[r.name.toLowerCase()]);
      }).join("");
      if (!items) return "";
      return '<div class="re-lib-sec">' +
        '<div class="re-lib-sec-head">' + ico(sec.icon, "re-lib-sec-ico") + '<span class="re-lib-sec-t">' + esc(sec.scope) + '</span><span class="re-lib-sec-note">' + esc(sec.note) + '</span></div>' +
        '<div class="re-ge-list">' + items + '</div>' +
      '</div>';
    }).join("");

    // Rules already in the group that aren't in the library — still removable.
    var extras = "";
    if (!ge.isNew) {
      var g = groupById(ge.groupId);
      var rows = (g ? g.rules : []).filter(function (r) { return !libNames[r.name.toLowerCase()]; })
        .map(function (r) { return geRow(r, !!ge.selected[r.name.toLowerCase()]); }).join("");
      if (rows) extras = '<div class="re-lib-sec">' +
        '<div class="re-lib-sec-head">' + ico("Adjustment", "re-lib-sec-ico") + '<span class="re-lib-sec-t">Already in this group</span><span class="re-lib-sec-note">Bespoke rules not in the library</span></div>' +
        '<div class="re-ge-list">' + rows + '</div>' +
      '</div>';
    }

    var n = groupEditSelectedCount();
    var title = ge.isNew ? "Add a pricing group" : "Edit pricing group";
    var sub = "A group is a set of components. Name it, then tick the components it should contain \u2014 only " + (geSide === "pay" ? "Pay rate" : "Bill rate") + " components are offered, so the two lookups never overlap. Each is added as a draft; its values are entered later in the rate-card import.";
    return '<div class="re-modal-scrim" data-re-gescrim role="dialog" aria-modal="true" aria-label="' + title + '">' +
      '<div class="re-modal re-gemodal">' +
        '<div class="re-modal-head">' + ico("Adjustment") +
          '<div class="re-modal-titles">' +
            '<div class="re-modal-title">' + title + '</div>' +
            '<div class="re-modal-sub">' + esc(sub) + '</div>' +
          '</div>' +
          '<button class="re-modal-close" data-re-geclose aria-label="Close">' + ico("Cancel") + '</button>' +
        '</div>' +
        '<div class="re-ge-namebar">' +
          '<label class="re-ge-namelabel" for="re-ge-name">Group name</label>' +
          '<input class="re-ge-nameinput" id="re-ge-name" type="text" value="' + esc(ge.name) + '" data-re-gename placeholder="e.g. Allowances" aria-label="Group name" />' +
        '</div>' +
        '<div class="re-modal-body"><div class="re-ge">' + extras + libSections + '</div></div>' +
        '<div class="re-ge-foot">' +
          '<span class="re-ge-count">' + n + ' rule' + (n === 1 ? "" : "s") + ' selected</span>' +
          '<span class="re-ge-foot-sp"></span>' +
          '<button class="re-btn" data-re-geclose>Cancel</button>' +
          '<button class="re-btn re-btn--primary" data-re-gesave>' + ico("Check") + (ge.isNew ? "Add group" : "Save group") + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  // One selectable rule row in the group editor.
  function geRow(r, on) {
    var tm = TYPE_META[r.type] || { label: r.type, color: "blue" };
    return '<button type="button" class="re-ge-item' + (on ? " is-on" : "") + '" data-re-getoggle="' + esc(r.name.toLowerCase()) + '" role="checkbox" aria-checked="' + on + '">' +
      '<span class="re-ge-check' + (on ? " is-on" : "") + '">' + (on ? ico("Check") : "") + '</span>' +
      '<span class="re-ge-main">' +
        '<span class="re-ge-name">' + esc(r.name) + (r.packSourced ? '<span class="re-lib-pack">' + ico("Lock") + 'pack</span>' : "") + '</span>' +
        (r.desc ? '<span class="re-ge-desc">' + esc(r.desc) + '</span>' : "") +
      '</span>' +
    '</button>';
  }

  function templateModal() {
    if (!S.tplOpen) return "";
    var scope = S.tplScope === "bill" ? "bill" : "pay";
    var sheetSet = sheetsFor(scope);
    var sheet = S.sheet || "pay";
    if (!sheetSet.some(function (s) { return s.id === sheet; })) sheet = "pay";
    var tabs = sheetSet.map(function (s) {
      return '<button class="re-sheet-tab' + (s.id === sheet ? " is-on" : "") + '" data-re-sheet="' + s.id + '" role="tab" aria-selected="' + (s.id === sheet) + '">' +
        '<span class="re-sheet-name">' + esc(s.name) + '</span>' +
        '<span class="re-sheet-sub">' + esc(s.sub) + '</span>' +
      '</button>';
    }).join("");
    var title = scope === "bill" ? "Bill-rate template" : "Pay-rate template";
    var subt = scope === "bill"
      ? "The value-free fields the import collects across the full bill chain \u2014 pay rates, the agency variables and the statutory reference. Fill these in after download, then upload in Rate Cards."
      : "The value-free pay-rate fields the import collects \u2014 the lookup keys and the worker pay elements from the Pay rate tab. Fill these in after download, then upload in Rate Cards.";
    var dlLabel = scope === "bill" ? "Download bill template" : "Download pay template";
    return '<div class="re-modal-scrim" role="dialog" aria-modal="true" aria-label="Rate-card template fields">' +
      '<div class="re-modal" data-re-modal>' +
        '<div class="re-modal-head">' + ico("DataGridView") +
          '<div class="re-modal-titles">' +
            '<div class="re-modal-title">' + title + '</div>' +
            '<div class="re-modal-sub">' + subt + '</div>' +
          '</div>' +
          '<button class="re-modal-close" data-re-tplclose aria-label="Close">' + ico("Cancel") + '</button>' +
        '</div>' +
        '<div class="re-modal-body">' +
          '<div class="re-sheet-tabs" role="tablist" aria-label="Template sheet">' + tabs + '</div>' +
          sheetLegend(sheet) +
          sheetBody(sheet) +
        '</div>' +
        '<div class="re-modal-foot">' +
          '<span class="re-modal-foot-note">' + ico("Lock") + 'Calculated and locked cells are filled by the engine on upload.</span>' +
          '<button class="re-btn re-btn--primary" data-re-download>' + ico("FileDownload") + dlLabel + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function downloadTemplate(scope, silent, fmt) {
    scope = scope === "bill" ? "bill" : "pay";
    fmt = fmt || "xlsx";
    try {
      var entity = ((activeConfig() && activeConfig().legalEntity) || "rate-card").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
      var fname = entity + "-" + scope + "-rate-card-template";
      var label = scope === "bill" ? "Bill" : "Pay";
      // Columns match the Rate card structure section: key columns + value columns only
      var cols = lookupKeyLabelsFor(scope).concat(ruleValueColumnsFor(scope));
      if (!cols.length) cols = lookupKeyLabels();
      if (fmt !== "csv" && window.XLSX) {
        var ws = XLSX.utils.aoa_to_sheet([cols]);
        ws["!cols"] = cols.map(function () { return { wch: 22 }; });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, label + " Rates");
        XLSX.writeFile(wb, fname + ".xlsx");
        toast(label + " rate card template downloaded \u2014 " + cols.length + " columns");
      } else {
        var csv = cols.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = fname + ".csv"; a.click(); URL.revokeObjectURL(a.href);
        toast(label + " rate card template downloaded (.csv) \u2014 " + cols.length + " columns");
      }
    } catch (err) {
      try { if (window.console && console.error) console.error("[RateEngine] download failed:", err); } catch (x) {}
      if (!silent) toast("Couldn\u2019t generate the template file");
    }
  }
  function fieldLabel(f) { return f.l; }

  // ============================================================ ops
  function groupById(id) { return S.cfg.groups.filter(function (g) { return g.id === id; })[0]; }
  // The base "Worker regular pay" group is structurally locked (no reorder /
  // rename / delete) but still accepts added rules, like any editable group.
  function groupAddable(g) { return !!g && (!g.locked || g.id === "base"); }
  function findRule(id) {
    var f = null;
    var allGroups = S.cfg.groups.concat([netWorkerPayGroup()]);
    allGroups.forEach(function (g) { g.rules.forEach(function (r) { if (r.id === id) f = { r: r, g: g }; }); });
    return f;
  }
  function guardEdit() { if (isEditable()) return true; toast("This version is read-only \u2014 create a new version or switch to a draft to edit"); return false; }

  // ---- configuration + version ops ---------------------------------
  function pickConfig(id) {
    S.activeConfigId = id; S.configMenuOpen = false; S.versionMenuOpen = false;
    S.collapsed = {}; S.expanded = {}; S.q = ""; S.view = "detail";
    RE._render();
  }
  function pickVersion(id) {
    activeConfig().activeVersionId = id; S.versionMenuOpen = false;
    S.collapsed = {}; S.expanded = {};
    RE._render();
  }
  function newConfig() {
    var evri = CONFIG();
    var id = "cfg-" + (S._seq++);
    S.configs.push({
      id: id, legalEntity: "New legal entity", pack: "United Kingdom", template: "Staffing", unit: "Hourly", currency: "GBP", variantAxis: "Parity",
      dimensions: clone(evri.dimensions), agencyVars: clone(evri.agencyVars), activeVersionId: id + "-v1",
      versions: [ { id: id + "-v1", label: "v1", status: "draft", date: todayLabel(), author: "You", note: "New draft \u2014 author the structure, then publish.", groups: clone(evri.groups) } ],
    });
    S.activeConfigId = id; S.configMenuOpen = false; S.versionMenuOpen = false; S.collapsed = {}; S.expanded = {}; S.q = "";
    S.view = "detail";
    toast("Added a new legal entity \u2014 its configuration starts as a draft"); RE._render();
  }
  function newVersion() {
    // Open conditions form first; version is created after the user confirms.
    S.conditionsForm = { conditions: {} };
    S.versionMenuOpen = false;
    RE._render();
  }
  function commitNewVersion() {
    var c = activeConfig(), src = activeVersion();
    var maxN = 0; c.versions.forEach(function (vv) { var m = /v(\d+)/.exec(vv.label); if (m) maxN = Math.max(maxN, +m[1]); });
    var label = "v" + (maxN + 1);
    var conds = (S.conditionsForm && S.conditionsForm.conditions) || {};
    var nv = { id: c.id + "-" + label, label: label, status: "draft", date: todayLabel(), author: "You",
               note: "Draft copied from " + src.label + ".", groups: clone(src.groups), conditions: conds };
    c.versions.unshift(nv); c.activeVersionId = nv.id;
    S.conditionsForm = null; S.versionMenuOpen = false; S.collapsed = {}; S.expanded = {};
    toast("Created " + label + " as a draft \u2014 you can edit its structure now"); RE._render();
  }
  function publishVersion() {
    var c = activeConfig(), v = activeVersion();
    if (v.status !== "draft") return;
    c.versions.forEach(function (x) { if (x.status === "published") x.status = "archived"; });
    v.status = "published"; S.versionMenuOpen = false;
    toast(v.label + " is now live \u2014 marked Active"); RE._render();
  }
  function switchToDraft() {
    var c = activeConfig(), d = null;
    c.versions.forEach(function (x) { if (x.status === "draft" && !d) d = x; });
    if (d) { c.activeVersionId = d.id; S.collapsed = {}; S.expanded = {}; toast("Switched to draft " + d.label); RE._render(); }
  }

  function moveGroup(id, dir) {
    if (!isEditable()) return;
    var gs = S.cfg.groups, i = gs.findIndex(function (g) { return g.id === id; });
    var j = i + dir; if (j < 0 || j >= gs.length) return;
    var t = gs[i]; gs[i] = gs[j]; gs[j] = t; markDirty(); RE._render();
  }
  // Reorder a rule by dragging — within its group or across editable groups.
  function reorderRule(srcId, targetId, after) {
    if (!isEditable()) return;
    var sf = findRule(srcId), tf = findRule(targetId);
    if (!sf || !tf) return;
    if (sf.r.locked || tf.r.locked || sf.g.locked || tf.g.locked) return;
    var from = sf.g.rules.indexOf(sf.r);
    if (from < 0) return;
    sf.g.rules.splice(from, 1);
    var to = tf.g.rules.indexOf(tf.r);
    if (to < 0) to = tf.g.rules.length;
    if (after) to += 1;
    tf.g.rules.splice(to, 0, sf.r);
    markDirty(); RE._render();
  }
  // Reorder a group by dragging. Among non-locked groups only — base stays
  // first and markup / taxes stay last (they're locked).
  function reorderGroup(srcId, targetId, after) {
    if (!isEditable()) return;
    var gs = S.cfg.groups;
    var si = gs.findIndex(function (g) { return g.id === srcId; });
    var ti = gs.findIndex(function (g) { return g.id === targetId; });
    if (si < 0 || ti < 0) return;
    if (gs[si].locked || gs[ti].locked) return;
    var moved = gs.splice(si, 1)[0];
    ti = gs.findIndex(function (g) { return g.id === targetId; });
    if (after) ti += 1;
    gs.splice(ti, 0, moved);
    markDirty(); RE._render();
  }
  function setGroupName(id, name) {
    if (!isEditable()) return;
    var g = groupById(id); if (!g || g.locked) return;
    g.name = name;
    markDirty(); RE._render();
  }
  // Part A — set a group's in-group conflict-resolution policy. Non-locked,
  // non-synthetic groups only; the value travels in the compiled contract.
  function setGroupResolution(id, mode) {
    if (!guardEdit()) return;
    var g = groupById(id); if (!g || g.synthetic || g.locked) return;
    if (!RESOLUTION_META[mode]) return;
    g.resolution = mode;
    markDirty(); RE._render();
    toast(g.name + ' \u2014 ' + RESOLUTION_META[mode].label.toLowerCase());
  }
  // Part B — toggle the Advanced "how this is treated" section open/closed.
  function toggleAdvanced(id) {
    if (!S.advExpanded) S.advExpanded = {};
    S.advExpanded[id] = !S.advExpanded[id];
    RE._render();
  }
  // Part B — flip one of a rule's five treatment flags (Advanced escape-hatch).
  // Materialises the full flag set on first edit so later reads are explicit.
  function toggleRuleFlag(id, key) {
    if (!guardEdit()) return;
    if (COMPONENT_FLAGS.map(function (f) { return f.k; }).indexOf(key) < 0) return;
    var fr = findRule(id); if (!fr || fr.r.locked) return;
    var cur = ruleFlags(fr.r);
    COMPONENT_FLAGS.forEach(function (f) { if (fr.r[f.k] === undefined) fr.r[f.k] = cur[f.k]; });
    fr.r[key] = !fr.r[key];
    // Editing the treatment makes this a custom component — drop the preset note
    // so the panel shows the derived treatment instead of a now-stale preset line.
    if (fr.r.behaviorNote) delete fr.r.behaviorNote;
    markDirty(); RE._render();
  }
  function delGroup(id) {
    if (!guardEdit()) return;
    var gs = S.cfg.groups, i = gs.findIndex(function (g) { return g.id === id; });
    if (i < 0) return;
    if (gs[i].locked) { toast("This group is locked and can\u2019t be removed"); return; }
    var nm = gs[i].name, nr = gs[i].rules.length;
    gs.splice(i, 1);
    markDirty();
    toast('Removed the "' + nm + '" group' + (nr ? " and its " + nr + " rule" + (nr === 1 ? "" : "s") : ""));
    RE._render();
  }
  // Unique, human group name so two custom groups never collide.
  function uniqueGroupName(base) {
    var taken = {};
    S.cfg.groups.forEach(function (g) { taken[g.name.trim().toLowerCase()] = 1; });
    if (!taken[base.toLowerCase()]) return base;
    var i = 2; while (taken[(base + " " + i).toLowerCase()]) i++;
    return base + " " + i;
  }
  // Add a CUSTOM group — opens the group editor (name + select its rule set)
  // in "new" mode. Saving lands a `custom`-badged group ahead of the locked
  // Markup / Taxes tail with exactly the rules you picked.
  function addGroup() {
    if (!guardEdit()) return;
    openGroupEditor(null);
  }

  // ================================================== group editor (rule set)
  //  A pricing group IS a set of rules. The editor lets you name a group and
  //  choose which rules belong to it — ticking a rule from the library adds a
  //  draft instance to the group, unticking removes it. Reused for both adding
  //  a new group and editing an existing one. Locked groups can't be edited.
  function libRuleByLower(nm) {
    var found = null;
    RULE_LIBRARY().forEach(function (sec) { sec.rules.forEach(function (r) { if (!r.custom && r.name.toLowerCase() === nm) found = r; }); });
    return found;
  }
  function instantiateLibRule(entry) {
    var r = Object.assign({}, entry, { id: "r-" + (S._seq++), draft: true });
    delete r.group; delete r.custom; delete r.desc;
    if (r.days) r.days = r.days.slice();   // own copy so instances don't share
    if (r.dates) r.dates = r.dates.slice();
    if (r.params) r.params = Object.assign({}, r.params);
    return r;
  }
  function openGroupEditor(groupId) {
    if (!guardEdit()) return;
    var selected = {};
    var name = "";
    if (groupId) {
      var g = groupById(groupId);
      if (!g) return;
      if (g.locked) { toast("This group is locked and can\u2019t be edited"); return; }
      name = g.name;
      g.rules.forEach(function (r) { selected[r.name.toLowerCase()] = true; });
    } else {
      name = uniqueGroupName("Custom group");
    }
    var geSide = groupId ? groupSide(groupById(groupId)) : (S.side === "pay" ? "pay" : "bill");
    S.groupEdit = { open: true, groupId: groupId || null, isNew: !groupId, name: name, selected: selected, side: geSide, _focused: false };
    RE._render();
  }
  function closeGroupEditor() { S.groupEdit = null; RE._render(); }
  function setGroupEditName(v) { if (S.groupEdit) S.groupEdit.name = v; }
  function toggleGroupEditRule(nm) {
    var ge = S.groupEdit; if (!ge) return;
    if (ge.selected[nm]) delete ge.selected[nm]; else ge.selected[nm] = true;
    RE._render();
  }
  function groupEditSelectedCount() {
    var ge = S.groupEdit; if (!ge) return 0;
    return Object.keys(ge.selected).filter(function (k) { return ge.selected[k]; }).length;
  }
  function saveGroupEdit() {
    if (!guardEdit()) return;
    var ge = S.groupEdit; if (!ge) return;
    var nm = (ge.name || "").trim();
    var g;
    if (ge.isNew) {
      if (!nm) nm = uniqueGroupName("Custom group");
      var newSide = ge.side === "pay" ? "pay" : "bill";
      g = { id: "g-" + (S._seq++), name: nm, rules: [], custom: true, side: newSide, resolution: "stack" };
      if (newSide === "pay") {
        // Land it at the end of the pay region, before the first bill group.
        var pgs = S.cfg.groups, lastPay = 0;
        pgs.forEach(function (x, i) { if (groupSide(x) === "pay") lastPay = i; });
        pgs.splice(lastPay + 1, 0, g);
      } else {
        // Land it ahead of the locked Markup / Taxes tail.
        S.cfg.groups.splice(Math.max(1, S.cfg.groups.length - 2), 0, g);
      }
      S.collapsed[g.id] = false;
    } else {
      g = groupById(ge.groupId); if (!g) { closeGroupEditor(); return; }
      if (nm) g.name = nm;
    }
    var desired = ge.selected;
    // Drop rules no longer selected.
    g.rules = g.rules.filter(function (r) { return desired[r.name.toLowerCase()]; });
    // Add newly selected rules from the library (existing non-library rules are kept).
    var have = {}; g.rules.forEach(function (r) { have[r.name.toLowerCase()] = 1; });
    Object.keys(desired).forEach(function (key) {
      if (!desired[key] || have[key]) return;
      var entry = libRuleByLower(key);
      if (entry) g.rules.push(instantiateLibRule(entry));
    });
    var n = g.rules.length;
    toast((ge.isNew ? 'Added the "' : 'Updated the "') + g.name + '" group \u2014 ' + n + ' rule' + (n === 1 ? "" : "s"));
    S.groupEdit = null;
    markDirty(); RE._render();
  }
  // Add a rule from the library. If opened from a group's "Add rule" button,
  // it lands in that group (S.libTargetGroup); otherwise in the rule's own
  // target group (created if missing). Always a draft — values come later in
  // the rate-card import. (There is no blank "create a new rule" path: every
  // rule comes from the predefined library.)
  function addLibraryRule(name) {
    if (!guardEdit()) return;
    var entry = findLibRule(name); if (!entry) return;
    var gid = S.libTargetGroup || entry.group || "allowances";
    var g = groupById(gid);
    if (!g) {
      // Side-aware placement: pay-side components (e.g. Additional payments)
      // land at the end of the pay region; bill-side ones ahead of Markup/Taxes.
      var newGrpPay = libRuleIsPay(entry);
      g = { id: gid, name: groupNameFor(gid), rules: [], resolution: "stack", side: newGrpPay ? "pay" : "bill" };
      var gs = S.cfg.groups, idx;
      if (newGrpPay) {
        idx = 0; gs.forEach(function (x, i) { if (groupSide(x) === "pay") idx = i + 1; });
      } else {
        idx = gs.findIndex(function (x) { return x.id === "markup"; });
        if (idx < 0) idx = gs.length;
      }
      gs.splice(idx, 0, g);
    }
    // Base pay is always present and cannot be re-added.
    if (entry.type === "Base" || entry.name === "Base Pay Rate") {
      toast('"Base Pay Rate" is always present — it cannot be added again'); S.libOpen = false; S.libTargetGroup = null; RE._render(); return;
    }
    var dupInGroup = g.rules.some(function (r) { return r.name.toLowerCase() === entry.name.toLowerCase(); });
    // Multi-add rules (Part A) may sit several times in one group and be resolved
    // by its policy — each copy gets a distinguishing name so it stays a distinct,
    // separately-configurable rule. Other rules still de-dupe by name.
    var addEntry = entry;
    if (dupInGroup) {
      if (!isMultiAdd(entry.name)) {
        toast('"' + entry.name + '" is already in ' + g.name);
        S.libOpen = false; S.libTargetGroup = null; RE._render(); return;
      }
      var base = entry.name, k = 2, taken = {};
      g.rules.forEach(function (r) { taken[r.name.toLowerCase()] = 1; });
      while (taken[(base + " " + k).toLowerCase()]) k++;
      addEntry = Object.assign({}, entry, { name: base + " " + k });
    }
    g.rules.push(instantiateLibRule(addEntry));
    var newId = g.rules[g.rules.length - 1].id;
    S.expanded[newId] = true; S.libOpen = false; S.libTargetGroup = null; S.side = libRuleIsPay(entry) ? "pay" : "bill";
    toast('Added "' + addEntry.name + '" to ' + g.name + ' \u2014 set its values in the rate-card import');
    markDirty(); RE._render();
  }
  function delRule(id) {
    if (!guardEdit()) return;
    var f = findRule(id);
    if (f && (f.r.locked || !groupAddable(f.g))) { toast("This rule is part of a locked group and can\u2019t be removed"); return; }
    var nm = f ? f.r.name : "rule";
    S.cfg.groups.forEach(function (g) { g.rules = g.rules.filter(function (r) { return r.id !== id; }); });
    toast('Removed "' + nm + '"');
    markDirty(); RE._render();
  }
  // Toggle a custom day on a Day Specific Pay rule. Each selected day becomes a
  // pay-rate column in the rate-card template.
  function toggleRuleDay(id, day) {
    if (!guardEdit()) return;
    var f = findRule(id); if (!f) return;
    if (!f.r.days) f.r.days = [];
    var i = f.r.days.indexOf(day);
    if (i >= 0) f.r.days.splice(i, 1);
    else { f.r.days.push(day); f.r.days.sort(function (a, b) { return WEEK_DAYS.indexOf(a) - WEEK_DAYS.indexOf(b); }); }
    markDirty(); RE._render();
  }
  // Set a numeric config parameter (daily / weekly overtime) on a rule.
  function setRuleParam(id, key, raw) {
    if (!isEditable()) return;
    var f = findRule(id); if (!f) return;
    if (!f.r.params) f.r.params = {};
    f.r.params[key] = (raw === "" ? "" : Number(raw));
    S._focusParam = id + ":" + key;
    markDirty(); RE._render();
  }
  function setRuleParamString(id, key, val) {
    if (!isEditable()) return;
    var f = findRule(id); if (!f) return;
    if (!f.r.params) f.r.params = {};
    f.r.params[key] = val;
    markDirty(); RE._render();
  }
  // Add / remove a year-less holiday date ("MM-DD") on a Holiday pay rule.
  function addRuleDate(id, m, d) {
    if (!guardEdit()) return;
    var f = findRule(id); if (!f) return;
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return;
    if (d > MONTH_DAYS[m - 1]) { toast(MONTHS[m - 1] + " doesn\u2019t have " + d + " days"); return; }
    if (!f.r.dates) f.r.dates = [];
    var key = (m < 10 ? "0" + m : "" + m) + "-" + (d < 10 ? "0" + d : "" + d);
    if (f.r.dates.indexOf(key) >= 0) { toast(fmtHolidayDate(key) + " is already added"); return; }
    f.r.dates.push(key); f.r.dates.sort();
    markDirty(); RE._render();
  }
  function removeRuleDate(id, key) {
    if (!guardEdit()) return;
    var f = findRule(id); if (!f || !f.r.dates) return;
    var i = f.r.dates.indexOf(key);
    if (i >= 0) f.r.dates.splice(i, 1);
    markDirty(); RE._render();
  }
  function setField(id, field, val) {
    if (!isEditable()) return;
    var f = findRule(id); if (!f) return;
    f.r[field] = val;
    if (field === "level") f.r.scope = val === "Global" ? "All" : val.replace(/^Per /, "per ");
    markDirty(); RE._render();
  }

  // ---- new rule-level ops: source toggle + time-band management ----
  function setRuleSource(ruleId, source) {
    if (!guardEdit()) return;
    var f = findRule(ruleId); if (!f) return;
    if (!f.r.params) f.r.params = {};
    f.r.params.source = source;
    markDirty(); RE._render();
  }
  function addTenureBand(ruleId) {
    if (!guardEdit()) return;
    var f = findRule(ruleId); if (!f) return;
    if (!f.r.bands) f.r.bands = [];
    var prev = f.r.bands[f.r.bands.length - 1];
    var fromWeek = prev ? (Number(prev.toWeek || 0) + 1) : 1;
    var toWeek   = fromWeek + 11;
    f.r.bands.push({ id: "tb-" + (S._seq++), fromWeek: fromWeek, toWeek: toWeek, value: 0 });
    S.expanded[f.r.id] = true;
    markDirty(); RE._render();
  }
  function addTimeBand(ruleId) {
    if (!guardEdit()) return;
    var f = findRule(ruleId); if (!f) return;
    if (!f.r.bands) f.r.bands = [];
    f.r.bands.push({ id: "b-" + (S._seq++), label: "", from: "08:00", to: "14:00", source: "pricing-rule", valueType: "Percentage", value: 15 });
    S.expanded[f.r.id] = true;
    markDirty(); RE._render();
  }
  function removeTimeBand(ruleId, bandId) {
    if (!guardEdit()) return;
    var f = findRule(ruleId); if (!f || !f.r.bands) return;
    f.r.bands = f.r.bands.filter(function(b) { return b.id !== bandId; });
    markDirty(); RE._render();
  }
  function setBandField(ruleId, bandId, field, val) {
    if (!isEditable()) return;
    var f = findRule(ruleId); if (!f || !f.r.bands) return;
    var band = f.r.bands.filter(function(b) { return b.id === bandId; })[0];
    if (!band) return;
    if (field === "value") val = parseFloat(val) || 1.0;
    band[field] = val;
    markDirty(); RE._render();
  }

  // Crash guard for event handlers: any thrown error is logged, the user
  // is told nothing changed, and we re-render from the last known state
  // (RE._render is itself guarded). Keeps interactions from escaping as
  // uncaught exceptions — the failure mode the earlier render-only guard
  // never covered.
  function reGuard(fn) {
    try { fn(); }
    catch (err) {
      try { if (window.console && console.error) console.error("[RateEngine] action failed:", err); } catch (x) {}
      try { toast("That action couldn’t complete — nothing was changed"); } catch (x) {}
      try { RE._render(); } catch (x) {}
    }
  }

  // ============================================================ events
  RE._wireOnce = function () {
    var root = RE._root;
    if (!root || root.__reWired) return;
    root.__reWired = true;

    root.addEventListener("click", function (e) { reGuard(function () {
      var t = e.target, hit = function (a) { return t.closest("[" + a + "]"); };
      var el;
      if ((el = hit("data-re-removecfg"))) { S.removeCfgConfirm = el.getAttribute("data-re-removecfg"); S.configMenuOpen = false; S.versionMenuOpen = false; RE._render(); return; }
      if (hit("data-re-removecfg-confirm")) { var rcid = S.removeCfgConfirm, rcName = ""; S.configs.forEach(function (c) { if (c.id === rcid) rcName = c.legalEntity; }); S.configs = S.configs.filter(function (c) { return c.id !== rcid; }); if (S.configs.length && S.activeConfigId === rcid) S.activeConfigId = S.configs[0].id; S.removeCfgConfirm = null; S.view = "table"; toast('\u201c' + rcName + '\u201d configuration removed'); RE._render(); return; }
      if (hit("data-re-removecfg-cancel")) { S.removeCfgConfirm = null; RE._render(); return; }
      if ((el = hit("data-re-viewentity"))) { pickConfig(el.getAttribute("data-re-viewentity")); return; }
      if (hit("data-re-backtotable")) { S.view = "table"; S.configMenuOpen = false; S.versionMenuOpen = false; RE._render(); return; }
      if (hit("data-re-cfgmenu")) { S.configMenuOpen = !S.configMenuOpen; S.versionMenuOpen = false; RE._render(); return; }
      if (hit("data-re-vermenu")) { S.versionMenuOpen = !S.versionMenuOpen; S.configMenuOpen = false; RE._render(); return; }
      if (hit("data-re-menuclose")) { S.configMenuOpen = false; S.versionMenuOpen = false; RE._render(); return; }
      if ((el = hit("data-re-pickcfg"))) { pickConfig(el.getAttribute("data-re-pickcfg")); return; }
      if ((el = hit("data-re-pickver"))) { pickVersion(el.getAttribute("data-re-pickver")); return; }
      if (hit("data-re-newcfg")) { newConfig(); return; }
      if (hit("data-re-newver")) { newVersion(); return; }
      if (hit("data-re-cond-confirm")) {
        // Collect checkbox state from the DOM before the form closes
        if (S.conditionsForm) {
          var allChecks = RE._root.querySelectorAll("[data-re-cond-type]");
          var conds = {};
          allChecks.forEach(function (cb) {
            if (!cb.checked) return;
            var t = cb.getAttribute("data-re-cond-type"), v = cb.getAttribute("data-re-cond-val");
            if (!conds[t]) conds[t] = [];
            conds[t].push(v);
          });
          S.conditionsForm.conditions = conds;
        }
        commitNewVersion(); return;
      }
      if (hit("data-re-cond-cancel")) { S.conditionsForm = null; RE._render(); return; }
      if (hit("data-re-publish")) { publishVersion(); return; }
      if (hit("data-re-savestruct")) { saveStructure(); return; }
      if (hit("data-re-switchdraft")) { switchToDraft(); return; }
      if ((el = hit("data-re-density"))) { S.density = el.getAttribute("data-re-density"); RE._render(); return; }
      if (hit("data-re-qclear")) { S.q = ""; RE._render(); return; }
      if (hit("data-re-collapseall")) { S.cfg.groups.forEach(function (g) { S.collapsed[g.id] = true; }); RE._render(); return; }
      if (hit("data-re-expandall")) { S.collapsed = {}; RE._render(); return; }
      if (hit("data-re-addgroup")) { addGroup(); return; }
      if ((el = hit("data-re-addrule"))) { S.libTargetGroup = el.getAttribute("data-re-addrule"); S.libQuery = ""; S.libOpen = true; RE._render(); return; }
      if ((el = hit("data-re-delrule"))) { delRule(el.getAttribute("data-re-delrule")); return; }
      if ((el = hit("data-re-grptoggle"))) { var gid = el.getAttribute("data-re-grptoggle"); S.collapsed[gid] = !S.collapsed[gid]; RE._render(); return; }
      if ((el = hit("data-re-grp-up"))) { moveGroup(el.getAttribute("data-re-grp-up"), -1); return; }
      if ((el = hit("data-re-grp-down"))) { moveGroup(el.getAttribute("data-re-grp-down"), 1); return; }
      if ((el = hit("data-re-grpdel"))) { delGroup(el.getAttribute("data-re-grpdel")); return; }
      if ((el = hit("data-re-grpedit"))) { openGroupEditor(el.getAttribute("data-re-grpedit")); return; }
      if ((el = hit("data-re-getoggle"))) { toggleGroupEditRule(el.getAttribute("data-re-getoggle")); return; }
      if (hit("data-re-gesave")) { saveGroupEdit(); return; }
      if (hit("data-re-geclose")) { closeGroupEditor(); return; }
      if (t.classList && t.classList.contains("re-modal-scrim") && t.hasAttribute("data-re-gescrim")) { closeGroupEditor(); return; }
      if ((el = hit("data-re-rulesource"))) { var rsp = el.getAttribute("data-re-rulesource").split(":"); setRuleSource(rsp[0], rsp[1]); return; }
      if ((el = hit("data-re-tbadd")))   { addTenureBand(el.getAttribute("data-re-tbadd")); return; }
      if ((el = hit("data-re-bandadd"))) { addTimeBand(el.getAttribute("data-re-bandadd")); return; }
      if ((el = hit("data-re-banddel"))) { var bdp = el.getAttribute("data-re-banddel").split(":"); removeTimeBand(bdp[0], bdp[1]); return; }
      if ((el = hit("data-re-bandsource"))) { var bsp3 = el.getAttribute("data-re-bandsource").split(":"); setBandField(bsp3[0], bsp3[1], "source", bsp3[2]); return; }
      if ((el = hit("data-re-ruleday"))) { var dp = el.getAttribute("data-re-ruleday").split(":"); toggleRuleDay(dp[0], dp[1]); return; }
      if ((el = hit("data-re-dateadd"))) {
        var rid = el.getAttribute("data-re-dateadd");
        var ms = RE._root.querySelector('[data-re-datem="' + rid + '"]');
        var dsl = RE._root.querySelector('[data-re-dated="' + rid + '"]');
        if (ms && dsl) addRuleDate(rid, parseInt(ms.value, 10), parseInt(dsl.value, 10));
        return;
      }
      if ((el = hit("data-re-ruledatedel"))) { var xp = el.getAttribute("data-re-ruledatedel").split(":"); removeRuleDate(xp[0], xp[1]); return; }
      if ((el = hit("data-re-ruletoggle"))) { var rid = el.getAttribute("data-re-ruletoggle"); S.selectedRule = (S.selectedRule === rid ? null : rid); RE._render(); return; }
      if ((el = hit("data-re-advtoggle"))) { toggleAdvanced(el.getAttribute("data-re-advtoggle")); return; }
      if ((el = hit("data-re-flag"))) { var fp = el.getAttribute("data-re-flag").split(":"); toggleRuleFlag(fp[0], fp[1]); return; }
      if ((el = hit("data-re-shifttype"))) { var stp = el.getAttribute("data-re-shifttype").split(":"); var stf = findRule(stp[0]); if (stf && isEditable()) { stf.r.shiftValueType = stp[1]; markDirty(); RE._render(); } return; }
      if ((el = hit("data-re-side"))) { S.side = el.getAttribute("data-re-side"); RE._render(); return; }
      if ((el = hit("data-re-sectoggle"))) { var sid = el.getAttribute("data-re-sectoggle"); S.sectionCollapsed[sid] = !S.sectionCollapsed[sid]; RE._render(); return; }
      if ((el = hit("data-re-lkstriptoggle"))) { S.lookupStripCollapsed = !S.lookupStripCollapsed; RE._render(); return; }
      if ((el = hit("data-re-lkadd"))) { lookupAdd(el.getAttribute("data-re-lkadd")); return; }
      if ((el = hit("data-re-lkremove"))) { lookupRemove(el.getAttribute("data-re-lkremove")); return; }
      if ((el = hit("data-re-lkmove"))) { var lp = el.getAttribute("data-re-lkmove").split(":"); lookupMove(lp[0] + ":" + lp[1], +lp[2]); return; }
      if (hit("data-re-csv")) { downloadTemplatesBoth(); return; }
      if ((el = hit("data-re-tplfmt"))) { S.tplFmt = el.getAttribute("data-re-tplfmt"); RE._render(); return; }
      if (hit("data-re-viewtpl")) { S.tplOpen = true; S.tplScope = (S.side === "bill" ? "bill" : "pay"); S.sheet = "pay"; RE._render(); return; }
      if (hit("data-re-addlib")) { S.libTargetGroup = null; S.libQuery = ""; S.libOpen = true; RE._render(); return; }
      if ((el = hit("data-re-libfilter"))) { S.libFilter = el.getAttribute("data-re-libfilter"); RE._render(); return; }
      if (hit("data-re-libclose")) { S.libOpen = false; S.libTargetGroup = null; RE._render(); return; }
      if (hit("data-re-libqclear")) { S.libQuery = ""; RE._render(); var lq = RE._root.querySelector("[data-re-libq]"); if (lq) { try { lq.focus(); } catch (x) {} } return; }
      if ((el = hit("data-re-libadd"))) { addLibraryRule(el.getAttribute("data-re-libadd")); return; }
      if (t.classList && t.classList.contains("re-modal-scrim") && t.hasAttribute("data-re-libscrim")) { S.libOpen = false; S.libTargetGroup = null; RE._render(); return; }
      if (hit("data-re-tplclose")) { S.tplOpen = false; RE._render(); return; }
      if ((el = hit("data-re-sheet"))) { S.sheet = el.getAttribute("data-re-sheet"); RE._render(); return; }
      if (hit("data-re-download")) { downloadTemplate(S.tplScope, false, S.tplFmt || "xlsx"); return; }
      if (t.classList && t.classList.contains("re-modal-scrim")) { S.tplOpen = false; RE._render(); return; }
    }); });

    root.addEventListener("input", function (e) { reGuard(function () {
      var el = e.target;
      if (el.hasAttribute("data-re-gename")) { setGroupEditName(el.value); return; }
      if (el.hasAttribute("data-re-q")) {
        S.q = el.value;
        var pos = el.selectionStart;
        RE._render();
        var ni = RE._root.querySelector("[data-re-q]");
        if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (x) {} }
        return;
      }
      if (el.hasAttribute("data-re-libq")) {
        S.libQuery = el.value;
        var lpos = el.selectionStart;
        RE._render();
        var lni = RE._root.querySelector("[data-re-libq]");
        if (lni) { lni.focus(); try { lni.setSelectionRange(lpos, lpos); } catch (x) {} }
        return;
      }
    }); });
    root.addEventListener("keydown", function (e) { reGuard(function () {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var el = e.target.closest("[data-re-sectoggle]");
      if (!el) return;
      e.preventDefault();
      var sid = el.getAttribute("data-re-sectoggle");
      S.sectionCollapsed[sid] = !S.sectionCollapsed[sid]; RE._render();
    }); });
    root.addEventListener("change", function (e) { reGuard(function () {
      var el = e.target;
      if (el.hasAttribute("data-re-field")) { var p = el.getAttribute("data-re-field").split(":"); setField(p[0], p[1], el.value); }
      if (el.hasAttribute("data-re-fname")) { var nv = el.value.trim(); if (nv) setField(el.getAttribute("data-re-fname"), "name", nv); }
      if (el.hasAttribute("data-re-shiftsrc")) { var ssf = findRule(el.getAttribute("data-re-shiftsrc")); if (ssf && isEditable()) { ssf.r.sourceLabel = el.value.trim() || null; markDirty(); } }
      if (el.hasAttribute("data-re-grpname")) { var gv = el.value.trim(); if (gv) setGroupName(el.getAttribute("data-re-grpname"), gv); }
      if (el.hasAttribute("data-re-grpres")) { setGroupResolution(el.getAttribute("data-re-grpres"), el.value); return; }
      if (el.hasAttribute("data-re-ruleparam")) { var pp = el.getAttribute("data-re-ruleparam").split(":"); setRuleParam(pp[0], pp[1], el.value); }
      if (el.hasAttribute("data-re-rulelitparam")) { var lpp = el.getAttribute("data-re-rulelitparam").split(":"); setRuleParamString(lpp[0], lpp[1], el.value); return; }
      if (el.hasAttribute("data-re-bandvaluetype")) { var bvtp = el.getAttribute("data-re-bandvaluetype").split(":"); setBandField(bvtp[0], bvtp[1], "valueType", el.value); return; }
      if (el.hasAttribute("data-re-bandtime")) { var btp = el.getAttribute("data-re-bandtime").split(":"); setBandField(btp[0], btp[1], btp[2], el.value); return; }
      if (el.hasAttribute("data-re-bandvalue")) { var bvp = el.getAttribute("data-re-bandvalue").split(":"); setBandField(bvp[0], bvp[1], "value", el.value); return; }
      if (el.hasAttribute("data-re-bandwk"))    { var bwp = el.getAttribute("data-re-bandwk").split(":"); setBandField(bwp[0], bwp[1], bwp[2], parseInt(el.value, 10) || 1); return; }
      if (el.hasAttribute("data-re-bandlabel")) { var blp = el.getAttribute("data-re-bandlabel").split(":"); setBandField(blp[0], blp[1], "label", el.value); return; }
    }); });

    // ---- drag-and-drop rule reordering (within a group) ----
    function clearDropMarks() {
      root.querySelectorAll(".is-drop-before, .is-drop-after").forEach(function (n) { n.classList.remove("is-drop-before", "is-drop-after"); });
    }
    function cleanupDrag() {
      dragRuleId = null; dragGroupId = null; dragLkKey = null;
      root.querySelectorAll(".is-dragging").forEach(function (n) { n.classList.remove("is-dragging"); });
      clearDropMarks();
    }
    root.addEventListener("dragstart", function (e) {
      var gh = e.target.closest("[data-re-grpgrip]");
      if (gh) {
        dragGroupId = gh.getAttribute("data-re-grpgrip"); dragRuleId = null;
        var sec = gh.closest("[data-re-grpdrag]"); if (sec) sec.classList.add("is-dragging");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragGroupId); } catch (x) {}
        return;
      }
      var lkChip = e.target.closest("[data-re-lkdrag]");
      if (lkChip) {
        dragLkKey = lkChip.getAttribute("data-re-lkdrag"); dragRuleId = null; dragGroupId = null;
        lkChip.classList.add("is-dragging");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragLkKey); } catch (x) {}
        return;
      }
      var h = e.target.closest("[data-re-grip]"); if (!h) return;
      dragRuleId = h.getAttribute("data-re-grip"); dragGroupId = null;
      var card = h.closest("[data-re-ruledrag]"); if (card) card.classList.add("is-dragging");
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragRuleId); } catch (x) {}
    });
    root.addEventListener("dragover", function (e) {
      if (dragLkKey) {
        var lkNode = e.target.closest("[data-re-lkdrop]");
        if (lkNode && lkNode.getAttribute("data-re-lkdrop") !== dragLkKey) {
          e.preventDefault(); try { e.dataTransfer.dropEffect = "move"; } catch(x) {} lkNode.classList.add("is-lk-over");
        }
        return;
      }
      var sel = dragGroupId ? "[data-re-grpdrag]" : dragRuleId ? "[data-re-ruledrag]" : null;
      if (!sel) return;
      var node = e.target.closest(sel); if (!node) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = "move"; } catch (x) {}
      clearDropMarks();
      var selfId = dragGroupId || dragRuleId;
      if (node.getAttribute(dragGroupId ? "data-re-grpdrag" : "data-re-ruledrag") === selfId) return;
      var b = node.getBoundingClientRect();
      node.classList.add((e.clientY - b.top) > b.height / 2 ? "is-drop-after" : "is-drop-before");
    });
    root.addEventListener("dragleave", function (e) {
      var node = e.target.closest("[data-re-ruledrag], [data-re-grpdrag], [data-re-lkdrop]");
      if (node) node.classList.remove("is-drop-before", "is-drop-after", "is-lk-over");
    });
    root.addEventListener("drop", function (e) { reGuard(function () {
      if (dragLkKey) {
        var lkNode = e.target.closest("[data-re-lkdrop]");
        var srcKey = dragLkKey;
        cleanupDrag();
        if (lkNode) {
          e.preventDefault();
          var toKey = lkNode.getAttribute("data-re-lkdrop");
          if (srcKey !== toKey) {
            var lsp = srcKey.split(":"), ltp = toKey.split(":");
            if (lsp[0] === ltp[0]) {
              var lside = lsp[0], fk = lsp[1], tk = ltp[1];
              var larr = lookupActiveFor(lside).slice();
              var fi = larr.indexOf(fk), ti = larr.indexOf(tk);
              if (fi >= 0 && ti >= 0) {
                larr.splice(fi, 1); larr.splice(ti, 0, fk);
                if (lside === "bill") S.lookupBill = larr; else S.lookupPay = larr;
                markDirty(); RE._render();
              }
            }
          }
        }
        return;
      }
      var group = !!dragGroupId, sel = group ? "[data-re-grpdrag]" : dragRuleId ? "[data-re-ruledrag]" : null;
      if (!sel) { cleanupDrag(); return; }
      var node = e.target.closest(sel); if (!node) { cleanupDrag(); return; }
      e.preventDefault();
      var targetId = node.getAttribute(group ? "data-re-grpdrag" : "data-re-ruledrag");
      var b = node.getBoundingClientRect();
      var after = (e.clientY - b.top) > b.height / 2;
      var src = group ? dragGroupId : dragRuleId;
      cleanupDrag();
      if (src && targetId && src !== targetId) { if (group) reorderGroup(src, targetId, after); else reorderRule(src, targetId, after); }
    }); });
    root.addEventListener("dragend", function () { cleanupDrag(); });

    document.addEventListener("keydown", function (e) { reGuard(function () {
      if (e.key !== "Escape" || !RE.state) return;
      if (RE.state.groupEdit && RE.state.groupEdit.open) { RE.state.groupEdit = null; RE._render(); }
      else if (RE.state.libOpen) { RE.state.libOpen = false; RE.state.libTargetGroup = null; RE._render(); }
      else if (RE.state.tplOpen) { RE.state.tplOpen = false; RE._render(); }
      else if (RE.state.configMenuOpen || RE.state.versionMenuOpen) { RE.state.configMenuOpen = false; RE.state.versionMenuOpen = false; RE._render(); }
    }); });
  };

})();
