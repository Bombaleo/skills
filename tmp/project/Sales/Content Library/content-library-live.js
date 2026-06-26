/* =====================================================================
   Dayforce Flex Work — Content Library (LIVE) controller
   Reads window.LIBRARY_DATA (library-data.js). Vanilla JS, no deps.
   Search · multi-select filters (stage / format / status) · sort
   (recent, stage, format, status, name) · grid & list views.
   State is held in the URL hash so a filtered view is shareable and
   survives reload.
   ===================================================================== */
(function () {
  "use strict";

  var STAGES = (window.LIBRARY_DATA && window.LIBRARY_DATA.stages) || [];

  /* ---- flatten the catalog, stamping each item with its stage ----- */
  var ITEMS = [];
  STAGES.forEach(function (s) {
    s.items.forEach(function (it) {
      ITEMS.push(Object.assign({}, it, {
        stage: s.n,
        stageEyebrow: s.eyebrow,
        stageTitle: s.title
      }));
    });
  });

  var ICONS = {
    interactive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M4 5h16v11H4z"/><path d="M9 20h6"/><path d="M12 16v4"/></svg>',
    deck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M3 4h18"/><path d="M4 4v9h16V4"/><path d="M12 13v4"/><path d="M9 20l3-3 3 3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M4 6h12v12H4z"/><path d="M16 10l4-2v8l-4-2"/></svg>',
    proof: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18.7l.9-5.4L4.2 9.7l5.4-.8z"/></svg>'
  };
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';
  var FAM_LABEL = { interactive: "Interactive", deck: "Deck", doc: "Document", video: "Video", proof: "Proof" };
  var FAM_ORDER = { interactive: 0, deck: 1, doc: 2, video: 3, proof: 4 };
  var STATUS_LABEL = { ready: "Ready to send", soon: "In production" };

  /* ---- helpers ---------------------------------------------------- */
  function fileSafe(t) { return t.replace(/&/g, "and").replace(/[\/\\:*?"<>|,]/g, "-"); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function hrefOf(it) {
    if (it.external) return it.href;
    return "assets/" + it.slug + "/" + encodeURIComponent(fileSafe(it.title) + ".html");
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function searchText(it) {
    return (it.title + " " + it.desc + " " + it.use + " " + it.format + " " +
            FAM_LABEL[it.fam] + " " + it.stageEyebrow).toLowerCase();
  }

  /* ---- state ------------------------------------------------------ */
  var state = {
    q: "",
    sort: "recent",
    view: "grid",
    stage: new Set(),
    fam: new Set(),
    status: new Set()
  };

  /* ---- elements --------------------------------------------------- */
  var main = document.getElementById("main");
  var empty = document.getElementById("empty");
  var search = document.getElementById("search");
  var searchClear = document.getElementById("searchClear");
  var sortSel = document.getElementById("sort");
  var filters = document.getElementById("filters");
  var clearBtn = document.getElementById("clearFilters");
  var shownCount = document.getElementById("shownCount");
  var shownNoun = document.getElementById("shownNoun");

  /* ---- counters (static) ------------------------------------------ */
  (function counters() {
    var ready = ITEMS.filter(function (i) { return i.status === "ready"; }).length;
    document.getElementById("cTotal").textContent = ITEMS.length;
    document.getElementById("cReady").textContent = ready;
    document.getElementById("cSoon").textContent = ITEMS.length - ready;
    document.getElementById("cStages").textContent = STAGES.length;
  })();

  /* ---- filtering + sorting ---------------------------------------- */
  function passes(it) {
    if (state.q && searchText(it).indexOf(state.q) === -1) return false;
    if (state.stage.size && !state.stage.has(String(it.stage))) return false;
    if (state.fam.size && !state.fam.has(it.fam)) return false;
    if (state.status.size && !state.status.has(it.status)) return false;
    return true;
  }

  function sortItems(list) {
    var arr = list.slice();
    switch (state.sort) {
      case "name":
        arr.sort(function (a, b) { return a.title.localeCompare(b.title); });
        break;
      case "format":
        arr.sort(function (a, b) {
          return (FAM_ORDER[a.fam] - FAM_ORDER[b.fam]) || a.title.localeCompare(b.title);
        });
        break;
      case "status":
        // ready first, then by recency
        arr.sort(function (a, b) {
          var r = (a.status === "ready" ? 0 : 1) - (b.status === "ready" ? 0 : 1);
          return r || (b.updated || "").localeCompare(a.updated || "");
        });
        break;
      case "stage":
        arr.sort(function (a, b) {
          return (a.stage - b.stage) ||
            (a.status === "ready" ? 0 : 1) - (b.status === "ready" ? 0 : 1) ||
            a.title.localeCompare(b.title);
        });
        break;
      case "recent":
      default:
        arr.sort(function (a, b) {
          return (b.updated || "").localeCompare(a.updated || "") || a.title.localeCompare(b.title);
        });
        break;
    }
    return arr;
  }

  /* ---- card markup ------------------------------------------------ */
  function cardHtml(it) {
    var external = it.external ? ' target="_blank" rel="noopener"' : "";
    var openLabel = it.status === "ready" ? "Open" : "Preview";
    return '' +
      '<a class="clib-card" href="' + hrefOf(it) + '"' + external +
        ' data-id="' + it.id + '">' +
        '<div class="clib-card-top">' +
          '<span class="clib-format" data-fam="' + it.fam + '">' + ICONS[it.fam] + FAM_LABEL[it.fam] + '</span>' +
          '<span class="clib-status" data-status="' + it.status + '"><span class="dot"></span>' + STATUS_LABEL[it.status] + '</span>' +
        '</div>' +
        '<div class="clib-card-body">' +
          '<p class="clib-card-stage">' + esc(it.stageEyebrow) + '</p>' +
          '<h3>' + esc(it.title) + '</h3>' +
          '<p class="clib-card-desc">' + esc(it.desc) + '</p>' +
          '<div class="clib-card-use"><b>Use it for</b>' + esc(it.use) + '</div>' +
        '</div>' +
        '<div class="clib-card-foot">' +
          '<div class="clib-card-meta">' +
            '<span class="clib-card-format">' + esc(it.format) + '</span>' +
            '<span class="clib-card-updated">Updated ' + fmtDate(it.updated) + '</span>' +
          '</div>' +
          '<span class="clib-open">' + openLabel + ' ' + ARROW + '</span>' +
        '</div>' +
      '</a>';
  }

  function groupHeadHtml(stage) {
    var s = STAGES.filter(function (x) { return x.n === stage; })[0];
    return '' +
      '<div class="clib-group-head">' +
        '<div class="clib-group-num">' + stage + '</div>' +
        '<div>' +
          '<p class="clib-group-eyebrow">' + esc(s ? s.eyebrow : ("Stage " + stage)) + '</p>' +
          '<h2 class="clib-group-title">' + esc(s ? s.title : "") + '</h2>' +
        '</div>' +
      '</div>';
  }

  /* ---- render ----------------------------------------------------- */
  function render() {
    var matched = sortItems(ITEMS.filter(passes));
    main.innerHTML = "";

    if (!matched.length) {
      empty.hidden = false;
      shownCount.textContent = "0";
      shownNoun.textContent = "assets";
      return;
    }
    empty.hidden = true;

    var listClass = state.view === "list" ? " is-list" : "";

    if (state.sort === "stage") {
      // grouped: one section per stage that has visible items
      var byStage = {};
      matched.forEach(function (it) { (byStage[it.stage] = byStage[it.stage] || []).push(it); });
      Object.keys(byStage).sort(function (a, b) { return a - b; }).forEach(function (st) {
        main.insertAdjacentHTML("beforeend", groupHeadHtml(Number(st)));
        var grid = document.createElement("div");
        grid.className = "clib-grid" + listClass;
        grid.innerHTML = byStage[st].map(cardHtml).join("");
        main.appendChild(grid);
      });
    } else {
      var grid = document.createElement("div");
      grid.className = "clib-grid" + listClass;
      grid.innerHTML = matched.map(cardHtml).join("");
      main.appendChild(grid);
    }

    shownCount.textContent = String(matched.length);
    shownNoun.textContent = matched.length === 1 ? "asset" : "assets";
  }

  /* ---- URL hash sync (shareable views) ---------------------------- */
  function writeHash() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.sort !== "recent") p.set("sort", state.sort);
    if (state.view !== "grid") p.set("view", state.view);
    if (state.stage.size) p.set("stage", Array.from(state.stage).join(","));
    if (state.fam.size) p.set("fam", Array.from(state.fam).join(","));
    if (state.status.size) p.set("status", Array.from(state.status).join(","));
    var str = p.toString();
    history.replaceState(null, "", str ? "#" + str : location.pathname + location.search);
  }

  function readHash() {
    var p = new URLSearchParams((location.hash || "").replace(/^#/, ""));
    state.q = (p.get("q") || "").toLowerCase();
    state.sort = p.get("sort") || "recent";
    state.view = p.get("view") === "list" ? "list" : "grid";
    function toSet(v) { return new Set((v ? v.split(",") : []).filter(Boolean)); }
    state.stage = toSet(p.get("stage"));
    state.fam = toSet(p.get("fam"));
    state.status = toSet(p.get("status"));
  }

  /* ---- chrome sync ------------------------------------------------ */
  function syncChrome() {
    search.value = state.q;
    searchClear.hidden = !state.q;
    sortSel.value = state.sort;

    document.getElementById("viewGrid").classList.toggle("is-active", state.view === "grid");
    document.getElementById("viewGrid").setAttribute("aria-pressed", state.view === "grid");
    document.getElementById("viewList").classList.toggle("is-active", state.view === "list");
    document.getElementById("viewList").setAttribute("aria-pressed", state.view === "list");

    filters.querySelectorAll(".clib-chip").forEach(function (chip) {
      var on = false;
      if (chip.dataset.stage) on = state.stage.has(chip.dataset.stage);
      else if (chip.dataset.fam) on = state.fam.has(chip.dataset.fam);
      else if (chip.dataset.status) on = state.status.has(chip.dataset.status);
      chip.classList.toggle("is-active", on);
    });

    clearBtn.hidden = !(state.stage.size || state.fam.size || state.status.size);
  }

  function update() {
    syncChrome();
    writeHash();
    render();
  }

  /* ---- events ----------------------------------------------------- */
  search.addEventListener("input", function () {
    state.q = this.value.trim().toLowerCase();
    update();
  });
  searchClear.addEventListener("click", function () {
    state.q = ""; search.value = ""; update(); search.focus();
  });
  sortSel.addEventListener("change", function () { state.sort = this.value; update(); });

  document.getElementById("viewGrid").addEventListener("click", function () { state.view = "grid"; update(); });
  document.getElementById("viewList").addEventListener("click", function () { state.view = "list"; update(); });

  filters.addEventListener("click", function (e) {
    var chip = e.target.closest(".clib-chip");
    if (!chip) return;
    var set, key;
    if (chip.dataset.stage) { set = state.stage; key = chip.dataset.stage; }
    else if (chip.dataset.fam) { set = state.fam; key = chip.dataset.fam; }
    else if (chip.dataset.status) { set = state.status; key = chip.dataset.status; }
    if (!set) return;
    if (set.has(key)) set.delete(key); else set.add(key);
    update();
  });

  clearBtn.addEventListener("click", function () {
    state.stage.clear(); state.fam.clear(); state.status.clear();
    update();
  });
  document.getElementById("resetAll").addEventListener("click", function () {
    state.q = ""; state.stage.clear(); state.fam.clear(); state.status.clear();
    update();
  });

  /* ---- boot ------------------------------------------------------- */
  readHash();
  update();
})();
