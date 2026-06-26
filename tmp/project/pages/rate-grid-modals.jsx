// =====================================================================
// Flex Work — Rate Grid · Modals   v1.48
//
//   · RgAddConditionModal — turn an addable condition into a column
//   · RgBulkAddModal      — one override line across many positions
//   · RgCoverageModal     — enumerate booking combinations + resolved rate
//   · RgExportModal       — download all lines as CSV
//   · RgImportModal       — paste CSV → rebuild the grid
//
// Reads the data layer from window.RG (pages/rate-grid.jsx). Loads
// AFTER rate-grid.jsx + req-shared.jsx (Dropdown), BEFORE app.jsx.
// =====================================================================

const { useState: useRgm, useMemo: useRgmMemo, useEffect: useRgmEffect } = React;

// ---------- Reusable centered modal shell ----------------------------
function RgModal({ open, title, sub, onClose, footer, wide, children }) {
  useRgmEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rg-modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className={"rg-modal" + (wide ? " rg-modal--wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <header className="rg-modal-head">
          <div className="rg-modal-titles">
            <h2 className="rg-modal-title">{title}</h2>
            {sub && <p className="rg-modal-sub">{sub}</p>}
          </div>
          <button type="button" className="rg-iconbtn" aria-label="Close" onClick={onClose}><Icon name="X" size={20} /></button>
        </header>
        <div className="rg-modal-body">{children}</div>
        {footer && <footer className="rg-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// =====================================================================
//  Add condition
// =====================================================================
function RgAddConditionModal({ open, active, onAdd, onClose }) {
  const RG = window.RG;
  const addable = Object.values(RG.CONDITIONS).filter((c) => !active.includes(c.key));
  return (
    <RgModal
      open={open}
      title="Add condition"
      sub="Conditions become columns. Existing lines default the new condition to [ALL]."
      onClose={onClose}
    >
      {addable.length === 0 ? (
        <p className="rg-modal-empty">Every condition is already a column.</p>
      ) : (
        <ul className="rg-condlist">
          {addable.map((c) => (
            <li key={c.key} className="rg-condlist-item">
              <div className="rg-condlist-text">
                <span className="rg-condlist-label">{c.label}</span>
                <span className="rg-condlist-values">{c.values.join(" · ")}</span>
              </div>
              <button
                type="button"
                className="vms-btn vms-btn--sm vms-btn--secondary"
                onClick={() => { onAdd(c.key); onClose(); }}
              >
                <Icon name="AddCircle" size={14} />Add column
              </button>
            </li>
          ))}
        </ul>
      )}
    </RgModal>
  );
}

// =====================================================================
//  Bulk add
// =====================================================================
function RgBulkAddModal({ open, active, onCreate, onClose }) {
  const RG = window.RG;
  const [picked, setPicked] = useRgm({});      // code -> bool
  const [cond, setCond] = useRgm({});           // key -> value | ALL
  const [rate, setRate] = useRgm(null);
  const [up, setUp] = useRgm(RG.uplift("pct", null));

  useRgmEffect(() => {
    if (open) { setPicked({}); setCond({}); setRate(null); setUp(RG.uplift("pct", null)); }
  }, [open]);

  const selectedCodes = RG.POSITIONS.filter((p) => picked[p.code]).map((p) => p.code);
  const canCreate = selectedCodes.length > 0 && rate != null && rate !== "";

  const create = () => {
    const cleanCond = {};
    active.forEach((k) => { const v = cond[k]; if (v != null && v !== RG.ALL) cleanCond[k] = v; });
    const rows = selectedCodes.map((code) => ({
      id: RG.uid(), pos: code, cond: { ...cleanCond }, rate: Number(rate), up: { ...up },
    }));
    onCreate(rows);
    onClose();
  };

  const allChecked = selectedCodes.length === RG.POSITIONS.length;

  return (
    <RgModal
      open={open}
      title="Bulk add override"
      sub="Create one override line — the same conditions and rate — on every selected position."
      onClose={onClose}
      footer={
        <React.Fragment>
          <span className="rg-modal-foot-note">
            {selectedCodes.length} {selectedCodes.length === 1 ? "position" : "positions"} selected
          </span>
          <div className="rg-modal-foot-actions">
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" disabled={!canCreate} onClick={create}>
              Create {selectedCodes.length > 0 ? `${selectedCodes.length} ` : ""}{selectedCodes.length === 1 ? "line" : "lines"}
            </button>
          </div>
        </React.Fragment>
      }
    >
      <div className="rg-bulk">
        <section className="rg-bulk-section">
          <div className="rg-bulk-sechead">
            <h3 className="rg-bulk-title">Positions</h3>
            <button
              type="button"
              className="rg-linkbtn"
              onClick={() => setPicked(allChecked ? {} : Object.fromEntries(RG.POSITIONS.map((p) => [p.code, true])))}
            >
              {allChecked ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="rg-checklist">
            {RG.POSITIONS.map((p) => (
              <li key={p.code}>
                <label className="rg-check">
                  <input
                    type="checkbox"
                    checked={!!picked[p.code]}
                    onChange={(e) => setPicked((s) => ({ ...s, [p.code]: e.target.checked }))}
                  />
                  <span className="rg-check-box" aria-hidden="true"><Icon name="Check" size={13} /></span>
                  <span className="rg-check-text">
                    <span className="rg-check-name">{p.name}</span>
                    <span className="rg-check-code">{p.code}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="rg-bulk-section">
          <h3 className="rg-bulk-title">Conditions</h3>
          <div className="rg-bulk-conds">
            {active.map((k) => {
              const def = RG.CONDITIONS[k];
              const opts = [{ value: RG.ALL, label: RG.ALL }].concat(def.values.map((v) => ({ value: v, label: v })));
              return (
                <div key={k} className="rg-bulk-cond">
                  <label className="rg-bulk-condlabel">{def.label}</label>
                  <Dropdown options={opts} value={cond[k] || RG.ALL} small onChange={(v) => setCond((s) => ({ ...s, [k]: v }))} />
                </div>
              );
            })}
            <div className="rg-bulk-cond">
              <label className="rg-bulk-condlabel">Rate</label>
              <span className="rg-rate-input">
                <span className="rg-cur" aria-hidden="true">{RG.CUR}</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={rate == null ? "" : rate} placeholder="0.00"
                  onChange={(e) => setRate(e.target.value === "" ? null : Number(e.target.value))} aria-label="Rate" />
              </span>
            </div>
          </div>
        </section>
      </div>
    </RgModal>
  );
}

// =====================================================================
//  Coverage check
// =====================================================================
function rgCartesian(arrays) {
  return arrays.reduce((acc, cur) => {
    const out = [];
    acc.forEach((a) => cur.forEach((c) => out.push(a.concat([c]))));
    return out;
  }, [[]]);
}

function RgCoverageModal({ open, state, onClose }) {
  const RG = window.RG;
  const [code, setCode] = useRgm(RG.POSITIONS[0].code);
  useRgmEffect(() => { if (open) setCode(RG.POSITIONS[0].code); }, [open]);

  const active = state.active;
  const valueArrays = active.map((k) => RG.CONDITIONS[k].values);
  const comboCount = valueArrays.reduce((n, a) => n * a.length, 1);
  const tooMany = comboCount > RG.MAX_COMBOS;

  const result = useRgmMemo(() => {
    if (!open || tooMany) return null;
    const combos = rgCartesian(valueArrays);
    const rows = combos.map((vals) => {
      const booking = {};
      active.forEach((k, i) => { booking[k] = vals[i]; });
      const res = RG.resolve(state, code, booking);
      return { vals, booking, res };
    });
    const counts = { override: 0, base: 0, none: 0 };
    rows.forEach((r) => { counts[r.res.source] += 1; });
    return { rows, counts };
  }, [open, code, state, tooMany]);

  const pos = RG.POSITIONS.find((p) => p.code === code);

  return (
    <RgModal
      open={open}
      title="Coverage check"
      sub="Resolve every booking combination for a position and see which line wins."
      wide
      onClose={onClose}
      footer={
        result ? (
          <div className="rg-cov-summary">
            <span className="rg-cov-stat"><span className="rg-cov-dot rg-cov-dot--override" />{result.counts.override} from override</span>
            <span className="rg-cov-stat"><span className="rg-cov-dot rg-cov-dot--base" />{result.counts.base} from base</span>
            <span className="rg-cov-stat"><span className="rg-cov-dot rg-cov-dot--none" />{result.counts.none} no rate</span>
          </div>
        ) : null
      }
    >
      <div className="rg-cov-picker">
        <label className="rg-bulk-condlabel">Position</label>
        <Dropdown
          options={RG.POSITIONS.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
          value={code}
          onChange={setCode}
        />
        <span className="rg-cov-count">{comboCount} {comboCount === 1 ? "combination" : "combinations"}</span>
      </div>

      {tooMany ? (
        <div className="rg-banner rg-banner--warning" style={{ marginTop: 16 }}>
          <Icon name="Alert" size={18} />
          <div className="rg-banner-body">
            <strong>{comboCount} combinations is too many to enumerate.</strong>
            <span> Remove a condition column (the limit is {RG.MAX_COMBOS}) and run the coverage check again.</span>
          </div>
        </div>
      ) : (
        <div className="rg-cov-tablewrap">
          <table className="rg-cov-table">
            <thead>
              <tr>
                {active.map((k) => <th key={k}>{RG.CONDITIONS[k].label}</th>)}
                <th className="rg-cov-rate-col">Resolved rate</th>
                <th className="rg-cov-rate-col">Season rate</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {result && result.rows.map((r, i) => (
                <tr key={i} className={r.res.source === "none" ? "rg-cov-row--none" : ""}>
                  {r.vals.map((v, j) => <td key={j}>{v}</td>)}
                  <td className="rg-cov-rate-col">{r.res.rate == null ? "—" : RG.fmtRate(r.res.rate)}</td>
                  <td className="rg-cov-rate-col">
                    {r.res.eff == null ? "—" : RG.fmtRate(r.res.eff)}
                    {r.res.up && r.res.up.val != null && <span className="rg-cov-up">{RG.fmtUplift(r.res.up)}</span>}
                  </td>
                  <td>
                    <span className={"rg-cov-pill rg-cov-pill--" + r.res.source}>
                      {r.res.source === "override" ? "Override" : r.res.source === "base" ? "Base" : "No rate"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pos && (state.bases[pos.code] == null || state.bases[pos.code] === "") && (
            <p className="rg-cov-note"><Icon name="Alert" size={13} />{pos.name} has no base rate, so combinations with no matching override resolve to no rate.</p>
          )}
        </div>
      )}
    </RgModal>
  );
}

// =====================================================================
//  Custom lookup — edit the lookup order used to resolve a rate
// =====================================================================
function RgLookupModal({ open, state, onApply, onClose }) {
  const RG = window.RG;
  const [order, setOrder] = useRgm(RG.lookupOrder(state));
  const [dragIdx, setDragIdx] = useRgm(null);
  const [overIdx, setOverIdx] = useRgm(null);

  useRgmEffect(() => {
    if (open) { setOrder(RG.lookupOrder(state)); }
  }, [open]);

  const move = (from, to) => {
    if (from == null || to == null || from === to || to < 0 || to >= order.length) return;
    setOrder((prev) => { const a = prev.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });
  };

  const apply = () => { onApply({ lookup: order }); onClose(); };

  // Two example fields to narrate the lookup-order rule.
  const top = order[0] ? RG.CONDITIONS[order[0]] : null;
  const second = order[1] ? RG.CONDITIONS[order[1]] : null;

  return (
    <RgModal
      open={open}
      title="Rate custom lookup"
      sub="Set the field order a booking uses to find its rate among the lines that match it."
      onClose={onClose}
      footer={
        <React.Fragment>
          <span className="rg-modal-foot-note">Custom lookup order</span>
          <div className="rg-modal-foot-actions">
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={apply}>Apply lookup</button>
          </div>
        </React.Fragment>
      }
    >
      <div className="rg-lookup">
        <section className="rg-lookup-order">
          <h3 className="rg-bulk-title">Lookup order</h3>
          <p className="rg-lookup-hint">Drag to reorder, or use the arrows. Highest weight is at the top.</p>
          {order.length === 0 ? (
            <p className="rg-modal-empty">No condition columns yet. Add a condition first.</p>
          ) : (
            <ol className="rg-ranklist">
              {order.map((k, i) => (
                <li
                  key={k}
                  className={"rg-rankrow" + (dragIdx === i ? " is-dragging" : "") + (overIdx === i ? " is-over" : "")}
                  draggable
                  onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  onDrop={(e) => { e.preventDefault(); move(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                >
                  <Icon name="ArrowsUpDownSmall" size={16} className="rg-rank-grip" />
                  <span className="rg-rank-num">{i + 1}</span>
                  <span className="rg-rank-label">{RG.CONDITIONS[k].label}</span>
                  <span className="rg-rank-vals">{RG.CONDITIONS[k].values.join(" · ")}</span>
                  <span className="rg-rank-moves">
                    <button type="button" className="rg-iconbtn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="ChevronUp" size={16} /></button>
                    <button type="button" className="rg-iconbtn" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, i + 1)}><Icon name="ChevronDown" size={16} /></button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {top && second && (
            <p className="rg-lookup-eg">
              <Icon name="Information" size={14} />
              A line that sets <strong>{top.label}</strong> wins over a line that only sets <strong>{second.label}</strong>.
            </p>
          )}
        </section>
      </div>
    </RgModal>
  );
}

// =====================================================================
//  CSV export / import
// =====================================================================
function rgCsvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function rgBuildCsv(state) {
  const RG = window.RG;
  const active = state.active;
  const header = ["Position", "Job Code"].concat(active.map((k) => RG.CONDITIONS[k].label)).concat(["Rate", "Season uplift"]);
  const lines = [header.map(rgCsvEscape).join(",")];
  const upCell = (up) => {
    if (!up || up.val == null || up.val === "") return "";
    return up.type === "abs" ? Number(up.val).toFixed(2) : Number(up.val) + "%";
  };
  RG.POSITIONS.forEach((p) => {
    // base first (all [ALL]) when present
    const base = state.bases[p.code];
    if (base != null && base !== "") {
      const bu = (state.baseUp && state.baseUp[p.code]) || null;
      lines.push([p.name, p.code].concat(active.map(() => RG.ALL)).concat([Number(base).toFixed(2), upCell(bu)]).map(rgCsvEscape).join(","));
    }
    state.overrides.filter((o) => o.pos === p.code).forEach((o) => {
      const cells = active.map((k) => (o.cond[k] != null && o.cond[k] !== RG.ALL ? o.cond[k] : RG.ALL));
      lines.push([p.name, p.code].concat(cells).concat([o.rate == null ? "" : Number(o.rate).toFixed(2), upCell(o.up)]).map(rgCsvEscape).join(","));
    });
  });
  return lines.join("\n");
}

function RgExportModal({ open, state, onClose }) {
  const RG = window.RG;
  const csv = useRgmMemo(() => (open ? rgBuildCsv(state) : ""), [open, state]);
  const download = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rate-grid.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const lineCount = csv ? csv.split("\n").length - 1 : 0;
  return (
    <RgModal
      open={open}
      title="Export CSV"
      sub="All rate lines, grouped by position. The base line shows every condition as [ALL]."
      onClose={onClose}
      footer={
        <div className="rg-modal-foot-actions" style={{ marginLeft: "auto" }}>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onClose}>Close</button>
          <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" onClick={download}>
            <Icon name="Export" size={14} />Download {lineCount} {lineCount === 1 ? "line" : "lines"}
          </button>
        </div>
      }
    >
      <pre className="rg-csv-preview" aria-label="CSV preview">{csv}</pre>
    </RgModal>
  );
}

// Parse a CSV string into rows of string arrays (handles quoted cells).
function rgParseCsv(text) {
  const rows = [];
  let row = [], cell = "", i = 0, inQ = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; i++; continue;
    }
    cell += ch; i++;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function RgImportModal({ open, state, onImport, onClose }) {
  const RG = window.RG;
  const [text, setText] = useRgm("");
  const [err, setErr] = useRgm(null);
  useRgmEffect(() => { if (open) { setText(""); setErr(null); } }, [open]);

  const preview = useRgmMemo(() => {
    if (!text.trim()) return null;
    try {
      const rows = rgParseCsv(text);
      if (rows.length < 2) return { error: "Needs a header row plus at least one data row." };
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const codeIdx = header.findIndex((h) => h === "job code" || h === "job_code" || h === "code");
      const nameIdx = header.findIndex((h) => h === "position");
      const rateIdx = header.findIndex((h) => h === "rate");
      const upIdx = header.findIndex((h) => h === "season uplift" || h === "uplift");
      if (rateIdx < 0) return { error: "No Rate column found." };
      if (codeIdx < 0 && nameIdx < 0) return { error: "No Position or Job Code column found." };
      // match condition columns by label
      const condCols = {}; // key -> column index
      RG.POSITIONS; // noop
      state.active.forEach((k) => {
        const lbl = RG.CONDITIONS[k].label.toLowerCase();
        const idx = header.findIndex((h) => h === lbl);
        if (idx >= 0) condCols[k] = idx;
      });
      const byCode = {};
      RG.POSITIONS.forEach((p) => { byCode[p.code.toLowerCase()] = p.code; });
      const byName = {};
      RG.POSITIONS.forEach((p) => { byName[p.name.toLowerCase()] = p.code; });

      const bases = {};
      RG.POSITIONS.forEach((p) => { bases[p.code] = null; });
      const baseUp = {};
      RG.POSITIONS.forEach((p) => { baseUp[p.code] = RG.uplift("pct", null); });
      const overrides = [];
      // Parse a season-uplift cell: "5%" → pct 5, "1.25" → abs 1.25, "" → none.
      const parseUp = (raw) => {
        const s = (raw || "").trim();
        if (s === "") return RG.uplift("pct", null);
        if (s.endsWith("%")) { const n = Number(s.slice(0, -1)); return RG.uplift("pct", isNaN(n) ? null : n); }
        const n = Number(s.replace(/[£$€,]/g, ""));
        return RG.uplift("abs", isNaN(n) ? null : n);
      };
      let skipped = 0, baseCount = 0, ovCount = 0;
      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        const codeRaw = (codeIdx >= 0 ? cells[codeIdx] : "") || "";
        const nameRaw = (nameIdx >= 0 ? cells[nameIdx] : "") || "";
        const code = byCode[codeRaw.trim().toLowerCase()] || byName[nameRaw.trim().toLowerCase()];
        if (!code) { skipped++; continue; }
        const rateRaw = (cells[rateIdx] || "").trim();
        const rate = rateRaw === "" ? null : Number(rateRaw);
        const up = upIdx >= 0 ? parseUp(cells[upIdx]) : RG.uplift("pct", null);
        const cond = {};
        let allWild = true;
        state.active.forEach((k) => {
          const idx = condCols[k];
          let v = idx != null ? (cells[idx] || "").trim() : "";
          if (v === "" ) v = RG.ALL;          // missing cell defaults to [ALL]
          if (v !== RG.ALL) {
            // only accept values in the fixed list; otherwise treat as wildcard
            if (RG.CONDITIONS[k].values.includes(v)) { cond[k] = v; allWild = false; }
          }
        });
        if (allWild) {
          if (rate != null) { bases[code] = rate; baseUp[code] = up; baseCount++; }
        } else {
          overrides.push({ id: RG.uid(), pos: code, cond, rate, up });
          ovCount++;
        }
      }
      return { bases, baseUp, overrides, baseCount, ovCount, skipped };
    } catch (e) {
      return { error: "Could not parse the CSV. Check the format and try again." };
    }
  }, [text, state]);

  const apply = () => {
    if (!preview || preview.error) { setErr(preview ? preview.error : "Paste some CSV first."); return; }
    const next = {
      active: state.active.slice(),
      lookup: (state.lookup || state.active).slice(),
      bases: preview.bases,
      baseUp: preview.baseUp,
      overrides: preview.overrides,
    };
    onImport(next);
    onClose();
  };

  return (
    <RgModal
      open={open}
      title="Import CSV"
      sub="Paste rows in the same format as Export. Condition columns match by label; missing cells default to [ALL]. Season uplift reads 5% or a fixed amount. Rows replace the current grid."
      onClose={onClose}
      footer={
        <React.Fragment>
          <span className="rg-modal-foot-note">
            {preview && !preview.error && `${preview.baseCount} base · ${preview.ovCount} override${preview.skipped ? ` · ${preview.skipped} skipped` : ""}`}
          </span>
          <div className="rg-modal-foot-actions">
            <button type="button" className="vms-btn vms-btn--sm vms-btn--secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="vms-btn vms-btn--sm vms-btn--primary" disabled={!preview || !!preview.error} onClick={apply}>Replace grid</button>
          </div>
        </React.Fragment>
      }
    >
      <textarea
        className="rg-csv-input"
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(null); }}
        placeholder={"Position,Job Code," + state.active.map((k) => RG.CONDITIONS[k].label).join(",") + ",Rate,Season uplift\nOperative Days,DIS217," + state.active.map(() => "[ALL]").join(",") + ",14.31,5%"}
        spellCheck={false}
      />
      {(err || (preview && preview.error)) && (
        <p className="rg-csv-err"><Icon name="Alert" size={14} />{err || preview.error}</p>
      )}
    </RgModal>
  );
}

Object.assign(window, {
  RgAddConditionModal, RgBulkAddModal, RgCoverageModal, RgLookupModal, RgExportModal, RgImportModal,
});
