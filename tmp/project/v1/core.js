// =====================================================================
//  FLEX WORK V1 · core  (IA version: V1)
//  ---------------------------------------------------------------------
//  The shared V1 namespace. Loaded FIRST (before chrome / pages / app).
//  Defines window.V1 with the icon inliner, toast, formatting helpers,
//  common UI fragments (crumb / field / stat), the V1 navigation models
//  and the page registry that app.js routes against.
//
//  Mirrors the v2 app's split (icons.jsx + shared utilities load before
//  the page modules and app.jsx), but in vanilla JS — no React, no Babel.
//  Everything is namespaced under window.V1 so the modules can share it
//  without globals leaking. Scoped under .proto-app in CSS.
// =====================================================================
window.V1 = window.V1 || {};
(function (V1) {
  "use strict";

  // ============================================================
  //  Icon set — FontAwesome 7 Free (Solid), the V1 product icon
  //  language. Each semantic name maps to a FA glyph codepoint; we
  //  render the literal character inside an <i class="proto-fa"> set
  //  to the FA Solid webfont. Literal glyph text (not the FA `--fa`
  //  custom-property trick) renders reliably everywhere, including
  //  html-to-image captures. Codepoints from FA Free 7.2.0.
  // ============================================================
  V1.FA = {
    Check: "\uf00c", Bell: "\uf0f3", X: "\uf00d",
    ChevronDown: "\uf078", ChevronUp: "\uf077", ChevronLeft: "\uf053", ChevronRight: "\uf054",
    ArrowLeft: "\uf060", ArrowRight: "\uf061", Search: "\uf002",
    // primary nav
    BarChart: "\ue0e3", PersonLines: "\uf2bb", Briefcase: "\uf0b1", Employees: "\uf0c0",
    ClipboardCircleCheck: "\uf328", StreetView: "\uf21d", Calendar: "\uf274", Settings: "\uf013",
    // settings sub-nav
    ShieldPerson: "\uf505", Person: "\uf007", Cancel: "\uf05e", Pay: "\uf0d6",
    Globe: "\uf0ac", Grid: "\uf00a", Row: "\uf00b", ClipboardPerson: "\uf7f3",
    OrgChartVert: "\uf0e8", MoneyBag: "\uf81d", Adjustment: "\uf1de", Bolt: "\uf0e7",
    CreditCard: "\uf09d", Users: "\uf0c0", Building: "\uf1ad", Phone: "\uf095",
    Bag: "\uf290", Notes: "\uf249", Broadcast: "\uf0a1",
    // agency detail + pricing
    Edit: "\uf304", Copy: "\uf0c5", Save: "\uf0c7", Export: "\uf56e", Information: "\uf05a",
    Inbox: "\uf01c", Menu: "\uf58e",
    FileDownload: "\uf56d", Excel: "\uf1c3", FileUpload: "\uf574",
    Location: "\uf3c5", Tag: "\uf02b", License: "\uf56c", Wallet: "\uf555",
    Calculate: "\uf1ec", Scale: "\ue098",
    Plus: "\uf067", Trash: "\uf1f8", Warning: "\uf071",
  };
  // Replace every [data-icon] span with its FA glyph. Synchronous — no
  // fetch — so icons appear on first paint and survive captures.
  V1.fillIcons = function (root) {
    var nodes = (root || document).querySelectorAll(".proto-ico[data-icon]:not([data-filled])");
    nodes.forEach(function (el) {
      var name = el.getAttribute("data-icon");
      el.setAttribute("data-filled", "1");
      el.innerHTML = '<i class="proto-fa">' + (V1.FA[name] || "") + "</i>";
    });
  };
  V1.ico = function (name, cls) {
    return '<span class="proto-ico ' + (cls || "") + '" data-icon="' + name + '" aria-hidden="true"></span>';
  };

  // ============================================================
  //  Toast
  // ============================================================
  V1.toast = function (msg) {
    var wrap = document.getElementById("toasts");
    if (!wrap) return;
    var t = document.createElement("div");
    t.className = "proto-toast";
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity 200ms"; }, 2400);
    setTimeout(function () { t.remove(); }, 2700);
  };

  // ============================================================
  //  Formatting / escaping
  // ============================================================
  V1.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  V1.fmtSize = function (b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  };
  // GBP — the V1 rate cards are UK logistics (HGV, Warrington…).
  V1.gbp = function (n) { return "\u00a3" + n.toFixed(2); };

  // ============================================================
  //  Shared UI fragments
  // ============================================================
  // WorkWhile-style monogram (double tick in a ring) — inline SVG.
  V1.WW_LOGO = '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<circle cx="32" cy="32" r="29" stroke="#161F5A" stroke-width="4"/>'
    + '<path d="M16 26 L26 44 L34 30 M30 30 L38 44 L48 26" stroke="#161F5A" stroke-width="4.5" '
    + 'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

  var HOME_SVG = '<span class="proto-ico" aria-hidden="true" style="color:var(--grayscale-1)">'
    + '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M4 10.5 L12 4 L20 10.5 V20 H14 V14 H10 V20 H4 Z" fill="currentColor"/></svg></span>';

  V1.crumb = function (parts) {
    var html = '<div class="proto-crumbs">' + HOME_SVG;
    parts.forEach(function (p, i) {
      if (i > 0) html += '<span class="proto-crumb-sep proto-ico" data-icon="ChevronRight"></span>';
      var cls = "proto-crumb" + (i === parts.length - 1 ? " is-current" : "");
      html += '<button class="' + cls + '"' + (p.act ? ' data-act="' + p.act + '"' : "") + '>' + p.label + '</button>';
    });
    return html + '</div>';
  };

  V1.field = function (k, v) {
    return '<div class="proto-field"><div class="k">' + k + '</div><div class="vv">' + v + '</div></div>';
  };
  V1.stat = function (v, l) {
    return '<div class="proto-stat"><span class="v">' + v + '</span><span class="l">' + l + '</span></div>';
  };

  // ============================================================
  //  Navigation models (V1 IA)
  // ============================================================
  V1.MAIN_NAV = [
    { id: "dashboards", label: "Dashboards", icon: "BarChart" },
    { id: "leads",      label: "Leads",      icon: "PersonLines" },
    { id: "clients",    label: "Clients",    icon: "Briefcase", expandable: true },
    { id: "workforce",  label: "Workforce",  icon: "Employees", expandable: true },
    { id: "jobs",       label: "Jobs",       icon: "ClipboardCircleCheck", expandable: true },
    { id: "agencies",   label: "Agencies",   icon: "StreetView", expandable: true },
    { id: "timesheets", label: "Timesheets", icon: "Calendar" },
    { id: "settings",   label: "Settings",   icon: "Settings" },
  ];

  V1.SETTINGS_NAV = [
    { group: "Policies", items: [
      { id: "accreditations", label: "Accreditations", icon: "ShieldPerson" },
      { id: "attire",         label: "Attire",         icon: "Person" },
      { id: "cancellation",   label: "Cancellation Policy", icon: "Cancel" },
      { id: "holidaypricing", label: "Holiday Pricing", icon: "Pay" },
    ]},
    { group: "Configuration", items: [
      { id: "markets",     label: "Markets",     icon: "Globe" },
      { id: "sectors",     label: "Sectors",     icon: "Grid" },
      { id: "districts",   label: "Districts",   icon: "Row" },
      { id: "positions",   label: "Positions",   icon: "ClipboardPerson" },
      { id: "organization",label: "Organization",icon: "OrgChartVert" },
      { id: "payroll",     label: "Payroll",     icon: "MoneyBag" },
      { id: "algorithm",   label: "Algorithm",   icon: "Adjustment" },
      { id: "automation",  label: "Automation Config", icon: "Bolt" },
      // Feature-added Configuration surface for Rate Automation.
      { id: "pricing",     label: "Pricing",     icon: "CreditCard", isNew: true },
      { id: "rate-engine", label: "Rate Engine",  icon: "Scale" },
    ]},
    { group: "Users", items: [
      { id: "users",      label: "Users",      icon: "Users" },
      { id: "demousers",  label: "Demo Users", icon: "Person" },
    ]},
    { group: "Other", items: [
      { id: "enterpriseorgs", label: "Enterprise Organizations", icon: "Building" },
      { id: "dfappoptions",   label: "Dayforce Flex Work App Options", icon: "Phone" },
      { id: "idealappoptions",label: "Ideal Flex Work App Options",    icon: "Phone" },
      { id: "promocodes",     label: "Promo Codes", icon: "Bag" },
      { id: "guides",         label: "Guides",      icon: "Notes" },
      { id: "referrals",      label: "Referrals",   icon: "Broadcast" },
    ]},
  ];

  // Agencies sub-nav (shown when the Agencies item is expanded). Only
  // "active" is wired in this build; the rest are inert.
  V1.AGENCY_SUBNAV = [
    { id: "invite",      label: "Invite" },
    { id: "active",      label: "Active" },
    { id: "deactivated", label: "Deactivated" },
    { id: "invoices",    label: "Invoices" },
  ];

  // ============================================================
  //  Roles — the "viewing as" set. Begin with Admin only; add more
  //  here and the top-bar account menu grows automatically.
  // ============================================================
  V1.ROLES = [
    { id: "admin", label: "Admin" },
  ];
  // The signed-in user (display only for now).
  V1.USER = { name: "Elijah", fullName: "Elijah Bilokur", email: "elijah.bilokur@dayforce.com", initials: "EL" };

  // ============================================================
  //  Page registry — each page module registers itself here as
  //  { render: () => htmlString, wire: (root) => void }. app.js
  //  routes against it. Mirrors v2's window.* page components.
  // ============================================================
  V1.pages = {};
})(window.V1);
