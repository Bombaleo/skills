// =====================================================================
// Flex Work — Professional Expenses (tenant-wide T&E view)
//   Standalone page that lists every expense report submitted under a
//   Professional engagement. Standard T&E report layout. Each row
//   ties to a worker, an SOW, and an
//   approval state in the same AP workflow as invoices.
//
//   Available from the Pro req details → Expenses link and from the
//   Pro worker detail → Expenses accordion's "Open in T&E" button.
// =====================================================================

const { useState: useStateProe, useMemo: useMemoProe } = React;

// ---------- Sample tenant-wide expense reports ------------------------
// Built deterministically from the Pro worker roster so any change to
// the roster flows through. Each row uses the standard T&E shape.
function _proeBuildReports() {
  const ws = (window.PROFESSIONAL_WORKERS_RAW || []);
  if (!ws.length) return [];
  const cats = ["Travel", "Lodging", "Meals", "Conference", "Software", "Hardware"];
  const months = ["April", "May"];
  const out = [];
  ws.forEach((w, wi) => {
    const seedH = (w.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const n = (seedH + wi) % 4;
    for (let i = 0; i < n; i++) {
      const r = (seedH + i * 13);
      const amount = 240 + (r % 1900);
      out.push({
        id: `EXP-${(seedH + i + wi).toString(36).toUpperCase().slice(-5)}`,
        worker: w.name,
        workerId: w.id,
        sowRef: w.sowRef,
        hiringManager: w.hiringManager,
        period: months[i % months.length] + ", week " + ((r % 4) + 1),
        submitted: `2026-${i === 0 ? "05" : "04"}-${((r % 25) + 1).toString().padStart(2, "0")}`,
        amount,
        currency: w.currency,
        lines: 2 + (r % 4),
        status: i === 0 ? "Submitted" : i === 1 ? "Approved" : "Paid",
        topCategory: cats[r % cats.length],
        country: w.country,
        flag: w.flag,
      });
    }
  });
  // Sort: Submitted first (oldest first), then Approved, then Paid.
  const order = { Submitted: 0, Approved: 1, Paid: 2 };
  out.sort((a, b) => (order[a.status] - order[b.status]) || a.submitted.localeCompare(b.submitted));
  return out;
}

const PROE_STATUS_TABS = [
  { id: "all",       label: "All"        },
  { id: "submitted", label: "Submitted"  },
  { id: "approved",  label: "Approved"   },
  { id: "paid",      label: "Paid"       },
];

function _proeFmtDate(s) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (e) { return s; }
}

function _proeMoney(n, ccy) {
  if (typeof window.profFmtMoney === "function") return window.profFmtMoney(n, ccy);
  return `${ccy || "USD"} ${n}`;
}

