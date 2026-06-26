// =====================================================================
// Flex Work — Unified Requisition / Engagement detail · router
// ---------------------------------------------------------------------
// Single entry point for every requisition / engagement detail page.
// Picks a "variant body" based on the row's sourcing channel; routes
// every id through one canonical URL space (/requisitions/:id).
//
// Architecture (matches unified-req-detail.html spec, v0.4+):
//
//   ┌─────────────────────────────────────────────────────────────┐
//   │  RequisitionEngagementDetail (this file)                    │
//   │    1. derive sourcingChannel from row / id-prefix           │
//   │    2. look up VariantRegistry by channel                    │
//   │    3. render the variant's <body> component                 │
//   └─────────────────────────────────────────────────────────────┘
//
// The router itself contains zero variant logic. Each variant
// (Professional, Contractor, SOW) registers a manifest against the
// VariantRegistry ONLY when its feature flag is on — when the flag is
// off, the variant module never registers, the channel never resolves,
// and the router falls through to FrontlineBody.
//
// CRITICAL CONTRACT — all flags off:
//   · No variant manifest is registered.
//   · Every channel resolves to the Frontline default.
//   · FrontlineBody === window.RequisitionDetailsPage (existing file,
//     byte-for-byte unchanged after delegate removal).
//   · No variant fixture is read, no variant chunk is loaded.
//   · index.html ships identical behavior to the pre-unification build.
//
// Adding a new worker type (e.g. EOR) = one manifest + one flag entry.
// The shell, Frontline, and the other registered variants stay
// untouched. See the §11 isolation contract in unified-req-detail.html.
// =====================================================================

const { useState: useStateRED, useEffect: useEffectRED, useMemo: useMemoRED } = React;

// ---------------------------------------------------------------------
// VariantRegistry — the runtime contract every surface reads from.
//
// Public API (window.VariantRegistry):
//   · register(manifest)              — variants call at module-eval
//                                       time, gated by their flag.
//   · get(channel)                    → manifest | null
//   · getById(id)                     → manifest | null   (id-prefix routing)
//   · list()                          → manifest[]        (enabled variants only)
//   · enabledTypes()                  → number            (incl. Frontline)
//
// Manifest shape (only what the router needs today; extends per spec):
//   {
//     id:        "professional" | "contractor" | "sow" | "eor",
//     label:     "Professional",
//     flag:      "professionalWork",
//     channels:  ["SOW"],                   // sourcingChannel values
//     idPrefix:  ["PRO-"],                  // id-routing fallback
//     chipClass: "rdu-chip--professional",
//     dotClass:  "rdu-mock-bar-dot--blue",
//     body:      <ReactComponent>,          // takes { id, onBack }
//   }
//
// Variants self-register exactly once. The base build ships with the
// Frontline manifest pre-seeded; other variants only land when their
// flag is on.
// ---------------------------------------------------------------------

const __VARIANT_REGISTRY__ = {
  byId: {},
  byChannel: {},
};

function variantRegister(manifest) {
  if (!manifest || !manifest.id) return;
  if (__VARIANT_REGISTRY__.byId[manifest.id]) return; // idempotent
  __VARIANT_REGISTRY__.byId[manifest.id] = manifest;
  for (const ch of (manifest.channels || [])) {
    __VARIANT_REGISTRY__.byChannel[ch] = manifest;
  }
}

function _variantFlagOn(m) {
  if (!m) return false;
  if (!m.flag) return true;
  return !!(window.getFeatureFlag && window.getFeatureFlag(m.flag));
}

function variantGet(channel) {
  const m = __VARIANT_REGISTRY__.byChannel[channel] || null;
  // Filter by current flag state so flipping a flag off collapses the
  // variant out of the registry's effective view even though the
  // manifest itself stays registered (idempotent). This is what makes
  // "all flags off" identity hold even after a session of toggling.
  return _variantFlagOn(m) ? m : null;
}

function variantGetById(id) {
  if (typeof id !== "string") return null;
  for (const m of Object.values(__VARIANT_REGISTRY__.byId)) {
    if (!_variantFlagOn(m)) continue;
    if ((m.idPrefix || []).some((p) => id.startsWith(p))) return m;
  }
  return null;
}

