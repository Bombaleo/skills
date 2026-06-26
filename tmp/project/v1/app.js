// =====================================================================
//  FLEX WORK V1 · app  (IA version: V1)
//  ---------------------------------------------------------------------
//  The V1 root. Owns the single app state, the render loop, the content
//  router (which page renders for the current view) and the chrome-level
//  event wiring (nav, settings sub-nav, account/role menu, and the
//  delegated [data-act] actions). Loaded LAST — after core.js, chrome.js
//  and every page module — then boots by calling render(), exactly like
//  v2's app.jsx mounts after its page modules are on window.
//
//  Single-page behaviour: every state, page and role runs from this one
//  index.html. Pages are pure render(state)→HTML functions re-invoked on
//  each render(); page-specific element listeners are attached by each
//  page's wire(root). No React, no Babel — the V1 convention.
// =====================================================================
(function (V1) {
  "use strict";
  var toast = V1.toast;

  // ============================================================
  //  App state — the single source of truth for the whole shell.
  // ============================================================
  var state = {
    view: "agencies",        // "agencies" | "settings"
    agencyTab: "list",       // within Agencies: "list" | "detail"
    agencySub: "active",     // active Agencies sub-nav item
    agencySort: null,        // { key: "sent"|"activated", dir: "asc"|"desc" } | null
    settingsItem: "pricing", // active settings sub-nav id
    role: "admin",           // "viewing as" role (see V1.ROLES)
    collapsed: false,
    upload: null,            // { name, size, rows, cols, processed, parsed }
    exampleRole: 0,          // index into the computed rate card for the worked example
    openAcc: { pricing: false }, // which agency accordion sections are expanded
    reRules: null,           // rate engine lookup rules (lazy-init by page module)
    reEditing: null,         // rule id | "new" | null
    reDraft: null,           // draft rule object being edited
    reDeleteConfirm: false,  // confirm-remove prompt in editor
    // Settings → Pricing: tab state + statutory rule editor
    pricingTab: "upload",
    srEditing: null,
    srDraft: null,
    // Agency-level pay rate engine settings (edited in the agency detail,
    // consumed by the Pricing engine + computed rate card).
    engine: {
      margin: 18,            // agency margin, % of charge build-up
      ot: 1.5,               // overtime multiplier
      rounding: 0,           // 0 = none; else round charge UP to nearest (e.g. 0.05)
      onCosts: [
        { key: "holiday", label: "Holiday pay accrual",   sub: "12.07% statutory",        pct: 12.07, on: true },
        { key: "ni",      label: "Employer's National Insurance", sub: "Secondary Class 1", pct: 13.80, on: true },
        { key: "pension", label: "Workplace pension",      sub: "Auto-enrolment minimum",  pct: 3.00,  on: true },
        { key: "levy",    label: "Apprenticeship levy",    sub: "0.5% of paybill",         pct: 0.50,  on: true },
      ],
    },
  };
  V1.state = state;
  // Statutory rules + upload validations — deep-copied from the pricing page module.
  state.statutoryRules    = ((V1.pages.pricing || {}).STATUTORY_RULES || []).map(function (r) { return JSON.parse(JSON.stringify(r)); });
  state.pricingValidations = ((V1.pages.pricing || {}).VALIDATIONS     || []).map(function (v) { return JSON.parse(JSON.stringify(v)); });
  // Default engine snapshot, for "Reset to defaults".
  V1.DEFAULT_ENGINE = JSON.parse(JSON.stringify(state.engine));

  // ============================================================
  //  Content router — which page renders for the current view.
  // ============================================================
  function content() {
    if (state.view === "settings") {
      if (state.settingsItem === "pricing")     return V1.pages.pricing.render();
      if (state.settingsItem === "rate-engine") return V1.pages.rateEngine.render();
      return V1.pages.settings.renderStub();
    }
    // Agencies area
    return state.agencyTab === "detail"
      ? V1.pages.agencies.render()
      : V1.pages.agenciesList.render();
  }

  // ============================================================
  //  Render — shell + active page, then wire.
  // ============================================================
  function render() {
    var app = V1.app = document.getElementById("app");
    app.innerHTML =
      V1.chrome.topbar() +
      '<div class="proto-body' + (state.collapsed ? " is-collapsed" : "") + '">' +
        (state.view === "settings" ? V1.chrome.settingsSidebar() : V1.chrome.mainSidebar()) +
        '<main class="proto-main"><div class="proto-main-inner">' + content() + '</div>' + V1.chrome.footer() + '</main>' +
      '</div>';
    V1.fillIcons(app);
    wire(app);
  }
  V1.render = render;

  // ============================================================
  //  Event wiring (delegated per render)
  // ============================================================
  function wire(app) {
    // primary nav
    app.querySelectorAll("[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-nav");
        if (id === "agencies") { state.view = "agencies"; state.agencyTab = "list"; state.agencySub = "active"; render(); }
        else if (id === "settings") { state.view = "settings"; render(); }
        else { toast(b.textContent.trim() + " isn\u2019t part of this prototype"); }
      });
    });

    // Agencies sub-nav (Invite / Active / Deactivated / Invoices)
    app.querySelectorAll("[data-agencysub]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-agencysub");
        if (id === "active") { state.agencySub = "active"; state.agencyTab = "list"; render(); }
        else { toast(b.textContent.trim() + " isn\u2019t part of this prototype"); }
      });
    });

    // settings sub-nav
    app.querySelectorAll("[data-set]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.settingsItem = b.getAttribute("data-set");
        render();
      });
    });

    // "viewing as" role selection (top-bar account menu)
    app.querySelectorAll("[data-role]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-role");
        if (id === state.role) { closeAccountMenu(); return; }
        state.role = id;
        render();
        var label = (V1.ROLES.filter(function (r) { return r.id === id; })[0] || {}).label || id;
        toast("Viewing as " + label);
      });
    });

    // generic delegated actions
    app.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        var a = b.getAttribute("data-act");
        if (a === "noop") { e.preventDefault(); return; }
        switch (a) {
          case "home": e.preventDefault(); state.view = "agencies"; state.agencyTab = "list"; state.agencySub = "active"; render(); break;
          case "backtoapp": state.view = "agencies"; render(); break;
          case "settings-root": state.view = "settings"; render(); break;
          case "agency-list": state.agencyTab = "list"; render(); break;
          case "collapse": state.collapsed = !state.collapsed; render(); break;
          case "go-pricing": state.view = "settings"; state.settingsItem = "pricing"; render(); break;
          case "download-template": V1.engine.downloadTemplate(); break;
          case "remove-file": state.upload = null; render(); break;
          case "process":
            if (state.upload && !state.upload.processed) { state.upload.processed = true; render(); toast("Rate automation applied"); }
            break;
          case "copy-guid":
            try { navigator.clipboard.writeText("5b488f4f-391f-405a-87ca-1811a0f63ac8"); } catch (er) {}
            toast("GUID copied"); break;
          case "update-contract": toast("Contract editor isn\u2019t part of this prototype"); break;
          case "deactivate": toast("Deactivate isn\u2019t part of this prototype"); break;
          case "open-agency-settings": state.view = "agencies"; state.agencyTab = "detail"; state.openAcc.pricing = true; render(); toast("Agency engine settings"); break;
          case "save-engine": toast("Engine settings saved \u2014 rates recalculated"); break;
          case "reset-engine":
            state.engine = JSON.parse(JSON.stringify(V1.DEFAULT_ENGINE));
            render(); toast("Engine reset to defaults"); break;

          // ---- Statutory Rules actions ----
          case "pricing-tab":
            state.pricingTab = b.getAttribute("data-tab") || "upload";
            state.srEditing  = null;
            state.srDraft    = null;
            render();
            break;

          case "sr-edit": {
            var srId   = b.getAttribute("data-sr-id");
            var srRule = (state.statutoryRules || []).filter(function (r) { return r.id === srId; })[0];
            if (!srRule) break;
            state.srEditing = srId;
            state.srDraft   = JSON.parse(JSON.stringify(srRule));
            render();
            break;
          }

          case "sr-cancel":
            state.srEditing = null;
            state.srDraft   = null;
            render();
            break;

          case "sr-save": {
            if (!state.srDraft) break;
            var srRules = state.statutoryRules || [];
            var srIdx = -1;
            for (var sri = 0; sri < srRules.length; sri++) {
              if (srRules[sri].id === state.srDraft.id) { srIdx = sri; break; }
            }
            if (srIdx >= 0) srRules[srIdx] = JSON.parse(JSON.stringify(state.srDraft));
            state.srEditing = null;
            state.srDraft   = null;
            render();
            toast("Rule updated");
            break;
          }

          // ---- Rate Engine lookup actions ----
          case "re-add":
            state.reEditing = "new";
            state.reDraft = V1.pages.rateEngine.newDraft();
            render();
            (function () {
              var el = document.getElementById("re-editor");
              if (el) el.scrollIntoView ? el.scrollIntoView({ behavior: "smooth", block: "start" }) : (el.parentElement.scrollTop = el.offsetTop);
            })();
            break;

          case "re-edit": {
            var rid = b.getAttribute("data-re-id");
            var rule = (state.reRules || []).filter(function (r) { return r.id === rid; })[0];
            if (!rule) break;
            state.reEditing = rid;
            state.reDraft   = JSON.parse(JSON.stringify(rule));
            render();
            (function () {
              var el = document.getElementById("re-editor");
              if (el) el.scrollIntoView ? el.scrollIntoView({ behavior: "smooth", block: "start" }) : (el.parentElement.scrollTop = el.offsetTop);
            })();
            break;
          }

          case "re-delete": {
            var delId = b.getAttribute("data-re-id");
            state.reRules = (state.reRules || []).filter(function (r) { return r.id !== delId; });
            if (state.reEditing === delId) { state.reEditing = null; state.reDraft = null; }
            render();
            toast("Rule deleted");
            break;
          }

          case "re-save": {
            if (!state.reDraft) break;
            var draft = state.reDraft;
            if (!state.reRules) state.reRules = [];
            var existIdx = state.reRules.findIndex ? state.reRules.findIndex(function (r) { return r.id === draft.id; })
              : (function () { for (var i = 0; i < state.reRules.length; i++) { if (state.reRules[i].id === draft.id) return i; } return -1; })();
            if (existIdx >= 0) {
              state.reRules[existIdx] = JSON.parse(JSON.stringify(draft));
              toast("Rule updated");
            } else {
              state.reRules.push(JSON.parse(JSON.stringify(draft)));
              toast("Rule added");
            }
            state.reEditing       = null;
            state.reDraft         = null;
            state.reDeleteConfirm = false;
            render();
            break;
          }

          case "re-delete-prompt":
            state.reDeleteConfirm = true;
            render();
            break;

          case "re-delete-confirm": {
            var confirmId = state.reDraft && state.reDraft.id;
            state.reRules = (state.reRules || []).filter(function (r) { return r.id !== confirmId; });
            state.reEditing       = null;
            state.reDraft         = null;
            state.reDeleteConfirm = false;
            render();
            toast("Rule removed");
            break;
          }

          case "re-delete-dismiss":
            state.reDeleteConfirm = false;
            render();
            break;

          case "re-cancel":
            state.reEditing       = null;
            state.reDraft         = null;
            state.reDeleteConfirm = false;
            render();
            break;

          case "re-draft-tenure": {
            if (state.reDraft) { state.reDraft.tenureStatus = b.getAttribute("data-val"); render(); }
            break;
          }

          case "re-draft-enabled": {
            if (state.reDraft) { state.reDraft.enabled = b.getAttribute("data-val") === "1"; render(); }
            break;
          }
          case "bell": toast("No new notifications"); break;
          case "locale": toast("Region switching isn\u2019t part of this prototype"); break;
          case "user-guides": e.preventDefault(); toast("User Guides aren\u2019t part of this prototype"); break;
          case "api-docs": e.preventDefault(); toast("API Docs aren\u2019t part of this prototype"); break;
          case "signout": toast("Sign-out isn\u2019t part of this prototype"); break;
          case "account": e.stopPropagation(); toggleAccountMenu(); break;
          default: break;
        }
      });
    });

    // delegate page-specific element wiring to the active page module
    if (state.view === "agencies") {
      if (state.agencyTab === "detail") V1.pages.agencies.wire(app);
      else V1.pages.agenciesList.wire(app);
    } else if (state.view === "settings" && state.settingsItem === "pricing") {
      V1.pages.pricing.wire(app);
    } else if (state.view === "settings" && state.settingsItem === "rate-engine") {
      V1.pages.rateEngine.wire(app);
    }
  }

  // ---------- Account / role menu open-close ----------
  function toggleAccountMenu() {
    var menu = document.getElementById("acct-menu");
    if (menu) menu.hidden = !menu.hidden;
  }
  function closeAccountMenu() {
    var menu = document.getElementById("acct-menu");
    if (menu) menu.hidden = true;
  }
  // Close the menu on any outside click — bound ONCE so it survives
  // every re-render (the menu element is rebuilt but the id is stable).
  document.addEventListener("click", function (e) {
    var menu = document.getElementById("acct-menu");
    if (!menu || menu.hidden) return;
    if (!e.target.closest || !e.target.closest(".proto-account")) closeAccountMenu();
  });

  // ============================================================
  //  Boot
  // ============================================================
  render();
})(window.V1);