// =====================================================================
// Page
// =====================================================================
function ProfessionalExpensesPage({ onBack }) {
  const reports = useMemoProe(() => _proeBuildReports(), []);
  const [statusTab, setStatusTab] = useStateProe("all");
  const [query, setQuery] = useStateProe("");

  const counts = useMemoProe(() => ({
    all: reports.length,
    submitted: reports.filter((r) => r.status === "Submitted").length,
    approved: reports.filter((r) => r.status === "Approved").length,
    paid: reports.filter((r) => r.status === "Paid").length,
  }), [reports]);

  const filtered = useMemoProe(() => {
    let list = reports;
    if (statusTab !== "all") {
      const target = statusTab[0].toUpperCase() + statusTab.slice(1);
      list = list.filter((r) => r.status === target);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        r.worker.toLowerCase().includes(q)
        || r.id.toLowerCase().includes(q)
        || r.sowRef.toLowerCase().includes(q)
        || r.topCategory.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reports, statusTab, query]);

  // Totals across the currently-filtered set, grouped by currency
  // (multi-currency tenants are the norm — never collapse to a single sum).
  const totals = useMemoProe(() => {
    const m = {};
    for (const r of filtered) {
      if (!m[r.currency]) m[r.currency] = { count: 0, amount: 0 };
      m[r.currency].count += 1;
      m[r.currency].amount += r.amount;
    }
    return m;
  }, [filtered]);

  const statusHue = (s) => s === "Paid" ? "success" : s === "Approved" ? "informative" : "warning";

  return (
    <div className="proe-page" data-screen-label="Professional Expenses">
      <ReqOmnibar
        title="Professional Expenses"
        subtitle="T&E"
        onBack={onBack}
        actions={(
          <React.Fragment>
            <button type="button" className="iconbtn" aria-label="Reload" onClick={() => showToast("Expenses refreshed")}>
              <Icon name="Refresh" size={20} />
            </button>
            <button type="button" className="btn btn--md btn--secondary" onClick={() => showToast("Expense report builder opened (preview)")}>
              <Icon name="AddCircle" size={16} />New report
            </button>
          </React.Fragment>
        )}
      />

      <div className="content-section proe-content">
        <header className="proe-head">
          <div>
            <h1 className="proe-title">Expenses</h1>
            <p className="proe-sub">T&amp;E reports submitted under Professional engagements. Routes through the same AP approval workflow as invoices.</p>
          </div>
          <div className="proe-totals">
            {Object.entries(totals).length === 0 ? (
              <span className="proe-totals-empty">No reports in the current filter.</span>
            ) : (
              Object.entries(totals).map(([ccy, t]) => (
                <div key={ccy} className="proe-totals-card">
                  <span className="proe-totals-eyebrow">{ccy}</span>
                  <span className="proe-totals-amount tabular">{_proeMoney(t.amount, ccy)}</span>
                  <span className="proe-totals-sub">{t.count} report{t.count === 1 ? "" : "s"}</span>
                </div>
              ))
            )}
          </div>
        </header>

        <div className="proe-toolbar">
          <div className="inv-search" role="search">
            <Icon name="Search" size={16} />
            <input
              type="search"
              placeholder="Search reports, workers, SOW reference"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="proe-card">
          <div className="fw-tabs proe-tabs" role="tablist">
            {PROE_STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-pressed={statusTab === t.id}
                className="fw-tab"
                onClick={() => setStatusTab(t.id)}
              >
                {t.label}
                <span className="fw-tab-count">{counts[t.id] || 0}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="proe-empty">
              <Icon name="Wallet" size={28} />
              <p>No expense reports match the current filter.</p>
              <p className="proe-empty-sub">When workers submit reports under a Professional SOW, they appear here for approval and payment.</p>
            </div>
          ) : (
            <div className="proe-table" role="table">
              <div className="proe-row proe-row--head" role="row">
                <span>Report</span>
                <span>Worker</span>
                <span>SOW</span>
                <span>Period</span>
                <span>Top category</span>
                <span>Submitted</span>
                <span style={{ textAlign: "right" }}>Amount</span>
                <span>Status</span>
                <span></span>
              </div>
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="proe-row proe-row--clickable"
                  role="row"
                  onClick={() => showToast(`Opening ${r.id} (preview)`)}
                >
                  <span className="tabular proe-id">
                    <Icon name="Wallet" size={14} />{r.id}
                  </span>
                  <span className="proe-worker">
                    <span className={`fi fi-${r.flag}`} aria-hidden="true" style={{ width: 16, height: 12, borderRadius: 2, marginRight: 6 }}></span>
                    {r.worker}
                  </span>
                  <span className="tabular proe-sow">{r.sowRef}</span>
                  <span>{r.period}</span>
                  <span>{r.topCategory}</span>
                  <span className="tabular">{_proeFmtDate(r.submitted)}</span>
                  <span className="tabular" style={{ textAlign: "right" }}>{_proeMoney(r.amount, r.currency)}</span>
                  <span>
                    <span className={`req-pill req-pill--${statusHue(r.status)}`}>{r.status}</span>
                  </span>
                  <span style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="iconbtn iconbtn--sm" aria-label="More"
                      onClick={(e) => openMenu(e.currentTarget, [
                        { icon: "View",      label: "View report",       onClick: () => showToast(`Opening ${r.id}`) },
                        { icon: "Check",     label: "Approve",           onClick: () => showToast(`${r.id} approved`, { kind: "success" }) },
                        { icon: "Send",      label: "Forward to approver", onClick: () => showToast(`${r.id} forwarded`) },
                        { icon: "Export",    label: "Export receipt set", onClick: () => showToast(`${r.id} receipts exported`) },
                        { divider: true },
                        { icon: "Cancel",    label: "Reject", danger: true,
                          onClick: () => openConfirm({
                            title: `Reject ${r.id}?`,
                            body: `${r.worker}'s ${r.period} report will be returned with a request for changes.`,
                            primaryLabel: "Reject",
                            onConfirm: () => showToast(`${r.id} rejected`, { kind: "success" }),
                          }) },
                      ])}
                    >
                      <Icon name="MoreVert" size={14} />
                    </button>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pw-info-banner" role="note" style={{ marginTop: 16 }}>
          <span className="pw-info-banner-icon" aria-hidden="true">
            <Icon name="Information" size={14} />
          </span>
          <span className="pw-info-banner-text">
            <b>Expense reports are optional under Professional engagements.</b>
            <span> They route through the same AP approval workflow as invoices, but never affect the contract-cadence billing.</span>
          </span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ProfessionalExpensesPage,
});
