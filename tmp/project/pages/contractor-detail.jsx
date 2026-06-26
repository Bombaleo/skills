// =====================================================================
// Flex Work — Contractor detail sections
//   Rendered inside WorkerDetailsPage when worker.pool === "Contractor".
//   Five accordion cards (Classification, Agreements & SOWs, Tax & Pay,
//   Documents, Contractor invoices) plus a 1099 prep summary card.
//
//   Style: pure Everest tokens — no custom palettes. Uses the existing
//   `acc-card`, `req-pill`, and `inv-*` patterns from workforce / invoices.
// =====================================================================

const { useState: useStateCD } = React;

// ---------- Risk pill --------------------------------------------------
function ContractorRiskPill({ score }) {
  const meta = window.contractorRiskMeta(score);
  return (
    <span
      className="ctr-risk-pill"
      style={{ background: meta.bg, color: meta.fg }}
      title={`${meta.label} · ${score}/100`}
    >
      <Icon name={meta.hue === "error" ? "Alert" : meta.hue === "warning" ? "Information" : "CheckCircle"} size={12} />
      {meta.label} · {score}
    </span>
  );
}

// ---------- KV (label / value) -----------------------------------------
function CtrKV({ label, value, mono }) {
  return (
    <div className="ctr-kv">
      <dt>{label}</dt>
      <dd className={mono ? "tabular" : undefined}>{value || "—"}</dd>
    </div>
  );
}

// ---------- Classification ---------------------------------------------
const IRS20_FACTORS = [
  { id: "f1",  label: "Behavioral control · Instructions",      verdict: "Independent", help: "Contractor decides when, where, and how the work gets done. No daily supervision." },
  { id: "f2",  label: "Behavioral control · Training",          verdict: "Independent", help: "No employer-provided training; contractor brings their own methods and tools." },
  { id: "f3",  label: "Financial control · Tools & equipment",  verdict: "Independent", help: "Contractor furnishes their own workstation, software licenses, and supplies." },
  { id: "f4",  label: "Financial control · Investment",         verdict: "Independent", help: "Contractor has a significant investment in the business they operate." },
  { id: "f5",  label: "Financial control · Profit / loss",      verdict: "Independent", help: "Contractor can realize a profit or incur a loss." },
  { id: "f6",  label: "Financial control · Services to others", verdict: "Independent", help: "Contractor is free to offer their services to other firms in the market." },
  { id: "f7",  label: "Financial control · Payment method",     verdict: "Independent", help: "Paid by invoice on a per-engagement basis, not on regular payroll." },
  { id: "f8",  label: "Relationship · Written contract",        verdict: "Independent", help: "Engagement is governed by an MSA + SOW signed by both parties." },
  { id: "f9",  label: "Relationship · Employee benefits",       verdict: "Independent", help: "Contractor receives no PTO, health, or retirement benefits." },
  { id: "f10", label: "Relationship · Permanency",              verdict: "Review",      help: "Engagement is open-ended. Long engagements (>18 mo) raise misclassification risk." },
  { id: "f11", label: "Relationship · Key activity",            verdict: "Independent", help: "Work performed is not a core, recurring activity of the company." },
  { id: "f12", label: "Relationship · Right to discharge",      verdict: "Independent", help: "Either party may terminate per the SOW. No at-will employment relationship." },
];

const ABC_TEST = [
  { id: "a", label: "A — Free from control & direction",            verdict: "Pass",  help: "Worker performs services without the company's control over the manner and means." },
  { id: "b", label: "B — Outside the usual course of business",     verdict: "Pass",  help: "Services rendered are outside the company's usual course of business." },
  { id: "c", label: "C — Customarily engaged in independent trade", verdict: "Pass",  help: "Worker is customarily engaged in an independently established trade." },
];

