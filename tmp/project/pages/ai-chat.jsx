// =====================================================================
// AI Chat — persistent assistant dock (feature flag `aiChat`).
//
// Mounts at the App root in app.jsx behind useFeatureFlag("aiChat"), so
// the launcher follows the user across every page. The chat panel is
// grounded in the same prototype data the rest of the product reads
// (window.REQUISITIONS, window.WORKERS, window.INVOICES, window.SUPPLIERS,
// window.LOCATIONS, window.TIMESHEETS, window.COMPLIANCE, …) so every
// answer is real — not a hallucinated number.
//
// On every send, the chat:
//   1. Snapshots the *current* program state into a tight, model-friendly
//      brief (counts, top rows, problem rows, KPIs).
//   2. Sends conversation history + the brief + a system prompt to
//      window.claude.complete, telling the model it can suggest actions
//      by emitting [ACTION:kind:arg] markers at the end of its reply.
//   3. Parses out those markers and renders them as inline chips the
//      user can click to navigate, open a row, or fire a side panel.
//
// Action kinds (rendered as chips below the reply):
//   · goto:<page>                 — flexGoTo(page) e.g. requisitions, invoices
//   · openReq:<id>                — open requisition detail
//   · openInvoice:<id>            — open invoice detail
//   · openWorker:<id>             — open worker detail
//   · newReq                      — open New Requisition flow
//   · messageSupplier:<supplierId> — toast "Drafting message to {sup}"
//   · approveTimesheet:<id>       — toast + (no-op storage update)
//   · openSettings:<tab>          — flexGoTo settings + tab
//
// State persists to localStorage.flexwork.aiChat so conversations
// survive reloads.
// =====================================================================
(function () {
  const STORAGE_KEY = "flexwork.aiChat";
  const OPEN_KEY    = "flexwork.aiChat.open";
  const MAX_HISTORY = 24;   // last N messages sent to the model

  // ---- Storage --------------------------------------------------------
  function readStored() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeStored(msgs) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50))); }
    catch (e) {}
  }

  // ---- Data brief — built fresh per send -----------------------------
  // Keep this tight; the model has a 1024-token output cap and we need
  // headroom for the answer. Aim for ~400 tokens of context.
  function _money(n) {
    if (n == null || isNaN(n)) return "—";
    const a = Math.abs(n);
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n.toFixed(0);
  }
  function _parseMoney(s) {
    if (typeof s === "number") return s;
    if (!s) return 0;
    const m = String(s).replace(/[^\d.\-]/g, "");
    const n = parseFloat(m);
    return isFinite(n) ? n : 0;
  }
  function buildBrief() {
    const reqs = window.REQUISITIONS || [];
    const workers = window.WORKERS || [];
    const invoices = window.INVOICES || [];
    const suppliers = window.SUPPLIERS || [];
    const locations = window.LOCATIONS || [];
    const timesheets = window.TIMESHEETS || [];
    const compliance = window.COMPLIANCE || [];
    const tempSpend = (window.getTempSpend && window.getTempSpend()) || null;
    const industry = (window.getIndustry && window.getIndustry()) || null;
    const country = (window.getCurrentCountry && window.getCurrentCountry()) || null;

    // --- Requisitions: status + at-risk + top 8
    const reqOpen   = reqs.filter((r) => r.status === "Open" || r.status === "Posted" || r.status === "Pending").length;
    const reqDraft  = reqs.filter((r) => r.status === "Draft").length;
    const reqFilled = reqs.filter((r) => r.status === "Filled" || r.status === "Closed").length;
    const reqAtRisk = reqs.filter((r) => (r.needed != null && r.confirmed != null && r.confirmed < r.needed)).length;
    const reqList = reqs.slice(0, 8).map((r) => ({
      id: r.id,
      job: Array.isArray(r.jobs) ? r.jobs.join(", ") : (r.job || r.role || ""),
      location: r.location || r.site || "",
      start: r.start || r.date || r.when || "",
      needed: r.needed,
      confirmed: r.confirmed,
      status: r.status || "Open",
      supplier: r.supplier || (Array.isArray(r.suppliers) ? r.suppliers.join("/") : ""),
    }));

    // --- Workers — counts by status, top 6 names
    const wStatus = {};
    workers.forEach((w) => { wStatus[w.status || "Active"] = (wStatus[w.status || "Active"] || 0) + 1; });
    const workerList = workers.slice(0, 6).map((w) => ({
      id: w.id,
      name: w.name,
      jobs: Array.isArray(w.jobs) ? w.jobs.slice(0, 2).join(", ") : "",
      supplier: w.supplier,
      status: w.status,
      rating: w.rating,
    }));

    // --- Invoices — counts + AP aging + top 6
    const invByStatus = {};
    let invTotal = 0;
    let invPendingTotal = 0;
    invoices.forEach((i) => {
      const k = i.status || "Pending";
      invByStatus[k] = (invByStatus[k] || 0) + 1;
      const amt = _parseMoney(i.amount || i.total);
      invTotal += amt;
      if (k === "Pending" || k === "Pending Approval" || k === "Review") invPendingTotal += amt;
    });
    const invList = invoices.slice(0, 6).map((i) => ({
      id: i.id,
      supplier: i.supplier,
      amount: i.amount || i.total,
      status: i.status,
      due: i.due || i.dueDate,
    }));

    // --- Suppliers — top 5 by spend
    const supList = suppliers
      .filter((s) => s.status === "Active")
      .map((s) => ({
        id: s.id,
        name: s.name,
        spend: s.spend,
        workers: s.workers,
        requisitions: s.requisitions,
        fillRate: s._sc ? s._sc.fillRate : null,
        rating: s._sc ? s._sc.rating : null,
      }))
      .slice(0, 6);

    // --- Locations — top 6
    const locList = locations
      .filter((l) => l.status === "Active")
      .slice(0, 6)
      .map((l) => ({ id: l.id, name: l.name, address: l.address }));

    // --- Timesheets — pending approval
    const tsPending = timesheets.filter((t) => t.status === "Pending Approval" || t.status === "Review").length;
    const tsList = timesheets
      .filter((t) => t.status === "Pending Approval" || t.status === "Review")
      .slice(0, 5)
      .map((t) => ({ id: t.id, worker: t.worker, duration: t.duration, status: t.status, supplier: t.supplier }));

    // --- Compliance — unresolved
    const compOpen = compliance.filter((c) => c.level && c.level !== "ok").length;

    return {
      meta: {
        industry: industry ? industry.name : null,
        country: country ? `${country.name} (${country.currency})` : null,
        tempSpend: tempSpend ? `${tempSpend.label} (${tempSpend.range})` : null,
        today: "May 22, 2026",
      },
      kpis: {
        openRequisitions: reqOpen,
        draftRequisitions: reqDraft,
        filledRequisitions: reqFilled,
        atRiskRequisitions: reqAtRisk,
        totalWorkers: workers.length,
        workersByStatus: wStatus,
        invoiceTotal: _money(invTotal),
        invoicePending: _money(invPendingTotal),
        invoicesByStatus: invByStatus,
        timesheetsPending: tsPending,
        complianceOpen: compOpen,
        activeSuppliers: suppliers.filter((s) => s.status === "Active").length,
        activeLocations: locations.filter((l) => l.status === "Active").length,
      },
      requisitions: reqList,
      workers: workerList,
      invoices: invList,
      suppliers: supList,
      locations: locList,
      timesheetsPending: tsList,
    };
  }

  // ---- System prompt + send to Claude --------------------------------
  function systemPrompt(brief, location) {
    return [
      "You are the AI assistant inside Dayforce Flex Work — a Vendor Management System (VMS) used by buyer organizations to manage their contingent workforce. You sit in a chat dock at the bottom-right of the application and have full visibility into the user's program data.",
      "",
      "GROUND RULES:",
      "1. Always ground your answers in the JSON brief below. If a number isn't in the brief, say so — never invent figures.",
      "2. Be concise. Most replies should be 1–3 short sentences. Use a small bulleted list when listing rows (max 5).",
      "3. When the user asks for an action you can perform, ALWAYS append a structured action marker on its own line at the end:",
      "   [ACTION:goto:requisitions]      — open the Requisitions list",
      "   [ACTION:goto:invoices]          — open the Invoices list",
      "   [ACTION:goto:workforce]         — open the Workforce list",
      "   [ACTION:goto:schedule]          — open the Schedule",
      "   [ACTION:goto:timesheets]        — open Timesheets",
      "   [ACTION:goto:suppliers]         — open Suppliers",
      "   [ACTION:goto:analytics]         — open Analytics / Insights",
      "   [ACTION:goto:dashboard]         — open Home / Dashboard",
      "   [ACTION:goto:compliance]        — open Compliance",
      "   [ACTION:newReq]                 — open the New Requisition flow",
      "   [ACTION:openReq:<id>]           — open a specific requisition by ID",
      "   [ACTION:openInvoice:<id>]       — open a specific invoice by ID",
      "   [ACTION:openWorker:<id>]        — open a specific worker by ID",
      "   [ACTION:messageSupplier:<id>]   — draft an outbound message to a supplier",
      "   [ACTION:approveTimesheet:<id>]  — approve a pending timesheet",
      "   [ACTION:openSettings:<tab>]     — open a Settings tab (policies, configuration, pricing, workflows, roles, users, feature-flags, system)",
      "   You may emit multiple action markers, one per line, at the end of the reply.",
      "4. Use specific IDs and names from the brief. Refer to rows by their ID (e.g. REQ-…) when relevant.",
      "5. For 'create' or 'request' intent, briefly confirm what you understood, then emit [ACTION:newReq] (for new requisitions) or [ACTION:goto:<page>]. The user will land on the matching screen.",
      "6. Currency is " + (brief.meta.country || "USD") + ". Today is " + brief.meta.today + ".",
      "",
      "USER CONTEXT:",
      "- Signed in as: " + (location && location.session ? location.session : "Amy Chen (Admin)"),
      "- Tenant: " + (brief.meta.industry || "Frontline manufacturing") + " · " + (brief.meta.country || "US"),
      "- Temp-spend tier: " + (brief.meta.tempSpend || "—"),
      "- Currently viewing: " + (location && location.page ? location.page : "Dashboard"),
      "",
      "LIVE PROGRAM BRIEF (JSON):",
      "```json",
      JSON.stringify(brief, null, 0),
      "```",
    ].join("\n");
  }

  async function askClaude(systemText, history, latest) {
    if (!window.claude || typeof window.claude.complete !== "function") {
      return "I'm not connected to the assistant runtime in this preview. (window.claude.complete is unavailable.) In production, this is where the real answer would land — grounded in the program data shown live behind me.";
    }
    // Send the system text as the first user turn (claude.complete is
    // single-shot, so we fold history + system into one message). Keep
    // the most recent N exchanges only.
    const trimmed = history.slice(-MAX_HISTORY);
    const messages = [
      { role: "user", content: systemText },
      { role: "assistant", content: "Understood — I'll ground every answer in that brief and append action markers when the user asks for something I can run." },
    ];
    for (const m of trimmed) {
      messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
    }
    messages.push({ role: "user", content: latest });
    try {
      const reply = await window.claude.complete({ messages });
      return reply || "(empty reply)";
    } catch (e) {
      return "Sorry — I couldn't reach the assistant just now (" + (e && e.message ? e.message : "unknown error") + "). Try again in a moment.";
    }
  }

  // ---- Action parsing -------------------------------------------------
  // Find [ACTION:kind:arg] markers, return { clean, actions[] }.
  const ACTION_RE = /\[ACTION:([a-zA-Z]+)(?::([^\]]+))?\]/g;
  function parseActions(text) {
    const actions = [];
    let m;
    while ((m = ACTION_RE.exec(text)) !== null) {
      actions.push({ kind: m[1], arg: m[2] || null });
    }
    const clean = text.replace(ACTION_RE, "").trim();
    return { clean, actions };
  }

  // ---- Action runner --------------------------------------------------
  // Hand-off to existing window APIs.
  function runAction(a) {
    const toast = (msg, kind) => { if (window.showToast) window.showToast(msg, kind ? { kind } : null); };
    switch (a.kind) {
      case "goto": {
        if (window.flexGoTo) window.flexGoTo({ page: a.arg });
        return;
      }
      case "newReq": {
        if (window.flexGoTo) window.flexGoTo({ page: "requisitions", sub: "new" });
        return;
      }
      case "openReq": {
        if (window.flexGoTo) window.flexGoTo({ page: "requisitions", sub: "details", id: a.arg });
        return;
      }
      case "openInvoice": {
        if (window.flexGoTo) window.flexGoTo({ page: "invoices", sub: "details", id: a.arg });
        return;
      }
      case "openWorker": {
        if (window.flexGoTo) window.flexGoTo({ page: "workforce", sub: "details", id: a.arg });
        return;
      }
      case "messageSupplier": {
        const sup = ((window.SUPPLIERS || []).find((s) => s.id === a.arg) || {}).name || a.arg || "agency";
        toast(`Drafting message to ${sup}`, "success");
        return;
      }
      case "approveTimesheet": {
        toast(`Approved timesheet ${a.arg || ""}`.trim(), "success");
        return;
      }
      case "openSettings": {
        if (window.flexGoTo) window.flexGoTo({ page: "settings", sub: a.arg || "feature-flags" });
        return;
      }
      default:
        toast(`Unrecognized action: ${a.kind}`);
    }
  }

  function actionChipLabel(a) {
    switch (a.kind) {
      case "goto":               return `Open ${_titleCase(a.arg)}`;
      case "newReq":             return "Open New Requisition";
      case "openReq":            return `Open ${a.arg}`;
      case "openInvoice":        return `Open ${a.arg}`;
      case "openWorker":         return "Open worker";
      case "messageSupplier":    return "Draft message";
      case "approveTimesheet":   return `Approve ${a.arg || "timesheet"}`;
      case "openSettings":       return `Open Settings · ${_titleCase(a.arg)}`;
      default:                   return a.kind;
    }
  }
  function actionChipIcon(a) {
    switch (a.kind) {
      case "goto":               return "ArrowRight";
      case "newReq":             return "ArrowRight";
      case "openReq":            return "ArrowRight";
      case "openInvoice":        return "MoneyBag";
      case "openWorker":         return "Person";
      case "messageSupplier":    return "Building";
      case "approveTimesheet":   return "PersonClock";
      case "openSettings":       return "ArrowRight";
      default:                   return "ArrowRight";
    }
  }
  function _titleCase(s) {
    if (!s) return "";
    return String(s).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ---- Suggested first-launch prompts -------------------------------
  const SUGGESTIONS = [
    { icon: "ArrowRight", text: "What needs my attention today?" },
    { icon: "PersonPlus", text: "Create a requisition for 6 forklift operators at Dallas DC next Monday" },
    { icon: "MoneyBag",  text: "What invoices are waiting on approval?" },
    { icon: "Building",  text: "Which agency has the best fill rate?" },
    { icon: "PersonClock", text: "Which shifts are at risk in the next 48 hours?" },
    { icon: "Calendar",  text: "What's my temp spend YTD vs budget?" },
  ];

  // ---- React component -----------------------------------------------
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  function AIChatHost() {
    // Feature flag — re-render on toggle so the host appears/disappears
    // without a page reload.
    if (typeof window !== "undefined" && window.useFeatureFlag) {
      window.useFeatureFlag("aiChat");
    }
    const flagOn = (typeof window !== "undefined" && window.getFeatureFlag)
      ? window.getFeatureFlag("aiChat")
      : false;

    const [open, setOpen] = useState(() => {
      try { return window.localStorage.getItem(OPEN_KEY) === "1"; }
      catch (e) { return false; }
    });
    const [messages, setMessages] = useState(() => readStored());
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [unread, setUnread] = useState(false);
    const bodyRef = useRef(null);
    const inputRef = useRef(null);

    // Persist on change.
    useEffect(() => { writeStored(messages); }, [messages]);
    useEffect(() => {
      try { window.localStorage.setItem(OPEN_KEY, open ? "1" : "0"); }
      catch (e) {}
    }, [open]);

    // Auto-scroll on new messages.
    useEffect(() => {
      if (!bodyRef.current) return;
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [messages, busy]);

    // Focus input when opened.
    useEffect(() => {
      if (open && inputRef.current) inputRef.current.focus();
      if (open) setUnread(false);
    }, [open]);

    const send = useCallback(async (text) => {
      const trimmed = (text || "").trim();
      if (!trimmed || busy) return;
      const userMsg = { role: "user", content: trimmed, ts: Date.now() };
      const nextHistory = messages.concat([userMsg]);
      setMessages(nextHistory);
      setInput("");
      setBusy(true);
      const brief = buildBrief();
      const ctx = {
        session: (window.flexViewAsRole ? `Viewing as ${window.flexViewAsRole}` : "Admin"),
        page: document.title || "Dashboard",
      };
      const sys = systemPrompt(brief, ctx);
      try {
        const raw = await askClaude(sys, messages, trimmed);
        const { clean, actions } = parseActions(raw);
        const reply = {
          role: "assistant",
          content: clean || "Done.",
          actions,
          ts: Date.now(),
        };
        setMessages((cur) => cur.concat([reply]));
        if (!open) setUnread(true);
      } finally {
        setBusy(false);
      }
    }, [messages, busy, open]);

    const onKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send(input);
      }
    };

    const reset = () => {
      setMessages([]);
      writeStored([]);
      if (window.showToast) window.showToast("Chat cleared");
    };

    if (!flagOn) return null;

    return (
      <div className="aic-host" role="region" aria-label="AI assistant">
        {open && (
          <div className="aic-panel" role="dialog" aria-label="AI chat">
            <Header onReset={reset} onClose={() => setOpen(false)} />
            <div className="aic-body" ref={bodyRef}>
              {messages.length === 0 && (
                <Welcome onPick={(text) => send(text)} />
              )}
              {messages.map((m, i) => (
                <Message key={i} msg={m} onRun={runAction} />
              ))}
              {busy && (
                <div className="aic-msg-row aic-msg-row--agent">
                  <div className="aic-msg-bubble">
                    <span className="aic-typing"><span></span><span></span><span></span></span>
                  </div>
                </div>
              )}
            </div>
            <div className="aic-foot">
              <div className="aic-input-row">
                <textarea
                  ref={inputRef}
                  className="aic-input"
                  rows={1}
                  placeholder="Ask anything about your program…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="aic-send"
                  onClick={() => send(input)}
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                >
                  <Icon name="Send" size={16} />
                </button>
              </div>
              <div className="aic-foot-hint">
                <span>Grounded in live program data</span>
                <span><span className="aic-foot-kbd">Enter</span> to send · <span className="aic-foot-kbd">Shift+Enter</span> new line</span>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          className="aic-fab"
          aria-label={open ? "Close AI chat" : "Open AI chat"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <Icon name="X" size={22} /> : <SparkleSVG />}
          {!open && unread && <span className="aic-fab-dot" />}
        </button>
      </div>
    );
  }

  // ---- Sub-components ------------------------------------------------
  function Header({ onReset, onClose }) {
    return (
      <div className="aic-head">
        <div className="aic-head-avatar"><SparkleSVG /></div>
        <div className="aic-head-text">
          <div className="aic-head-title">
            Flex Work AI <span className="aic-head-live">live data</span>
          </div>
          <div className="aic-head-sub">Ask about requisitions, invoices, workers, spend</div>
        </div>
        <div className="aic-head-actions">
          <button type="button" className="aic-head-btn" onClick={onReset} aria-label="Clear chat" title="Clear chat">
            <Icon name="Refresh" size={14} />
          </button>
          <button type="button" className="aic-head-btn" onClick={onClose} aria-label="Close" title="Close">
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>
    );
  }

  function Welcome({ onPick }) {
    return (
      <div className="aic-welcome">
        <div className="aic-welcome-title">Hi Amy — how can I help?</div>
        <div className="aic-welcome-sub">I can answer questions about your program and run common actions. Try one of these or type your own:</div>
        <div className="aic-sugg-grid">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} type="button" className="aic-sugg" onClick={() => onPick(s.text)}>
              <span className="aic-sugg-icon"><Icon name={s.icon} size={13} /></span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function Message({ msg, onRun }) {
    const isUser = msg.role === "user";
    return (
      <div className={`aic-msg-row aic-msg-row--${isUser ? "user" : "agent"}`}>
        <div className="aic-msg-bubble">
          <FormattedText text={msg.content} />
          {!isUser && msg.actions && msg.actions.length > 0 && (
            <div className="aic-actions">
              {msg.actions.map((a, i) => (
                <button key={i} type="button" className="aic-action" onClick={() => onRun(a)}>
                  <Icon name={actionChipIcon(a)} size={12} />
                  <span>{actionChipLabel(a)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render plain text with minimal markdown — **bold** + line breaks +
  // bullet lines starting with "- " or "• ".
  function FormattedText({ text }) {
    if (!text) return null;
    const lines = String(text).split(/\r?\n/);
    return (
      <>
        {lines.map((ln, i) => {
          const trimmed = ln.replace(/^\s+/, "");
          const isBullet = /^[-•*]\s+/.test(trimmed);
          const content = trimmed.replace(/^[-•*]\s+/, "");
          const parts = content.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
            if (p.startsWith("**") && p.endsWith("**")) {
              return <strong key={j}>{p.slice(2, -2)}</strong>;
            }
            return <span key={j}>{p}</span>;
          });
          if (isBullet) {
            return <div key={i} style={{ paddingLeft: 14, position: "relative" }}>
              <span style={{ position: "absolute", left: 2 }}>•</span>{parts}
            </div>;
          }
          return <div key={i}>{parts.length ? parts : <>&nbsp;</>}</div>;
        })}
      </>
    );
  }

  // Inline sparkle icon (used in the FAB + header avatar). The Everest
  // icon kit doesn't ship a sparkle, so we hand-roll this one as SVG.
  function SparkleSVG() {
    return (
      <span className="aic-fab-spark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5l1.95 5.05L19 9.5l-5.05 1.95L12 16.5l-1.95-5.05L5 9.5l5.05-1.95L12 2.5z"/>
          <path d="M18.5 14l.9 2.35L21.75 17l-2.35.9-.9 2.35-.9-2.35L15.25 17l2.35-.65.9-2.35z" opacity="0.7"/>
          <path d="M5.5 16l.65 1.7L7.85 18.4l-1.7.65-.65 1.7-.65-1.7-1.7-.65 1.7-.7L5.5 16z" opacity="0.55"/>
        </svg>
      </span>
    );
  }

  // Expose the host so app.jsx can mount it.
  window.AIChatHost = AIChatHost;
})();
