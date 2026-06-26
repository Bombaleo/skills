/* =====================================================================
   Flex Work API Reference · hash-routed renderer
   ---------------------------------------------------------------------
   URL format:
     <no hash> / #/                       → home (overview + tag grid)
     #/get-started/auth                   → authentication overview
     #/get-started/errors                 → errors & retries
     #/get-started/pagination             → pagination
     #/{tagId}                            → tag landing (endpoint grid)
     #/{tagId}/{endpointId}               → single endpoint page
     #{endpointId}  (legacy)              → single endpoint page
   ===================================================================== */

(function () {
  "use strict";

  /* ---------- tiny dom helpers ------------------------------------- */
  function el(tag, props, ...children) {
    var n = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === "class") n.className = props[k];
        else if (k === "html") n.innerHTML = props[k];
        else if (k === "on") {
          for (var ev in props.on) n.addEventListener(ev, props.on[ev]);
        } else if (k in n) {
          try { n[k] = props[k]; } catch (e) { n.setAttribute(k, props[k]); }
        } else {
          n.setAttribute(k, props[k]);
        }
      }
    }
    children.flat(Infinity).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function escHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- JSON pretty-print w/ syntax highlighting ------------- */
  function highlightJSON(obj) {
    var s = JSON.stringify(obj, null, 2);
    if (s == null) return "";
    return s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="tk-key">$1</span>$2')
      .replace(/: ("(?:[^"\\]|\\.)*")/g, ': <span class="tk-string">$1</span>')
      .replace(/(\[|, )("(?:[^"\\]|\\.)*")/g, '$1<span class="tk-string">$2</span>')
      .replace(/: (-?\d+(?:\.\d+)?)/g, ': <span class="tk-number">$1</span>')
      .replace(/(\[|, )(-?\d+(?:\.\d+)?)/g, '$1<span class="tk-number">$2</span>')
      .replace(/: (true|false|null)/g, ': <span class="tk-bool">$1</span>');
  }

  /* ---------- code-sample generators ------------------------------- */
  var BASE_URLS = {
    Production: "https://api.dayforce.com/flex-work/v1",
    Sandbox:    "https://api.sandbox.dayforce.com/flex-work/v1",
    EU:         "https://api.eu.dayforce.com/flex-work/v1"
  };

  function pathWithExamples(p, params) {
    return p.replace(/\{(\w+)\}/g, function (_, name) {
      var match = (params || []).find(function (x) { return x.name === name; });
      if (match && match.example) return match.example;
      return "01HZX7K2QM4FN0R8VBSE6PA7CY";
    });
  }

  function queryString(params) {
    var qs = (params || []).filter(function (p) { return p.in === "query" && p.example !== undefined; });
    if (!qs.length) return "";
    return "?" + qs.map(function (p) { return p.name + "=" + encodeURIComponent(p.example); }).join("&");
  }

  function genCurl(ep, baseUrl) {
    var url = baseUrl + pathWithExamples(ep.path, ep.params) + queryString(ep.params);
    var lines = [];
    var method = ep.method.toUpperCase();
    lines.push("curl -X " + method + " '" + url + "' \\");
    lines.push("  -H 'Authorization: Bearer $FLEXWORK_TOKEN' \\");
    lines.push("  -H 'X-Flexwork-Org: $FLEXWORK_ORG'" + (ep.body ? " \\" : ""));
    if (ep.body) {
      lines.push("  -H 'Content-Type: application/json' \\");
      var bodyJSON = JSON.stringify(ep.body.example, null, 2)
        .split("\n").map(function (l, i) { return i === 0 ? "  -d '" + l : "      " + l; }).join("\n");
      lines.push(bodyJSON + "'");
    }
    return lines.join("\n");
  }

  function genJS(ep, baseUrl) {
    var url = baseUrl + pathWithExamples(ep.path, ep.params) + queryString(ep.params);
    var body = ep.body
      ? ",\n  body: JSON.stringify(" + JSON.stringify(ep.body.example, null, 2).split("\n").join("\n    ") + ")"
      : "";
    var headers = '"Authorization": `Bearer ${token}`,\n    "X-Flexwork-Org": orgId';
    if (ep.body) headers += ',\n    "Content-Type": "application/json"';
    return (
"const res = await fetch(\n" +
"  \"" + url + "\",\n" +
"  {\n" +
"    method: \"" + ep.method.toUpperCase() + "\",\n" +
"    headers: {\n      " + headers + "\n    }" + body + "\n" +
"  }\n" +
");\n" +
"const data = await res.json();"
    );
  }

  function genPython(ep, baseUrl) {
    var url = baseUrl + pathWithExamples(ep.path, ep.params) + queryString(ep.params);
    var bodyArg = ep.body ? ",\n    json=" + pyDict(ep.body.example, 1) : "";
    return (
"import requests\n\n" +
"res = requests.request(\n" +
"    \"" + ep.method.toUpperCase() + "\",\n" +
"    \"" + url + "\",\n" +
"    headers={\n" +
"        \"Authorization\": f\"Bearer {token}\",\n" +
"        \"X-Flexwork-Org\": org_id,\n" +
(ep.body ? "        \"Content-Type\": \"application/json\",\n" : "") +
"    }" + bodyArg + ",\n" +
")\n" +
"data = res.json()"
    );
  }

  function pyDict(obj, depth) {
    var pad = "    ".repeat(depth);
    var padIn = "    ".repeat(depth + 1);
    if (obj == null) return "None";
    if (typeof obj === "boolean") return obj ? "True" : "False";
    if (typeof obj === "number") return String(obj);
    if (typeof obj === "string") return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      return "[\n" + obj.map(function (v) { return padIn + pyDict(v, depth + 1); }).join(",\n") + "\n" + pad + "]";
    }
    var keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return "{\n" + keys.map(function (k) {
      return padIn + JSON.stringify(k) + ": " + pyDict(obj[k], depth + 1);
    }).join(",\n") + "\n" + pad + "}";
  }

  function genGo(ep, baseUrl) {
    var url = baseUrl + pathWithExamples(ep.path, ep.params) + queryString(ep.params);
    var body = ep.body
      ? "body, _ := json.Marshal(map[string]interface{}{\n" +
        goMapBody(ep.body.example, 1) +
        "})\nreq, _ := http.NewRequest(\"" + ep.method.toUpperCase() + "\", url, bytes.NewReader(body))"
      : "req, _ := http.NewRequest(\"" + ep.method.toUpperCase() + "\", url, nil)";
    var ctype = ep.body ? "req.Header.Set(\"Content-Type\", \"application/json\")\n" : "";
    return (
"url := \"" + url + "\"\n" + body + "\n" +
"req.Header.Set(\"Authorization\", \"Bearer \"+token)\n" +
"req.Header.Set(\"X-Flexwork-Org\", orgID)\n" + ctype +
"res, err := http.DefaultClient.Do(req)"
    );
  }

  function goMapBody(obj, depth) {
    var pad = "    ".repeat(depth);
    if (obj == null) return "";
    var keys = Object.keys(obj);
    return keys.map(function (k) {
      var v = obj[k];
      var vStr;
      if (typeof v === "string") vStr = JSON.stringify(v);
      else if (typeof v === "number" || typeof v === "boolean") vStr = String(v);
      else vStr = JSON.stringify(v);
      return pad + JSON.stringify(k) + ": " + vStr + ",";
    }).join("\n") + "\n";
  }

  function highlightCurl(s) {
    return escHtml(s)
      .replace(/^(curl)/, '<span class="tk-fn">$1</span>')
      .replace(/(-X|-H|-d)\s/g, '<span class="tk-keyword">$1</span> ')
      .replace(/(GET|POST|PUT|PATCH|DELETE)/g, '<span class="tk-method">$1</span>')
      .replace(/(&#39;[^&]*&#39;)/g, function (m) { return '<span class="tk-string">' + m + "</span>"; });
  }
  function highlightJS(s) {
    return escHtml(s)
      .replace(/\b(const|let|await|return|new)\b/g, '<span class="tk-keyword">$1</span>')
      .replace(/(\bfetch|\bJSON\.stringify|\bres\.json)/g, '<span class="tk-fn">$1</span>')
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="tk-string">$1</span>')
      .replace(/(`[^`]*`)/g, '<span class="tk-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tk-number">$1</span>');
  }
  function highlightPython(s) {
    return escHtml(s)
      .replace(/\b(import|from|as|None|True|False)\b/g, '<span class="tk-keyword">$1</span>')
      .replace(/\b(requests\.request|res\.json)\b/g, '<span class="tk-fn">$1</span>')
      .replace(/(f&quot;[^&]*&quot;)/g, '<span class="tk-string">$1</span>')
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="tk-string">$1</span>')
      .replace(/(#[^\n]*)/g, '<span class="tk-comment">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tk-number">$1</span>');
  }
  function highlightGo(s) {
    return escHtml(s)
      .replace(/\b(map|interface|nil|var|func)\b/g, '<span class="tk-keyword">$1</span>')
      .replace(/\b(http\.NewRequest|http\.DefaultClient\.Do|json\.Marshal|bytes\.NewReader|req\.Header\.Set)\b/g, '<span class="tk-fn">$1</span>')
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="tk-string">$1</span>')
      .replace(/(:=|\/\/[^\n]*)/g, function (m) {
        if (m.startsWith("//")) return '<span class="tk-comment">' + m + "</span>";
        return '<span class="tk-keyword">' + m + "</span>";
      })
      .replace(/\b(\d+)\b/g, '<span class="tk-number">$1</span>');
  }

  var HIGHLIGHTERS = { cURL: highlightCurl, JavaScript: highlightJS, Python: highlightPython, Go: highlightGo };
  var GENERATORS  = { cURL: genCurl,        JavaScript: genJS,        Python: genPython,      Go: genGo        };
  var LANGS = ["cURL", "JavaScript", "Python", "Go"];

  /* ---------- state + router --------------------------------------- */
  var state = {
    lang:   localStorage.getItem("fw-api-lang") || "cURL",
    server: localStorage.getItem("fw-api-server") || "Production",
    route:  { kind: "home" }
  };

  function parseHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h || h === "/") return { kind: "home" };
    var parts = h.split("/").filter(Boolean);

    // Legacy single-segment endpoint hash, e.g. #req_list
    if (parts.length === 1 && !h.startsWith("/")) {
      var ep0 = findEndpointById(parts[0]);
      if (ep0) return { kind: "endpoint", tagId: ep0.tag, endpointId: ep0.id };
      if (parts[0] === "intro")        return { kind: "home" };
      if (parts[0] === "auth-overview") return { kind: "info", id: "auth" };
      if (parts[0] === "errors")        return { kind: "info", id: "errors" };
      if (parts[0] === "pagination")    return { kind: "info", id: "pagination" };
    }

    // Hash-routed form: #/...
    if (parts[0] === "get-started" && parts[1]) {
      return { kind: "info", id: parts[1] };
    }
    if (parts.length === 1) {
      // Group landing page?
      var group = findGroupById(parts[0]);
      if (group) return { kind: "group", groupId: group.id };
      // Otherwise tag
      return { kind: "tag", tagId: parts[0] };
    }
    if (parts.length >= 2) {
      var ep = findEndpointById(parts[1]);
      if (ep) return { kind: "endpoint", tagId: ep.tag, endpointId: ep.id };
      return { kind: "tag", tagId: parts[1] };
    }
    return { kind: "home" };
  }

  function navigate(hashPath, opts) {
    opts = opts || {};
    if (location.hash === hashPath) {
      // re-trigger render anyway
      onRoute();
    } else {
      location.hash = hashPath;
    }
    if (!opts.keepScroll) {
      // Scroll the main column to top
      var main = document.querySelector(".api-main");
      if (main) main.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }
  }

  function hrefFor(route) {
    if (route.kind === "home") return "#/";
    if (route.kind === "info") return "#/get-started/" + route.id;
    if (route.kind === "group") return "#/" + route.groupId;
    if (route.kind === "tag")  return "#/" + route.tagId;
    if (route.kind === "endpoint") return "#/" + route.tagId + "/" + route.endpointId;
    return "#/";
  }

  function findEndpointById(id) {
    return (window.FW_API_SPEC.paths || []).find(function (p) { return p.id === id; });
  }
  function endpointsForTag(tagId) {
    var eps = (window.FW_API_SPEC.paths || []).filter(function (p) { return p.tag === tagId; });
    // P1-08 — canonical order: GET collection, GET item, POST, PATCH, PUT,
    // DELETE, then sub-resource action paths (those containing ':').
    return eps.slice().sort(function (a, b) {
      return endpointOrder(a) - endpointOrder(b);
    });
  }
  function endpointOrder(ep) {
    var path   = ep.path || "";
    var method = (ep.method || "").toUpperCase();
    var isAction   = path.indexOf(":") >= 0;
    var hasPathArg = path.indexOf("{") >= 0;
    if (isAction)                          return 60;
    if (method === "GET"    && !hasPathArg) return 10;
    if (method === "GET"    &&  hasPathArg) return 20;
    if (method === "POST")                  return 30;
    if (method === "PATCH")                 return 40;
    if (method === "PUT")                   return 41;
    if (method === "DELETE")                return 50;
    return 90;
  }
  function findTagById(tagId) {
    return (window.FW_API_SPEC.tags || []).find(function (t) { return t.id === tagId; });
  }
  function findGroupById(groupId) {
    return (window.FW_API_SPEC.groups || []).find(function (g) { return g.id === groupId; });
  }
  function groupForTag(tagId) {
    var groups = window.FW_API_SPEC.groups || [];
    for (var i = 0; i < groups.length; i++) {
      if ((groups[i].tags || []).indexOf(tagId) >= 0) return groups[i];
    }
    return null;
  }

  /* ---------- left nav --------------------------------------------- */
  function buildNav() {
    var nav = document.getElementById("api-nav");
    nav.innerHTML = "";

    var spec = window.FW_API_SPEC;
    var groups = spec.groups || [];

    // Render each group as a labelled section
    groups.forEach(function (group) {
      var sec = el("div", { class: "api-nav-section api-nav-group", "data-group-id": group.id });

      // Group header — also a link to the group landing page
      var groupHref = "#/" + group.id;
      var header = el("a", {
        class: "api-nav-group-h",
        href: groupHref,
        "data-route": groupHref
      },
        el("span", { class: "api-nav-group-name" }, group.name)
      );
      sec.appendChild(header);

      // Get-started gets info-page links instead of endpoint tags
      if (group.id === "get-started") {
        var infoList = el("ul", { class: "api-nav-list" });
        [
          { route: { kind: "home" },                                label: "Overview" },
          { route: { kind: "info", id: "auth" },                    label: "Authentication" },
          { route: { kind: "info", id: "errors" },                  label: "Errors & retries" },
          { route: { kind: "info", id: "pagination" },              label: "Pagination" },
          { route: { kind: "info", id: "idempotency" },             label: "Idempotency" },
          { route: { kind: "info", id: "rate-limits" },             label: "Rate limits" },
          { route: { kind: "info", id: "versioning" },              label: "Versioning" },
          { route: { kind: "info", id: "conditional-reads" },       label: "Conditional reads" },
          { route: { kind: "info", id: "sparse-fieldsets" },        label: "Sparse fieldsets" },
          { route: { kind: "info", id: "filter-language" },         label: "Filter language" },
          { route: { kind: "info", id: "residency" },               label: "Region & residency" },
          { route: { kind: "info", id: "deprecation" },             label: "Deprecation contract" },
          { route: { kind: "info", id: "ndjson-streaming" },        label: "NDJSON streaming" }
        ].forEach(function (item) {
          var href = hrefFor(item.route);
          var a = el("a", { href: href, class: "api-nav-link api-nav-link--plain" },
            el("span", { class: "api-nav-label" }, item.label));
          a.dataset.route = href;
          infoList.appendChild(el("li", null, a));
        });
        sec.appendChild(infoList);
      }

      // Render each tag inside this group
      (group.tags || []).forEach(function (tagId) {
        var tag = findTagById(tagId);
        if (!tag) return;
        var eps = endpointsForTag(tag.id);
        if (!eps.length) return;

        var tagHref = hrefFor({ kind: "tag", tagId: tag.id });
        var tagAnchor = el("a", {
          class: "api-nav-tag",
          href: tagHref,
          "aria-expanded": "false"
        },
          el("svg", { class: "chev", viewBox: "0 0 16 16", fill: "none", html: '<path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/>' }),
          el("span", { class: "api-nav-tag-name" }, tag.name),
          el("span", { class: "api-nav-tag-count" }, eps.length + "")
        );
        tagAnchor.dataset.route = tagHref;
        tagAnchor.addEventListener("click", function (e) {
          // Header click toggles expansion. Tag landing pages are still
          // reachable via the home / group page cards.
          e.preventDefault();
          var current = tagAnchor.getAttribute("aria-expanded") === "true";
          tagAnchor.setAttribute("aria-expanded", current ? "false" : "true");
        });
        sec.appendChild(tagAnchor);

        var list = el("ul", { class: "api-nav-list" });
        eps.forEach(function (ep) {
          var href = hrefFor({ kind: "endpoint", tagId: tag.id, endpointId: ep.id });
          var a = el("a", { href: href, class: "api-nav-link" },
            el("span", { class: "method method--" + ep.method.toLowerCase() }, ep.method),
            el("span", { class: "api-nav-label", title: ep.name }, ep.name)
          );
          a.dataset.route = href;
          list.appendChild(el("li", null, a));
        });
        sec.appendChild(list);
      });

      nav.appendChild(sec);
    });
  }

  function setActiveNav() {
    var href = hrefFor(state.route);
    document.querySelectorAll(".api-nav-link.is-active, .api-nav-tag.is-active").forEach(function (a) {
      a.classList.remove("is-active");
    });
    var match = document.querySelector('[data-route="' + href + '"]');
    if (match) match.classList.add("is-active");
    // For endpoint routes, also subtly mark the parent tag.
    if (state.route.kind === "endpoint") {
      var parentTag = document.querySelector('[data-route="' + hrefFor({ kind: "tag", tagId: state.route.tagId }) + '"]');
      if (parentTag) {
        parentTag.classList.add("is-tag-current");
        parentTag.setAttribute("aria-expanded", "true");
        // Scroll the active link into view inside the nav.
        if (match && match.scrollIntoView) {
          var navEl = document.getElementById("api-nav");
          var mr = match.getBoundingClientRect();
          var nr = navEl.getBoundingClientRect();
          if (mr.top < nr.top || mr.bottom > nr.bottom) {
            match.scrollIntoView({ block: "center" });
          }
        }
      }
    } else if (state.route.kind === "tag") {
      // Expand the matching tag when landing on the tag page.
      var tagEl = document.querySelector('[data-route="' + href + '"]');
      if (tagEl && tagEl.classList.contains("api-nav-tag")) {
        tagEl.setAttribute("aria-expanded", "true");
      }
      document.querySelectorAll(".api-nav-tag.is-tag-current").forEach(function (a) { a.classList.remove("is-tag-current"); });
    } else {
      document.querySelectorAll(".api-nav-tag.is-tag-current").forEach(function (a) { a.classList.remove("is-tag-current"); });
    }
  }

  /* ---------- field row -------------------------------------------- */
  function renderField(f) {
    var leftKids = [
      el("div", { class: "api-field-name" }, f.name),
      el("div", { class: "api-field-meta" },
        el("span", { class: "api-field-type" }, f.type || ""),
        f.required
          ? el("span", { class: "api-field-req" }, "Required")
          : el("span", { class: "api-field-opt" }, "Optional"),
        f.in ? el("span", { class: "api-field-opt" }, "in " + f.in) : null
      )
    ];
    var rightKids = [];
    if (f.desc) {
      var p = document.createElement("div");
      p.className = "api-field-desc";
      p.innerHTML = escHtml(f.desc).replace(/`([^`]+)`/g, "<code>$1</code>");
      rightKids.push(p);
    }
    if (f.enum && f.enum.length) {
      var enumKids = f.enum.map(function (v) { return el("code", null, v); });
      rightKids.push(el("div", { class: "api-field-enum" }, enumKids));
    }
    return el("div", { class: "api-field" },
      el("div", { class: "api-field-left" }, leftKids),
      el("div", null, rightKids)
    );
  }

  function formatPathSpan(p) {
    var out = "";
    p.split(/(\{[^}]+\})/g).forEach(function (s) {
      if (/^\{.+\}$/.test(s)) out += '<span class="param">' + escHtml(s) + "</span>";
      else out += escHtml(s);
    });
    var span = document.createElement("span");
    span.innerHTML = out;
    return span;
  }

  /* ---------- center: endpoint detail page ------------------------- */
  function renderEndpointPage(ep) {
    var page = el("article", { class: "api-page-content api-endpoint-page" });
    var tag = findTagById(ep.tag);

    // Breadcrumb (Reference → Group → Tag → Endpoint)
    var group = groupForTag(ep.tag);
    var crumbKids = [
      el("a", { href: hrefFor({ kind: "home" }) }, "Reference"),
      el("span", { class: "api-crumb-sep" }, "/")
    ];
    if (group) {
      crumbKids.push(el("a", { href: hrefFor({ kind: "group", groupId: group.id }) }, group.name));
      crumbKids.push(el("span", { class: "api-crumb-sep" }, "/"));
    }
    crumbKids.push(el("a", { href: hrefFor({ kind: "tag", tagId: ep.tag }) }, tag ? tag.name : ep.tag));
    crumbKids.push(el("span", { class: "api-crumb-sep" }, "/"));
    crumbKids.push(el("span", { class: "api-crumb-current" }, ep.name));
    var crumb = el("nav", { class: "api-crumb", "aria-label": "Breadcrumb" }, crumbKids);
    page.appendChild(crumb);

    // Head: METHOD /path + actions
    var head = el("div", { class: "api-endpoint-head" },
      el("span", { class: "method large method--" + ep.method.toLowerCase() }, ep.method),
      el("code", { class: "api-endpoint-path" }, formatPathSpan(ep.path)),
      el("div", { class: "api-endpoint-actions" },
        copyButton(function () {
          return ep.method + " " + BASE_URLS[state.server] + ep.path;
        }, "Copy method + URL"),
        tryItButton(ep)
      )
    );
    page.appendChild(head);

    page.appendChild(el("h1", { class: "api-endpoint-name" }, ep.name));
    page.appendChild(el("p", { class: "api-endpoint-summary" }, ep.summary || ""));

    // Meta chips — auth, scope, idempotency, rate limit
    page.appendChild(renderMetaChips(ep));

    // Long-form detail paragraph (from spec.ep.detail)
    if (ep.detail) {
      page.appendChild(el("div", { class: "api-detail-block" },
        el("p", null, ep.detail)
      ));
    }

    // Long-form description (synthesized from spec fields)
    var lifecycleBlocks = renderEndpointDetail(ep);
    if (lifecycleBlocks) page.appendChild(lifecycleBlocks);

    // Param groups
    var groups = [["Path parameters", "path"], ["Query parameters", "query"], ["Headers", "header"]];
    groups.forEach(function (g) {
      var hits = (ep.params || []).filter(function (p) { return p.in === g[1]; });
      if (!hits.length) return;
      page.appendChild(el("div", { class: "api-sub-h" }, g[0], el("span", { class: "count" }, hits.length + "")));
      var box = el("div", { class: "api-fields" });
      hits.forEach(function (f) { box.appendChild(renderField(f)); });
      page.appendChild(box);
    });

    // Request body
    if (ep.body && ep.body.schema && ep.body.schema.length) {
      page.appendChild(el("div", { class: "api-sub-h" }, "Request body",
        el("span", { class: "count" }, ep.body.schema.length + " fields")));
      var box1 = el("div", { class: "api-fields" });
      ep.body.schema.forEach(function (f) { box1.appendChild(renderField(f)); });
      page.appendChild(box1);
    } else if (ep.body && ep.body.schemaRef) {
      page.appendChild(el("div", { class: "api-sub-h" }, "Request body"));
      page.appendChild(el("div", { class: "api-fields" },
        el("div", { class: "api-field" },
          el("div", { class: "api-field-left" },
            el("div", { class: "api-field-name" }, "body"),
            el("div", { class: "api-field-meta" },
              el("span", { class: "api-field-type" }, ep.body.schemaRef),
              el("span", { class: "api-field-req" }, "Required")
            )
          ),
          el("div", null, el("div", { class: "api-field-desc", html: "See the schema reference for the full shape. The Try it panel below has a valid example body pre-filled." }))
        )
      ));
    }

    // Responses
    if (ep.responses && ep.responses.length) {
      page.appendChild(el("div", { class: "api-sub-h" }, "Responses",
        el("span", { class: "count" }, ep.responses.length + "")));
      var rbox = el("div", { class: "api-responses" });
      ep.responses.forEach(function (r) {
        var bucket = r.status < 300 ? "2xx" : r.status < 400 ? "3xx" : r.status < 500 ? "4xx" : "5xx";
        rbox.appendChild(el("div", { class: "api-response-row" },
          el("span", { class: "api-status api-status--" + bucket }, r.status + ""),
          el("div", { class: "api-response-schema" }, r.schema ? el("code", null, r.schema) : el("span", null, "Empty body")),
          el("div", { class: "api-response-desc" }, r.desc || "")
        ));
      });
      page.appendChild(rbox);
    }

    // Try it
    page.appendChild(renderTryIt(ep));

    // Related endpoints
    var related = renderRelatedEndpoints(ep);
    if (related) page.appendChild(related);

    // Prev / next
    var siblings = endpointsForTag(ep.tag);
    var idx = siblings.findIndex(function (s) { return s.id === ep.id; });
    var prev = siblings[idx - 1];
    var next = siblings[idx + 1];
    if (prev || next) {
      var nav = el("div", { class: "api-prevnext" });
      if (prev) nav.appendChild(el("a", { href: hrefFor({ kind: "endpoint", tagId: prev.tag, endpointId: prev.id }), class: "api-prevnext-link api-prevnext-prev" },
        el("span", { class: "api-prevnext-eyebrow" }, "← Previous"),
        el("span", { class: "api-prevnext-name" }, prev.name)
      ));
      else nav.appendChild(el("span", null));
      if (next) nav.appendChild(el("a", { href: hrefFor({ kind: "endpoint", tagId: next.tag, endpointId: next.id }), class: "api-prevnext-link api-prevnext-next" },
        el("span", { class: "api-prevnext-eyebrow" }, "Next →"),
        el("span", { class: "api-prevnext-name" }, next.name)
      ));
      page.appendChild(nav);
    }

    return page;
  }

  /* ---------- endpoint detail helpers ------------------------------ */
  function renderMetaChips(ep) {
    var chips = el("div", { class: "api-meta-chips" });
    var scope = inferScope(ep);
    var iconChip = function (icon, label, val) {
      var chip = el("span", { class: "api-meta-chip" });
      chip.innerHTML = metaChipIcon(icon);
      chip.appendChild(el("span", null, label, " "));
      chip.appendChild(el("b", null, val));
      return chip;
    };
    chips.appendChild(iconChip("lock", "Scope", scope));
    chips.appendChild(iconChip("idem", "Idempotent", isIdempotent(ep) ? "Yes" : "No"));
    chips.appendChild(iconChip("rate", "Rate limit", inferRateLimit(ep)));
    return chips;
  }

  function metaChipIcon(kind) {
    if (kind === "lock") return '<svg viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7.5" width="9" height="6" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
    if (kind === "idem") return '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 0 1 10 0M13 8a5 5 0 0 1-10 0" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11 5l2-1v3M5 11l-2 1V9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (kind === "rate") return '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2v3M8 14v-1M2.5 8h2.5M14 8h-2.5M4 4l1.5 1.5M12 12l-1.5-1.5M12 4l-1.5 1.5M4 12l1.5-1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
    return "";
  }

  function inferScope(ep) {
    // Derive a permission scope from the endpoint's path + method.
    var resource = (ep.path.split("/")[1] || "").replace(/-/g, "_");
    if (!resource) return "auth";
    var verb = ep.method === "GET" ? "read" : "write";
    if (ep.path.includes(":approve") || ep.path.includes(":reject")) verb = "approve";
    return resource + "." + verb;
  }

  function isIdempotent(ep) {
    var m = ep.method.toUpperCase();
    return m === "GET" || m === "PUT" || m === "DELETE" || m === "HEAD" || m === "OPTIONS";
  }

  function inferRateLimit(ep) {
    var m = ep.method.toUpperCase();
    if (ep.path.startsWith("/auth")) return "30 / min";
    if (ep.path.startsWith("/ai"))   return "20 / min";
    if (m === "GET")    return "300 / min";
    return "120 / min";
  }

  function renderEndpointDetail(ep) {
    // Synthesize a "When to use this" callout from the method + path verb.
    var blocks = [];
    var lifecycle = lifecycleCopy(ep);
    if (lifecycle) {
      blocks.push(el("div", { class: "api-callout-info api-callout-info--tip" },
        el("div", { class: "api-callout-info-icon", html: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5v5M8 11.2v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' }),
        el("div", { class: "api-callout-info-body" },
          el("b", null, "When to use this"),
          lifecycle
        )
      ));
    }
    var caveat = caveatCopy(ep);
    if (caveat) {
      blocks.push(el("div", { class: "api-callout-info api-callout-info--warn" },
        el("div", { class: "api-callout-info-icon", html: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2l6 11H2L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.2v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' }),
        el("div", { class: "api-callout-info-body" },
          el("b", null, "Caveat"),
          caveat
        )
      ));
    }
    if (!blocks.length) return null;
    var wrap = el("div", null);
    blocks.forEach(function (b) { wrap.appendChild(b); });
    return wrap;
  }

  function lifecycleCopy(ep) {
    var m = ep.method.toUpperCase();
    var hasList = /:list|^GET\s\/\w+s$/.test(m + " " + ep.path);
    if (m === "GET" && /\{[^}]+\}/.test(ep.path)) {
      return "Fetch a single record by identifier. Returns 404 if it doesn't exist or the caller can't see it.";
    }
    if (m === "GET")  return "Returns a cursor-paginated list. Combine filters with the cursor to traverse large result sets without overfetching.";
    if (m === "POST" && /:[a-z]+$/i.test(ep.path)) return "An action endpoint — runs a state-machine transition on an existing resource. Returns the updated resource (or a job handle when async).";
    if (m === "POST") return "Create a new resource. Pair this with X-Flexwork-Idempotency-Key so a retried POST won't create duplicates.";
    if (m === "PATCH") return "Partial update — only the fields you include are changed. Use this rather than PUT when you don't want to send the whole record back.";
    if (m === "PUT")   return "Replace the entire resource. Any fields you omit are reset to their defaults.";
    if (m === "DELETE")return "Soft-delete or revoke the resource. Most DELETEs are reversible in audit, but they're permanent from the API's perspective.";
    return null;
  }

  function caveatCopy(ep) {
    if (ep.path.includes(":approve")) return "Approval is logged with the calling user as the approver. Downstream workflow steps fire immediately.";
    if (ep.path.includes(":publish")) return "Publishing notifies every affected worker. Use the respectQuietHours flag to suppress out-of-hours pushes.";
    if (ep.path.includes(":import"))  return "Pass dryRun=true on the first call to validate without persisting. The error report identifies the offending row and field.";
    if (ep.path.endsWith("/distribute")) return "Distribution is asynchronous — the response describes the resolved plan, not the eventual fan-out. Subscribe to requisition.distributed for confirmation.";
    if (ep.method === "DELETE" && !ep.path.includes(":")) return "Hard-deletes are rare in Flex Work — most DELETE endpoints move the record to a terminal state rather than removing it from storage.";
    return null;
  }

  /* ---------- Try it panel ---------------------------------------- */
  function tryItButton(ep) {
    var btn = el("button", { class: "api-btn api-btn--primary", type: "button", title: "Run a mock request" },
      el("span", { html: '<svg viewBox="0 0 16 16" fill="none"><path d="M4 3l8 5-8 5V3z" fill="currentColor"/></svg>' }),
      "Try it"
    );
    btn.addEventListener("click", function () {
      var panel = document.querySelector(".api-tryit");
      if (!panel) return;
      panel.scrollIntoView({ block: "start", behavior: "smooth" });
      var first = panel.querySelector(".api-tryit-input, .api-tryit-textarea, .api-tryit-select");
      if (first) setTimeout(function () { first.focus(); }, 360);
    });
    return btn;
  }

  function defaultInputForField(f) {
    if (f.example != null) return String(f.example);
    if (f.enum && f.enum.length) return f.enum[0];
    var t = (f.type || "").toLowerCase();
    if (t.includes("integer") || t.includes("number")) return "50";
    if (t.includes("boolean")) return "true";
    if (t.includes("date") && !t.includes("datetime")) return "2026-06-01";
    if (t.includes("datetime")) return "2026-06-01T00:00:00Z";
    if (t.includes("email")) return "user@example.com";
    if (t.includes("ulid")) return "01HZX7K2QM4FN0R8VBSE6PA7CY";
    return "";
  }

  function renderTryIt(ep) {
    var panel = el("section", { class: "api-tryit", "aria-labelledby": "tryit-h-" + ep.id });

    panel.appendChild(el("div", { class: "api-tryit-head" },
      el("div", { class: "api-tryit-head-left" },
        el("span", { class: "method method--" + ep.method.toLowerCase() }, ep.method),
        el("div", null,
          el("h2", { class: "api-tryit-h", id: "tryit-h-" + ep.id }, "Try it out"),
          el("p", { class: "api-tryit-sub" }, "Send a mock request — no real data is changed.")
        )
      ),
      el("span", { class: "api-tryit-badge" }, "Mock environment")
    ));

    var form = el("div", { class: "api-tryit-form" });
    var inputs = {}; // name → input element

    // Path params
    var pathParams = (ep.params || []).filter(function (p) { return p.in === "path"; });
    if (pathParams.length) form.appendChild(renderTryItGroup("Path parameters", pathParams, inputs));
    // Query params
    var queryParams = (ep.params || []).filter(function (p) { return p.in === "query"; });
    if (queryParams.length) form.appendChild(renderTryItGroup("Query parameters", queryParams, inputs));
    // Headers
    var headerParams = (ep.params || []).filter(function (p) { return p.in === "header"; });
    if (headerParams.length) form.appendChild(renderTryItGroup("Headers", headerParams, inputs));

    // Auth headers (always shown, prefilled)
    form.appendChild(renderTryItGroup("Auth", [
      { name: "Authorization", type: "header", required: true, example: "Bearer eyJraWQiOiJmd2tpZF8wMSIs…" },
      { name: "X-Flexwork-Org", type: "header", required: true, example: "01HZX0J0ORG0000000000000XY" }
    ], inputs));

    // Body
    var bodyInput = null;
    if (ep.body && (ep.body.example || ep.body.schema)) {
      var bodyGroup = el("div", { class: "api-tryit-group" });
      bodyGroup.appendChild(el("div", { class: "api-tryit-group-h" }, "Request body (JSON)"));
      bodyInput = el("textarea", {
        class: "api-tryit-textarea",
        spellcheck: "false",
        rows: "10"
      });
      bodyInput.value = JSON.stringify(ep.body.example, null, 2);
      bodyGroup.appendChild(bodyInput);
      form.appendChild(bodyGroup);
    }

    panel.appendChild(form);

    // Foot
    var statusEl = el("div", { class: "api-tryit-status" }, "Ready");
    var sendBtn = el("button", { class: "api-tryit-send", type: "button" },
      el("span", { html: '<svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      "Send request"
    );
    var resetBtn = el("button", { class: "api-tryit-reset", type: "button" }, "Reset");
    var foot = el("div", { class: "api-tryit-foot" }, resetBtn, statusEl, sendBtn);
    panel.appendChild(foot);

    // Result placeholder
    var resultHost = el("div");
    panel.appendChild(resultHost);

    function reset() {
      Object.keys(inputs).forEach(function (k) {
        var inp = inputs[k];
        inp.value = defaultInputForField(inp._field);
      });
      if (bodyInput) bodyInput.value = JSON.stringify(ep.body.example, null, 2);
      resultHost.innerHTML = "";
      statusEl.textContent = "Ready";
    }
    resetBtn.addEventListener("click", reset);

    sendBtn.addEventListener("click", function () {
      sendBtn.disabled = true;
      statusEl.textContent = "Sending…";
      var startedAt = performance.now();
      var latency = 90 + Math.round(Math.random() * 240);
      setTimeout(function () {
        var elapsed = Math.round(performance.now() - startedAt);
        var result = simulateResponse(ep, inputs, bodyInput);
        resultHost.innerHTML = "";
        resultHost.appendChild(renderTryItResult(ep, inputs, bodyInput, result, elapsed));
        statusEl.textContent = "Response received in " + elapsed + " ms";
        sendBtn.disabled = false;
      }, latency);
    });

    return panel;
  }

  function renderTryItGroup(label, fields, inputs) {
    var group = el("div", { class: "api-tryit-group" });
    group.appendChild(el("div", { class: "api-tryit-group-h" }, label));
    var grid = el("div", { class: "api-tryit-fields" });
    fields.forEach(function (f) {
      var fieldEl = el("label", { class: "api-tryit-field" });
      var name = el("span", { class: "api-tryit-field-name" }, f.name);
      if (f.required) name.appendChild(el("span", { class: "req" }, "*"));
      else name.appendChild(el("span", { class: "opt" }, "Opt"));
      fieldEl.appendChild(name);

      var input;
      if (f.enum && f.enum.length) {
        input = el("select", { class: "api-tryit-select" });
        if (!f.required) input.appendChild(el("option", { value: "" }, "—"));
        f.enum.forEach(function (v) {
          var opt = el("option", { value: v }, v);
          if (v === f.example) opt.selected = true;
          input.appendChild(opt);
        });
      } else {
        input = el("input", { class: "api-tryit-input", type: "text", spellcheck: "false" });
      }
      input.value = defaultInputForField(f);
      input._field = f;
      inputs[f.name] = input;
      fieldEl.appendChild(input);
      grid.appendChild(fieldEl);
    });
    group.appendChild(grid);
    return group;
  }

  function simulateResponse(ep, inputs, bodyInput) {
    // Validate required path params have values.
    var pathParams = (ep.params || []).filter(function (p) { return p.in === "path"; });
    for (var i = 0; i < pathParams.length; i++) {
      var p = pathParams[i];
      if (p.required && (!inputs[p.name] || !inputs[p.name].value.trim())) {
        return { status: 400, body: { type: "request.missing_param", title: "Missing path parameter", field: p.name, traceId: randomULID() } };
      }
    }
    // Validate JSON body parses, if any.
    if (bodyInput) {
      try { JSON.parse(bodyInput.value); }
      catch (e) {
        return { status: 400, body: { type: "request.body_invalid_json", title: "Request body is not valid JSON", detail: e.message, traceId: randomULID() } };
      }
    }
    // Find the canonical success response on the spec.
    var success = (ep.responses || []).find(function (r) { return r.status < 400; });
    if (!success) return { status: 200, body: {} };
    if (success.status === 204) return { status: 204, body: null };
    return { status: success.status, body: ep.responseExample };
  }

  function randomULID() {
    var chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    var s = "";
    for (var i = 0; i < 26; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function renderTryItResult(ep, inputs, bodyInput, result, elapsed) {
    var bucket = result.status < 300 ? "2xx" : result.status < 400 ? "2xx" : result.status < 500 ? "4xx" : "5xx";
    var wrap = el("div", { class: "api-tryit-result" });

    // tabs
    var tabBar = el("div", { class: "api-tryit-result-tabs" });
    var bodyPre = el("pre");
    var requestPre = el("pre");
    var headersPre = el("pre");

    function setTab(name) {
      tabBar.querySelectorAll(".api-tryit-result-tab").forEach(function (b) {
        b.classList.toggle("is-active", b.dataset.tab === name);
      });
      bodyPre.style.display    = name === "body"    ? "" : "none";
      requestPre.style.display = name === "request" ? "" : "none";
      headersPre.style.display = name === "headers" ? "" : "none";
    }

    var bodyTab = el("button", { class: "api-tryit-result-tab is-active", "data-tab": "body", type: "button" }, "Body");
    var reqTab  = el("button", { class: "api-tryit-result-tab",            "data-tab": "request", type: "button" }, "Request");
    var hdrTab  = el("button", { class: "api-tryit-result-tab",            "data-tab": "headers", type: "button" }, "Headers");
    [bodyTab, reqTab, hdrTab].forEach(function (b) {
      b.addEventListener("click", function () { setTab(b.dataset.tab); });
      tabBar.appendChild(b);
    });

    tabBar.appendChild(el("div", { class: "api-tryit-result-meta" },
      el("span", { class: "api-resp-pill api-resp-pill--" + bucket }, result.status + ""),
      el("span", null, elapsed + " ms")
    ));
    wrap.appendChild(tabBar);

    // Body
    var bodyJson = result.body == null
      ? '<span class="tk-comment">// Empty body</span>'
      : highlightJSON(result.body);
    bodyPre.innerHTML = bodyJson;

    // Request — show the resolved URL + headers + body
    var resolvedPath = ep.path;
    var pp = (ep.params || []).filter(function (p) { return p.in === "path"; });
    pp.forEach(function (p) {
      var v = inputs[p.name] ? inputs[p.name].value : "";
      resolvedPath = resolvedPath.replace("{" + p.name + "}", v);
    });
    var qp = (ep.params || []).filter(function (p) { return p.in === "query" && inputs[p.name] && inputs[p.name].value.trim() });
    var qs = qp.length ? "?" + qp.map(function (p) { return encodeURIComponent(p.name) + "=" + encodeURIComponent(inputs[p.name].value.trim()); }).join("&") : "";
    var fullUrl = BASE_URLS[state.server] + resolvedPath + qs;

    var bodyText = bodyInput ? bodyInput.value : "";
    var reqText = ep.method + " " + fullUrl;
    if (bodyText) reqText += "\n\n" + bodyText;
    requestPre.innerHTML = highlightCurl(reqText);

    // Headers
    var headerLines = [
      "Authorization: " + (inputs["Authorization"] ? inputs["Authorization"].value : "Bearer …"),
      "X-Flexwork-Org: " + (inputs["X-Flexwork-Org"] ? inputs["X-Flexwork-Org"].value : "")
    ];
    (ep.params || []).filter(function (p) { return p.in === "header"; }).forEach(function (p) {
      headerLines.push(p.name + ": " + (inputs[p.name] ? inputs[p.name].value : ""));
    });
    headersPre.innerHTML = escHtml(headerLines.join("\n"));

    var body = el("div", { class: "api-tryit-result-body" });
    body.appendChild(bodyPre);
    body.appendChild(requestPre);
    body.appendChild(headersPre);
    setTab("body");
    wrap.appendChild(body);

    return wrap;
  }

  /* ---------- Related endpoints ----------------------------------- */
  function renderRelatedEndpoints(ep) {
    var siblings = endpointsForTag(ep.tag).filter(function (s) { return s.id !== ep.id; });
    if (!siblings.length) return null;
    var picks = siblings.slice(0, 6);

    var wrap = el("section", { class: "api-related" });
    wrap.appendChild(el("div", { class: "api-sub-h" }, "More in this section"));
    var list = el("ul", { class: "api-related-list" });
    picks.forEach(function (s) {
      list.appendChild(el("li", null,
        el("a", { class: "api-related-link", href: hrefFor({ kind: "endpoint", tagId: s.tag, endpointId: s.id }) },
          el("span", { class: "method method--" + s.method.toLowerCase() }, s.method),
          el("span", { class: "api-related-name" }, s.name)
        )
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  /* ---------- center: group landing -------------------------------- */
  function renderGroupPage(group) {
    var page = el("article", { class: "api-page-content api-group-page" });

    page.appendChild(el("nav", { class: "api-crumb", "aria-label": "Breadcrumb" },
      el("a", { href: hrefFor({ kind: "home" }) }, "Reference"),
      el("span", { class: "api-crumb-sep" }, "/"),
      el("span", { class: "api-crumb-current" }, group.name)
    ));

    var totalEps = (group.tags || []).reduce(function (n, t) { return n + endpointsForTag(t).length; }, 0);

    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, totalEps + " endpoint" + (totalEps === 1 ? "" : "s") + " across " + (group.tags || []).length + " section" + ((group.tags || []).length === 1 ? "" : "s")),
      el("h1", { class: "api-tag-title" }, group.name),
      el("p", { class: "api-tag-detail" }, group.summary || "")
    ));

    (group.tags || []).forEach(function (tagId) {
      var tag = findTagById(tagId);
      if (!tag) return;
      var eps = endpointsForTag(tag.id);
      if (!eps.length) return;

      page.appendChild(el("div", { class: "api-group-tag-h" },
        el("a", { href: hrefFor({ kind: "tag", tagId: tag.id }) }, tag.name),
        el("span", { class: "count" }, eps.length + " endpoints")
      ));
      page.appendChild(el("p", { class: "api-group-tag-desc" }, tag.description || ""));

      var grid = el("ul", { class: "api-tag-endpoints" });
      eps.forEach(function (ep) {
        grid.appendChild(el("li", null,
          el("a", { class: "api-tag-endpoint-card", href: hrefFor({ kind: "endpoint", tagId: ep.tag, endpointId: ep.id }) },
            el("div", { class: "api-tag-endpoint-head" },
              el("span", { class: "method method--" + ep.method.toLowerCase() }, ep.method),
              el("code", { class: "api-tag-endpoint-path" }, formatPathSpan(ep.path))
            ),
            el("div", { class: "api-tag-endpoint-name" }, ep.name),
            el("div", { class: "api-tag-endpoint-summary" }, truncate(ep.summary || "", 160))
          )
        ));
      });
      page.appendChild(grid);
    });

    return page;
  }

  /* ---------- center: tag landing ---------------------------------- */
  function renderTagPage(tag) {
    var page = el("article", { class: "api-page-content api-tag-page" });
    var eps = endpointsForTag(tag.id);
    var group = groupForTag(tag.id);

    var crumbKids = [
      el("a", { href: hrefFor({ kind: "home" }) }, "Reference"),
      el("span", { class: "api-crumb-sep" }, "/")
    ];
    if (group) {
      crumbKids.push(el("a", { href: hrefFor({ kind: "group", groupId: group.id }) }, group.name));
      crumbKids.push(el("span", { class: "api-crumb-sep" }, "/"));
    }
    crumbKids.push(el("span", { class: "api-crumb-current" }, tag.name));
    page.appendChild(el("nav", { class: "api-crumb", "aria-label": "Breadcrumb" }, crumbKids));

    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, eps.length + " endpoint" + (eps.length === 1 ? "" : "s")),
      el("h1", { class: "api-tag-title" }, tag.name),
      el("p", { class: "api-tag-detail" }, tag.description || "")
    ));

    page.appendChild(el("div", { class: "api-sub-h" }, "All endpoints"));
    var grid = el("ul", { class: "api-tag-endpoints" });
    eps.forEach(function (ep) {
      grid.appendChild(el("li", null,
        el("a", { class: "api-tag-endpoint-card", href: hrefFor({ kind: "endpoint", tagId: ep.tag, endpointId: ep.id }) },
          el("div", { class: "api-tag-endpoint-head" },
            el("span", { class: "method method--" + ep.method.toLowerCase() }, ep.method),
            el("code", { class: "api-tag-endpoint-path" }, formatPathSpan(ep.path))
          ),
          el("div", { class: "api-tag-endpoint-name" }, ep.name),
          el("div", { class: "api-tag-endpoint-summary" }, truncate(ep.summary || "", 160))
        )
      ));
    });
    page.appendChild(grid);

    return page;
  }

  function truncate(s, n) {
    if (!s) return "";
    if (s.length <= n) return s;
    return s.slice(0, n - 1).replace(/\s\S*$/, "") + "…";
  }

  /* ---------- center: home page ------------------------------------ */
  function renderHomePage() {
    var spec = window.FW_API_SPEC;
    var page = el("article", { class: "api-page-content api-home-page" });

    // Hero
    var hero = el("section", { class: "api-hero" });
    hero.appendChild(el("p", { class: "api-hero-eyebrow" }, "Platform reference"));
    hero.appendChild(el("h1", null, "The Flex Work API"));
    hero.appendChild(el("p", { class: "api-hero-lede" },
      "Flex Work is API-first. Every requisition, candidate, shift, timesheet, " +
      "invoice and supplier contract in the product is reachable over the same " +
      "REST surface documented here. This is the canonical reference — auto-generated " +
      "from our OpenAPI 3.0 spec, with live request and response examples for every endpoint."
    ));

    var meta = el("div", { class: "api-hero-meta" });
    meta.appendChild(metaCell("Base URL", el("code", null, "https://api.dayforce.com/flex-work/v1")));
    meta.appendChild(metaCell("Auth",     el("span", null, "OAuth 2.0 · Bearer token")));
    meta.appendChild(metaCell("Format",   el("span", null, "JSON over HTTPS")));
    meta.appendChild(metaCell("Version",  el("span", null, "v1.0 · " + spec.paths.length + " endpoints across " + (spec.groups || []).length + " groups")));
    hero.appendChild(meta);
    page.appendChild(hero);

    // Quick-start callouts
    var callouts = el("nav", { class: "api-callouts", "aria-label": "Quick start" });
    var quickStarts = [
      { href: "#/get-started/auth",         icon: "shield", title: "Authenticate", body: "Trade your client credentials for a one-hour bearer token, scoped to a Flex Work org." },
      { href: "#/requisitions/req_list",     icon: "list",   title: "List requisitions", body: "The most common entry point. Cursor-paginated, with rich filters across engagement type, channel and status." },
      { href: "#/webhooks/hk_create",        icon: "bolt",   title: "Subscribe to webhooks", body: "Get notified the moment a requisition opens, a timesheet is approved, or a worker offboards." }
    ];
    quickStarts.forEach(function (q) {
      callouts.appendChild(el("a", { class: "api-callout", href: q.href },
        el("div", { class: "api-callout-icon", html: calloutIconSvg(q.icon) }),
        el("h3", { class: "api-callout-title" }, q.title),
        el("p", { class: "api-callout-detail" }, q.body)
      ));
    });
    page.appendChild(callouts);

    // Tag grid — now sourced from groups
    page.appendChild(el("h2", { class: "api-home-section-h" }, "Browse the reference"));
    page.appendChild(el("p", { class: "api-home-section-sub" },
      "Every feature in Flex Work ships with an endpoint spec. Pick a section to drill in."));

    var groupGrid = el("ul", { class: "api-tag-grid" });
    (spec.groups || []).forEach(function (group) {
      var count = (group.tags || []).reduce(function (n, t) { return n + endpointsForTag(t).length; }, 0);
      if (!count && group.id !== "get-started") return;
      var href = group.id === "get-started" ? hrefFor({ kind: "info", id: "auth" }) : hrefFor({ kind: "group", groupId: group.id });
      groupGrid.appendChild(el("li", null,
        el("a", { class: "api-tag-card", href: href },
          el("div", { class: "api-tag-card-head" },
            el("h3", { class: "api-tag-card-name" }, group.name),
            count ? el("span", { class: "api-tag-card-count" }, count + "") : el("span", { class: "api-tag-card-count" }, (group.tags || []).length + " topics")
          ),
          el("p", { class: "api-tag-card-detail" }, truncate(group.summary || "", 160))
        )
      ));
    });
    page.appendChild(groupGrid);

    return page;
  }

  function metaCell(label, val) {
    var d = el("div", null);
    d.appendChild(el("b", null, label));
    if (val.nodeType) d.appendChild(val);
    else d.appendChild(document.createTextNode(val));
    return d;
  }

  function calloutIconSvg(kind) {
    if (kind === "shield") return '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5 2v3.5c0 3-2 5.4-5 6.5C5 12.4 3 10 3 7V3.5l5-2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 8l1.5 1.5L10 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/></svg>';
    if (kind === "list")   return '<svg viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 6h6M5 9h6M5 12h3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    return '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5L4 8.5h3.5L7 14.5l5-7H8.5L9 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }

  /* ---------- center: info pages ----------------------------------- */
  function renderInfoPage(id) {
    var page = el("article", { class: "api-page-content api-info-page" });
    page.appendChild(el("nav", { class: "api-crumb", "aria-label": "Breadcrumb" },
      el("a", { href: hrefFor({ kind: "home" }) }, "Reference"),
      el("span", { class: "api-crumb-sep" }, "/"),
      el("span", { class: "api-crumb-current" }, infoTitle(id))
    ));

    if (id === "auth") return renderAuthInfo(page);
    if (id === "errors") return renderErrorsInfo(page);
    if (id === "pagination") return renderPaginationInfo(page);
    if (id === "idempotency") return renderIdempotencyInfo(page);
    if (id === "rate-limits") return renderRateLimitsInfo(page);
    if (id === "versioning") return renderVersioningInfo(page);
    if (id === "conditional-reads") return renderConditionalReadsInfo(page);
    if (id === "sparse-fieldsets") return renderSparseFieldsetsInfo(page);
    if (id === "filter-language") return renderFilterLanguageInfo(page);
    if (id === "residency") return renderResidencyInfo(page);
    if (id === "deprecation") return renderDeprecationInfo(page);
    if (id === "ndjson-streaming") return renderNdjsonInfo(page);
    return page;
  }

  function renderNdjsonInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "NDJSON streaming"),
      el("p", { class: "api-tag-detail", html:
        "Every list endpoint accepts <code>Accept: application/x-ndjson</code>. The response streams one JSON object per line, the connection stays open until the result set is exhausted. " +
        "Saves an order of magnitude on HTTP round-trips for BI tools and bulk exporters that need every row."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Request"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "Accept",          type: "header", required: true,  desc: "`application/x-ndjson` to opt into streaming mode. `application/json` (default) returns a single paginated envelope." }),
      renderField({ name: "X-Stream-BatchSize", type: "header", required: false, desc: "Internal flush batch — server-side hint, 100\u20135000. Lower batches reduce time-to-first-byte but increase per-batch overhead. Defaults to 1000." })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Response shape"));
    page.appendChild(el("div", { class: "api-detail-block" },
      el("p", null, "Each line is a complete JSON object — the same record shape as the standard list envelope's `data[]` entries. There is NO envelope, NO data wrapper, NO trailing summary line. Newline-delimited JSON, full stop."),
      el("p", null, "The connection closes cleanly when the result set is exhausted. Filters, ordering, and the filter language all work the same as in paginated mode; cursor pagination is irrelevant in streaming mode and silently ignored."),
      el("p", null, "On error mid-stream, the platform writes one final line `{\"error\":{\"type\":\"\u2026\",\"detail\":\"\u2026\",\"traceId\":\"\u2026\"}}` then closes the connection. Parsers MUST treat any line that contains a top-level `error` key as a terminal condition.")
    ));
    page.appendChild(el("div", { class: "api-callout-info api-callout-info--tip" },
      el("div", { class: "api-callout-info-icon", html: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5v5M8 11.2v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' }),
      el("div", { class: "api-callout-info-body" },
        el("b", null, "Throughput"),
        "A full audit-log pull at the $500M tier (12M rows / quarter) takes ~14 minutes streaming vs ~3 hours paginated. Use NDJSON for any export bigger than a few thousand rows."
      )
    ));
    return page;
  }

  function renderConditionalReadsInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Conditional reads"),
      el("p", { class: "api-tag-detail", html:
        "Every entity GET returns a strong <code>ETag</code> header. " +
        "Pass it back on the next read as <code>If-None-Match</code> and the platform returns " +
        "<b>304 Not Modified</b> with no body when the entity hasn't changed. " +
        "List endpoints return a weak <code>ETag</code> computed over the result-set hash."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Response headers"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "ETag",          type: "header", required: true,  desc: 'Strong validator on entity GETs, e.g. `\"a08c3d0e7f6f5a4b\"`. Weak validator (`W/\"\u2026\"`) on list GETs.' }),
      renderField({ name: "Last-Modified", type: "header", required: true,  desc: "RFC 7231 date of the most recent change to the entity. Use with If-Modified-Since as an alternative to ETag." }),
      renderField({ name: "Cache-Control", type: "header", required: true,  desc: "Defaults to `private, max-age=0, must-revalidate` — clients must revalidate every read but can use the cached body on 304." })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Request headers"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "If-None-Match",     type: "header", required: false, desc: "ETag from a previous response. The server returns 304 if the entity matches." }),
      renderField({ name: "If-Modified-Since", type: "header", required: false, desc: "RFC 7231 date. The server returns 304 if the entity hasn't changed since." }),
      renderField({ name: "If-Match",          type: "header", required: false, desc: "Optimistic concurrency on PATCH / PUT / DELETE. Server returns 412 Precondition Failed if the entity has changed." })
    ));
    page.appendChild(el("div", { class: "api-callout-info api-callout-info--tip" },
      el("div", { class: "api-callout-info-icon", html: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5v5M8 11.2v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' }),
      el("div", { class: "api-callout-info-body" },
        el("b", null, "Cache hit rate"),
        "A dashboard hitting 480 location pages every minute saves ~700k full reads a day on 304s. Worth implementing on day one."
      )
    ));
    return page;
  }

  function renderSparseFieldsetsInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Sparse fieldsets & expansions"),
      el("p", { class: "api-tag-detail", html:
        "Trim the payload by passing <code>?fields=</code>. Inline related entities by passing <code>?expand=</code>. " +
        "Works on every list and entity GET; combine freely."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Query parameters"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "fields",  type: "string", required: false, desc: "Comma-separated allowlist, e.g. `?fields=id,title,status`. Server returns ONLY those fields; everything else is omitted. Saves bandwidth on big list calls." }),
      renderField({ name: "expand",  type: "string", required: false, desc: "Comma-separated list of relationships to inline, e.g. `?expand=supplier,job`. Saves round-trips when listing entities + their relations." })
    ));
    page.appendChild(el("div", { class: "api-detail-block" },
      el("p", null, "Combined example: GET /requisitions?fields=id,title,status,supplier&expand=supplier returns a list of requisitions with the supplier inlined under each row and every other field stripped — ~12 KB versus ~280 KB on a default list."),
      el("p", null, "Field paths support one level of nesting on expand: `?fields=id,supplier.name` works after `?expand=supplier`.")
    ));
    return page;
  }

  function renderFilterLanguageInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Filter language"),
      el("p", { class: "api-tag-detail", html:
        "Beyond the per-field query params, list endpoints accept a small RQL-style <code>?filter=</code> grammar for OR, NOT, ranges, and set membership."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Operators"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "field:eq:value",     type: "operator", required: false, desc: "Equality. Equivalent to `?field=value`." }),
      renderField({ name: "field:in:(a,b,c)",   type: "operator", required: false, desc: "Set membership." }),
      renderField({ name: "field:gte:value",    type: "operator", required: false, desc: "Range — gte / gt / lte / lt." }),
      renderField({ name: "field:contains:str", type: "operator", required: false, desc: "Substring match (string fields only)." }),
      renderField({ name: "field:exists",       type: "operator", required: false, desc: "Non-null check." }),
      renderField({ name: "not(\u2026)",        type: "operator", required: false, desc: "Negation." }),
      renderField({ name: "or(\u2026,\u2026)",  type: "operator", required: false, desc: "Boolean OR of clauses." })
    ));
    page.appendChild(el("div", { class: "api-detail-block" },
      el("p", null, "Clauses are comma-separated and AND'd. Example: `?filter=status:in:(open,filled),startDate:gte:2026-06-01,not(supplierId:eq:01HZX0J7X1)`."),
      el("p", null, "Invalid expressions return 400 with the offset of the parse error.")
    ));
    return page;
  }

  function renderResidencyInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Region & residency"),
      el("p", { class: "api-tag-detail", html:
        "Flex Work tenants are pinned to one of six regions. Cross-region reads are explicit and return <b>403 cross_region_forbidden</b> when the token's region doesn't match the data's region. Reads can opt into a regional read replica with <code>X-Flexwork-Consistency: stale</code>."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Headers"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "X-Flexwork-Region",      type: "header", required: false, desc: "Asserted region code (us, eu, ca, au, etc.). Defaults to the token's home region. Returns 403 if the data lives elsewhere." }),
      renderField({ name: "X-Flexwork-Consistency", type: "header", required: false, desc: "Read consistency. `strong` (default) reads the primary; `stale` reads a regional replica with up to 5s lag." })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Available regions"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "us",          type: "region", required: false, desc: "United States. Primary at us-east-1." }),
      renderField({ name: "eu",          type: "region", required: false, desc: "European Union. Primary at eu-west-1." }),
      renderField({ name: "ca",          type: "region", required: false, desc: "Canada. Primary at ca-central-1." }),
      renderField({ name: "uk",          type: "region", required: false, desc: "United Kingdom. Primary at eu-west-2." }),
      renderField({ name: "au",          type: "region", required: false, desc: "Australia. Primary at ap-southeast-2." }),
      renderField({ name: "sandbox",     type: "region", required: false, desc: "Shared sandbox at us-east-1. No production data." })
    ));
    return page;
  }

  function renderDeprecationInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Deprecation contract"),
      el("p", { class: "api-tag-detail", html:
        "Endpoints scheduled for removal emit <code>Deprecation</code> and <code>Sunset</code> headers per RFC 8594. Sunset is announced <b>at least 6 months</b> before the endpoint stops responding. Within a major version the platform never removes a field, narrows an enum, or tightens a validation rule."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Response headers"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "Deprecation",    type: "header", required: false, desc: "Present on deprecated endpoints. Value is `true` or an RFC 7231 date — the date the endpoint was deprecated." }),
      renderField({ name: "Sunset",         type: "header", required: false, desc: "RFC 7231 date the endpoint will stop responding. Always at least 6 months in the future." }),
      renderField({ name: "Link",           type: "header", required: false, desc: "Migration target. e.g. `Link: </flex-work/v1/requisitions:create-v2>; rel=\"successor-version\"`." }),
      renderField({ name: "X-Flexwork-Version", type: "header", required: true, desc: "Schema date the response was generated against (YYYY-MM-DD). Use to detect drift in CI." })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "What never changes within v1"));
    page.appendChild(el("div", { class: "api-detail-block" },
      el("p", null, "The platform never: removes a field, renames a field, changes a field's type, narrows an enum, makes an optional field required, or tightens a validation rule."),
      el("p", null, "The platform may: add new fields (clients must ignore unknowns), add new endpoints, add new enum values (clients must default-handle), add new optional headers, and add new optional query parameters.")
    ));
    return page;
  }

  function infoTitle(id) {
    return ({
      auth: "Authentication",
      errors: "Errors & retries",
      pagination: "Pagination",
      idempotency: "Idempotency",
      "rate-limits": "Rate limits",
      versioning: "Versioning",
      "conditional-reads": "Conditional reads & ETags",
      "sparse-fieldsets": "Sparse fieldsets & expansions",
      "filter-language": "Filter language",
      residency: "Region & residency",
      deprecation: "Deprecation contract",
      "ndjson-streaming": "NDJSON streaming"
    })[id] || id;
  }

  function renderAuthInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Authentication"),
      el("p", { class: "api-tag-detail", html:
        'All requests must include a bearer token in the <code>Authorization</code> header and the org identifier in <code>X-Flexwork-Org</code>. ' +
        'Tokens are issued by <a href="#/auth/auth_token">POST /auth/token</a>, are scoped to one org plus a role, and expire after one hour. ' +
        'Long-running integrations should request a refresh token and rotate ahead of expiry.'
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Required headers"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "Authorization",            type: "header", required: true,  desc: "Bearer token, e.g. `Authorization: Bearer eyJraWQiOiJmd2tpZF8wMSIs…`. Tokens last for one hour; capture the `expires_in` response field and rotate before expiry." }),
      renderField({ name: "X-Flexwork-Org",           type: "header", required: true,  desc: "The Flex Work org identifier the request is for. Tokens are minted for one org; this header asserts which org the caller intends to operate on for clarity in audit logs." }),
      renderField({ name: "X-Flexwork-Idempotency-Key", type: "header", required: false, desc: "Client-generated unique key for retry-safe mutations. Repeating a request with the same key within 24 hours returns the original response without re-running the side effect." }),
      renderField({ name: "X-Flexwork-Labs",          type: "header", required: false, desc: "Opt into Labs surfaces. Pass the comma-separated capability list, e.g. `aiChat,advancedInsights`." })
    ));
    return page;
  }

  function renderErrorsInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Errors and retries"),
      el("p", { class: "api-tag-detail", html:
        'Errors are returned with a problem-style JSON envelope and a stable <code>type</code> code you can branch on. ' +
        'Server errors (5xx) are safe to retry with exponential backoff; client errors (4xx) are not — fix the request and resend.'
      })
    ));
    var rows = [
      [200, "2xx", "Page<T> or entity", "Success. Response body matches the endpoint's documented schema."],
      [201, "2xx", "Entity",            "Resource created. The body is the new entity."],
      [202, "2xx", "Job",               "Accepted. The work is happening asynchronously; the body identifies the job."],
      [204, "2xx", "Empty",             "Success with no body."],
      [400, "4xx", "Error",             "Validation failed. The field property names the offending property."],
      [401, "4xx", "Error",             "Token missing, malformed, or expired."],
      [403, "4xx", "Error",             "Caller is authenticated but lacks the required scope for this operation."],
      [404, "4xx", "Error",             "Resource does not exist, or is not visible to the caller's org."],
      [409, "4xx", "Error",             "Request conflicts with the resource's current state — typically a lifecycle violation."],
      [429, "4xx", "Error",             "Rate limit exceeded. Respect Retry-After and back off."],
      [500, "5xx", "Error",             "Server error. Safe to retry with exponential backoff up to five attempts."],
      [503, "5xx", "Error",             "Region temporarily unavailable. Same retry policy as 500."]
    ];
    var rbox = el("div", { class: "api-responses" });
    rows.forEach(function (r) {
      rbox.appendChild(el("div", { class: "api-response-row" },
        el("span", { class: "api-status api-status--" + r[1] }, r[0] + ""),
        el("div", { class: "api-response-schema" }, el("code", null, r[2])),
        el("div", { class: "api-response-desc" }, r[3])
      ));
    });
    page.appendChild(rbox);
    return page;
  }

  function renderPaginationInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Pagination"),
      el("p", { class: "api-tag-detail" },
        "Every list endpoint uses cursor pagination. Pass the nextCursor from the previous response as the cursor query parameter to fetch the next page. Page size defaults to 50; the max is 200. Total counts are off by default — pass count=true to include them, at a small latency cost."
      )
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Standard envelope"));
    page.appendChild(el("div", { class: "api-fields" },
      renderField({ name: "data",       type: "Array<T>", required: true,  desc: "List of records on this page." }),
      renderField({ name: "nextCursor", type: "string",   required: false, desc: "Opaque cursor for the next page; null when there are no more rows." }),
      renderField({ name: "totalCount", type: "integer",  required: false, desc: "Total matching records. Only included when the request set count=true." })
    ));
    return page;
  }

  function renderIdempotencyInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Idempotency"),
      el("p", { class: "api-tag-detail", html:
        "All POST mutations are <b>safely retriable</b> when you send <code>X-Flexwork-Idempotency-Key</code>. " +
        "Generate a UUID per logical request and resend it on retries &mdash; Flex Work remembers the original response for 24 hours and replays it byte-for-byte. " +
        "GET, PUT, PATCH, and DELETE are inherently idempotent and ignore the header."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "How replays work"));
    page.appendChild(el("div", { class: "api-detail-block" },
      el("p", null, "The first request with a given key runs the side effect and stores the (status, headers, body) triple under that key. Repeats within 24 hours return that triple — no double-charging, no duplicate requisitions, no duplicate worker assignments."),
      el("p", null, "If the SAME key is used with a DIFFERENT body, the platform returns 422 unprocessable_entity. That tells the client it has a bug — its retry logic is sending different payloads under one key.")
    ));
    return page;
  }

  function renderRateLimitsInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Rate limits"),
      el("p", { class: "api-tag-detail", html:
        "Limits are <b>per access token</b>, applied with a token-bucket. Reads are looser than writes; auth and AI endpoints are tightest. " +
        "Every response carries <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and <code>X-RateLimit-Reset</code>."
      })
    ));
    var rows = [
      ["GET (reads)",                  "300 / minute", "Bursts of 60 tolerated."],
      ["POST / PUT / PATCH / DELETE",  "120 / minute", "Most write endpoints."],
      ["POST /auth/*",                 "30 / minute",  "Tighter to slow credential-stuffing."],
      ["POST /ai/*",                   "20 / minute",  "Token-cost driven; AI endpoints fan out to model calls."],
      ["POST /webhooks:test",          "5 / minute",   "Deliberately tight."]
    ];
    var box = el("div", { class: "api-fields" });
    rows.forEach(function (r) {
      box.appendChild(renderField({ name: r[0], type: r[1], required: false, desc: r[2] }));
    });
    page.appendChild(box);
    page.appendChild(el("div", { class: "api-callout-info api-callout-info--warn" },
      el("div", { class: "api-callout-info-icon", html: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2l6 11H2L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.2v.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' }),
      el("div", { class: "api-callout-info-body" },
        el("b", null, "On 429"),
        "Respect the Retry-After header. Back off exponentially: 1s, 2s, 4s, 8s, 16s, jittered \xb125%."
      )
    ));
    return page;
  }

  function renderVersioningInfo(page) {
    page.appendChild(el("header", { class: "api-tag-header" },
      el("p", { class: "api-tag-eyebrow" }, "Get started"),
      el("h1", { class: "api-tag-title" }, "Versioning"),
      el("p", { class: "api-tag-detail", html:
        "Flex Work uses <b>dated API versions</b>. The version is part of the base URL (<code>/flex-work/v1</code>) and is pinned per-client via the <code>X-Flexwork-Version</code> header in <code>YYYY-MM-DD</code> format. " +
        "Within v1, additive changes ship monthly; breaking changes are queued for v2 and announced 6 months ahead."
      })
    ));
    page.appendChild(el("div", { class: "api-sub-h" }, "Stability contract"));
    page.appendChild(el("div", { class: "api-detail-block" },
      el("p", null, "Within a major version, the platform never: removes a field, renames a field, changes a field's type, narrows an enum, makes an optional field required, or tightens a validation rule."),
      el("p", null, "The platform may: add new fields (clients must ignore unknowns), add new endpoints, add new enum values (clients must default-handle), and add new optional headers."),
      el("p", null, "Deprecated endpoints are tagged with the Deprecation and Sunset response headers (RFC 8594) at least 6 months before removal.")
    ));
    return page;
  }

  /* ---------- main mount ------------------------------------------- */
  function renderMain() {
    var host = document.getElementById("api-main-host");
    host.innerHTML = "";
    if (state.route.kind === "endpoint") {
      var ep = findEndpointById(state.route.endpointId);
      if (ep) host.appendChild(renderEndpointPage(ep));
      else host.appendChild(renderNotFound());
    } else if (state.route.kind === "tag") {
      var tag = findTagById(state.route.tagId);
      if (tag) host.appendChild(renderTagPage(tag));
      else host.appendChild(renderNotFound());
    } else if (state.route.kind === "group") {
      var grp = findGroupById(state.route.groupId);
      if (grp) host.appendChild(renderGroupPage(grp));
      else host.appendChild(renderNotFound());
    } else if (state.route.kind === "info") {
      host.appendChild(renderInfoPage(state.route.id));
    } else {
      host.appendChild(renderHomePage());
    }
    host.appendChild(renderFooter());
  }

  function renderNotFound() {
    var page = el("div", { class: "api-page-content api-empty-state" });
    page.appendChild(el("div", { class: "api-empty-icon", html:
      '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '  <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2"/>' +
      '  <path d="M22 26h0M42 26h0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '  <path d="M22 42c3-3 7-4 10-4s7 1 10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>'
    }));
    page.appendChild(el("h1", { class: "api-empty-title" }, "We couldn\u2019t find that page"));
    page.appendChild(el("p",  { class: "api-empty-body" },
      "The URL you followed doesn\u2019t match an endpoint, tag, or info page in this reference. It may have been renamed, or the link is from an older version of the docs."
    ));

    var actions = el("div", { class: "api-empty-actions" });
    actions.appendChild(el("a", { class: "api-empty-btn api-empty-btn--primary", href: hrefFor({ kind: "home" }) }, "Reference home"));
    actions.appendChild(el("button", { class: "api-empty-btn", type: "button",
      on: { click: function () { openPalette(); } } }, "Search the docs"));
    page.appendChild(actions);

    page.appendChild(el("div", { class: "api-empty-suggestions" },
      el("div", { class: "api-empty-suggestions-h" }, "Popular endpoints"),
      el("ul", null,
        el("li", null, el("a", { href: "#/requisitions/req_list"        }, "GET /requisitions")),
        el("li", null, el("a", { href: "#/workers/wrk_list"             }, "GET /workers")),
        el("li", null, el("a", { href: "#/suppliers/sup_list"           }, "GET /suppliers")),
        el("li", null, el("a", { href: "#/me/me_approvals_list"         }, "GET /me/approvals")),
        el("li", null, el("a", { href: "#/search/search"                }, "GET /search"))
      )
    ));
    return page;
  }

  function renderFooter() {
    return el("footer", { class: "api-footer" },
      el("div", null, "Flex Work API · v1.0 · last updated ", el("time", { datetime: "2026-05-26" }, "May 26, 2026")),
      el("div", null,
        el("a", { href: "../Flex Work v2 Changelog.html" }, "Changelog"),
        el("a", { href: "../index.html" }, "Back to app")
      )
    );
  }

  /* ---------- right rail (code samples) ---------------------------- */
  function renderRail() {
    var rail = document.getElementById("api-code-rail");
    rail.innerHTML = "";

    // Tabs
    var tabs = el("div", { class: "api-code-tabs" });
    LANGS.forEach(function (lang) {
      var btn = el("button", { class: "api-code-tab" + (lang === state.lang ? " is-active" : ""), "data-lang": lang, type: "button" }, lang);
      btn.addEventListener("click", function () {
        state.lang = lang;
        localStorage.setItem("fw-api-lang", lang);
        rerenderRail();
      });
      tabs.appendChild(btn);
    });
    // Collapse button inside the tab bar
    var collapseBtn = el("button", {
      class: "api-icon-btn",
      type: "button",
      title: "Hide code panel",
      "aria-label": "Hide code panel",
      style: "margin-left: auto;",
      html: '<svg viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    });
    collapseBtn.addEventListener("click", function () { toggleRail(true); });
    tabs.appendChild(collapseBtn);
    rail.appendChild(tabs);

    // Base URL strip
    var baseStrip = el("div", { class: "api-base-strip" });
    baseStrip.appendChild(document.createTextNode("Base URL"));
    var sel = el("select", null);
    Object.keys(BASE_URLS).forEach(function (key) {
      var opt = el("option", { value: key }, key + " · " + BASE_URLS[key]);
      if (key === state.server) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      state.server = sel.value;
      localStorage.setItem("fw-api-server", state.server);
      rerenderRail();
    });
    baseStrip.appendChild(sel);
    rail.appendChild(baseStrip);

    rail.appendChild(el("div", { class: "api-code-scroll", id: "api-code-scroll" }));
    rerenderRail();
  }

  function activeEndpointForRail() {
    if (state.route.kind === "endpoint") return findEndpointById(state.route.endpointId);
    if (state.route.kind === "tag") {
      var eps = endpointsForTag(state.route.tagId);
      return eps[0] || findEndpointById("auth_token");
    }
    // Home or info pages → show the auth/token quickstart example
    return findEndpointById("auth_token");
  }

  function rerenderRail() {
    var rail = document.getElementById("api-code-rail");
    if (!rail) return;
    rail.querySelectorAll(".api-code-tab").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.lang === state.lang);
    });
    var scroll = document.getElementById("api-code-scroll");
    scroll.innerHTML = "";

    var ep = activeEndpointForRail();
    if (!ep) return;
    var baseUrl = BASE_URLS[state.server];

    // Request block
    var reqHead = el("div", { class: "api-code-block-head" },
      el("span", { class: "api-code-block-label" },
        el("span", { class: "method req-method method--" + ep.method.toLowerCase() }, ep.method),
        "Request example"
      ),
      el("div", { class: "api-code-block-actions" },
        copyButton(function () { return GENERATORS[state.lang](ep, baseUrl); })
      )
    );
    var reqPre = el("pre", { html: HIGHLIGHTERS[state.lang](GENERATORS[state.lang](ep, baseUrl)) });
    scroll.appendChild(el("div", { class: "api-code-block" }, reqHead, reqPre));

    // Response block
    var firstSuccess = (ep.responses || []).find(function (r) { return r.status < 400; }) || (ep.responses || [])[0];
    if (firstSuccess) {
      var bucket = firstSuccess.status < 300 ? "2xx" : firstSuccess.status < 400 ? "2xx" : firstSuccess.status < 500 ? "4xx" : "5xx";
      var respHead = el("div", { class: "api-code-block-head" },
        el("span", { class: "api-code-block-label" },
          el("span", { class: "api-resp-pill api-resp-pill--" + bucket }, firstSuccess.status + ""),
          "Response"
        ),
        el("div", { class: "api-code-block-actions" },
          copyButton(function () { return JSON.stringify(ep.responseExample, null, 2); })
        )
      );
      var body = ep.responseExample == null
        ? '<span class="tk-comment">// Empty body</span>'
        : highlightJSON(ep.responseExample);
      var respPre = el("pre", { html: body });
      scroll.appendChild(el("div", { class: "api-code-block" }, respHead, respPre));
    }
  }

  function copyButton(getText, title) {
    var btn = el("button", {
      class: "api-icon-btn",
      type: "button",
      title: title || "Copy",
      "aria-label": title || "Copy",
      html: '<svg viewBox="0 0 16 16" fill="none"><rect x="4.5" y="4.5" width="8" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M3 11V3a1 1 0 0 1 1-1h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
    });
    btn.addEventListener("click", function () {
      try {
        navigator.clipboard.writeText(getText()).then(function () {
          btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';
          setTimeout(function () {
            btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><rect x="4.5" y="4.5" width="8" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M3 11V3a1 1 0 0 1 1-1h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
          }, 1100);
        });
      } catch (e) {}
    });
    return btn;
  }

  /* ---------- rail collapse toggle --------------------------------- */
  function applyRailCollapsed() {
    var page = document.querySelector(".api-page");
    var collapsed = localStorage.getItem("fw-api-rail-collapsed") === "1";
    if (!page) return;
    page.classList.toggle("is-code-rail-collapsed", collapsed);
    var btn = document.getElementById("api-code-rail-show");
    if (btn) {
      btn.style.display = collapsed ? "" : "none";
    }
  }
  function toggleRail(collapse) {
    var current = localStorage.getItem("fw-api-rail-collapsed") === "1";
    var next = typeof collapse === "boolean" ? collapse : !current;
    localStorage.setItem("fw-api-rail-collapsed", next ? "1" : "0");
    applyRailCollapsed();
  }
  function buildRailShowButton() {
    if (document.getElementById("api-code-rail-show")) return;
    var btn = el("button", {
      id: "api-code-rail-show",
      class: "api-code-rail-toggle",
      type: "button",
      title: "Show code samples",
      "aria-label": "Show code samples"
    },
      el("span", { html: '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      el("span", null, "Show code")
    );
    btn.addEventListener("click", function () { toggleRail(false); });
    document.body.appendChild(btn);
  }

  /* ---------- search palette --------------------------------------- */
  function setupSearch() {
    // Top-bar input is the palette trigger.
    var input = document.getElementById("api-search-input");
    if (!input) return;
    input.readOnly = true;
    var open = function () { openPalette(); };
    input.addEventListener("focus", open);
    input.addEventListener("click", open);

    window.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      } else if (e.key === "/" && document.activeElement === document.body) {
        e.preventDefault();
        openPalette();
      } else if (e.key === "?" && document.activeElement === document.body) {
        e.preventDefault();
        toggleShortcutsOverlay();
      } else if (e.key === "Escape") {
        var scrim = document.querySelector(".api-palette-scrim.is-open");
        if (scrim) closePalette();
        var help = document.querySelector(".api-shortcuts.is-open");
        if (help) hideShortcutsOverlay();
      }
    });
  }

  /* ---------- Keyboard shortcuts overlay (P-66) -------------------- */
  function buildShortcutsOverlay() {
    if (document.querySelector(".api-shortcuts")) return;
    var isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
    var meta = isMac ? "\u2318" : "Ctrl";

    var groups = [
      { title: "Navigate", items: [
        [meta + " K", "Open the command palette"],
        ["/",         "Focus the search box"],
        ["?",         "Show this overlay"],
        ["Esc",       "Close palette or this overlay"]
      ] },
      { title: "In the palette", items: [
        ["\u2191 \u2193", "Move through results"],
        ["Enter",     "Open the highlighted item"],
        ["Tab",       "Cycle result group"]
      ] },
      { title: "On an endpoint page", items: [
        ["T",         "Jump to Try it"],
        ["C",         "Copy method + URL"],
        ["B",         "Back to tag landing"]
      ] }
    ];

    var scrim = el("div", { class: "api-shortcuts-scrim" });
    var panel = el("div", { class: "api-shortcuts-panel", role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts" });
    panel.appendChild(el("div", { class: "api-shortcuts-head" },
      el("h2", { class: "api-shortcuts-title" }, "Keyboard shortcuts"),
      el("button", { class: "api-shortcuts-close", type: "button", "aria-label": "Close", on: { click: hideShortcutsOverlay } }, "\u00d7")
    ));
    var grid = el("div", { class: "api-shortcuts-grid" });
    groups.forEach(function (g) {
      var col = el("div", { class: "api-shortcuts-col" });
      col.appendChild(el("div", { class: "api-shortcuts-col-h" }, g.title));
      var list = el("dl", { class: "api-shortcuts-list" });
      g.items.forEach(function (row) {
        list.appendChild(el("div", { class: "api-shortcuts-row" },
          el("dt", { class: "api-shortcuts-keys" }, kbd(row[0])),
          el("dd", { class: "api-shortcuts-desc" }, row[1])
        ));
      });
      col.appendChild(list);
      grid.appendChild(col);
    });
    panel.appendChild(grid);
    panel.appendChild(el("div", { class: "api-shortcuts-foot" }, "Press ", kbd("?"), " any time to reopen this overlay."));

    var host = el("div", { class: "api-shortcuts" });
    host.appendChild(scrim);
    host.appendChild(panel);
    scrim.addEventListener("click", hideShortcutsOverlay);
    document.body.appendChild(host);

    function kbd(text) {
      var span = el("kbd", { class: "api-kbd" });
      span.textContent = text;
      return span;
    }
  }
  function toggleShortcutsOverlay() {
    buildShortcutsOverlay();
    var host = document.querySelector(".api-shortcuts");
    if (!host) return;
    host.classList.toggle("is-open");
  }
  function hideShortcutsOverlay() {
    var host = document.querySelector(".api-shortcuts");
    if (host) host.classList.remove("is-open");
  }

  var paletteState = { items: [], filtered: [], cursor: 0 };

  function buildPaletteIndex() {
    var spec = window.FW_API_SPEC;
    var items = [];
    items.push({ kind: "info", id: "home",       label: "Overview",        path: "/",                 route: { kind: "home" } });
    items.push({ kind: "info", id: "auth",       label: "Authentication",  path: "/get-started/auth", route: { kind: "info", id: "auth" } });
    items.push({ kind: "info", id: "errors",     label: "Errors & retries",path: "/get-started/errors", route: { kind: "info", id: "errors" } });
    items.push({ kind: "info", id: "pagination", label: "Pagination",      path: "/get-started/pagination", route: { kind: "info", id: "pagination" } });
    spec.tags.forEach(function (t) {
      var count = endpointsForTag(t.id).length;
      if (count) items.push({ kind: "tag", id: t.id, label: t.name, path: "/" + t.id, sub: count + " endpoints", route: { kind: "tag", tagId: t.id } });
    });
    spec.paths.forEach(function (p) {
      items.push({
        kind: "endpoint", id: p.id, method: p.method, label: p.name,
        path: p.path, tag: p.tag,
        route: { kind: "endpoint", tagId: p.tag, endpointId: p.id }
      });
    });
    paletteState.items = items;
  }

  function rankItems(q) {
    if (!q) {
      // Default ordering: popular endpoints first, then tags, then info.
      var def = paletteState.items.slice();
      def.sort(function (a, b) {
        var order = function (it) {
          if (it.kind === "endpoint") return 0;
          if (it.kind === "tag")      return 1;
          return 2;
        };
        return order(a) - order(b);
      });
      return def.slice(0, 60);
    }
    var qLower = q.toLowerCase();
    var tokens = qLower.split(/\s+/).filter(Boolean);
    return paletteState.items.map(function (it) {
      var hay = (it.label + " " + it.path + " " + (it.tag || "") + " " + (it.method || "")).toLowerCase();
      var score = 0;
      tokens.forEach(function (tk) {
        var i = hay.indexOf(tk);
        if (i < 0) score = -999;
        else {
          // Earlier match is better, label match is best.
          score += 10 - Math.min(i, 10);
          if (it.label.toLowerCase().indexOf(tk) >= 0) score += 6;
          if (it.path.toLowerCase().indexOf(tk) === 0) score += 4;
        }
      });
      return { it: it, score: score };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 60)
      .map(function (r) { return r.it; });
  }

  function openPalette() {
    if (!paletteState.items.length) buildPaletteIndex();
    var scrim = document.getElementById("api-palette");
    if (!scrim) {
      scrim = buildPalette();
      document.body.appendChild(scrim);
    }
    scrim.classList.add("is-open");
    paletteState.cursor = 0;
    var inp = scrim.querySelector(".api-palette-input");
    if (inp) {
      inp.value = "";
      renderPaletteResults("");
      setTimeout(function () { inp.focus(); }, 50);
    }
  }
  function closePalette() {
    var scrim = document.getElementById("api-palette");
    if (scrim) scrim.classList.remove("is-open");
  }

  function buildPalette() {
    var scrim = el("div", { class: "api-palette-scrim", id: "api-palette" });
    var panel = el("div", { class: "api-palette" });

    var inputWrap = el("div", { class: "api-palette-input-wrap" });
    inputWrap.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    var input = el("input", { class: "api-palette-input", type: "text", placeholder: "Search endpoints, paths, tags… (press ? for shortcuts)", spellcheck: "false", autocomplete: "off" });
    inputWrap.appendChild(input);
    inputWrap.appendChild(el("span", { class: "api-palette-esc" }, "Esc"));
    panel.appendChild(inputWrap);

    var results = el("div", { class: "api-palette-results", id: "api-palette-results" });
    panel.appendChild(results);

    var foot = el("div", { class: "api-palette-foot" },
      el("span", null, el("kbd", null, "↑"), el("kbd", null, "↓"), "navigate"),
      el("span", null, el("kbd", null, "Enter"), "open"),
      el("span", null, el("kbd", null, "Esc"), "close")
    );
    panel.appendChild(foot);

    scrim.appendChild(panel);

    scrim.addEventListener("click", function (e) {
      if (e.target === scrim) closePalette();
    });
    input.addEventListener("input", function () {
      paletteState.cursor = 0;
      renderPaletteResults(input.value);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        paletteState.cursor = Math.min(paletteState.filtered.length - 1, paletteState.cursor + 1);
        updatePaletteCursor();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        paletteState.cursor = Math.max(0, paletteState.cursor - 1);
        updatePaletteCursor();
      } else if (e.key === "Enter") {
        e.preventDefault();
        var pick = paletteState.filtered[paletteState.cursor];
        if (pick) {
          closePalette();
          navigate(hrefFor(pick.route));
        }
      }
    });

    return scrim;
  }

  function renderPaletteResults(q) {
    var host = document.getElementById("api-palette-results");
    if (!host) return;
    var items = rankItems(q);
    paletteState.filtered = items;

    host.innerHTML = "";
    if (!items.length) {
      host.appendChild(el("div", { class: "api-palette-empty" },
        el("div", { class: "api-palette-empty-title" }, "No matches for \u201c" + q + "\u201d"),
        el("div", { class: "api-palette-empty-sub" }, "Try a shorter query, or jump to one of these:"),
        el("ul", { class: "api-palette-empty-suggestions" },
          el("li", null, el("a", { href: "#/requisitions/req_list", onclick: function () { closePalette(); } }, "GET /requisitions")),
          el("li", null, el("a", { href: "#/workers/wrk_list",      onclick: function () { closePalette(); } }, "GET /workers")),
          el("li", null, el("a", { href: "#/suppliers/sup_list",    onclick: function () { closePalette(); } }, "GET /suppliers")),
          el("li", null, el("a", { href: "#/me/me_approvals_list",  onclick: function () { closePalette(); } }, "GET /me/approvals"))
        )
      ));
      return;
    }

    var groups = { endpoint: [], tag: [], info: [] };
    items.forEach(function (it) { (groups[it.kind] || groups.endpoint).push(it); });

    var orderedKeys = [
      ["endpoint", "Endpoints"],
      ["tag",      "Sections"],
      ["info",     "Get started"]
    ];

    orderedKeys.forEach(function (pair) {
      var key = pair[0], label = pair[1];
      if (!groups[key].length) return;
      var group = el("div", { class: "api-palette-group" });
      group.appendChild(el("div", { class: "api-palette-group-h" }, label));
      groups[key].forEach(function (it) {
        var row = el("a", {
          class: "api-palette-item",
          href: hrefFor(it.route),
          "data-id": it.id
        },
          (it.kind === "endpoint"
            ? el("span", { class: "method method--" + (it.method || "get").toLowerCase() }, it.method)
            : el("span", { class: "method method--" + (it.kind === "tag" ? "options" : "head") }, it.kind === "tag" ? "TAG" : "DOC")),
          el("div", null,
            el("div", { class: "api-palette-item-name" }, it.label),
            el("code", { class: "api-palette-item-path" }, it.kind === "endpoint" ? it.path : (it.sub || it.path))
          ),
          el("span", { class: "api-palette-item-arrow" }, "↵")
        );
        row.addEventListener("click", function (e) {
          e.preventDefault();
          closePalette();
          navigate(hrefFor(it.route));
        });
        row.addEventListener("mouseenter", function () {
          var idx = paletteState.filtered.findIndex(function (x) { return x.id === it.id && x.kind === it.kind; });
          if (idx >= 0) { paletteState.cursor = idx; updatePaletteCursor(); }
        });
        group.appendChild(row);
      });
      host.appendChild(group);
    });

    updatePaletteCursor();
  }

  function updatePaletteCursor() {
    var host = document.getElementById("api-palette-results");
    if (!host) return;
    var items = host.querySelectorAll(".api-palette-item");
    items.forEach(function (n) { n.classList.remove("is-cursor"); });
    var pick = paletteState.filtered[paletteState.cursor];
    if (!pick) return;
    var hit = host.querySelector('.api-palette-item[data-id="' + pick.id + '"]');
    if (hit) {
      hit.classList.add("is-cursor");
      var hr = hit.getBoundingClientRect();
      var br = host.getBoundingClientRect();
      if (hr.bottom > br.bottom) hit.scrollIntoView({ block: "nearest" });
      else if (hr.top < br.top) hit.scrollIntoView({ block: "nearest" });
    }
  }

  /* ---------- route handler ---------------------------------------- */
  function onRoute() {
    state.route = parseHash();
    renderMain();
    rerenderRail();
    setActiveNav();
    document.title = pageTitle();
  }

  function pageTitle() {
    var base = "Flex Work API";
    if (state.route.kind === "endpoint") {
      var ep = findEndpointById(state.route.endpointId);
      if (ep) return ep.name + " · " + base;
    }
    if (state.route.kind === "tag") {
      var tag = findTagById(state.route.tagId);
      if (tag) return tag.name + " · " + base;
    }
    if (state.route.kind === "info") return infoTitle(state.route.id) + " · " + base;
    return base;
  }

  /* ---------- boot ------------------------------------------------- */
  function boot() {
    if (!window.FW_API_SPEC) { console.error("FW_API_SPEC missing"); return; }
    buildNav();
    renderRail();
    buildRailShowButton();
    applyRailCollapsed();
    setupSearch();
    window.addEventListener("hashchange", onRoute);
    onRoute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