function ContractorClassificationBody({ w }) {
  const [tab, setTab] = useStateCD("irs"); // "irs" | "abc"
  const factors = tab === "irs" ? IRS20_FACTORS : ABC_TEST;
  const reviewCount = factors.filter((f) => f.verdict === "Review").length;

  return (
    <div className="ctr-classif">
      <div className="ctr-classif-top">
        <div className="ctr-classif-summary">
          <div className="ctr-classif-summary-row">
            <span className="ctr-classif-label">Determination</span>
            <span className={`req-pill req-pill--${w.classification === "At risk" ? "warning" : w.classification === "Pending review" ? "informative" : "success"}`}>
              {w.classification}
            </span>
          </div>
          <div className="ctr-classif-summary-row">
            <span className="ctr-classif-label">Misclassification risk</span>
            <ContractorRiskPill score={w.riskScore} />
          </div>
          <div className="ctr-classif-summary-row">
            <span className="ctr-classif-label">Last reviewed</span>
            <span className="tabular">2026-04-12 · Eliana Torres, Workforce Ops</span>
          </div>
        </div>

        <ul className="ctr-classif-flags">
          <li>
            <Icon name="Information" size={14} />
            <span><b>Tenure:</b> {w.tenureMos} months {w.tenureMos >= 18 ? <em className="ctr-flag-warn">(approaching co-employment threshold)</em> : null}</span>
          </li>
          <li>
            <Icon name="Information" size={14} />
            <span><b>Hours / week:</b> {w.weeklyHours} {w.weeklyHours >= 35 ? <em className="ctr-flag-warn">(full-time equivalent — review)</em> : null}</span>
          </li>
          <li>
            <Icon name="Information" size={14} />
            <span><b>Other clients:</b> {w.weeklyHours >= 35 ? "Single-client exclusivity flagged" : "Engaged with other clients (declared)"}</span>
          </li>
        </ul>
      </div>

      <div className="ctr-classif-tabs" role="tablist">
        <button type="button" role="tab" aria-pressed={tab === "irs"} className="fw-tab" onClick={() => setTab("irs")}>
          <Icon name="ShieldPerson" size={14} />IRS 20-factor test
          <span className="fw-tab-count">{IRS20_FACTORS.length}</span>
        </button>
        <button type="button" role="tab" aria-pressed={tab === "abc"} className="fw-tab" onClick={() => setTab("abc")}>
          <Icon name="ShieldPerson" size={14} />ABC test (CA AB5)
          <span className="fw-tab-count">{ABC_TEST.length}</span>
        </button>
      </div>

      <ul className="ctr-factor-list">
        {factors.map((f) => (
          <li key={f.id} className="ctr-factor">
            <span className={`ctr-factor-verdict ctr-factor-verdict--${f.verdict.toLowerCase()}`}>
              <Icon
                name={f.verdict === "Pass" || f.verdict === "Independent" ? "Check" : f.verdict === "Review" ? "Information" : "Cancel"}
                size={12}
              />
              {f.verdict}
            </span>
            <div className="ctr-factor-body">
              <div className="ctr-factor-title">{f.label}</div>
              <p className="ctr-factor-help">{f.help}</p>
            </div>
          </li>
        ))}
      </ul>

      <footer className="ctr-classif-actions">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast("Classification re-review scheduled for next review cycle")}>
          <Icon name="Refresh" size={14} />Re-review classification
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Classification report exported for ${w.name}`, { kind: "success" })}>
          <Icon name="FileDownload" size={14} />Export determination
        </button>
        {reviewCount > 0 && (
          <span className="ctr-classif-hint">
            <Icon name="Alert" size={12} />
            {reviewCount} factor{reviewCount === 1 ? "" : "s"} flagged for review
          </span>
        )}
      </footer>
    </div>
  );
}

// ---------- Agreements -------------------------------------------------
function ContractorAgreementsBody({ w }) {
  const rows = CONTRACTOR_AGREEMENTS[w.id] || [
    { id: "MSA-tpl", type: "MSA", status: "Not started", signed: "—", expires: "—", signer: "—" },
  ];
  function statusHue(s) {
    if (s === "Countersigned" || s === "Active") return "success";
    if (s === "Awaiting signature" || s === "Draft" || s === "Renewal due") return "warning";
    if (s === "Expired") return "error";
    return "default";
  }
  return (
    <div className="ctr-agreements">
      <header className="ctr-agreements-head">
        <div>
          <div className="ctr-agreements-eyebrow">Active relationship</div>
          <h4>{w.agreement.type} · effective {w.agreement.effective}</h4>
          <p>
            Counter-signed by Flex Work Operations · expires{" "}
            <b className="tabular">{w.agreement.expires}</b>
          </p>
        </div>
        <div className="ctr-agreements-actions">
          <button type="button" className="btn btn--sm btn--secondary" onClick={() => {
            // v0.97 — Inline renewal draft. Mutates the per-window
            // store so the agreement appears in the Renewals queue in
            // the IC Compliance Hub on the next render.
            if (window.CONTRACTOR_AGREEMENTS) {
              const cur = window.CONTRACTOR_AGREEMENTS[w.id] || [];
              const today = new Date().toISOString().slice(0, 10);
              const nextYear = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })();
              const renewalId = `MSA-RENEW-${Math.floor(2100 + Math.random() * 900)}`;
              window.CONTRACTOR_AGREEMENTS[w.id] = [
                { id: renewalId, type: "MSA renewal", status: "Awaiting signature", signed: "—", expires: nextYear, signer: w.name, effective: today },
                ...cur,
              ];
            }
            showToast(`Renewal drafted for ${w.name} — sent for signature`, { kind: "success" });
          }}>
            <Icon name="Refresh" size={14} />Renew
          </button>
          <button type="button" className="btn btn--sm btn--secondary" onClick={() => {
            // v0.97 — Inline New SOW draft. Adds a child SOW under the
            // active MSA so the Manager can stack multiple concurrent
            // engagements (UX research + design + QA, etc.) under one
            // contractor. Reuses CONTRACTOR_AGREEMENTS (already keyed
            // per contractor, already multi-row).
            if (window.CONTRACTOR_AGREEMENTS) {
              const cur = window.CONTRACTOR_AGREEMENTS[w.id] || [];
              const today = new Date().toISOString().slice(0, 10);
              const expires = (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); })();
              const sowId = `SOW-${Math.floor(2400 + Math.random() * 900)}`;
              window.CONTRACTOR_AGREEMENTS[w.id] = [
                { id: sowId, type: "SOW", status: "Draft", signed: "—", expires, signer: w.name, effective: today },
                ...cur,
              ];
            }
            showToast(`New SOW ${"draft"} added for ${w.name} — open the row to edit milestones`, { kind: "success" });
          }}>
            <Icon name="DocumentAdd" size={14} />New SOW
          </button>
          <button type="button" className="btn btn--sm btn--secondary" onClick={() => {
            // v0.97 — Convert-to-employee. Side-panel-equivalent
            // confirmation flow. Marks the contractor for conversion;
            // a real implementation would emit the
            // contractor.converted_to_employee webhook + open the
            // Dayforce HR onboarding wizard pre-filled with identity,
            // address, banking, and tax form.
            openConfirm({
              title: `Convert ${w.name} to employee?`,
              body: (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ margin: 0 }}>This terminates the current IC engagement on the effective date and starts the Dayforce HR onboarding workflow pre-filled with:</p>
                  <ul style={{ margin: 0, paddingLeft: 18, font: "var(--evr-body2)" }}>
                    <li>Legal name: <b>{w.legalName || w.name}</b></li>
                    <li>Country / address: <b>{w.countryName}</b> · {w.address}</li>
                    <li>Banking method: <b>{w.payMethod}</b> (re-verification on file)</li>
                    <li>Tax form: <b>{w.taxForm}</b> &rarr; W-4 (US) / TD1 (CA)</li>
                  </ul>
                  <p style={{ margin: 0, font: "var(--evr-body2)", color: "var(--evr-content-primary-lowemp)" }}>
                    Final invoice and last 1099 will be generated automatically at the termination date.
                  </p>
                </div>
              ),
              primaryLabel: "Start conversion",
              onConfirm: () => showToast(`Conversion started for ${w.name} · contractor.converted_to_employee emitted to Dayforce HR`, { kind: "success" }),
            });
          }}>
            <Icon name="PersonArrow" size={14} />Convert to employee
          </button>
        </div>
      </header>

      <div className="ctr-table">
        <div className="ctr-table-head ctr-row-agreement">
          <div>Document</div>
          <div>Type</div>
          <div>Status</div>
          <div>Signed</div>
          <div>Expires</div>
          <div></div>
        </div>
        {rows.map((r) => (
          <div className="ctr-table-row ctr-row-agreement" key={r.id}>
            <div className="ctr-cell-doc">
              <Icon name="File" size={16} />
              <span className="tabular">{r.id}</span>
            </div>
            <div>{r.type}</div>
            <div><span className={`req-pill req-pill--${statusHue(r.status)}`}>{r.status}</span></div>
            <div className="tabular">{r.signed}</div>
            <div className="tabular">{r.expires}</div>
            <div className="ctr-cell-actions">
              <button type="button" className="iconbtn iconbtn--sm" aria-label="Download" onClick={() => showToast(`Downloading ${r.id}.pdf`)}>
                <Icon name="FileDownload" size={16} />
              </button>
              <button type="button" className="iconbtn iconbtn--sm" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
                { icon: "View", label: "View document", onClick: () => showToast(`Opening ${r.id}`) },
                { icon: "Send", label: "Resend for signature", onClick: () => showToast(`Resent ${r.id} to ${r.signer}`) },
                { icon: "Edit", label: "Amend", onClick: () => showToast(`Amendment started on ${r.id}`) },
                { divider: true },
                { icon: "TrashCan", label: "Terminate", danger: true, onClick: () => openConfirm({
                  title: `Terminate ${r.id}?`,
                  body: "This will revoke the contractor's access to active engagements under this document.",
                  primaryLabel: "Terminate",
                  onConfirm: () => showToast(`${r.id} terminated`, { kind: "success" }),
                }) },
              ])}>
                <Icon name="MoreVert" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Tax & Pay --------------------------------------------------
function ContractorTaxBody({ w }) {
  return (
    <div className="ctr-tax">
      <div className="ctr-tax-grid">
        <section className="ctr-tax-card">
          <h4>Tax classification</h4>
          <dl className="ctr-kv-grid">
            <CtrKV label="Entity type"         value={w.entity} />
            <CtrKV label="Legal / DBA name"    value={w.legalName} />
            <CtrKV label="Country of residence" value={`${w.countryName} (${w.country})`} />
            <CtrKV label="Tax form on file"    value={w.taxForm} />
            <CtrKV label="Reportable on"       value={w.taxClass} />
            <CtrKV label="TIN / EIN"           value="•••• 4429" mono />
          </dl>
          <footer className="ctr-tax-foot">
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`${w.taxForm} re-request sent to ${w.name}`)}>
              <Icon name="Send" size={14} />Re-request {w.taxForm}
            </button>
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`${w.taxForm} downloaded`)}>
              <Icon name="FileDownload" size={14} />Download {w.taxForm}
            </button>
          </footer>
        </section>

        <section className="ctr-tax-card">
          <h4>Rate & payment</h4>
          <dl className="ctr-kv-grid">
            <CtrKV label="Rate type"        value={w.rateType} />
            <CtrKV label="Rate"             value={`${window.fmtContractorMoney(w.rateAmount, w.currency)}${w.rateType === "Hourly" ? " / hr" : w.rateType === "Per-word" ? " / word" : w.rateType.startsWith("Fixed") ? " / month" : ""}`} mono />
            <CtrKV label="Currency"         value={w.currency} />
            <CtrKV label="Payment method"   value={w.payMethod} />
            <CtrKV label="Payment terms"    value="Net 15" />
            <CtrKV label="YTD paid"         value={window.fmtContractorMoney(w.ytdPaid, w.currency)} mono />
          </dl>
          <footer className="ctr-tax-foot">
            <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Banking re-verification sent to ${w.name}`)}>
              <Icon name="Pay" size={14} />Re-verify banking
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

