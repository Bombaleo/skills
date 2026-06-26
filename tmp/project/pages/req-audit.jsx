// =====================================================================
// Flex Work — Shared Audit module · the one Decision-05 exception
// ---------------------------------------------------------------------
// Per Decision 05 of unified-req-detail.html, every requisition /
// engagement variant writes audit entries through ONE shared schema.
// This is the single named exception to the §11 isolation contract —
// every other variant primitive (store, fetcher, edit schema) stays
// per-variant, but the audit log is intentionally converged so
// Compliance can scan a cross-variant timeline.
//
// Public API on window:
//   · AUDIT_ENTRIES                                    raw store
//   · writeAudit({ scope, target, action, ... })       append + dispatch
//   · readAudit(scope, target)                         array (newest first)
//   · useAuditLog(scope, target)                       React hook
//   · AuditAccordion({ scope, target, defaultOpen })   rendered component
//   · AuditEntryShape                                  the canonical shape
//
// Schema (AuditEntry):
//   {
//     id:       string            unique entry id
//     at:       ISO timestamp     when the change happened
//     actor:    string            who did it (display name)
//     action:   string            short verb phrase ("Updated rate")
//     target:   string            scoped id ("FW-12-0481", "PRO-K1L2M3")
//     scope:    string            "frontline" | "professional" | "contractor" | "sow"
//     before?:  any               optional old value
//     after?:   any               optional new value
//     source?:  string            optional "ui" | "import" | "api"
//   }
//
// The audit module is the only piece of variant-shared code permitted
// outside the shell (§11 + Decision 05). The ESLint cross-variant rule
// in the spec's §11 has a documented exception for `pages/audit/**` —
// this file is the prototype's flat equivalent.
// =====================================================================

const { useState: useAuditState, useEffect: useAuditEffect, useMemo: useAuditMemo } = React;

// ---------- Store -----------------------------------------------------
// In-memory array; the prototype doesn't persist audit entries across
// reloads. Seed with a few representative rows so the accordion renders
// non-empty under each variant.

const AUDIT_ENTRIES = [
  // Frontline — sample row keyed against a real REQUISITIONS id.
  { id: "ae-f-0001", at: "2026-05-19T09:14:00Z", actor: "Maya Patel",   action: "Approved bookings", target: "J6K7L8M9N0", scope: "frontline",    source: "ui" },
  { id: "ae-f-0002", at: "2026-05-19T07:42:00Z", actor: "System",       action: "Distribution rebalanced", target: "J6K7L8M9N0", scope: "frontline", source: "api" },
  // Professional
  { id: "ae-p-0001", at: "2026-05-18T15:30:00Z", actor: "Robin Chen",   action: "Moved candidate to Offer", target: "PRO-K1L2M3", scope: "professional", source: "ui" },
  { id: "ae-p-0002", at: "2026-05-17T11:05:00Z", actor: "Sasha Khan",   action: "Updated cadence rate",     target: "PRO-K1L2M3", scope: "professional", source: "ui", before: "$14,200/mo", after: "$14,800/mo" },
  // Contractor
  { id: "ae-c-0001", at: "2026-05-15T10:12:00Z", actor: "Sasha Khan",   action: "Cleared classification (IC)", target: "c-an", scope: "contractor", source: "ui" },
  { id: "ae-c-0002", at: "2026-05-14T08:00:00Z", actor: "System",       action: "W-9 received",             target: "c-an", scope: "contractor", source: "api" },
  // SOW
  { id: "ae-s-0001", at: "2026-05-19T13:21:00Z", actor: "Imani Ross",   action: "Accepted milestone M-04",  target: "SOW-2026-018", scope: "sow", source: "ui" },
  { id: "ae-s-0002", at: "2026-05-12T16:48:00Z", actor: "Imani Ross",   action: "Approved change order +$24k", target: "SOW-2026-018", scope: "sow", source: "ui" },
];

// Counter for new ids (sequence-only — IDs are not persisted).
let __auditSeq = 100;
function _auditId(scope) { __auditSeq += 1; return `ae-${(scope || "x")[0]}-${__auditSeq}`; }

// ---------- Public functions -----------------------------------------

