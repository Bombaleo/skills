// =====================================================================
// Flex Work — Assignment engine (shared spine)
//
// One small support module that the assign-worker panel and the
// Project / SOW / worker-mobile surfaces all read. It is the
// "minimal new architecture" called for in the parity doc: a single
// lib, not a route page, that turns the shift-shaped picker into a
// type-aware assignment spine.
//
// It owns, reusing objects that already exist wherever possible:
//   · modeFor(engType)        — allocate | submit | propose
//   · supplier-type compat    — reuse worker.pool / V77 axes
//   · credential pre-check    — reuse getCredentialingForWorker()
//   · availability guard      — reuse getBookingAssignments() + a
//                               deterministic synthetic schedule
//   · ContingentEngagement    — the v1.6 object, persisted to
//                               flexwork.assignments.{orgId}
//   · work-order + onboarding — the Fieldglass lifecycle as a status
//                               machine on the same record
//   · shift offers            — buyer→worker offer/accept loop for
//                               worker-mobile
//
// Exposed as window.AssignmentEngine. Pure data + logic; no React.
// =====================================================================

(function () {
  "use strict";

  // ---- storage ------------------------------------------------------
  function _orgId() {
    return (window.getCurrentIndustryId && window.getCurrentIndustryId()) || "manufacturing";
  }
  function _read(prefix) {
    try {
      const raw = window.localStorage.getItem(prefix + _orgId());
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function _write(prefix, val) {
    try { window.localStorage.setItem(prefix + _orgId(), JSON.stringify(val)); }
    catch (e) { /* no-op */ }
  }
  const REC_KEY = "flexwork.assignments.";
  const OFFER_KEY = "flexwork.shiftOffers.";

  function _emit() {
    try { window.dispatchEvent(new CustomEvent("flexwork:assignments:change")); }
    catch (e) { /* no-op */ }
  }
  function subscribe(cb) {
    const h = () => cb();
    window.addEventListener("flexwork:assignments:change", h);
    return () => window.removeEventListener("flexwork:assignments:change", h);
  }

  function _hash(s) {
    let h = 0;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h >>> 0;
  }
  function _uid(p) {
    return (p || "AS") + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4).toString(36);
  }
  function _now() { return new Date().toISOString().slice(0, 16).replace("T", " "); }

  // ---- mode per engagement type -------------------------------------
  // allocate → instant placement (Shift)
  // submit   → candidate submission → work order → onboarding (Assignment)
  // propose  → defer to the team-proposal flow (Project / SOW)
  function modeFor(engType) {
    switch (engType) {
      case "Assignment":        return "submit";
      case "Project":           return "propose";
      case "Statement of Work": return "propose";
      case "Shift":
      default:                  return "allocate";
    }
  }

  // ---- supplier-type compatibility (v0.77 Phase 4) ------------------
  // Resolve a worker's supplier type from its pool/flags, and a row's
  // expected supplier type from cfg. "Agency" is the default both sides.
  function workerSupplierType(worker) {
    if (!worker) return "Agency";
    const explicit = worker.supplierType || worker.workerType;
    if (explicit) {
      const e = String(explicit).toLowerCase();
      if (e.includes("eor")) return "EOR";
      if (e.includes("ic") || e.includes("contractor") || e.includes("independent")) return "IC";
      if (e.includes("agency")) return "Agency";
    }
    const pool = String(worker.pool || "").toLowerCase();
    if (pool === "contractor") return "IC";
    if (pool === "eor") return "EOR";
    return "Agency";
  }
  function rowSupplierType(cfg) {
    const s = (cfg && (cfg.supplierType || cfg.workerType)) || "Agency";
    const e = String(s).toLowerCase();
    if (e.includes("eor")) return "EOR";
    if (e.includes("ic") || e.includes("contractor")) return "IC";
    return "Agency";
  }
  function isCompatible(worker, cfg) {
    return workerSupplierType(worker) === rowSupplierType(cfg);
  }

  // ---- credential pre-check (reuse getCredentialingForWorker) -------
  // Returns { level: ok|warn|fail, blockers:[], expiring:[], label }.
  function credentialSummary(worker) {
    let rec = null;
    if (typeof window.getCredentialingForWorker === "function") {
      try { rec = window.getCredentialingForWorker(worker); } catch (e) { rec = null; }
    }
    if (!rec || !rec.worker || !rec.pack) {
      return { level: "ok", blockers: [], expiring: [], label: "Cleared" };
    }
    const creds = rec.worker.creds || {};
    const blockers = [];
    const expiring = [];
    (rec.pack.catalog || []).forEach((cred) => {
      const c = creds[cred.code] || { s: "na" };
      if (c.s === "err" || c.s === "missing") blockers.push(cred.label);
      else if (c.s === "warn") expiring.push(cred.label);
    });
    const level = blockers.length ? "fail" : (expiring.length ? "warn" : "ok");
    const label = blockers.length
      ? `${blockers.length} blocking`
      : (expiring.length ? `${expiring.length} expiring` : "Cleared");
    return { level, blockers, expiring, label };
  }

  // ---- availability / double-booking guard --------------------------
  // Hard conflict: the worker is already assigned to the same booking
  // (reads getBookingAssignments). Soft conflict: a deterministic
  // synthetic "already on another shift today" so the demo always
  // shows the guard working.
  function availabilityFor(worker, cfg) {
    if (!worker) return { conflict: false, level: "ok", label: "Available" };
    // Hard: same booking already holds this worker on another slot.
    if (cfg && cfg.bookingId && typeof window.getBookingAssignments === "function") {
      try {
        const a = window.getBookingAssignments(cfg.bookingId) || {};
        const taken = Object.keys(a).some(
          (k) => a[k] === worker.id && String(k) !== String(cfg.idx)
        );
        if (taken) return { conflict: true, level: "fail", label: "On this booking" };
      } catch (e) { /* fall through */ }
    }
    // Soft: deterministic clash for ~18% of workers on the named day.
    const h = _hash((worker.id || worker.name) + "|" + (cfg && cfg.day || ""));
    if ((h % 100) < 18) {
      return { conflict: true, level: "warn", label: "Booked elsewhere" };
    }
    return { conflict: false, level: "ok", label: "Available" };
  }

  // ---- onboarding activity items (Fieldglass activity items) --------
  // Reuse the lifecycle onboarding catalog when present; else a sane
  // default. Returns [{id,label,required}].
  function onboardingItemsFor(engType) {
    let tasks = null;
    if (typeof window.getOnboardingTasks === "function") {
      const kind = engType === "Shift" ? "frontline" : "professional";
      try { tasks = window.getOnboardingTasks(kind); } catch (e) { tasks = null; }
    }
    if (tasks && tasks.length) {
      return tasks.slice(0, 6).map((t, i) => ({
        id: t.id || ("ob" + i),
        label: t.label || t.name || t.title || ("Step " + (i + 1)),
        required: t.required !== false,
      }));
    }
    return [
      { id: "bgc",     label: "Background check",        required: true },
      { id: "docs",    label: "Signed assignment docs",  required: true },
      { id: "access",  label: "System / building access", required: true },
      { id: "orient",  label: "Orientation complete",    required: false },
    ];
  }

  // ---- lifecycle ----------------------------------------------------
  // Status order for an Assignment / SOW resource:
  //   submitted → wo_pending → wo_accepted → onboarding → active
  // plus the terminal "rejected".
  const LIFECYCLE = [
    { id: "submitted",   label: "Candidate submitted" },
    { id: "wo_pending",  label: "Work order issued" },
    { id: "wo_accepted", label: "Supplier accepted" },
    { id: "onboarding",  label: "Onboarding" },
    { id: "active",      label: "Active" },
  ];
  function lifecycle() { return LIFECYCLE.slice(); }
  function statusIndex(id) {
    const i = LIFECYCLE.findIndex((s) => s.id === id);
    return i === -1 ? 0 : i;
  }
  function statusLabel(id) {
    if (id === "rejected") return "Rejected";
    const s = LIFECYCLE.find((x) => x.id === id);
    return s ? s.label : id;
  }
  function nextStatus(id) {
    const i = statusIndex(id);
    return i < LIFECYCLE.length - 1 ? LIFECYCLE[i + 1].id : null;
  }

  // ---- engagement / assignment records ------------------------------
  function getRecords() { return _read(REC_KEY); }
  function recordsForReq(cfg) {
    const sup = cfg && cfg.supplierId;
    const role = cfg && cfg.role;
    const ctx = cfg && (cfg.reqId || cfg.bookingId || cfg.projectId || cfg.sowId);
    return getRecords().filter((r) => {
      if (ctx && r.ctx) return r.ctx === ctx;
      return r.supplierId === sup && r.role === role;
    });
  }
  // Create a record. status defaults per mode: allocate → active,
  // submit/propose → submitted.
  function createRecord(rec) {
    const engType = rec.engagementType || "Shift";
    const mode = modeFor(engType);
    const status = rec.status || (mode === "allocate" ? "active" : "submitted");
    const out = {
      id: _uid("ENG"),
      createdAt: _now(),
      engagementType: engType,
      role: rec.role || "",
      supplierId: rec.supplierId || "",
      supplierLabel: rec.supplierLabel || "",
      workerId: rec.workerId || "",
      workerName: rec.workerName || "",
      positionId: rec.positionId || rec.idx || null,
      ctx: rec.ctx || rec.reqId || rec.bookingId || rec.projectId || rec.sowId || null,
      billRate: rec.billRate || null,
      proposedRate: rec.proposedRate || null,
      exception: rec.exception || null,
      status,
      onboarding: onboardingItemsFor(engType).map((t) => ({ ...t, done: false })),
      audit: [{ at: _now(), by: rec.by || "Agency", action: "Created", detail: statusLabel(status) }],
    };
    const all = getRecords();
    all.unshift(out);
    _write(REC_KEY, all);
    _emit();
    return out;
  }
  function updateRecord(id, patch, auditEntry) {
    const all = getRecords();
    const i = all.findIndex((r) => r.id === id);
    if (i === -1) return null;
    all[i] = { ...all[i], ...patch };
    if (auditEntry) all[i].audit = [...(all[i].audit || []), { at: _now(), ...auditEntry }];
    _write(REC_KEY, all);
    _emit();
    return all[i];
  }
  function advance(id, by) {
    const all = getRecords();
    const r = all.find((x) => x.id === id);
    if (!r) return null;
    const next = nextStatus(r.status);
    if (!next) return r;
    return updateRecord(id, { status: next }, { by: by || "System", action: "Advanced", detail: statusLabel(next) });
  }
  function setStatus(id, status, by, note) {
    return updateRecord(id, { status }, { by: by || "System", action: "Status", detail: statusLabel(status) + (note ? " · " + note : "") });
  }
  function reject(id, reason, by) {
    return updateRecord(id, { status: "rejected", rejectReason: reason },
      { by: by || "Manager", action: "Rejected", detail: reason || "" });
  }
  function toggleOnboarding(id, itemId, by) {
    const all = getRecords();
    const r = all.find((x) => x.id === id);
    if (!r) return null;
    const ob = (r.onboarding || []).map((t) => t.id === itemId ? { ...t, done: !t.done } : t);
    const allRequiredDone = ob.filter((t) => t.required).every((t) => t.done);
    return updateRecord(id, { onboarding: ob },
      { by: by || "Manager", action: "Onboarding", detail: (allRequiredDone ? "All required items cleared" : "Item toggled") });
  }
  function onboardingComplete(rec) {
    return (rec.onboarding || []).filter((t) => t.required).every((t) => t.done);
  }

  // ---- shift offers (buyer → worker accept loop) --------------------
  function getOffers() { return _read(OFFER_KEY); }
  function createOffer(o) {
    const out = {
      id: _uid("OFR"),
      createdAt: _now(),
      workerId: o.workerId || "",
      workerName: o.workerName || "",
      role: o.role || "",
      supplierId: o.supplierId || "",
      bookingId: o.bookingId || null,
      idx: o.idx != null ? o.idx : null,
      day: o.day || "",
      when: o.when || "",
      status: "pending",
    };
    const all = getOffers();
    all.unshift(out);
    _write(OFFER_KEY, all);
    _emit();
    return out;
  }
  function pendingOffersForWorker(workerId) {
    return getOffers().filter((o) => o.status === "pending" && (!workerId || o.workerId === workerId));
  }
  function respondOffer(id, accepted) {
    const all = getOffers();
    const i = all.findIndex((o) => o.id === id);
    if (i === -1) return null;
    all[i] = { ...all[i], status: accepted ? "accepted" : "declined", respondedAt: _now() };
    _write(OFFER_KEY, all);
    _emit();
    return all[i];
  }

  // ---- labels per mode + role --------------------------------------
  function labelsFor(engType, role) {
    const isAgency = role === "agency";
    const mode = modeFor(engType);
    if (mode === "submit") {
      return {
        title: isAgency ? "Submit candidate" : "Request candidate",
        primary: isAgency ? "Submit candidate" : "Request candidate",
        hint: "Submitting starts a work order the buyer reviews, then onboarding before the worker goes active.",
      };
    }
    if (mode === "propose") {
      return {
        title: isAgency ? "Add resource" : "Request resource",
        primary: isAgency ? "Add to team" : "Request",
        hint: "Resources join the engagement team and onboard against the contract before they go active.",
      };
    }
    return {
      title: isAgency ? "Assign worker" : "Request worker",
      primary: isAgency ? "Assign" : "Request",
      hint: isAgency
        ? "Assigning notifies the worker and updates the roster instantly."
        : "Requests are sent to the supplier; you'll be notified when accepted.",
    };
  }

  window.AssignmentEngine = {
    subscribe,
    modeFor, labelsFor,
    workerSupplierType, rowSupplierType, isCompatible,
    credentialSummary, availabilityFor,
    onboardingItemsFor, lifecycle, statusIndex, statusLabel, nextStatus,
    getRecords, recordsForReq, createRecord, updateRecord,
    advance, setStatus, reject, toggleOnboarding, onboardingComplete,
    getOffers, createOffer, pendingOffersForWorker, respondOffer,
  };
})();