// ---------- Documents --------------------------------------------------
function ContractorDocsBody({ w }) {
  const docs = CONTRACTOR_DOCS[w.id] || [
    { name: "W-9 (2025)", type: "Tax", status: "On file", expires: "2026-12-31" },
    { name: "Government-issued ID", type: "Identity", status: "Verified", expires: "—" },
  ];
  function statusHue(s) {
    if (s === "On file" || s === "Verified") return "success";
    if (s === "Stale" || s === "Pending") return "warning";
    if (s === "Expired" || s === "Missing") return "error";
    return "default";
  }
  return (
    <div className="ctr-docs">
      <div className="ctr-table">
        <div className="ctr-table-head ctr-row-doc">
          <div>Document</div>
          <div>Category</div>
          <div>Status</div>
          <div>Expires</div>
          <div></div>
        </div>
        {docs.map((d, i) => (
          <div className="ctr-table-row ctr-row-doc" key={i}>
            <div className="ctr-cell-doc">
              <Icon name="File" size={16} />
              <span>{d.name}</span>
            </div>
            <div>{d.type}</div>
            <div><span className={`req-pill req-pill--${statusHue(d.status)}`}>{d.status}</span></div>
            <div className="tabular">{d.expires}</div>
            <div className="ctr-cell-actions">
              <button type="button" className="iconbtn iconbtn--sm" aria-label="Download" onClick={() => showToast(`Downloading ${d.name}.pdf`)}>
                <Icon name="FileDownload" size={16} />
              </button>
              <button type="button" className="iconbtn iconbtn--sm" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
                { icon: "Send", label: "Request fresh copy", onClick: () => showToast(`Request sent to ${w.name}`) },
                { icon: "TrashCan", label: "Remove", danger: true, onClick: () => showToast(`${d.name} removed`, { kind: "success" }) },
              ])}>
                <Icon name="MoreVert" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <footer className="ctr-docs-foot">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast("Upload document — pick a file (preview)")}>
          <Icon name="FileUpload" size={14} />Upload document
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Document request packet sent to ${w.name}`, { kind: "success" })}>
          <Icon name="Send" size={14} />Request missing docs
        </button>
      </footer>
    </div>
  );
}

// ---------- Invoices ---------------------------------------------------
function ContractorInvoicesBody({ w }) {
  const rows = CONTRACTOR_INVOICES[w.id] || [];
  function statusHue(s) {
    if (s === "Paid") return "success";
    if (s === "Submitted" || s === "Approved") return "informative";
    if (s === "Disputed") return "warning";
    return "default";
  }
  if (!rows.length) {
    return (
      <div className="ctr-empty">
        <Icon name="Wallet" size={20} />
        <div>
          <h4>No invoices yet</h4>
          <p>Contractor invoices arrive here when {w.name} submits them, or when Flex Work auto-generates them from approved time.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="ctr-invoices">
      <div className="ctr-table">
        <div className="ctr-table-head ctr-row-invoice">
          <div>Invoice</div>
          <div>Period</div>
          <div>Hours / units</div>
          <div>Amount</div>
          <div>Status</div>
          <div></div>
        </div>
        {rows.map((r) => (
          <div className="ctr-table-row ctr-row-invoice" key={r.id}>
            <div className="ctr-cell-doc">
              <Icon name="Wallet" size={16} />
              <span className="tabular">{r.id}</span>
            </div>
            <div className="tabular">{r.period}</div>
            <div className="tabular">{r.hours} hrs</div>
            <div className="tabular">{window.fmtContractorMoney(r.amount, r.currency)}</div>
            <div><span className={`req-pill req-pill--${statusHue(r.status)}`}>{r.status}</span></div>
            <div className="ctr-cell-actions">
              <button type="button" className="iconbtn iconbtn--sm" aria-label="Download" onClick={() => showToast(`Downloading ${r.id}.pdf`)}>
                <Icon name="FileDownload" size={16} />
              </button>
              <button type="button" className="iconbtn iconbtn--sm" aria-label="More" onClick={(e) => openMenu(e.currentTarget, [
                { icon: "View", label: "View invoice", onClick: () => showToast(`Opening ${r.id}`) },
                { icon: "Check", label: "Approve", onClick: () => showToast(`${r.id} approved`, { kind: "success" }) },
                { icon: "Pay", label: "Mark paid", onClick: () => showToast(`${r.id} marked paid`, { kind: "success" }) },
                { icon: "Cancel", label: "Dispute", danger: true, onClick: () => showToast(`Dispute opened on ${r.id}`, { kind: "warning" }) },
              ])}>
                <Icon name="MoreVert" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <footer className="ctr-invoices-foot">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Generating invoice from approved time for ${w.name}`, { kind: "success" })}>
          <Icon name="AddCircle" size={14} />Generate from time
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Reminder sent to ${w.name}`)}>
          <Icon name="Send" size={14} />Remind contractor
        </button>
      </footer>
    </div>
  );
}

// ---------- 1099 prep --------------------------------------------------
function ContractorYearEndBody({ w }) {
  const filings = {
    "W-9":        { form: "1099-NEC", threshold: 600,  thresholdLbl: "$600 reporting threshold" },
    "W-8BEN":     { form: "1042-S",   threshold: 0,    thresholdLbl: "All non-US contractor payments" },
    "W-8BEN-E":   { form: "1042-S",   threshold: 0,    thresholdLbl: "All non-US entity payments" },
  };
  const f = filings[w.taxForm] || filings["W-9"];
  const overThreshold = w.ytdPaid >= f.threshold;
  return (
    <div className="ctr-yearend">
      <div className="ctr-yearend-grid">
        <div className="ctr-yearend-stat">
          <div className="ctr-yearend-eyebrow">YTD paid · 2026</div>
          <div className="ctr-yearend-value tabular">{window.fmtContractorMoney(w.ytdPaid, w.currency)}</div>
          <div className="ctr-yearend-sub">{overThreshold ? "Above filing threshold" : "Below filing threshold"}</div>
        </div>
        <div className="ctr-yearend-stat">
          <div className="ctr-yearend-eyebrow">Filing form</div>
          <div className="ctr-yearend-value">{f.form}</div>
          <div className="ctr-yearend-sub">{f.thresholdLbl}</div>
        </div>
        <div className="ctr-yearend-stat">
          <div className="ctr-yearend-eyebrow">Address on file</div>
          <div className="ctr-yearend-value ctr-yearend-value--small">{w.address.split(",").slice(0, 2).join(",")}</div>
          <div className="ctr-yearend-sub">Verified Mar 2026</div>
        </div>
        <div className="ctr-yearend-stat">
          <div className="ctr-yearend-eyebrow">{w.taxForm} on file</div>
          <div className="ctr-yearend-value">
            <span className={`req-pill req-pill--${w.status === "Compliant" ? "success" : "warning"}`}>{w.status === "Compliant" ? "Current" : "Missing / stale"}</span>
          </div>
          <div className="ctr-yearend-sub">{w.status === "Compliant" ? "Expires Dec 31, 2026" : "Re-request before year-end"}</div>
        </div>
      </div>
      <footer className="ctr-yearend-foot">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`${f.form} preview generated for ${w.name}`, { kind: "success" })}>
          <Icon name="PDF" size={14} />Preview {f.form}
        </button>
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => showToast(`Address re-verification sent`)}>
          <Icon name="Send" size={14} />Re-verify address
        </button>
      </footer>
    </div>
  );
}

// =====================================================================
// Top-level component — drop after the standard worker accordions.
// =====================================================================
// WfAccordionCardC — thin wrapper around the workforce WfAccordionCard
// that injects an optional Dayforce alignment pill via the `action`
// slot (rendered to the right of the title, separate from the chevron).
// We render the pill in `action` rather than inline with the title so
// the visual treatment matches what's already on every workforce row.
function WfAccordionCardC({ icon, title, subtitle, defaultOpen = false, action, dayforce, children }) {
  const Card = (typeof window !== "undefined") ? window.WfAccordionCard : null;
  const Pill = (typeof window !== "undefined") ? window.DfAlignPill : null;
  const pillEl = dayforce && Pill ? <Pill {...dayforce} /> : null;
  const mergedAction = (pillEl || action) ? (
    <span className="ctr-acc-actions">
      {pillEl}
      {action}
    </span>
  ) : undefined;
  if (Card) {
    return (
      <Card icon={icon} title={title} subtitle={subtitle} defaultOpen={defaultOpen} action={mergedAction}>
        {children}
      </Card>
    );
  }
  // Fallback — only used if WfAccordionCard isn't exported (during dev).
  // Collapsed by default like every other accordion.
  const [open, setOpen] = useStateCD(false);
  const id = React.useId();
  return (
    <section className="acc-card">
      <button
        type="button"
        className="acc-card-head"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="acc-card-avatar" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="wf-acc-title-stack">
          <span className="acc-card-title">{title}</span>
          {subtitle && <span className="wf-acc-sub">{subtitle}</span>}
        </span>
        {mergedAction && <span className="wf-acc-action" onClick={(e) => e.stopPropagation()}>{mergedAction}</span>}
        <span className="acc-card-chev" data-open={open} aria-hidden="true">
          <Icon name="ChevronDown" size={20} />
        </span>
      </button>
      {open && <div id={id} className="acc-card-body">{children}</div>}
    </section>
  );
}

function ContractorDetailSections({ w }) {
  if (!w || w.pool !== "Contractor") return null;
  // Defensive: even if a row somehow carries pool === "Contractor" while
  // the feature flag is off (e.g. stale state across a flag flip), don't
  // render the contractor-specific accordions. Contractor workers are
  // only injected into the workforce list when the flag is on, so this
  // is a belt-and-suspenders guard.
  if (typeof window !== "undefined" && window.getFeatureFlag
      && !window.getFeatureFlag("contractors")) {
    return null;
  }
  return (
    <React.Fragment>
      <WfAccordionCardC
        icon="ShieldPerson"
        title="Classification"
        subtitle="IRS 20-factor + ABC test, tenure & exclusivity flags, misclassification risk"
        defaultOpen
        dayforce={{
          primitive: "Compliance.ClassificationDetermination",
          subtitle: "new sub-record",
          product: "Compliance",
          strategy: "Add",
          note: "IRS 20-factor + ABC determination, risk score, and review history attach to the Employee record. New sub-record because Dayforce Compliance does not ship an IC classification primitive today.",
          anchor: "compliance",
        }}
      >
        <ContractorClassificationBody w={w} />
      </WfAccordionCardC>

      <WfAccordionCardC
        icon="File"
        title="Agreements & SOWs"
        subtitle="Master agreement, statements of work, NDAs, IP assignment"
        defaultOpen
        dayforce={{
          primitive: "ContractAgreement",
          subtitle: "Flex Work-owned · links to Dayforce Document",
          product: "Flex Work",
          strategy: "Add",
          note: "MSA + SOW + NDA + IP Assignment are stored as ContractAgreement rows (Flex Work) that reference the signed PDF in Dayforce Document. Signature state, effective and expiry dates, and renewal lineage all live here.",
          anchor: "people",
        }}
      >
        <ContractorAgreementsBody w={w} />
      </WfAccordionCardC>

      <WfAccordionCardC
        icon="Pay"
        title="Tax classification & payment"
        subtitle="Tax form on file, entity, rate, currency, banking, YTD"
        dayforce={{
          primitive: "Payroll.TaxDocument + Payroll.PaymentMethod",
          subtitle: "extend",
          product: "Payroll",
          strategy: "Extend",
          note: "W-9 / W-8BEN / W-8BEN-E ride on Dayforce Payroll.TaxDocument. Banking ties into Payroll.PaymentMethod. Rate + currency + payment terms live on ContingentEngagement (Flex Work).",
          anchor: "payroll",
        }}
      >
        <ContractorTaxBody w={w} />
      </WfAccordionCardC>

      <WfAccordionCardC
        icon="FileDownload"
        title="Documents"
        subtitle="W-9 / W-8BEN, ID, certificate of insurance, business license, custom"
        dayforce={{
          primitive: "Dayforce Document",
          subtitle: "with documentCategory tagging",
          product: "People",
          strategy: "Reuse",
          note: "Every contractor document (W-9, COI, ID, license, custom) is stored in the existing Dayforce Document store, tagged with documentCategory so the contractor surface can filter to the right set.",
          anchor: "people",
        }}
      >
        <ContractorDocsBody w={w} />
      </WfAccordionCardC>

      <WfAccordionCardC
        icon="Wallet"
        title="Contractor invoices"
        subtitle="Contractor-submitted invoices (or auto-generated from approved time)"
        dayforce={{
          primitive: "SupplierInvoice",
          subtitle: "payerType = Contractor",
          product: "Flex Work",
          strategy: "Extend",
          note: "Contractor-submitted invoices ride the existing SupplierInvoice table; a payerType discriminator distinguishes Supplier (agency) vs Contractor (direct). Both route through the same Dayforce AP workflow.",
          anchor: "invoices",
        }}
      >
        <ContractorInvoicesBody w={w} />
      </WfAccordionCardC>

      <WfAccordionCardC
        icon="Calculate"
        title="Year-end · 1099 / 1042-S prep"
        subtitle="YTD totals, filing form, address verification"
        dayforce={{
          primitive: "Payroll.YearEndForm",
          subtitle: "1099-NEC · 1042-S · T4A",
          product: "Payroll",
          strategy: "Add",
          note: "YTD contractor payments aggregate into a Payroll.YearEndForm record for 1099-NEC (US), 1042-S (foreign), or T4A (Canada). Filing entity, address, and TIN flow directly from the contractor profile.",
          anchor: "payroll",
        }}
      >
        <ContractorYearEndBody w={w} />
      </WfAccordionCardC>
    </React.Fragment>
  );
}

Object.assign(window, {
  ContractorDetailSections,
  ContractorRiskPill,
});
