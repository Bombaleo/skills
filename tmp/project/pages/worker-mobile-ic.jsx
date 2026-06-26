// =====================================================================
// Flex Work — Worker mobile · Contractor (IC) self-serve portal
//   Exposes window.WmContractorView, a fully self-contained component
//   that replaces the shift-worker home / shifts / more screens when
//   the active worker has pool === "Contractor". The host shell in
//   pages/worker-mobile.jsx detects the pool and renders this view
//   instead of the normal body — same iOS device frame, same dock
//   header (so the worker picker keeps working), only the body and
//   bottom tab bar swap.
//
//   Surfaces:
//     · Engagements tab — invite acknowledgement, agreement signing,
//                         active engagements list
//     · Invoices tab    — submit invoice, history, status
//     · Documents tab   — upload portal (tax, ID, COI, license)
//     · Profile tab     — address / phone / banking / earnings & YTD
//
//   All writes go through the same per-window data stores the rest of
//   the prototype reads from (CONTRACTOR_AGREEMENTS, CONTRACTOR_DOCS,
//   CONTRACTOR_INVOICES) so the Admin- / Manager-side surfaces pick
//   up changes on the next render. No new data model.
// =====================================================================

(function () {
  const { useState, useEffect, useMemo, useRef } = React;

  // ---------- Tiny shared helpers ----------------------------------
  function fmtMoney(amt, ccy) {
    if (window.fmtContractorMoney) return window.fmtContractorMoney(amt, ccy);
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD", maximumFractionDigits: 0 }).format(amt || 0); }
    catch (e) { return `${ccy || "USD"} ${amt || 0}`; }
  }
  function fmtDate(iso) {
    if (!iso || iso === "—") return "—";
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch (e) { return iso; }
  }
  function todayISO() {
    const d = (typeof window.flexToday === "function") ? window.flexToday() : new Date();
    return d.toISOString().slice(0, 10);
  }
  function daysUntil(iso) {
    if (!iso || iso === "—") return Infinity;
    const today = (typeof window.flexToday === "function") ? window.flexToday() : new Date();
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return Infinity;
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Read agreement / docs / invoices for a contractor, with safe fallbacks.
  function readAgreements(cid) { return (window.CONTRACTOR_AGREEMENTS && window.CONTRACTOR_AGREEMENTS[cid]) || []; }
  function readDocs(cid)       { return (window.CONTRACTOR_DOCS       && window.CONTRACTOR_DOCS[cid])       || []; }
  function readInvoices(cid)   { return (window.CONTRACTOR_INVOICES   && window.CONTRACTOR_INVOICES[cid])   || []; }

  // ---------- Inline icons (kept tiny — match the wm- icon style) --
  function I({ name, size = 18 }) {
    if (window.Icon) return React.createElement(window.Icon, { name, size });
    return <span aria-hidden="true">·</span>;
  }

  // ---------- Top header (single-row) ------------------------------
  function IcHeader({ title, onBack }) {
    return (
      <div className="wm-header">
        {onBack ? (
          <button className="wm-iconbtn wm-iconbtn--bare" onClick={onBack} aria-label="Back">
            <I name="ChevronLeft" size={26} />
          </button>
        ) : (
          <h1>{title}</h1>
        )}
        <div className="wm-header-r">
          <span className="wm-avatar" aria-hidden="true">{title.slice(0, 2).toUpperCase()}</span>
        </div>
      </div>
    );
  }

  // ---------- Bottom tab bar (4 tabs) ------------------------------
  function IcTabBar({ tab, onChange, badges }) {
    const items = [
      { id: "engagements", label: "Engagements", icon: "Briefcase",     badge: badges && badges.engagements },
      { id: "invoices",    label: "Invoices",    icon: "Wallet",        badge: badges && badges.invoices },
      { id: "documents",   label: "Documents",   icon: "File",          badge: badges && badges.documents },
      { id: "profile",     label: "Profile",     icon: "PersonAuthorize" },
    ];
    return (
      <div className="wm-tabbar" role="tablist">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-pressed={tab === it.id}
            className={"wm-tab" + (tab === it.id ? " wm-tab--on" : "")}
            onClick={() => onChange(it.id)}
          >
            <span className="wm-tab-icon" aria-hidden="true">
              <I name={it.icon} size={20} />
              {it.badge && it.badge > 0 ? <span className="wm-tab-badge" aria-label={`${it.badge} new`}>{it.badge}</span> : null}
            </span>
            <span className="wm-tab-label">{it.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // ---------- Reusable rows / chips --------------------------------
  function StatusPill({ kind, label }) {
    const k = kind || "default";
    return <span className={`req-pill req-pill--${k}`}>{label}</span>;
  }
  function KV({ k, v }) {
    return (
      <div className="wmic-kv">
        <span className="wmic-kv-k">{k}</span>
        <span className="wmic-kv-v">{v}</span>
      </div>
    );
  }
  function Sheet({ title, onClose, children, foot }) {
    return (
      <div className="wmic-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="wmic-sheet-backdrop" onClick={onClose} aria-hidden="true" />
        <div className="wmic-sheet-card">
          <div className="wmic-sheet-head">
            <h3>{title}</h3>
            <button className="wm-iconbtn" onClick={onClose} aria-label="Close"><I name="Cancel" size={16} /></button>
          </div>
          <div className="wmic-sheet-body">{children}</div>
          {foot ? <div className="wmic-sheet-foot">{foot}</div> : null}
        </div>
      </div>
    );
  }

  // =================================================================
  // Tab: Engagements (inbox + active list)
  // =================================================================
  function EngagementsTab({ contractor, onToast, onOpenAgreement }) {
    const ags = readAgreements(contractor.id);
    const pending = ags.filter((a) => a.status === "Awaiting signature" || a.status === "Pending review" || a.status === "Draft");
    const active  = ags.filter((a) => a.status === "Countersigned" || a.status === "Active");
    const renewal = ags.filter((a) => a.status === "Renewal due");
    const expired = ags.filter((a) => a.status === "Expired");

    // Synthesize a primary engagement card from the contractor record
    // even when no per-row agreement is stored. The detail header is
    // the canonical "Active engagement" surface.
    const primary = contractor.agreement;

    return (
      <div className="wm-scroll wmic-scroll">

        {/* Onboarding banner — surfaces when status === "Onboarding" */}
        {contractor.status === "Onboarding" && (
          <div className="wmic-banner wmic-banner--warn">
            <I name="Information" size={20} />
            <div className="wmic-banner-body">
              <b>Finish onboarding</b>
              <p>Complete agreement signature, tax form, and banking to start invoicing.</p>
            </div>
          </div>
        )}

        {/* Invites pending signature */}
        {pending.length > 0 && (
          <section className="wmic-section">
            <h2 className="wmic-section-h">Awaiting your signature <span className="wmic-section-c">{pending.length}</span></h2>
            {pending.map((a) => (
              <button key={a.id} className="wmic-card wmic-card--invite" onClick={() => onOpenAgreement(a, "sign")}>
                <div className="wmic-card-icon"><I name="File" size={20} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{a.type} — {a.id}</div>
                  <div className="wmic-card-sub">
                    {a.signer ? `From ${a.signer}` : "From Flex Work Operations"} · Sent {a.signed && a.signed !== "—" ? fmtDate(a.signed) : "today"}
                  </div>
                  <div className="wmic-card-foot">
                    <StatusPill kind="warning" label={a.status} />
                    <span className="wmic-card-cta">Review and sign →</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* Renewals due */}
        {renewal.length > 0 && (
          <section className="wmic-section">
            <h2 className="wmic-section-h">Renewals due <span className="wmic-section-c">{renewal.length}</span></h2>
            {renewal.map((a) => (
              <button key={a.id} className="wmic-card wmic-card--renew" onClick={() => onOpenAgreement(a, "renew")}>
                <div className="wmic-card-icon"><I name="Refresh" size={20} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{a.type} — {a.id}</div>
                  <div className="wmic-card-sub">
                    Expires {fmtDate(a.expires)} · Renew to keep working
                  </div>
                  <div className="wmic-card-foot">
                    <StatusPill kind="warning" label="Renewal due" />
                    <span className="wmic-card-cta">Renew →</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* Active engagement summary card */}
        <section className="wmic-section">
          <h2 className="wmic-section-h">Active engagement</h2>
          <div className="wmic-card wmic-card--active">
            <div className="wmic-card-body wmic-card-body--full">
              <div className="wmic-card-title">{contractor.jobs && contractor.jobs[0]} at Flex Work</div>
              <div className="wmic-card-sub">
                {primary.type} · {primary.status} · Effective {fmtDate(primary.effective)}
              </div>
              <div className="wmic-kv-grid">
                <KV k="Rate"   v={`${fmtMoney(contractor.rateAmount, contractor.currency)}${contractor.rateType === "Hourly" ? " / hr" : contractor.rateType === "Per-word" ? " / word" : ""}`} />
                <KV k="Hours / wk" v={`${contractor.weeklyHours} hr`} />
                <KV k="Tenure" v={`${contractor.tenureMos} mo`} />
                <KV k="Expires" v={fmtDate(primary.expires)} />
              </div>
              {primary.expires !== "—" && daysUntil(primary.expires) <= 60 && (
                <div className="wmic-inline-flag">
                  <I name="Alert" size={14} />
                  Your agreement renews in {daysUntil(primary.expires)} days. We'll send the renewal packet at the 30-day mark.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Active agreements list */}
        {active.length > 0 && (
          <section className="wmic-section">
            <h2 className="wmic-section-h">All agreements on file <span className="wmic-section-c">{active.length + expired.length}</span></h2>
            {[...active, ...expired].map((a) => (
              <button key={a.id} className="wmic-card wmic-card--agree" onClick={() => onOpenAgreement(a, "view")}>
                <div className="wmic-card-icon"><I name="File" size={18} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{a.type} — {a.id}</div>
                  <div className="wmic-card-sub">Signed {fmtDate(a.signed)} · Expires {fmtDate(a.expires)}</div>
                </div>
                <StatusPill kind={a.status === "Expired" ? "error" : "success"} label={a.status} />
              </button>
            ))}
          </section>
        )}

      </div>
    );
  }

  // =================================================================
  // Tab: Invoices (list + composer)
  // =================================================================
  function InvoicesTab({ contractor, onToast, onCompose }) {
    const rows = readInvoices(contractor.id);
    const submitted = rows.filter((r) => r.status === "Submitted" || r.status === "Approved");
    const paid = rows.filter((r) => r.status === "Paid");
    const ytdPaid = paid.reduce((s, r) => s + (r.amount || 0), 0);
    return (
      <div className="wm-scroll wmic-scroll">

        <div className="wmic-earn-hero">
          <div className="wmic-earn-label">Paid year to date</div>
          <div className="wmic-earn-amt">{fmtMoney(ytdPaid || contractor.ytdPaid || 0, contractor.currency)}</div>
          <div className="wmic-earn-sub">{submitted.length > 0 ? `${submitted.length} invoice${submitted.length === 1 ? "" : "s"} in flight` : "Everything's up to date."}</div>
          <button className="wmic-btn wmic-btn--primary wmic-earn-cta" onClick={onCompose}>
            <I name="AddCircle" size={16} />New invoice
          </button>
        </div>

        <section className="wmic-section">
          <h2 className="wmic-section-h">In flight <span className="wmic-section-c">{submitted.length}</span></h2>
          {submitted.length === 0 ? (
            <div className="wmic-empty">
              <I name="Check" size={18} />
              <p>No invoices awaiting approval.</p>
            </div>
          ) : (
            submitted.map((r) => (
              <div key={r.id} className="wmic-card wmic-card--inv">
                <div className="wmic-card-icon"><I name="Wallet" size={18} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{r.id}</div>
                  <div className="wmic-card-sub">{r.period} · {r.hours} hr</div>
                </div>
                <div className="wmic-card-right">
                  <div className="wmic-card-amt">{fmtMoney(r.amount, r.currency)}</div>
                  <StatusPill kind={r.status === "Approved" ? "informative" : "default"} label={r.status} />
                </div>
              </div>
            ))
          )}
        </section>

        <section className="wmic-section">
          <h2 className="wmic-section-h">Paid <span className="wmic-section-c">{paid.length}</span></h2>
          {paid.length === 0 ? (
            <div className="wmic-empty">
              <I name="Information" size={18} />
              <p>Your first paid invoice will appear here.</p>
            </div>
          ) : (
            paid.map((r) => (
              <div key={r.id} className="wmic-card wmic-card--inv">
                <div className="wmic-card-icon"><I name="Wallet" size={18} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{r.id}</div>
                  <div className="wmic-card-sub">{r.period} · Paid {fmtDate(r.date)}</div>
                </div>
                <div className="wmic-card-right">
                  <div className="wmic-card-amt">{fmtMoney(r.amount, r.currency)}</div>
                  <StatusPill kind="success" label="Paid" />
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    );
  }

  // =================================================================
  // Tab: Documents (upload portal)
  // =================================================================
  function DocumentsTab({ contractor, onToast, onUpload }) {
    const docs = readDocs(contractor.id);
    const requested = [];
    // Synthetic gap detection: if a US contractor doesn't have a recent
    // W-9, surface a request card. Same for ID and COI.
    if (contractor.country === "US" && !docs.find((d) => d.type === "Tax")) requested.push({ name: "W-9 (current year)", type: "Tax", reason: "Required for 1099 reporting" });
    if (!docs.find((d) => d.type === "Identity")) requested.push({ name: "Government-issued ID", type: "Identity", reason: "One-time identity verification" });
    if (contractor.weeklyHours >= 20 && !docs.find((d) => d.type === "Insurance")) requested.push({ name: "Certificate of Insurance (GL + E&O)", type: "Insurance", reason: "Required per IC program coverage policy" });

    function hue(s) {
      if (s === "On file" || s === "Verified") return "success";
      if (s === "Stale" || s === "Pending")    return "warning";
      if (s === "Expired" || s === "Missing")  return "error";
      return "default";
    }

    return (
      <div className="wm-scroll wmic-scroll">

        {requested.length > 0 && (
          <section className="wmic-section">
            <h2 className="wmic-section-h">Requested by Flex Work <span className="wmic-section-c">{requested.length}</span></h2>
            {requested.map((d, i) => (
              <button key={i} className="wmic-card wmic-card--req" onClick={() => onUpload(d)}>
                <div className="wmic-card-icon"><I name="FileUpload" size={20} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{d.name}</div>
                  <div className="wmic-card-sub">{d.reason}</div>
                  <div className="wmic-card-foot">
                    <StatusPill kind="warning" label="Action needed" />
                    <span className="wmic-card-cta">Upload →</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        <section className="wmic-section">
          <h2 className="wmic-section-h">On file <span className="wmic-section-c">{docs.length}</span></h2>
          {docs.length === 0 ? (
            <div className="wmic-empty">
              <I name="Information" size={18} />
              <p>Documents you upload will appear here. Flex Work keeps them encrypted at rest.</p>
            </div>
          ) : (
            docs.map((d, i) => (
              <div key={i} className="wmic-card wmic-card--doc">
                <div className="wmic-card-icon"><I name="File" size={18} /></div>
                <div className="wmic-card-body">
                  <div className="wmic-card-title">{d.name}</div>
                  <div className="wmic-card-sub">{d.type} · Expires {fmtDate(d.expires)}</div>
                </div>
                <StatusPill kind={hue(d.status)} label={d.status} />
              </div>
            ))
          )}
        </section>

        <button className="wmic-btn wmic-btn--secondary wmic-btn--full" onClick={() => onUpload(null)}>
          <I name="FileUpload" size={16} />Upload a new document
        </button>
      </div>
    );
  }

  // =================================================================
  // Tab: Profile (identity / tax / banking / earnings + 1099 dl)
  // =================================================================
  function ProfileTab({ contractor, onToast, onEdit, onView1099 }) {
    const yearEndForm = contractor.taxForm === "W-9" ? "1099-NEC"
                      : contractor.country === "CA" ? "T4A"
                      : contractor.taxForm === "W-8BEN-E" ? "1042-S"
                      : "1042-S";
    const initials = (contractor.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("");
    return (
      <div className="wm-scroll wmic-scroll">

        {/* Identity card */}
        <section className="wmic-profile-card">
          <div className="wmic-profile-av" aria-hidden="true">{initials}</div>
          <div>
            <div className="wmic-profile-name">{contractor.name}</div>
            <div className="wmic-profile-sub">
              <span className={`fi fi-${contractor.flag}`} aria-hidden="true" />
              {contractor.countryName} · {contractor.entity}
            </div>
          </div>
        </section>

        <section className="wmic-section">
          <h2 className="wmic-section-h">Identity & contact</h2>
          <div className="wmic-list">
            <button className="wmic-list-row" onClick={() => onEdit("contact")}>
              <div>
                <div className="wmic-list-k">Legal / DBA name</div>
                <div className="wmic-list-v">{contractor.legalName || contractor.name}</div>
              </div>
              <I name="ChevronRight" size={18} />
            </button>
            <button className="wmic-list-row" onClick={() => onEdit("contact")}>
              <div>
                <div className="wmic-list-k">Email</div>
                <div className="wmic-list-v">{contractor.email}</div>
              </div>
              <I name="ChevronRight" size={18} />
            </button>
            <button className="wmic-list-row" onClick={() => onEdit("contact")}>
              <div>
                <div className="wmic-list-k">Phone</div>
                <div className="wmic-list-v">{contractor.phone}</div>
              </div>
              <I name="ChevronRight" size={18} />
            </button>
            <button className="wmic-list-row" onClick={() => onEdit("address")}>
              <div>
                <div className="wmic-list-k">Address</div>
                <div className="wmic-list-v">{contractor.address}</div>
              </div>
              <I name="ChevronRight" size={18} />
            </button>
          </div>
        </section>

        <section className="wmic-section">
          <h2 className="wmic-section-h">Tax & pay</h2>
          <div className="wmic-list">
            <button className="wmic-list-row" onClick={() => onEdit("tax")}>
              <div>
                <div className="wmic-list-k">Tax form on file</div>
                <div className="wmic-list-v">{contractor.taxForm} · Reports as {contractor.taxClass}</div>
              </div>
              <I name="ChevronRight" size={18} />
            </button>
            <button className="wmic-list-row" onClick={() => onEdit("banking")}>
              <div>
                <div className="wmic-list-k">Payment method</div>
                <div className="wmic-list-v">{contractor.payMethod} · {contractor.currency}</div>
              </div>
              <I name="ChevronRight" size={18} />
            </button>
            <div className="wmic-list-row wmic-list-row--ro">
              <div>
                <div className="wmic-list-k">Year-to-date paid</div>
                <div className="wmic-list-v">{fmtMoney(contractor.ytdPaid, contractor.currency)}</div>
              </div>
            </div>
            <button className="wmic-list-row" onClick={onView1099}>
              <div>
                <div className="wmic-list-k">Year-end · {yearEndForm}</div>
                <div className="wmic-list-v">Download your tax form once Flex Work files (Jan)</div>
              </div>
              <I name="FileDownload" size={18} />
            </button>
          </div>
        </section>

        <section className="wmic-section">
          <h2 className="wmic-section-h">Account</h2>
          <div className="wmic-list">
            <div className="wmic-list-row wmic-list-row--ro">
              <div>
                <div className="wmic-list-k">Classification</div>
                <div className="wmic-list-v">{contractor.classification} · Risk score {contractor.riskScore}/100</div>
              </div>
            </div>
            <div className="wmic-list-row wmic-list-row--ro">
              <div>
                <div className="wmic-list-k">Worker ID</div>
                <div className="wmic-list-v" style={{ fontFamily: "var(--evr-font-mono)", fontSize: 12 }}>{contractor.workerId}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // =================================================================
  // Sheets (modal flows)
  // =================================================================

  function AgreementSheet({ agreement, contractor, mode, onClose, onToast }) {
    const [stage, setStage] = useState(mode === "view" ? "preview" : "review"); // review → signing → done
    const [accepted, setAccepted] = useState(false);
    const title = mode === "renew" ? `Renew ${agreement.type}` : `${agreement.type} · ${agreement.id}`;
    function sign() {
      setStage("signing");
      setTimeout(() => {
        setStage("done");
        // Mutate the agreement store so the Admin / Manager surfaces
        // pick it up on the next render. Per-window write only — no
        // persistence layer needed in the prototype.
        if (window.CONTRACTOR_AGREEMENTS && window.CONTRACTOR_AGREEMENTS[contractor.id]) {
          window.CONTRACTOR_AGREEMENTS[contractor.id] = window.CONTRACTOR_AGREEMENTS[contractor.id].map((a) =>
            a.id === agreement.id ? { ...a, status: "Countersigned", signed: todayISO() } : a);
        }
        onToast({ title: "Signed", msg: `${agreement.id} countersigned · Flex Work was notified` });
      }, 900);
    }
    return (
      <Sheet
        title={title}
        onClose={onClose}
        foot={mode === "view" ? null : (
          <React.Fragment>
            <button className="wmic-btn wmic-btn--secondary" onClick={onClose}>Cancel</button>
            <button
              className="wmic-btn wmic-btn--primary"
              disabled={!accepted || stage === "signing"}
              onClick={sign}
            >
              {stage === "signing" ? "Signing…" : stage === "done" ? "Signed" : "Sign with DocuSign"}
            </button>
          </React.Fragment>
        )}
      >
        {stage === "done" ? (
          <div className="wmic-success">
            <I name="CheckCircle" size={32} />
            <h4>Signed</h4>
            <p>Flex Work has been notified. Your active engagement is now live — you can start submitting invoices.</p>
          </div>
        ) : (
          <React.Fragment>
            <div className="wmic-pdf">
              <div className="wmic-pdf-head">
                <I name="File" size={16} />
                <span>{agreement.id}.pdf · {agreement.type}</span>
              </div>
              <div className="wmic-pdf-body">
                <p><b>{agreement.type}</b> between Flex Work Inc. ("Company") and {contractor.legalName || contractor.name} ("Contractor"), effective {fmtDate(agreement.effective)} through {fmtDate(agreement.expires)}.</p>
                <p>1. <b>Services.</b> Contractor will perform the services described in the SOW attached hereto. Contractor is an independent contractor and not an employee, agent, or partner of the Company.</p>
                <p>2. <b>Compensation.</b> Company will pay Contractor at the rate of {fmtMoney(contractor.rateAmount, contractor.currency)}{contractor.rateType === "Hourly" ? " per hour" : ""} for services rendered, payable Net 15 from approval.</p>
                <p>3. <b>Confidentiality &amp; IP.</b> Contractor agrees to the standard Flex Work NDA and IP Assignment, incorporated herein by reference.</p>
                <p>4. <b>Term.</b> Either party may terminate this Agreement for any reason on 30 days' notice.</p>
                <p style={{ color: "var(--evr-content-primary-lowemp)", fontSize: 12 }}>(This is a simplified preview. The full {agreement.id}.pdf has the complete clauses.)</p>
              </div>
            </div>
            {mode !== "view" && (
              <label className="wmic-accept">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>I have read and agree to the terms of this {agreement.type}.</span>
              </label>
            )}
          </React.Fragment>
        )}
      </Sheet>
    );
  }

  function InvoiceComposeSheet({ contractor, onClose, onToast }) {
    const [period, setPeriod] = useState("Last two weeks");
    const [hours, setHours]   = useState(String(contractor.weeklyHours * 2 || 40));
    const [notes, setNotes]   = useState("");
    const [mode, setMode]     = useState(contractor.rateType === "Hourly" ? "hourly" : "fixed");
    const [amount, setAmount] = useState(String(contractor.rateAmount));

    const computed = mode === "hourly" ? (Number(hours) || 0) * (contractor.rateAmount || 0) : (Number(amount) || 0);

    function submit() {
      const id = `CINV-${Math.floor(2100 + Math.random() * 900)}`;
      const newRow = {
        id, date: todayISO(), period,
        hours: mode === "hourly" ? Number(hours) : 0,
        amount: computed, currency: contractor.currency, status: "Submitted",
      };
      if (window.CONTRACTOR_INVOICES) {
        const cur = window.CONTRACTOR_INVOICES[contractor.id] || [];
        window.CONTRACTOR_INVOICES[contractor.id] = [newRow, ...cur];
      }
      onToast({ title: "Invoice submitted", msg: `${id} sent to Flex Work · ${fmtMoney(computed, contractor.currency)}` });
      onClose();
    }

    return (
      <Sheet
        title="New invoice"
        onClose={onClose}
        foot={(
          <React.Fragment>
            <button className="wmic-btn wmic-btn--secondary" onClick={onClose}>Cancel</button>
            <button className="wmic-btn wmic-btn--primary" disabled={computed <= 0} onClick={submit}>Submit invoice</button>
          </React.Fragment>
        )}
      >
        <div className="wmic-form">
          <label className="wmic-field">
            <span className="wmic-field-lbl">Period</span>
            <select className="wmic-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option>Last two weeks</option>
              <option>Last month</option>
              <option>This sprint</option>
              <option>Custom range</option>
            </select>
          </label>
          <label className="wmic-field">
            <span className="wmic-field-lbl">Billing mode</span>
            <select className="wmic-input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="hourly">Hourly (from {fmtMoney(contractor.rateAmount, contractor.currency)} / hr)</option>
              <option value="fixed">Fixed amount</option>
              <option value="auto">Auto-generate from approved time</option>
            </select>
          </label>
          {mode === "hourly" ? (
            <label className="wmic-field">
              <span className="wmic-field-lbl">Hours</span>
              <input className="wmic-input" type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
          ) : (
            <label className="wmic-field">
              <span className="wmic-field-lbl">Amount ({contractor.currency})</span>
              <input className="wmic-input" type="number" min="0" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
          )}
          <label className="wmic-field">
            <span className="wmic-field-lbl">Notes (optional)</span>
            <textarea className="wmic-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you work on?" />
          </label>
          <div className="wmic-callout">
            <I name="Calculate" size={14} />
            <span>Total invoiced: <b>{fmtMoney(computed, contractor.currency)}</b> · Paid Net 15 to your {contractor.payMethod} account</span>
          </div>
        </div>
      </Sheet>
    );
  }

  function DocUploadSheet({ requested, contractor, onClose, onToast }) {
    const [name, setName] = useState(requested ? requested.name : "");
    const [type, setType] = useState(requested ? requested.type : "Tax");
    const [expires, setExpires] = useState("");
    const [picked, setPicked] = useState(false);
    function submit() {
      const row = { name: name || "Untitled document", type, status: "Pending", expires: expires || "—" };
      if (window.CONTRACTOR_DOCS) {
        const cur = window.CONTRACTOR_DOCS[contractor.id] || [];
        window.CONTRACTOR_DOCS[contractor.id] = [...cur, row];
      }
      onToast({ title: "Document uploaded", msg: `${row.name} sent to Flex Work for review` });
      onClose();
    }
    return (
      <Sheet
        title={requested ? `Upload · ${requested.name}` : "Upload document"}
        onClose={onClose}
        foot={(
          <React.Fragment>
            <button className="wmic-btn wmic-btn--secondary" onClick={onClose}>Cancel</button>
            <button className="wmic-btn wmic-btn--primary" disabled={!picked || !name} onClick={submit}>Upload</button>
          </React.Fragment>
        )}
      >
        <div className="wmic-form">
          <div className={"wmic-drop" + (picked ? " wmic-drop--has" : "")} onClick={() => setPicked(true)}>
            <I name={picked ? "CheckCircle" : "FileUpload"} size={28} />
            <span>{picked ? "selfie-id-front.jpg · 1.4 MB" : "Tap to pick a file or take a photo"}</span>
            {!picked && <span className="wmic-drop-hint">PDF, JPG, or PNG — up to 10 MB</span>}
          </div>
          <label className="wmic-field">
            <span className="wmic-field-lbl">Document name</span>
            <input className="wmic-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="W-9 (2026)" />
          </label>
          <label className="wmic-field">
            <span className="wmic-field-lbl">Category</span>
            <select className="wmic-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option>Tax</option>
              <option>Identity</option>
              <option>Insurance</option>
              <option>License</option>
              <option>Other</option>
            </select>
          </label>
          <label className="wmic-field">
            <span className="wmic-field-lbl">Expires (optional)</span>
            <input className="wmic-input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
        </div>
      </Sheet>
    );
  }

  function ContactEditSheet({ contractor, kind, onClose, onToast }) {
    // Single sheet that handles the small profile-edit cases: contact,
    // address, tax preference, banking method. Banking updates inside
    // the quiet-window flag a Compliance review (read from the IC
    // program integration config if available).
    const cfg = (window.getContractorIntegrations ? window.getContractorIntegrations() : {});
    const quietDays = cfg.bankingQuietDays || 5;
    const [val, setVal] = useState(() => {
      if (kind === "address") return contractor.address || "";
      if (kind === "contact") return contractor.email || "";
      if (kind === "tax")     return contractor.taxForm || "W-9";
      if (kind === "banking") return contractor.payMethod || "ACH";
      return "";
    });
    const titles = { contact: "Contact details", address: "Mailing address", tax: "Tax form on file", banking: "Payment method" };
    function save() {
      // Patch in-place on the canonical record so other surfaces
      // re-derive. Banking change inside the quiet window kicks an
      // ops-review flag.
      const row = window.getContractorById ? window.getContractorById(contractor.id) : null;
      if (row) {
        if (kind === "contact") row.email = val;
        if (kind === "address") row.address = val;
        if (kind === "tax")     { row.taxForm = val; }
        if (kind === "banking") row.payMethod = val;
      }
      if (kind === "banking") {
        onToast({ title: "Banking updated", msg: `Compliance will re-verify before the next payment run · ${quietDays}-day quiet window` });
      } else {
        onToast({ title: "Saved", msg: `${titles[kind]} updated` });
      }
      onClose();
    }
    return (
      <Sheet
        title={titles[kind] || "Edit"}
        onClose={onClose}
        foot={(
          <React.Fragment>
            <button className="wmic-btn wmic-btn--secondary" onClick={onClose}>Cancel</button>
            <button className="wmic-btn wmic-btn--primary" onClick={save}>Save</button>
          </React.Fragment>
        )}
      >
        <div className="wmic-form">
          {kind === "address" && (
            <label className="wmic-field">
              <span className="wmic-field-lbl">Full address</span>
              <textarea className="wmic-input" rows={3} value={val} onChange={(e) => setVal(e.target.value)} />
              <span className="wmic-field-hint">Used on your year-end {contractor.taxForm === "W-9" ? "1099-NEC" : "1042-S"}. Changes after Jan 1 require re-verification.</span>
            </label>
          )}
          {kind === "contact" && (
            <React.Fragment>
              <label className="wmic-field">
                <span className="wmic-field-lbl">Email</span>
                <input className="wmic-input" type="email" value={val} onChange={(e) => setVal(e.target.value)} />
              </label>
              <span className="wmic-field-hint">We'll send a confirmation to the new address before switching.</span>
            </React.Fragment>
          )}
          {kind === "tax" && (
            <React.Fragment>
              <label className="wmic-field">
                <span className="wmic-field-lbl">Tax form</span>
                <select className="wmic-input" value={val} onChange={(e) => setVal(e.target.value)}>
                  <option>W-9</option>
                  <option>W-8BEN</option>
                  <option>W-8BEN-E</option>
                </select>
              </label>
              <span className="wmic-field-hint">After save, Flex Work emails you the e-sign request for the form. We file it once you sign.</span>
            </React.Fragment>
          )}
          {kind === "banking" && (
            <React.Fragment>
              <label className="wmic-field">
                <span className="wmic-field-lbl">Payment method</span>
                <select className="wmic-input" value={val} onChange={(e) => setVal(e.target.value)}>
                  {(window.getEnabledPaymentMethodsForCountry
                    ? window.getEnabledPaymentMethodsForCountry(contractor.country)
                    : ["ACH", "Wire", "Wise", "PayPal"]).map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <div className="wmic-callout">
                <I name="ShieldPerson" size={14} />
                <span>For your protection, banking changes inside the {quietDays}-day quiet window before a payment run are reviewed by Compliance.</span>
              </div>
            </React.Fragment>
          )}
        </div>
      </Sheet>
    );
  }

  function YearEndSheet({ contractor, onClose }) {
    const form = contractor.taxForm === "W-9" ? "1099-NEC"
              : contractor.country === "CA" ? "T4A"
              : "1042-S";
    return (
      <Sheet
        title={`Year-end · ${form}`}
        onClose={onClose}
        foot={<button className="wmic-btn wmic-btn--primary" onClick={onClose}>Done</button>}
      >
        <div className="wmic-form">
          <div className="wmic-pdf">
            <div className="wmic-pdf-head">
              <I name="File" size={16} />
              <span>{form} · {contractor.name} · 2025</span>
            </div>
            <div className="wmic-pdf-body">
              <p><b>Payer:</b> Flex Work Inc.</p>
              <p><b>Recipient:</b> {contractor.legalName || contractor.name}</p>
              <p><b>Recipient TIN:</b> •••• 4429</p>
              <p><b>Address:</b> {contractor.address}</p>
              <p><b>Box 1 · Nonemployee compensation (2025):</b> {fmtMoney(contractor.ytdPaid, contractor.currency)}</p>
              <p style={{ color: "var(--evr-content-primary-lowemp)", fontSize: 12 }}>(Filed by Flex Work via Track1099 · A copy was emailed to {contractor.email})</p>
            </div>
          </div>
          <button className="wmic-btn wmic-btn--secondary wmic-btn--full">
            <I name="FileDownload" size={16} />Download {form}.pdf
          </button>
        </div>
      </Sheet>
    );
  }

  // =================================================================
  // Top-level: the contractor view
  // =================================================================
  function WmContractorView({ contractor, onToast, onExit }) {
    const [tab, setTab] = useState("engagements");
    const [agreementSheet, setAgreementSheet] = useState(null);
    const [composeOpen, setComposeOpen] = useState(false);
    const [uploadSheet, setUploadSheet] = useState(null);
    const [editKind, setEditKind] = useState(null);
    const [yearEndOpen, setYearEndOpen] = useState(false);

    const ags = readAgreements(contractor.id);
    const pendingSig = ags.filter((a) => a.status === "Awaiting signature" || a.status === "Renewal due").length;
    const invsAll = readInvoices(contractor.id);
    const invsInFlight = invsAll.filter((r) => r.status === "Submitted" || r.status === "Approved").length;
    const docsRequested = (
      (contractor.country === "US" && !readDocs(contractor.id).find((d) => d.type === "Tax") ? 1 : 0)
      + (!readDocs(contractor.id).find((d) => d.type === "Identity") ? 1 : 0)
      + (contractor.weeklyHours >= 20 && !readDocs(contractor.id).find((d) => d.type === "Insurance") ? 1 : 0)
    );

    let body;
    if (tab === "engagements") {
      body = <EngagementsTab contractor={contractor} onToast={onToast} onOpenAgreement={(a, mode) => setAgreementSheet({ a, mode })} />;
    } else if (tab === "invoices") {
      body = <InvoicesTab contractor={contractor} onToast={onToast} onCompose={() => setComposeOpen(true)} />;
    } else if (tab === "documents") {
      body = <DocumentsTab contractor={contractor} onToast={onToast} onUpload={(d) => setUploadSheet(d || {})} />;
    } else {
      body = <ProfileTab contractor={contractor} onToast={onToast} onEdit={(k) => setEditKind(k)} onView1099={() => setYearEndOpen(true)} />;
    }

    return (
      <React.Fragment>
        <IcHeader title={tab === "engagements" ? "Engagements" : tab === "invoices" ? "Invoices" : tab === "documents" ? "Documents" : "Profile"} />
        {body}
        <IcTabBar tab={tab} onChange={setTab} badges={{ engagements: pendingSig, invoices: invsInFlight, documents: docsRequested }} />

        {agreementSheet && (
          <AgreementSheet
            agreement={agreementSheet.a}
            contractor={contractor}
            mode={agreementSheet.mode}
            onClose={() => setAgreementSheet(null)}
            onToast={onToast}
          />
        )}
        {composeOpen && (
          <InvoiceComposeSheet contractor={contractor} onClose={() => setComposeOpen(false)} onToast={onToast} />
        )}
        {uploadSheet !== null && (
          <DocUploadSheet
            requested={uploadSheet && uploadSheet.name ? uploadSheet : null}
            contractor={contractor}
            onClose={() => setUploadSheet(null)}
            onToast={onToast}
          />
        )}
        {editKind && (
          <ContactEditSheet
            contractor={contractor}
            kind={editKind}
            onClose={() => setEditKind(null)}
            onToast={onToast}
          />
        )}
        {yearEndOpen && (
          <YearEndSheet contractor={contractor} onClose={() => setYearEndOpen(false)} />
        )}
      </React.Fragment>
    );
  }

  Object.assign(window, {
    WmContractorView,
  });
})();
