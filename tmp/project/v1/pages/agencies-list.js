// =====================================================================
//  FLEX WORK V1 · pages/agencies-list  (IA version: V1)
//  ---------------------------------------------------------------------
//  Agencies → Active: the "Active Agencies List". A legacy-styled card
//  (header + icon, Date Sent / Date Activated sort pills) wrapping a
//  table — drag handle + priority, agency name, contact, copyable email,
//  invite-sent and date-activated columns, with zebra striping. Clicking
//  a row opens the agency detail (WorkWhile).
//
//  Bespoke legacy components (NOT Everest): see styles-agencies-list.css.
//  Registers window.V1.pages.agenciesList = { render, wire }.
// =====================================================================
(function (V1) {
  "use strict";
  var ico = V1.ico, esc = V1.escapeHtml;

  // Active staffing-agency partners.
  var AGENCIES = [
    { pr: "1st", name: "WorkWhile",            contact: "Jordan Avery",      email: "partnerships@workwhile.com",        sent: "01/09/2026", act: "01/12/2026" },
    { pr: "2nd", name: "Adecco Staffing",      contact: "Megan Fitzgerald",  email: "megan.fitzgerald@adeccona.com",     sent: "01/14/2026", act: "01/16/2026" },
    { pr: "3rd", name: "Randstad US",          contact: "Daniel Okafor",     email: "daniel.okafor@randstadusa.com",     sent: "02/02/2026", act: "02/05/2026" },
    { pr: "4th", name: "ManpowerGroup",        contact: "Priya Nair",        email: "priya.nair@manpowergroup.com",      sent: "02/10/2026", act: "02/12/2026" },
    { pr: "5th", name: "Kelly Services",       contact: "Robert Schaefer",   email: "robert.schaefer@kellyservices.com", sent: "02/20/2026", act: "02/24/2026" },
    { pr: "N/A", name: "Aerotek",              contact: "Lauren Castillo",   email: "lcastillo@aerotek.com",             sent: "03/03/2026", act: "03/05/2026" },
    { pr: "N/A", name: "PeopleReady",          contact: "Marcus Bell",       email: "marcus.bell@peopleready.com",       sent: "03/09/2026", act: "03/11/2026" },
    { pr: "N/A", name: "Express Employment",   contact: "Sandra Whitfield",  email: "sandra.whitfield@expresspros.com",  sent: "03/16/2026", act: "03/18/2026" },
    { pr: "N/A", name: "Insight Global",       contact: "Tyler Mahoney",     email: "tyler.mahoney@insightglobal.com",   sent: "03/24/2026", act: "03/27/2026" },
    { pr: "N/A", name: "Robert Half",          contact: "Elena Vargas",      email: "elena.vargas@roberthalf.com",       sent: "04/01/2026", act: "04/03/2026" },
    { pr: "N/A", name: "Allegis Group",        contact: "Christopher Doyle", email: "cdoyle@allegisgroup.com",           sent: "04/06/2026", act: "04/09/2026" },
    { pr: "N/A", name: "Hays Recruitment",     contact: "Olivia Pearson",    email: "olivia.pearson@hays.com",           sent: "04/13/2026", act: "04/15/2026" },
    { pr: "N/A", name: "Spherion Staffing",    contact: "Andre Coleman",     email: "andre.coleman@spherion.com",        sent: "04/20/2026", act: "04/22/2026" },
    { pr: "N/A", name: "Integrity Staffing",   contact: "Hannah Brooks",     email: "hannah.brooks@integritystaffing.com", sent: "04/27/2026", act: "04/29/2026" },
    { pr: "N/A", name: "Staffmark",            contact: "Victor Ramos",      email: "victor.ramos@staffmark.com",        sent: "05/04/2026", act: "05/06/2026" },
    { pr: "N/A", name: "TrueBlue",             contact: "Natalie Wong",      email: "natalie.wong@trueblue.com",         sent: "05/11/2026", act: "05/13/2026" },
    { pr: "N/A", name: "Tradesmen International", contact: "Gregory Sullivan", email: "gsullivan@tradesmen.com",         sent: "05/18/2026", act: "05/20/2026" },
    { pr: "N/A", name: "Instawork",            contact: "Sofia Mendes",      email: "sofia.mendes@instawork.com",        sent: "05/22/2026", act: "N/A" },
    { pr: "N/A", name: "Bluecrew",             contact: "Derek Lindqvist",   email: "derek.lindqvist@bluecrewjobs.com",  sent: "05/26/2026", act: "N/A" },
    { pr: "N/A", name: "Wonolo",               contact: "Aisha Karim",       email: "aisha.karim@wonolo.com",            sent: "05/29/2026", act: "N/A" },
    { pr: "N/A", name: "Employbridge",         contact: "Patrick Donnelly",  email: "patrick.donnelly@employbridge.com", sent: "06/01/2026", act: "N/A" },
  ];

  // MM/DD/YYYY → sortable number; "N/A" sorts last.
  function dateVal(s) {
    if (!s || s === "N/A") return -1;
    var p = s.split("/");
    if (p.length !== 3) return -1;
    return parseInt(p[2], 10) * 10000 + parseInt(p[0], 10) * 100 + parseInt(p[1], 10);
  }

  function sortedRows() {
    var rows = AGENCIES.slice();
    var s = V1.state.agencySort;
    if (!s) return rows;
    var key = s.key === "activated" ? "act" : "sent";
    rows.sort(function (a, b) {
      var d = dateVal(a[key]) - dateVal(b[key]);
      return s.dir === "asc" ? d : -d;
    });
    return rows;
  }

  // Inbox icon already in the Everest set; dark-tinted in the header.
  function render() {
    var state = V1.state;
    var s = state.agencySort;

    var pill = function (key, label) {
      var on = s && s.key === key;
      var arrow = on ? (s.dir === "asc" ? " \u2191" : " \u2193") : "";
      return '<button class="agl-pill' + (on ? " is-on" : "") + '" data-agencysort="' + key + '">' + label + arrow + '</button>';
    };

    var rows = sortedRows().map(function (r) {
      var actCls = r.act === "N/A" ? " is-na" : "";
      return '<tr class="agl-row" data-agency-row="' + esc(r.name) + '">' +
        '<td class="agl-c-priority"><span class="agl-handle" aria-hidden="true">' + ico("Menu") + '</span><span class="agl-priority">' + esc(r.pr) + '</span></td>' +
        '<td class="agl-c-name">' + esc(r.name) + '</td>' +
        '<td class="agl-c-contact">' + esc(r.contact) + '</td>' +
        '<td class="agl-c-email"><span class="agl-email">' + esc(r.email) + '</span>' +
          '<button class="agl-copy" data-copy-email="' + esc(r.email) + '" aria-label="Copy email">' + ico("Copy") + '</button></td>' +
        '<td class="agl-c-sent">' + esc(r.sent) + '</td>' +
        '<td class="agl-c-act' + actCls + '">' + esc(r.act) + '</td>' +
      '</tr>';
    }).join("");

    return V1.crumb([
      { label: "Agencies", act: "noop" },
      { label: "Active Agencies" },
    ]) +
    '<div class="agl-card">' +
      '<div class="agl-head">' +
        '<span class="agl-head-ico">' + ico("Inbox") + '</span>' +
        '<h1 class="agl-title">Active Agencies List</h1>' +
      '</div>' +
      '<div class="agl-filters">' +
        pill("sent", "Date Sent") +
        pill("activated", "Date Activated") +
      '</div>' +
      '<div class="agl-table-wrap">' +
        '<table class="agl-table">' +
          '<thead><tr>' +
            '<th class="agl-c-priority">Priority</th>' +
            '<th class="agl-c-name">Agency Name</th>' +
            '<th class="agl-c-contact">Contact</th>' +
            '<th class="agl-c-email">Email</th>' +
            '<th class="agl-c-sent">Invite Sent</th>' +
            '<th class="agl-c-act">Date Activated</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  function wire(app) {
    // sort pills — click toggles desc → asc → off
    app.querySelectorAll("[data-agencysort]").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.getAttribute("data-agencysort");
        var s = V1.state.agencySort;
        if (!s || s.key !== key) V1.state.agencySort = { key: key, dir: "desc" };
        else if (s.dir === "desc") V1.state.agencySort = { key: key, dir: "asc" };
        else V1.state.agencySort = null;
        V1.render();
      });
    });

    // copy email (don't trigger the row navigation)
    app.querySelectorAll("[data-copy-email]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var email = b.getAttribute("data-copy-email");
        try { navigator.clipboard.writeText(email); } catch (er) {}
        V1.toast("Email copied");
      });
    });

    // row → agency detail (WorkWhile)
    app.querySelectorAll("[data-agency-row]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        V1.state.agencyTab = "detail";
        V1.render();
      });
    });
  }

  V1.pages.agenciesList = { id: "agencies-list", render: render, wire: wire };
})(window.V1);