function variantList() {
  // Frontline is always implicitly registered; treat it as included.
  // Only return manifests whose flag is currently on, so a flag flipped
  // off mid-session collapses the registry the same way a fresh load
  // with that flag off would.
  return Object.values(__VARIANT_REGISTRY__.byId).filter(_variantFlagOn);
}

function variantEnabledTypes() {
  // 1 (Frontline always-on) + N registered variants
  return 1 + variantList().length;
}

// ---------------------------------------------------------------------
// Channel inference — derive sourcingChannel from a row or, failing that,
// from the id prefix. The Frontline REQUISITIONS fixture does not carry
// a `sourcingChannel` field today (see unified-req-detail.html §07 — to
// be added per Dayforce alignment), so we infer it deterministically
// from the row id. Net effect: at flags-off every Frontline id resolves
// to "Agency", which is the FrontlineBody default.
// ---------------------------------------------------------------------

function inferSourcingChannel(id, row) {
  if (row && row.sourcingChannel) return row.sourcingChannel;
  if (typeof id !== "string") return "Agency";
  if (id.startsWith("PRJ-"))   return "Project";          // Project engagement
  if (id.startsWith("PRO-"))   return "SOW";            // Professional
  if (id.startsWith("CTR-"))   return "Direct";         // Contractor (canonical)
  if (id.startsWith("c-"))     return "Direct";         // Contractor (current fixture id space)
  if (id.startsWith("SOW-"))   return "SOW-milestone";  // SOW agreement
  if (id.startsWith("EOR-"))   return "EOR";            // EOR engagement (future variant)
  return "Agency";                                       // Frontline default
}

// ---------------------------------------------------------------------
// Router — the entry point app.jsx mounts in place of every detail page.
//
// Renders nothing of its own chrome; the variant body owns the omnibar
// and page chrome. This keeps the all-flags-off render byte-identical
// to today's RequisitionDetailsPage output.
// ---------------------------------------------------------------------

