/* =====================================================================
   Dayforce Flex Work — Sales Content Library dashboard
   Reads window.LIBRARY_DATA (library-data.js). Vanilla JS, no deps.
   Sales-facing: browse, search and open every asset by buyer stage.
   ===================================================================== */
(function () {
  "use strict";

  var DATA = (window.LIBRARY_DATA && window.LIBRARY_DATA.stages) || [];

  var ICONS = {
    interactive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M4 5h16v11H4z"/><path d="M9 20h6"/><path d="M12 16v4"/></svg>',
    deck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M3 4h18"/><path d="M4 4v9h16V4"/><path d="M12 13v4"/><path d="M9 20l3-3 3 3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M4 6h12v12H4z"/><path d="M16 10l4-2v8l-4-2"/></svg>',
    proof: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18.7l.9-5.4L4.2 9.7l5.4-.8z"/></svg>'
  };
  var FORMAT_LABEL = { interactive: "Interactive", deck: "Deck", doc: "Document", video: "Video", proof: "Proof" };
  var STATUS_LABEL = { ready: "Ready to send", soon: "Coming soon" };

  function fileSafe(t) { return t.replace(/&/g, "and").replace(/[\/\\:*?"<>|,]/g, "-"); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function hrefOf(item) {
    if (item.external) return item.href;
    return "assets/" + item.slug + "/" + encodeURIComponent(fileSafe(item.title) + ".html");
  }

  /* ---- render ------------------------------------------------------ */
  var stagesEl = document.getElementById("stages");

  function cardHtml(item) {
    var external = item.external ? ' target="_blank" rel="noopener"' : "";
    return '' +
      '<a class="lib-card" href="' + hrefOf(item) + '"' + external +
        ' data-status="' + item.status + '" data-fam="' + item.fam + '"' +
        ' data-search="' + esc((item.title + " " + item.desc + " " + item.use + " " + item.format).toLowerCase()) + '">' +
        '<div class="lib-card-top">' +
          '<span class="lib-format" data-fam="' + item.fam + '">' + ICONS[item.fam] + FORMAT_LABEL[item.fam] + '</span>' +
          '<span class="lib-status" data-status="' + item.status + '"><span class="lib-status-dot"></span>' + STATUS_LABEL[item.status] + '</span>' +
        '</div>' +
        '<h4>' + esc(item.title) + '</h4>' +
        '<p class="lib-card-desc">' + esc(item.desc) + '</p>' +
        '<div class="lib-card-use"><span class="lib-card-use-l">Use it for</span>' + esc(item.use) + '</div>' +
        '<div class="lib-card-foot">' +
          '<span class="lib-card-format">' + esc(item.format) + '</span>' +
          '<span class="lib-open">' + (item.status === "ready" ? "Open asset" : "Preview") +
            ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></span>' +
        '</div>' +
      '</a>';
  }

  function stageHtml(stage) {
    var cards = stage.items.map(cardHtml).join("");
    return '' +
      '<section class="lib-stage" data-stage="' + stage.n + '">' +
        '<div class="lib-stage-rail"><div class="lib-stage-num">' + stage.n + '</div></div>' +
        '<div class="lib-stage-head">' +
          '<p class="lib-stage-eyebrow">' + esc(stage.eyebrow) + '</p>' +
          '<h3>' + esc(stage.title) + '</h3>' +
          '<div class="lib-stage-meta">' +
            '<div><p class="lib-stage-meta-l">Buyer mindset</p><p class="lib-stage-meta-v">' + esc(stage.mindset) + '</p></div>' +
            '<div><p class="lib-stage-meta-l">What sales needs to do</p><p class="lib-stage-meta-v"><b>' + esc(stage.goal) + '</b></p></div>' +
          '</div>' +
        '</div>' +
        '<div class="lib-grid">' + cards + '</div>' +
        '<p class="lib-stage-empty" hidden>No assets match here.</p>' +
      '</section>';
  }

  stagesEl.innerHTML = DATA.map(stageHtml).join("");

  /* ---- stats ------------------------------------------------------- */
  function allItems() {
    var out = [];
    DATA.forEach(function (s) { s.items.forEach(function (i) { out.push(i); }); });
    return out;
  }
  (function stats() {
    var items = allItems(), ready = 0;
    items.forEach(function (i) { if (i.status === "ready") ready++; });
    document.getElementById("statTotal").textContent = items.length;
    document.getElementById("statReady").textContent = ready;
    document.getElementById("statSoon").textContent = items.length - ready;
    document.getElementById("statStages").textContent = DATA.length;
  })();

  /* ---- filtering + search ----------------------------------------- */
  var statusFilter = "all";
  var query = "";

  function apply() {
    var shown = 0;
    stagesEl.querySelectorAll(".lib-stage").forEach(function (sec) {
      var visibleInStage = 0;
      sec.querySelectorAll(".lib-card").forEach(function (c) {
        var okStatus = statusFilter === "all" || c.getAttribute("data-status") === statusFilter;
        var okQuery = !query || c.getAttribute("data-search").indexOf(query) !== -1;
        var match = okStatus && okQuery;
        c.classList.toggle("is-hidden", !match);
        if (match) { shown++; visibleInStage++; }
      });
      sec.style.display = visibleInStage ? "" : "none";
    });
    document.getElementById("visibleCount").textContent = shown;
    document.getElementById("noResults").hidden = shown !== 0;
  }

  document.getElementById("filters").addEventListener("click", function (e) {
    var btn = e.target.closest(".lib-chip");
    if (!btn) return;
    statusFilter = btn.getAttribute("data-filter");
    this.querySelectorAll(".lib-chip").forEach(function (c) { c.classList.remove("is-active"); });
    btn.classList.add("is-active");
    apply();
  });

  var searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", function () {
    query = this.value.trim().toLowerCase();
    document.getElementById("searchClear").hidden = !query;
    apply();
  });
  document.getElementById("searchClear").addEventListener("click", function () {
    searchInput.value = ""; query = ""; this.hidden = true; apply(); searchInput.focus();
  });

  apply();
})();