function writeAudit(entry) {
  if (!entry || !entry.target || !entry.scope) return null;
  const full = {
    id:     entry.id || _auditId(entry.scope),
    at:     entry.at || new Date().toISOString(),
    actor:  entry.actor  || "You",
    action: entry.action || "Updated",
    target: entry.target,
    scope:  entry.scope,
    source: entry.source || "ui",
    before: entry.before,
    after:  entry.after,
  };
  AUDIT_ENTRIES.unshift(full); // newest first
  try {
    window.dispatchEvent(new CustomEvent("audit:write", { detail: full }));
  } catch (e) { /* no-op */ }
  return full;
}

function readAudit(scope, target) {
  // Newest-first; scope optional (cross-variant timeline when omitted).
  let rows = AUDIT_ENTRIES.slice();
  if (scope)  rows = rows.filter((r) => r.scope === scope);
  if (target) rows = rows.filter((r) => r.target === target);
  return rows;
}

function useAuditLog(scope, target) {
  const [tick, setTick] = useAuditState(0);
  useAuditEffect(() => {
    function onWrite(e) {
      const d = e.detail;
      if (!d) return;
      if (target && d.target !== target) return;
      if (scope && d.scope !== scope)    return;
      setTick((t) => t + 1);
    }
    window.addEventListener("audit:write", onWrite);
    return () => window.removeEventListener("audit:write", onWrite);
  }, [scope, target]);
  // useMemo on tick guarantees a fresh array reference whenever a new
  // entry lands so consumers re-render predictably.
  return useAuditMemo(() => readAudit(scope, target), [scope, target, tick]);
}

// ---------- Rendering ------------------------------------------------

function _auditFormatWhen(iso) {
  // Compact relative-style stamp for the prototype: "May 19 · 09:14".
  try {
    const d = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = String(d.getDate());
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${month} ${day} · ${hh}:${mm}`;
  } catch (e) { return iso; }
}

function AuditAccordion({ scope, target, defaultOpen }) {
  const entries = useAuditLog(scope, target);
  // Collapsed by default everywhere — ignore `defaultOpen` so the audit
  // section starts closed like every other accordion.
  const [open, setOpen] = useAuditState(false);
  const count = entries.length;

  return (
    <div className="rdu-audit" role="region" aria-label="Audit log">
      <button
        type="button"
        className="rdu-audit-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="rdu-audit-h-ic" aria-hidden="true">⌘</span>
        <span className="rdu-audit-h-title">Audit</span>
        <span className="rdu-audit-h-sub">{count === 0 ? "No entries" : `${count} ${count === 1 ? "entry" : "entries"}`}</span>
        <span className="rdu-audit-h-tag">Shared</span>
        <span className="rdu-audit-h-chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ol className="rdu-audit-list">
          {entries.length === 0 ? (
            <li className="rdu-audit-empty">No audit entries for this {scope || "engagement"} yet.</li>
          ) : entries.map((e) => (
            <li className="rdu-audit-row" key={e.id}>
              <div className="rdu-audit-row-when">{_auditFormatWhen(e.at)}</div>
              <div className="rdu-audit-row-action">
                <span className="rdu-audit-row-actor">{e.actor}</span>
                <span className="rdu-audit-row-verb">{e.action}</span>
                {(e.before !== undefined || e.after !== undefined) ? (
                  <span className="rdu-audit-row-diff">
                    {e.before !== undefined ? <span className="rdu-audit-before">{String(e.before)}</span> : null}
                    {e.before !== undefined && e.after !== undefined ? <span className="rdu-audit-arrow"> → </span> : null}
                    {e.after  !== undefined ? <span className="rdu-audit-after">{String(e.after)}</span> : null}
                  </span>
                ) : null}
              </div>
              <div className="rdu-audit-row-src" aria-label={`Source: ${e.source || "ui"}`}>{e.source || "ui"}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- Expose ---------------------------------------------------

Object.assign(window, {
  AUDIT_ENTRIES,
  writeAudit,
  readAudit,
  useAuditLog,
  AuditAccordion,
  // Documentation export — schema reference rather than runtime use.
  AuditEntryShape: {
    id: "string", at: "ISO timestamp", actor: "string", action: "string",
    target: "string", scope: "frontline|professional|contractor|sow",
    before: "any?", after: "any?", source: "ui|api|import",
  },
});
