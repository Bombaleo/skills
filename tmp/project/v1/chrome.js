// =====================================================================
//  FLEX WORK V1 · chrome  (IA version: V1)
//  ---------------------------------------------------------------------
//  The V1 app shell, in the LEGACY design (not Everest components):
//  top nav bar (brand, locale flag, notifications, name + account/role
//  menu), the search pill, the primary left sidebar (with the expandable
//  Agencies sub-nav), the Settings sub-nav sidebar, and the page footer
//  (User Guides / API Docs / Changelog · powered by). Pure render
//  functions returning HTML strings; app.js stitches them around the
//  active page and wires them.
//
//  Loaded AFTER core.js and BEFORE app.js.
// =====================================================================
(function (V1) {
  "use strict";
  var ico = V1.ico;

  // US flag (locale switcher) — V1 chrome affordance.
  var FLAG_US = '<span class="proto-flag" aria-hidden="true"><img src="vendor/flag-usa.png" alt="" /></span>';

  var chrome = {};

  // ---------- Top bar ----------
  chrome.topbar = function () {
    var state = V1.state;
    var roleLabel = (V1.ROLES.filter(function (r) { return r.id === state.role; })[0] || V1.ROLES[0]).label;

    var roleRows = V1.ROLES.map(function (r) {
      var cur = r.id === state.role;
      return '<button class="proto-account-role' + (cur ? " is-current" : "") + '" data-role="' + r.id + '">' +
        '<span>' + r.label + '</span>' + (cur ? ico("Check") : "") +
      '</button>';
    }).join("");

    return '<header class="proto-topbar">' +
      '<a class="proto-topbar-brand" href="#" data-act="home" aria-label="Dayforce Flex Work">' +
        '<img src="vendor/dfw_logo_horizontal.svg" alt="Dayforce Flex Work" />' +
      '</a>' +
      '<span class="proto-topbar-spacer"></span>' +
      '<div class="proto-topbar-actions">' +
        '<button class="proto-flagbtn" data-act="locale" aria-label="Region: United States">' + FLAG_US + '</button>' +
        '<button class="proto-iconbtn" data-act="bell" aria-label="Notifications">' + ico("Bell") + '<span class="proto-bell-dot"></span></button>' +
        '<div class="proto-account">' +
          '<button class="proto-userbtn" data-act="account" aria-haspopup="true" aria-label="Your account">' +
            '<span class="proto-userbtn-name">' + V1.USER.name + '</span>' +
            '<span class="proto-userbtn-chev proto-ico" data-icon="ChevronDown"></span>' +
            '<span class="proto-avatar">' + V1.USER.initials + '</span>' +
          '</button>' +
          '<div class="proto-account-menu" id="acct-menu" hidden>' +
            '<div class="proto-account-id">' +
              '<span class="proto-avatar proto-avatar--sm">' + V1.USER.initials + '</span>' +
              '<div><div class="ai-name">' + V1.USER.fullName + '</div><div class="ai-email">' + V1.USER.email + '</div></div>' +
            '</div>' +
            '<div class="proto-account-sec">Role</div>' +
            roleRows +
            '<div class="proto-account-sep"></div>' +
            '<button class="proto-account-item" data-act="signout">' + ico("ArrowLeft") + 'Sign out</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</header>';
  };

  // ---------- Search pill ----------
  chrome.searchBox = function () {
    return '<div class="proto-search">' + ico("Search") +
      '<input class="proto-search-input" type="text" placeholder="Search" aria-label="Search" />' +
      '<span class="proto-kbd"><kbd>\u2318</kbd><kbd>K</kbd></span>' +
    '</div>';
  };

  // ---------- Collapse / expand toggle ----------
  chrome.collapseBtn = function () {
    var collapsed = V1.state.collapsed;
    return '<button class="proto-collapse" data-act="collapse" aria-label="' +
        (collapsed ? "Expand sidebar" : "Collapse sidebar") + '" title="' +
        (collapsed ? "Expand sidebar" : "Collapse sidebar") + '">' +
      ico(collapsed ? "ChevronRight" : "ChevronLeft") +
      '<span class="proto-collapse-label">Collapse sidebar</span>' +
    '</button>';
  };

  // ---------- Primary sidebar ----------
  chrome.mainSidebar = function () {
    var state = V1.state;
    var onAgencies = state.view === "agencies";

    var items = V1.MAIN_NAV.map(function (n) {
      if (n.id === "agencies") {
        // Expandable + active when in the Agencies area; renders its sub-nav.
        var sub = onAgencies ? '<div class="proto-subnav-inline">' + V1.AGENCY_SUBNAV.map(function (s) {
          var active = onAgencies && state.agencySub === s.id;
          return '<button class="proto-subnav-link' + (active ? " is-active" : "") + '" data-agencysub="' + s.id + '">' + s.label + '</button>';
        }).join("") + '</div>' : "";
        return '<button class="proto-nav-item' + (onAgencies ? " is-active" : "") + '" data-nav="agencies">' +
            ico(n.icon) + '<span class="proto-nav-label">' + n.label + '</span>' +
            '<span class="proto-nav-chev proto-ico" data-icon="' + (onAgencies ? "ChevronUp" : "ChevronDown") + '"></span>' +
          '</button>' + sub;
      }
      return '<button class="proto-nav-item" data-nav="' + n.id + '">' +
        ico(n.icon) + '<span class="proto-nav-label">' + n.label + '</span>' +
        (n.expandable ? '<span class="proto-nav-chev proto-ico" data-icon="ChevronDown"></span>' : "") +
      '</button>';
    }).join("");

    return '<aside class="proto-sidebar" aria-label="Primary navigation">' +
      chrome.searchBox() +
      '<nav class="proto-nav">' + items + '</nav>' +
      chrome.collapseBtn() +
    '</aside>';
  };

  // ---------- Settings sub-nav sidebar ----------
  chrome.settingsSidebar = function () {
    var state = V1.state;
    var groups = V1.SETTINGS_NAV.map(function (g) {
      var items = g.items.map(function (it) {
        var active = it.id === state.settingsItem;
        return '<button class="proto-subnav-item' + (active ? " is-active" : "") + '" data-set="' + it.id + '">' +
          ico(it.icon) + '<span class="proto-nav-label">' + it.label + '</span>' +
          (it.isNew ? '<span class="proto-pill-new">New</span>' : "") +
        '</button>';
      }).join("");
      return '<div class="proto-subnav-group"><div class="proto-subnav-head">' + g.group + '</div>' + items + '</div>';
    }).join("");
    return '<aside class="proto-sidebar" aria-label="Settings navigation">' +
      chrome.searchBox() +
      '<button class="proto-subnav-back" data-act="backtoapp" title="Back to app">' + ico("ArrowLeft") + '<span class="proto-nav-label">Back to app</span></button>' +
      groups +
      chrome.collapseBtn() +
    '</aside>';
  };

  // ---------- Page footer ----------
  chrome.footer = function () {
    return '<footer class="proto-footer">' +
      '<div class="proto-footer-links">' +
        '<a href="#" data-act="user-guides">User Guides</a>' +
        '<a href="#" data-act="api-docs">API Docs</a>' +
        '<a href="Flex Work V1 Changelog.html">Changelog</a>' +
      '</div>' +
      '<div class="proto-footer-brand">powered by ' +
        '<img src="vendor/dfw_logo_horizontal_black.svg" alt="Dayforce Flex Work" /></div>' +
    '</footer>';
  };

  V1.chrome = chrome;
})(window.V1);