function RequisitionEngagementDetail({ requisitionId, onBack }) {
  // Re-render when feature flags flip live so the router picks up newly
  // registered variants without a full page reload.
  const proOn = window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false;
  const ctrOn = window.useFeatureFlag ? window.useFeatureFlag("contractors")      : false;
  const sowOn = window.useFeatureFlag ? window.useFeatureFlag("sow")              : false;

  // ----- Cross-store row lookup --------------------------------------
  // Promoted from a local memo to the exported useRequisitionRow hook
  // (see below) so other surfaces (list pages, dashboard tiles, audit
  // accordion) can resolve a row by id through the same dispatcher.
  const row = useRequisitionRow(requisitionId);

  // Resolve the variant. Order:
  //   (a) channel from row → registry.byChannel
  //   (b) id prefix → registry.byId  (covers direct-load before row read)
  //   (c) fall through → Frontline
  const channel = inferSourcingChannel(requisitionId, row);
  const manifest = variantGet(channel) || variantGetById(requisitionId);

  // ----- Tenant-role gate --------------------------------------------
  // Per §10 of unified-req-detail.html, a Staffwise (agency-org) tenant
  // must see only manifests whose `agencyOrgVisibility` permits it.
  // The Contractor variant declares `hidden` for agency tenants because
  // direct engagements have no vendor seat; the router enforces that
  // here, falling through to Frontline (which itself filters by agency
  // supplier id in its existing data path).
  const isAgency = !!(window.isAgencyOrg && window.isAgencyOrg());
  const blockedByAgency = manifest && isAgency && manifest.agencyOrgVisibility === "hidden";

  // Variant-only KPI strip + chip row data — used both for the Frontline
  // strip injection (when enabledTypes > 1) and the variant bodies that
  // render their own hero.
  const enabled = variantEnabledTypes();

  // ---------- FRONTLINE PATH ----------------------------------------
  // Default. No variant manifest matched (or no flag is on for that
  // channel). Render today's RequisitionDetailsPage byte-for-byte —
  // this is the all-flags-off ship.
  if (!manifest || blockedByAgency) {
    const Frontline = window.RequisitionDetailsPage;
    if (!Frontline) {
      // Defensive: if the Frontline body somehow hasn't loaded, render
      // nothing rather than throwing.
      return null;
    }
    // Per Decision 03 — when more than one engagement type is enabled,
    // surface a slim type strip above the Frontline body so the user
    // never wonders which kind of row they're looking at. When only
    // Frontline is on, this returns null and the body renders byte-
    // identical to the pre-unification ship.
    //
    return (
      <React.Fragment>
        {enabled > 1 && window.AxisChipRow ? <window.AxisChipRow row={row} requisitionId={requisitionId} /> : null}
        {enabled > 1 ? <VariantTypeStrip channel="Agency" label="Frontline" /> : null}
        <Frontline requisitionId={requisitionId} onBack={onBack} />
      </React.Fragment>
    );
  }

  // ---------- VARIANT PATH ------------------------------------------
  // A variant manifest matched. Render its body, passing the same props
  // the legacy detail page takes so existing pages plug in unchanged.
  const Body = manifest.body;
  if (!Body) {
    // Manifest registered without a body (shouldn't happen). Fall back.
    const Frontline = window.RequisitionDetailsPage;
    return Frontline ? <Frontline requisitionId={requisitionId} onBack={onBack} /> : null;
  }
  return (
    <React.Fragment>
      {window.AxisChipRow ? <window.AxisChipRow row={row} requisitionId={requisitionId} /> : null}
      <Body requisitionId={requisitionId} onBack={onBack} row={row} manifest={manifest} />
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------
// useRequisitionRow — the cross-store dispatcher hook.
//
// Spec §11 calls this out as the shared lookup contract. The hook
// inspects the registered variants in priority order and returns the
// first matching row (with `__store` tag so callers know which fixture
// they hit). Frontline (REQUISITIONS) is always queried first because
// it's the always-on default and skipping the variant tables when the
// id doesn't need them is what makes the flag-off path zero-cost.
// ---------------------------------------------------------------------

function useRequisitionRow(id) {
  // Re-render whenever a flag flips so the variant stores become
  // available without a manual reload.
  const proOn = window.useFeatureFlag ? window.useFeatureFlag("professionalWork") : false;
  const ctrOn = window.useFeatureFlag ? window.useFeatureFlag("contractors")      : false;
  const sowOn = window.useFeatureFlag ? window.useFeatureFlag("sow")              : false;
  return useMemoRED(() => {
    if (!id) return null;
    // Frontline first — the all-flags-off path stops here.
    const fl = (window.REQUISITIONS || []).find((r) => r.id === id);
    if (fl) return { ...fl, sourcingChannel: fl.sourcingChannel || "Agency", __store: "frontline" };
    // Variant stores — only iterated when the flag is on, because the
    // variant manifest is only registered behind its flag.
    for (const m of variantList()) {
      if (m.lookupRow) {
        const r = m.lookupRow(id);
        if (r) return { ...r, sourcingChannel: (m.channels && m.channels[0]) || null, __store: m.id };
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, proOn, ctrOn, sowOn]);
}

// ---------------------------------------------------------------------
// VariantTypeStrip — the Decision-03 chip strip the router injects
// above the Frontline body when more than one engagement type is
// enabled on the tenant. Hidden entirely when count === 1, which is
// the all-flags-off byte-identical default.
// ---------------------------------------------------------------------

function VariantTypeStrip({ channel, label, supplier }) {
  const chipClass = ({
    Agency:          "rdu-chip--frontline",
    SOW:             "rdu-chip--professional",
    Direct:          "rdu-chip--contractor",
    "SOW-milestone": "rdu-chip--sow",
    EOR:             "rdu-chip--eor",
  })[channel] || "rdu-chip--frontline";
  return (
    <div className="rdu-type-strip" role="presentation">
      <span className="rdu-type-strip-lbl">Engagement type</span>
      <span className={`rdu-chip ${chipClass}`}>{label}</span>
      <span className="rdu-chip rdu-chip--channel">
        {channel === "Agency" ? "Agency · supplier-distributed" :
         channel === "SOW" ? "SOW · supplier-sourced" :
         channel === "Direct" ? "Direct · no supplier" :
         channel === "SOW-milestone" ? "SOW · milestone-billed" :
         channel}
        {supplier ? ` · ${supplier}` : ""}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Wire-up — register the three variant manifests behind their flags.
//
// CRITICAL: these `if (getFeatureFlag(...))` checks run once at module
// load. The Frontline ship does NOT register any variant; the registry
// stays empty; every channel falls through to FrontlineBody.
//
// When a tenant flips a flag on at runtime, we re-register inside a
// small mount effect (below) so the page picks up the new variant
// without a full reload. The opposite — flipping off — is handled by
// the registry's idempotent `register()` and the `enabledTypes()` count
// reaching back to 1, which collapses the chip row in the chrome.
// ---------------------------------------------------------------------

function maybeRegisterVariants() {
  const flag = window.getFeatureFlag || (() => false);

  // Professional — wraps the existing ProfessionalRequisitionDetailsPage.
  if (flag("professionalWork") && window.ProfessionalRequisitionDetailsPage) {
    variantRegister({
      id:        "professional",
      label:     "Professional",
      flag:      "professionalWork",
      channels:  ["SOW"],
      idPrefix:  ["PRO-"],
      chipClass: "rdu-chip--professional",
      dotClass:  "rdu-mock-bar-dot--blue",
      // §10 — agency tenants (Staffwise) see the vendor-side body; the
      // future tenantRole branch in ProfessionalBody inverts the
      // pipeline + approvals. Default tenant is "buyer".
      tenantRole:           "buyer",
      agencyOrgVisibility:  "vendor-side",
      // Declarative manifest entries — listed for documentation /
      // shell-extraction. The current body still renders its own hero,
      // so these are read by the registry but not yet consumed by a
      // generic shell. Phase 1 of the spec (DetailShell) will route
      // these into the omnibar + hero + accordion grid.
      chips:    [{ kind: "type",    text: "Professional" }, { kind: "channel", text: "SOW · supplier-sourced" }],
      meta:     ["Hiring manager", "Labor metric", "Cadence", "Term", "Timesheet mode", "Opened"],
      accordions: ["Engagement", "Pipeline", "Interviews", "Contract terms", "SOW preview", "Timesheet", "Approvals", "Audit"],
      art:      "annualized",
      menu:     [{ icon: "PersonPlus", label: "Add candidate" }, { icon: "Performance", label: "View pipeline" }],
      audit:    { scope: "professional" },
      body:      function ProfessionalBodyAdapter({ requisitionId, onBack }) {
        const Body = window.ProfessionalRequisitionDetailsPage;
        return Body ? <Body requisitionId={requisitionId} onBack={onBack} /> : null;
      },
      lookupRow: (id) => {
        const arr = window.PROFESSIONAL_REQUISITIONS_RAW || window.PROFESSIONAL_REQUISITIONS || [];
        return arr.find((r) => r.id === id) || null;
      },
    });
  }

  // Contractor — wraps a thin engagement-detail body built from the
  // existing ContractorDetailSections. Replaces the bounce-to-Workforce.
  if (flag("contractors") && window.ContractorEngagementBody) {
    variantRegister({
      id:        "contractor",
      label:     "Contractor",
      flag:      "contractors",
      channels:  ["Direct"],
      idPrefix:  ["CTR-", "c-"],
      chipClass: "rdu-chip--contractor",
      dotClass:  "rdu-mock-bar-dot--purple",
      // §10 — Contractor engagements are direct, no supplier sits
      // between worker and buyer. An agency-org tenant has no role in a
      // Contractor engagement, so the variant is hidden on those
      // tenants — the router falls through to FrontlineBody for them.
      tenantRole:           "buyer",
      agencyOrgVisibility:  "hidden",
      chips:    [{ kind: "type", text: "Contractor" }, { kind: "channel", text: "Direct · no supplier" }],
      meta:     ["Owner", "Labor metric", "Rate", "Term", "Classification", "Tax form"],
      accordions: ["Engagement", "Identity", "Classification", "Agreement", "Tax & banking", "Documents", "Invoices", "Audit"],
      art:      "risk",
      menu:     [{ icon: "PersonAuthorize", label: "Re-run classification" }, { icon: "FileDownload", label: "Request updated W-9" }],
      audit:    { scope: "contractor" },
      body:      window.ContractorEngagementBody,
      lookupRow: (id) => {
        // Per spec §07, fixture is CONTRACTOR_ENGAGEMENTS keyed on
        // engagement id. Prototype today: contractor worker IS the
        // engagement, so we read from getContractorById.
        if (window.getContractorById) return window.getContractorById(id) || null;
        const arr = window.CONTRACTOR_ENGAGEMENTS || [];
        return arr.find((r) => r.id === id) || null;
      },
    });
  }

  // SOW — wraps the SOW agreement body. Today's SOW detail lives under
  // Suppliers → contract; the unified router lets it be reached via
  // /requisitions/:id as well (308 alias from /sows/:id per Decision 01).
  if (flag("sow") && window.SowEngagementBody) {
    variantRegister({
      id:        "sow",
      label:     "SOW",
      flag:      "sow",
      channels:  ["SOW-milestone"],
      idPrefix:  ["SOW-"],
      chipClass: "rdu-chip--sow",
      dotClass:  "rdu-mock-bar-dot--teal",
      // §10 — SOW agreements appear for agency-org tenants too. The
      // body inverts (Burn = what Staffwise invoiced, etc.) via its
      // own tenantRole check.
      tenantRole:           "buyer",
      agencyOrgVisibility:  "vendor-side",
      chips:    [{ kind: "type", text: "SOW" }, { kind: "channel", text: "Supplier · MSA" }],
      meta:     ["Supplier", "Total value", "Billed to date", "Term", "Owner", "Engagement model"],
      accordions: ["Agreement", "Burn & budget", "Resources", "Milestones", "Deliverables", "Change orders", "Invoices", "Audit"],
      art:      "burn",
      menu:     [{ icon: "Check", label: "Approve next milestone" }, { icon: "Edit", label: "Raise change order" }],
      audit:    { scope: "sow" },
      body:      window.SowEngagementBody,
      lookupRow: (id) => {
        const sows = (window.getSOWs && window.getSOWs()) || window.SOW_AGREEMENTS_RAW || [];
        return sows.find((r) => r.id === id) || null;
      },
    });
  }

  // EOR — preview / plug-in pattern proof per spec §07. A fifth variant
  // landing behind a fifth flag, with zero edits to the four above —
  // demonstrates the registry pattern absorbs new worker types without
  // touching the existing bodies. Production EOR (local entity ·
  // in-country employment · global tax · FX lock) lands post Phase 5.
  if (flag("eor") && window.EorEngagementBody) {
    variantRegister({
      id:        "eor",
      label:     "EOR",
      flag:      "eor",
      channels:  ["EOR"],
      idPrefix:  ["EOR-"],
      chipClass: "rdu-chip--eor",
      dotClass:  "rdu-mock-bar-dot--yellow",
      // §10 — EOR is intrinsically vendor-mediated; agency-org tenants
      // can be the EOR partner of record, so vendor-side visibility.
      tenantRole:           "buyer",
      agencyOrgVisibility:  "vendor-side",
      chips:    [{ kind: "type", text: "EOR" }, { kind: "channel", text: "Cross-border · employer of record" }],
      meta:     ["EOR partner", "Local entity", "Country", "Bill currency", "Pay currency", "FX lock", "Term", "Owner"],
      accordions: ["Engagement", "Local entity", "In-country employment", "Global tax & SI", "Currency & FX", "Repatriation", "Audit"],
      art:      "bill-rate",
      menu:     [{ icon: "Globe", label: "Re-quote FX" }, { icon: "Pay", label: "Trigger local payroll" }],
      audit:    { scope: "eor" },
      // Preview-only: declare future-variant so future surfaces (e.g.
      // Dashboard EOR lane) can show a Preview badge.
      preview:   true,
      body:      window.EorEngagementBody,
      lookupRow: (id) => {
        // No EOR_ENGAGEMENTS fixture yet; the body synthesizes a
        // representative row from the id alone.
        return { id, sourcingChannel: "EOR" };
      },
    });
  }
}

// Run registration at script-eval time. The Frontline ship hits this
// once and registers nothing (all flags off → all branches no-op).
// Variants register exactly when their flag is on.
maybeRegisterVariants();

// Listen for live flag toggles (Feature Flags page dispatches
// `featureflags:change` per pages/feature-flags.jsx). Re-run
// registration so the router picks up newly-enabled variants on the
// next render — when a variant flips on at runtime its manifest lands
// in the registry without a page reload.
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("featureflags:change", () => maybeRegisterVariants());
}

// ---------------------------------------------------------------------
// Public surface — expose registry helpers + the router component so
// other pages (Workforce, Suppliers, list views) can read which
// variants are active without importing this file directly.
// ---------------------------------------------------------------------

Object.assign(window, {
  RequisitionEngagementDetail,
  VariantRegistry: {
    register:      variantRegister,
    get:           variantGet,
    getById:       variantGetById,
    list:          variantList,
    enabledTypes:  variantEnabledTypes,
  },
  inferSourcingChannel,
  useRequisitionRow,
  VariantTypeStrip,
});
