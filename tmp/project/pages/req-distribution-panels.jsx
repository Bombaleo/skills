// =====================================================================
// Flex Work — Distribution & date helpers added in v1.1
//   · AirlineDateRange   — typeable two-date range chip with an inline
//                          calendar popover, modelled after airline
//                          booking widgets (Mon, Apr 20 → Sun, Apr 26).
//                          Replaces the old "Apr 20 – Apr 26, 2026" menu
//                          chip in the Schedule rail.
//   · PriorityAllPanel   — "View all" priority configuration. Side panel
//                          listing every supplier in tiered priority order
//                          with response windows, fill targets, drag rank.
//   · AgencyWorkersPanel — Per-supplier worker picker. Lets the user pick
//                          which specific workers to invite from each
//                          agency for a requisition.
// =====================================================================

const { useState: useStateRdp, useEffect: useEffectRdp, useRef: useRefRdp, useMemo: useMemoRdp } = React;

// ---------- Date helpers ------------------------------------------------

const RDP_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const RDP_MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const RDP_WEEKDAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function rdpToISO(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rdpFormat(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  const wd = RDP_WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
  return `${wd}, ${RDP_MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// Parse "Apr 20", "Apr 20 2026", "4/20", "4/20/2026", "2026-04-20"
function rdpParse(text, fallbackYear = 2026) {
  if (!text) return null;
  const s = String(text).trim();
  // ISO first
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // M/D or M/D/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : fallbackYear;
    return new Date(y, +m[1] - 1, +m[2]);
  }
  // "Apr 20" / "Apr 20, 2026" / "April 20 2026"
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/);
  if (m) {
    const monIdx = RDP_MONTHS.findIndex((mo) => mo.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    if (monIdx >= 0) return new Date(m[3] ? +m[3] : fallbackYear, monIdx, +m[2]);
  }
  return null;
}

function rdpAddDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function rdpStripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function rdpSame(a, b) { return a && b && rdpToISO(a) === rdpToISO(b); }
function rdpBetween(d, a, b) {
  if (!a || !b) return false;
  const t = +rdpStripTime(d);
  return t > +rdpStripTime(a) && t < +rdpStripTime(b);
}

// ---------- AirlineDateRange --------------------------------------------
//
// Two text inputs + an inline two-month calendar, anchored to a chip.
// • Type freely in either input → the date parses on blur / Enter.
// • Click any day in the calendar to set start; click a later day for end.
// • Click prev/next month chevrons.
// • Esc, outside-click, or "Apply" closes.

function AirlineDateRange({ start, end, onChange, today = (window.flexToday ? window.flexToday() : new Date(2026, 4, 19)) }) {
  const [open, setOpen] = useStateRdp(false);
  const [startText, setStartText] = useStateRdp(rdpFormat(start));
  const [endText, setEndText] = useStateRdp(rdpFormat(end));
  const [view, setView] = useStateRdp({ year: (start || today).getFullYear(), month: (start || today).getMonth() });
  // While selecting in the calendar, the next click is interpreted as the
  // end of the range. Setting `picking` to "start" lets the user re-pick
  // the first date by clicking it again.
  const [picking, setPicking] = useStateRdp("start"); // "start" | "end"
  const rootRef = useRefRdp(null);

  // Keep text in sync if props change externally
  useEffectRdp(() => { setStartText(rdpFormat(start)); }, [start && rdpToISO(start)]);
  useEffectRdp(() => { setEndText(rdpFormat(end)); }, [end && rdpToISO(end)]);

  useEffectRdp(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commitStart = () => {
    const d = rdpParse(startText, view.year);
    if (d) {
      onChange && onChange(d, end);
      setStartText(rdpFormat(d));
      setView({ year: d.getFullYear(), month: d.getMonth() });
      setPicking("end");
    } else {
      setStartText(rdpFormat(start));
    }
  };
  const commitEnd = () => {
    const d = rdpParse(endText, view.year);
    if (d) {
      onChange && onChange(start, d);
      setEndText(rdpFormat(d));
    } else {
      setEndText(rdpFormat(end));
    }
  };

  const onDayClick = (d) => {
    if (picking === "start") {
      onChange && onChange(d, end && +d <= +end ? end : rdpAddDays(d, 6));
      setStartText(rdpFormat(d));
      setEndText(rdpFormat(end && +d <= +end ? end : rdpAddDays(d, 6)));
      setPicking("end");
    } else {
      // If user picks a date earlier than start, treat as new start.
      if (start && +d < +start) {
        onChange && onChange(d, start);
        setStartText(rdpFormat(d));
        setEndText(rdpFormat(start));
        setPicking("end");
      } else {
        onChange && onChange(start, d);
        setEndText(rdpFormat(d));
        setPicking("start");
      }
    }
  };

  const nudgeMonth = (delta) => {
    setView(({ year, month }) => {
      const m = month + delta;
      if (m < 0) return { year: year - 1, month: 11 };
      if (m > 11) return { year: year + 1, month: 0 };
      return { year, month: m };
    });
  };

  const monthLabel1 = `${RDP_MONTHS[view.month]} ${view.year}`;
  const nextMonth = view.month === 11 ? { year: view.year + 1, month: 0 } : { year: view.year, month: view.month + 1 };
  const monthLabel2 = `${RDP_MONTHS[nextMonth.month]} ${nextMonth.year}`;

  return (
    <div className="adr-root" ref={rootRef}>
      <div
        className={"adr-chip" + (open ? " adr-chip--open" : "")}
        role="group"
        aria-label="Date range"
      >
        <span className="adr-cal-icon" aria-hidden="true">
          <Icon name="Calendar" size={16} />
        </span>
        <label className={"adr-field" + (picking === "start" && open ? " adr-field--active" : "")}>
          <span className="adr-field-label">Start</span>
          <input
            className="adr-input"
            value={startText}
            placeholder="Apr 20"
            onChange={(e) => setStartText(e.target.value)}
            onFocus={() => { setOpen(true); setPicking("start"); }}
            onBlur={commitStart}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitStart(); } }}
            aria-label="Start date"
            spellCheck={false}
          />
        </label>
        <span className="adr-sep" aria-hidden="true">
          <Icon name="ArrowRight" size={14} />
        </span>
        <label className={"adr-field" + (picking === "end" && open ? " adr-field--active" : "")}>
          <span className="adr-field-label">End</span>
          <input
            className="adr-input"
            value={endText}
            placeholder="Apr 26"
            onChange={(e) => setEndText(e.target.value)}
            onFocus={() => { setOpen(true); setPicking("end"); }}
            onBlur={commitEnd}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEnd(); } }}
            aria-label="End date"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="adr-toggle"
          aria-label={open ? "Close calendar" : "Open calendar"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="ChevronDown" size={16} />
        </button>
      </div>

      {open && (
        <div className="adr-pop" role="dialog" aria-label="Pick date range">
          <div className="adr-pop-head">
            <button type="button" className="adr-pop-nav" onClick={() => nudgeMonth(-1)} aria-label="Previous month">
              <Icon name="ChevronLeft" size={16} />
            </button>
            <div className="adr-pop-months">
              <span>{monthLabel1}</span>
              <span>{monthLabel2}</span>
            </div>
            <button type="button" className="adr-pop-nav" onClick={() => nudgeMonth(1)} aria-label="Next month">
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
          <div className="adr-pop-grid">
            <AdrMonth
              year={view.year}
              month={view.month}
              start={start}
              end={end}
              today={today}
              onPick={onDayClick}
            />
            <AdrMonth
              year={nextMonth.year}
              month={nextMonth.month}
              start={start}
              end={end}
              today={today}
              onPick={onDayClick}
            />
          </div>
          <div className="adr-pop-foot">
            <div className="adr-presets">
              <button type="button" className="adr-preset" onClick={() => {
                const s = new Date(today);
                const dow = (s.getDay() + 6) % 7;
                const monday = rdpAddDays(s, -dow);
                onChange && onChange(monday, rdpAddDays(monday, 6));
                setStartText(rdpFormat(monday));
                setEndText(rdpFormat(rdpAddDays(monday, 6)));
              }}>This week</button>
              <button type="button" className="adr-preset" onClick={() => {
                const s = new Date(today);
                const dow = (s.getDay() + 6) % 7;
                const monday = rdpAddDays(s, -dow + 7);
                onChange && onChange(monday, rdpAddDays(monday, 6));
                setStartText(rdpFormat(monday));
                setEndText(rdpFormat(rdpAddDays(monday, 6)));
              }}>Next week</button>
              <button type="button" className="adr-preset" onClick={() => {
                const s = new Date(today.getFullYear(), today.getMonth(), 1);
                const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                onChange && onChange(s, e);
                setStartText(rdpFormat(s));
                setEndText(rdpFormat(e));
              }}>This month</button>
            </div>
            <div className="adr-foot-actions">
              <button type="button" className="btn btn--md btn--tertiary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn--md btn--primary" onClick={() => setOpen(false)}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdrMonth({ year, month, start, end, today, onPick }) {
  const first = new Date(year, month, 1);
  // Sun=0..Sat=6 → shift to Mon-first (Mon=0..Sun=6)
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="adr-month">
      <div className="adr-month-dow">
        {RDP_WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="adr-dow">{d[0]}</span>
        ))}
      </div>
      <div className="adr-month-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`e-${i}`} className="adr-cell adr-cell--blank" />;
          const isStart = rdpSame(d, start);
          const isEnd = rdpSame(d, end);
          const isBetween = rdpBetween(d, start, end);
          const isToday = rdpSame(d, today);
          const cls = [
            "adr-cell",
            isStart && "adr-cell--start",
            isEnd && "adr-cell--end",
            isBetween && "adr-cell--in",
            isToday && !isStart && !isEnd && "adr-cell--today",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={rdpToISO(d)}
              type="button"
              className={cls}
              onClick={() => onPick(d)}
              aria-label={d.toDateString()}
            >
              <span className="adr-cell-day tabular">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- PriorityAllPanel --------------------------------------------
// A side panel that opens from new-requisition.jsx's "View all" link in
// the Priority section. Has two tabs:
//   · Priority — the classic ranked supplier list with response windows.
//   · Advanced — per-vendor allocation rules driven by a distribution
//                mode picker (Even split / Percentage / Tiered / Manual)
//                with one-click defaults.

const PAP_MODES = [
  { id: "percent", glyph: "%",  icon: "BarChart",    label: "Percentage",
    blurb: "Each supplier receives a fixed share of total demand." },
  { id: "manual",  glyph: "#",  icon: "Adjustment",  label: "Count",
    blurb: "Set an exact worker count per supplier." },
  { id: "variable", glyph: "~", icon: "Stack",       label: "Variable",
    blurb: "Platform adjusts each supplier's share automatically based on cascade order and recent fill performance." },
];

// Map a settings-level distributionMethod ("percent" / "count" / "variable")
// to the internal PriorityAllPanel mode id. Falls back to "manual".
function papModeFromMethod(method) {
  if (method === "percent")  return "percent";
  if (method === "variable") return "variable";
  return "manual";
}

// Even-split: distribute `total` across n suppliers, remainder to the top ranks.
function papEvenSplit(n, total) {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

// Apply mode to rows → return rows with `workers` recomputed.
function papApplyMode(rows, mode, demand) {
  if (!rows.length) return rows;
  if (mode === "percent") {
    // Largest-remainder so totals match exactly.
    const raw = rows.map((r) => demand * (Number(r.pct) || 0) / 100);
    const base = raw.map((v) => Math.floor(v));
    let used = base.reduce((a, b) => a + b, 0);
    const frac = raw.map((v, i) => ({ i, f: v - Math.floor(v) }))
      .sort((a, b) => b.f - a.f);
    let k = 0;
    while (used < demand && k < frac.length) {
      base[frac[k].i] += 1; used += 1; k += 1;
    }
    return rows.map((r, i) => ({ ...r, workers: base[i] }));
  }
  if (mode === "variable") {
    // Variable = cascade by tier. Tier 1 gets the demand split evenly across
    // its suppliers; lower tiers are warm backups (0 until escalation).
    const byTier = { 1: [], 2: [], 3: [] };
    rows.forEach((r, i) => { byTier[r.tier || 1].push(i); });
    const next = rows.map((r) => ({ ...r, workers: 0 }));
    const t1 = byTier[1];
    if (t1.length) {
      const split = papEvenSplit(t1.length, demand);
      t1.forEach((idx, k) => { next[idx].workers = split[k]; });
    }
    return next;
  }
  // manual — leave workers as-is
  return rows.map((r) => ({ ...r }));
}

// Seed percent + tier defaults from an unconfigured rows array.
function papSeedRows(rows) {
  const total = rows.reduce((a, r) => a + (Number(r.workers) || 0), 0);
  return rows.map((r, i) => ({
    ...r,
    pct: r.pct != null ? r.pct : (total > 0 ? Math.round((Number(r.workers) || 0) / total * 100) : Math.round(100 / Math.max(1, rows.length))),
    tier: r.tier != null ? r.tier : (i < 2 ? 1 : i < 4 ? 2 : 3),
  }));
}

function PriorityAllPanel({ open, onClose, value, onSave, initialTab, defaultMode = "manual", defaultWindow }) {
  // `initialTab` retained for back-compat with older call sites — the panel
  // is now a single unified screen.  Touch it so eslint doesn't whine.
  void initialTab;

  // The distribution method seeds from the org-wide default, but the user
  // can override it inline for this requisition. It controls the kind of
  // "Amt" input each row exposes:
  //   · manual   → exact worker count per supplier (a # input)
  //   · percent  → share of total demand (a % slider)
  //   · variable → tier picker (T1/T2/T3); platform auto-balances counts
  const [mode, setMode] = useStateRdp(defaultMode);
  const modeMeta = PAP_MODES.find((m) => m.id === mode) || PAP_MODES[1];
  const overridden = mode !== defaultMode;

  const [rows, setRows] = useStateRdp(papSeedRows(value || []));
  // Internal demand — used for the percent → workers conversion and as the
  // base for preset math.  No UI exposes it; instead it tracks the live
  // total of the table so presets feel intuitive ("split what's there").
  const [demand, setDemand] = useStateRdp(() => {
    const s = (value || []).reduce((a, r) => a + (Number(r.workers) || 0), 0);
    return s || Math.max((value || []).length, 4);
  });

  useEffectRdp(() => {
    if (!open) return;
    const seeded = papSeedRows(value || []);
    const withWindow = defaultWindow
      ? seeded.map((r) => ({ ...r, window: r.window || defaultWindow }))
      : seeded;
    const s = (value || []).reduce((a, r) => a + (Number(r.workers) || 0), 0);
    const startDemand = s || Math.max(withWindow.length, 4);
    setDemand(startDemand);
    setMode(defaultMode);
    setRows(defaultMode !== "manual" ? papApplyMode(withWindow, defaultMode, startDemand) : withWindow);
  }, [open, defaultMode]);

  // Switch the active distribution method.  Re-seeds the rows so the chosen
  // mode lands on a sensible default (carries existing splits forward where
  // possible, or evens them out) and recomputes the Amt column.
  const changeMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setRows((rs) => {
      if (next === "percent") {
        // Prefer to carry the user's existing worker counts forward as
        // percentages, so a switch from # → % feels lossless.
        const workersSum = rs.reduce((a, r) => a + (Number(r.workers) || 0), 0);
        if (workersSum > 0) {
          const raw = rs.map((r) => (Number(r.workers) || 0) / workersSum * 100);
          const pcts = raw.map((v) => Math.floor(v));
          let used = pcts.reduce((a, b) => a + b, 0);
          const frac = raw.map((v, i) => ({ i, f: v - Math.floor(v) }))
            .sort((a, b) => b.f - a.f);
          let k = 0;
          while (used < 100 && k < frac.length) { pcts[frac[k].i] += 1; used += 1; k += 1; }
          setDemand(workersSum);
          const seeded = rs.map((r, i) => ({ ...r, pct: pcts[i] }));
          return papApplyMode(seeded, "percent", workersSum);
        }
        const sum = rs.reduce((a, r) => a + (Number(r.pct) || 0), 0);
        if (Math.abs(sum - 100) > 1 || rs.every((r) => !r.pct)) {
          const split = papEvenSplit(rs.length, 100);
          const seeded = rs.map((r, i) => ({ ...r, pct: split[i] }));
          return papApplyMode(seeded, "percent", demand);
        }
        return papApplyMode(rs, "percent", demand);
      }
      if (next === "variable") {
        const seeded = rs.map((r, i) => ({ ...r, tier: r.tier || (i < 2 ? 1 : i < 4 ? 2 : 3) }));
        return papApplyMode(seeded, "variable", demand);
      }
      // → manual: keep current workers; if everything is zero, seed evenly.
      const workersSum = rs.reduce((a, r) => a + (Number(r.workers) || 0), 0);
      if (workersSum === 0) {
        const split = papEvenSplit(rs.length, demand);
        return rs.map((r, i) => ({ ...r, workers: split[i] }));
      }
      return rs;
    });
  };

  // ----- Add-supplier dropdown ---------------------------------------
  const [addOpen, setAddOpen] = useStateRdp(false);
  const addRef = useRefRdp(null);
  useEffectRdp(() => {
    if (!addOpen) return;
    const onDoc = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [addOpen]);

  // ----- Row helpers --------------------------------------------------
  const move = (idx, dir) => {
    setRows((rs) => {
      const next = rs.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((r, i) => ({ ...r, rank: i + 1 }));
    });
  };
  const updateRow = (idx, patch) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx) => {
    setRows((rs) => rs.filter((_, i) => i !== idx).map((r, i) => ({ ...r, rank: i + 1 })));
  };
  const addSupplier = (supplierId) => {
    setRows((rs) => [...rs, {
      rank: rs.length + 1, supplier: supplierId, workers: 0,
      window: defaultWindow || "30 min",
      pct: 0, tier: 2,
    }]);
    setAddOpen(false);
  };

  // ----- Quick-start presets -----------------------------------------
  // Each preset adapts its math to the active mode so a single chip ("Equal
  // share", "100% to top supplier", "Top two · 70 / 30") works regardless of
  // whether the org runs % / # / variable distribution.
  const applyPreset = (id) => {
    if (id === "even") {
      if (mode === "percent") {
        setRows((rs) => {
          const split = papEvenSplit(rs.length, 100);
          return papApplyMode(rs.map((r, i) => ({ ...r, pct: split[i], tier: 1 })), "percent", demand);
        });
      } else if (mode === "variable") {
        setRows((rs) => papApplyMode(rs.map((r) => ({ ...r, tier: 1 })), "variable", demand));
      } else {
        setRows((rs) => {
          const split = papEvenSplit(rs.length, demand);
          return rs.map((r, i) => ({ ...r, workers: split[i] }));
        });
      }
      showToast("Equal share applied to every supplier", { kind: "success" });
      return;
    }
    if (id === "single") {
      if (mode === "percent") {
        setRows((rs) => papApplyMode(
          rs.map((r, i) => ({ ...r, pct: i === 0 ? 100 : 0, tier: i === 0 ? 1 : 2 })),
          "percent", demand));
      } else if (mode === "variable") {
        setRows((rs) => papApplyMode(
          rs.map((r, i) => ({ ...r, tier: i === 0 ? 1 : 2 })),
          "variable", demand));
      } else {
        setRows((rs) => rs.map((r, i) => ({ ...r, workers: i === 0 ? demand : 0 })));
      }
      showToast("100% routed to top supplier", { kind: "success" });
      return;
    }
    if (id === "top-two") {
      if (mode === "percent") {
        setRows((rs) => papApplyMode(
          rs.map((r, i) => ({ ...r, pct: i === 0 ? 70 : i === 1 ? 30 : 0, tier: i < 2 ? 1 : 2 })),
          "percent", demand));
      } else if (mode === "variable") {
        setRows((rs) => papApplyMode(
          rs.map((r, i) => ({ ...r, tier: i < 2 ? 1 : 2 })),
          "variable", demand));
      } else {
        const share70 = Math.round(demand * 0.7);
        const share30 = demand - share70;
        setRows((rs) => rs.map((r, i) => ({
          ...r, workers: i === 0 ? share70 : i === 1 ? share30 : 0,
        })));
      }
      showToast("Top two suppliers · 70 / 30 split", { kind: "success" });
      return;
    }
    if (id === "cascade") {
      setRows((rs) => papApplyMode(
        rs.map((r, i) => ({ ...r, tier: i < 2 ? 1 : i < 4 ? 2 : 3 })),
        "variable", demand));
      showToast("Suppliers grouped into a 3-tier cascade", { kind: "success" });
      return;
    }
    if (id === "weighted") {
      const scorecards = (window.SCORECARDS) || {};
      setRows((rs) => {
        const weights = rs.map((r, i) => {
          const sc = scorecards[r.supplier];
          if (sc && sc.composite) return sc.composite;
          return [60, 25, 10, 5, 3, 2][i] || 1;
        });
        const sum = weights.reduce((a, b) => a + b, 0) || 1;
        const raw = weights.map((w) => w / sum * 100);
        const pcts = raw.map((v) => Math.floor(v));
        let used = pcts.reduce((a, b) => a + b, 0);
        const frac = raw.map((v, i) => ({ i, f: v - Math.floor(v) }))
          .sort((a, b) => b.f - a.f);
        let k = 0;
        while (used < 100 && k < frac.length) { pcts[frac[k].i] += 1; used += 1; k += 1; }
        const next = rs.map((r, i) => ({ ...r, pct: pcts[i], tier: 1 }));
        return mode === "percent" ? papApplyMode(next, "percent", demand) : next;
      });
      showToast("Share weighted by 90-day performance score", { kind: "success" });
      return;
    }
  };

  const availableToAdd = Object.keys(REQ_SUPPLIERS).filter(
    (id) => !rows.some((r) => r.supplier === id)
  );

  const totalWorkers = rows.reduce((s, r) => s + (Number(r.workers) || 0), 0);
  const pctTotal = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);

  // Available presets per mode — the chip set adapts so users never see a
  // preset that wouldn't make sense for their inherited method.
  const PRESETS = mode === "variable"
    ? [
        { id: "even",    icon: "Users", label: "Equal share" },
        { id: "single",  icon: "Bolt",  label: "100% to top supplier" },
        { id: "cascade", icon: "Stack", label: "3-tier cascade" },
      ]
    : mode === "percent"
      ? [
          { id: "even",     icon: "Users",       label: "Equal share" },
          { id: "single",   icon: "Bolt",        label: "100% to top supplier" },
          { id: "top-two",  icon: "BarChart",    label: "Top two · 70 / 30" },
          { id: "weighted", icon: "Performance", label: "Weighted by score" },
        ]
      : [
          { id: "even",    icon: "Users",    label: "Equal share" },
          { id: "single",  icon: "Bolt",     label: "100% to top supplier" },
          { id: "top-two", icon: "BarChart", label: "Top two · 70 / 30" },
        ];

  // The Amt header label changes per mode so users know what to expect.
  const amtHeader = mode === "percent" ? "Amt · %"
                  : mode === "variable" ? "Amt · tier"
                  : "Amt · #";

  // Subtitle in the side-panel header summarises the active method.
  const subTitle =
      mode === "percent"  ? `Set each supplier's % share · ${pctTotal}% of 100% allocated`
    : mode === "variable" ? `Group suppliers into cascade tiers · ${rows.length} suppliers`
    :                       `Set worker counts per supplier · ${totalWorkers} assigned`;

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <aside
        className={"side-panel side-panel--wide" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Distribution priority"
        aria-hidden={!open}
      >
        <header className="sp-head">
          <div>
            <h2>Distribution priority</h2>
            <p className="sp-sub">{subTitle}</p>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>
        <div className="sp-body">
          {/* Active method banner with inline override picker.  Defaults to
              the org-wide setting; user can switch for this requisition. */}
          <div className="prio-method-row">
            <div className="prio-method-summary">
              <span className="prio-method-glyph tabular" aria-hidden="true">{modeMeta.glyph}</span>
              <div className="prio-method-text">
                <span className="prio-method-label">
                  Distribution method <span className="prio-method-strong">{modeMeta.label}</span>
                  {overridden && (
                    <span className="prio-method-pill" title={`Org default is ${PAP_MODES.find((m) => m.id === defaultMode)?.label}`}>
                      Overridden
                    </span>
                  )}
                </span>
                <span className="prio-method-sub">{modeMeta.blurb}</span>
              </div>
            </div>
            <div className="prio-method-picker" role="radiogroup" aria-label="Distribution method">
              {PAP_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  className={"prio-method-opt" + (mode === m.id ? " prio-method-opt--on" : "")}
                  onClick={() => changeMode(m.id)}
                  title={m.label}
                >
                  <span className="prio-method-opt-glyph tabular" aria-hidden="true">{m.glyph}</span>
                  <span className="prio-method-opt-label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick-start presets. */}
          <div className="prio-presets" role="group" aria-label="Quick start presets">
            <span className="prio-presets-label">Quick start</span>
            <div className="prio-preset-chips">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="prio-preset"
                  onClick={() => applyPreset(p.id)}
                >
                  <Icon name={p.icon} size={14} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority list. */}
          <div className="prio-all">
            <div className="prio-all-head">
              <span style={{ width: 56 }}></span>
              <span style={{ flex: 1 }}>Supplier</span>
              <span className="prio-all-col prio-all-col--amt">{amtHeader}</span>
              <span className="prio-all-col">Response window</span>
              <span style={{ width: 80 }}></span>
            </div>
            {rows.map((p, idx) => {
              const supplier = REQ_SUPPLIERS[p.supplier] || REQ_SUPPLIERS.sw;
              const isBackup = mode === "variable" && (p.tier || 1) > 1;
              const metaLine = mode === "variable"
                ? (isBackup
                    ? `Tier ${p.tier} backup · escalated only if Tier ${(p.tier || 2) - 1} unfilled`
                    : `Primary fill · auto-assigned ${p.workers || 0} worker${p.workers === 1 ? "" : "s"}`)
                : mode === "percent"
                  ? `${p.pct || 0}% share · ${p.workers || 0} worker${p.workers === 1 ? "" : "s"}`
                  : (p.workers > 0
                      ? `${p.workers} worker${p.workers === 1 ? "" : "s"} assigned`
                      : "No workers assigned");
              return (
                <div key={p.supplier} className="prio-all-row">
                  <span className={"prio-badge" + ((p.workers === 0 && !isBackup) ? " prio-badge--off" : "")}>{p.rank}</span>
                  <span className="prio-all-supplier">
                    <ReqSupplierChip id={p.supplier} size={32} />
                    <span className="prio-all-supplier-text">
                      <span className="prio-all-supplier-name">{supplier.label}</span>
                      <span className="prio-all-supplier-meta">{metaLine}</span>
                    </span>
                  </span>

                  {/* Amt — varies by inherited method. */}
                  <span className="prio-all-col prio-all-col--amt prio-all-col--input">
                    {mode === "manual" && (
                      <input
                        type="number"
                        className="prio-all-num tabular"
                        min={0}
                        value={p.workers}
                        onChange={(e) => updateRow(idx, { workers: Math.max(0, Number(e.target.value) || 0) })}
                        aria-label={`${supplier.label} workers`}
                      />
                    )}
                    {mode === "percent" && (
                      <div className="prio-pct-control">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={p.pct || 0}
                          onChange={(e) => {
                            const next = Math.max(0, Math.min(100, Number(e.target.value)));
                            setRows((rs) => {
                              const patched = rs.map((r, i) => i === idx ? { ...r, pct: next } : r);
                              return papApplyMode(patched, "percent", demand);
                            });
                          }}
                          aria-label={`${supplier.label} share`}
                          className="prio-pct-slider"
                        />
                        <span className="prio-pct-readout tabular">{p.pct || 0}%</span>
                      </div>
                    )}
                    {mode === "variable" && (
                      <div className="prio-tier-seg" role="radiogroup" aria-label={`${supplier.label} tier`}>
                        {[1, 2, 3].map((t) => (
                          <button
                            key={t}
                            type="button"
                            role="radio"
                            aria-checked={(p.tier || 1) === t}
                            className={"prio-tier-pill prio-tier-pill--t" + t + ((p.tier || 1) === t ? " prio-tier-pill--on" : "")}
                            onClick={() => {
                              setRows((rs) => {
                                const patched = rs.map((r, i) => i === idx ? { ...r, tier: t } : r);
                                return papApplyMode(patched, "variable", demand);
                              });
                            }}
                          >
                            T{t}
                          </button>
                        ))}
                      </div>
                    )}
                  </span>

                  {/* Response window. */}
                  <span className="prio-all-col prio-all-col--input">
                    <select
                      className="prio-all-sel"
                      value={p.window || defaultWindow || "30 min"}
                      onChange={(e) => updateRow(idx, { window: e.target.value })}
                      aria-label={`${supplier.label} response window`}
                    >
                      <option>15 min</option>
                      <option>30 min</option>
                      <option>1 hour</option>
                      <option>2 hours</option>
                      <option>4 hours</option>
                      <option>24 hours</option>
                    </select>
                  </span>

                  {/* Reorder + remove. */}
                  <span className="prio-all-actions">
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Move ${supplier.label} up`}
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                    >
                      <Icon name="ChevronUp" size={16} />
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Move ${supplier.label} down`}
                      disabled={idx === rows.length - 1}
                      onClick={() => move(idx, 1)}
                    >
                      <Icon name="ChevronDown" size={16} />
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Remove ${supplier.label}`}
                      title="Remove supplier"
                      onClick={() => removeRow(idx)}
                    >
                      <Icon name="TrashCan" size={16} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Percent total readout — only shown when sums matter. */}
          {mode === "percent" && (
            <div className={"prio-pct-total" + (Math.abs(pctTotal - 100) > 0 ? " prio-pct-total--off" : "")}>
              <span className="prio-pct-total-label">Total share</span>
              <span className="prio-pct-total-val tabular">{pctTotal}% of 100%</span>
            </div>
          )}

          {/* Add another supplier from the catalog. */}
          <div
            ref={addRef}
            style={{ position: "relative", marginTop: 16, display: "flex", justifyContent: "flex-start" }}
          >
            <button
              type="button"
              className="btn btn--md btn--secondary"
              onClick={() => setAddOpen((o) => !o)}
              disabled={availableToAdd.length === 0}
              aria-haspopup="menu"
              aria-expanded={addOpen}
            >
              <Icon name="AddCircle" size={16} />
              {availableToAdd.length === 0 ? "All suppliers added" : "Add supplier"}
            </button>
            {addOpen && availableToAdd.length > 0 && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 240,
                  background: "var(--evr-surface-primary-default)",
                  border: "1px solid var(--evr-border-decorative-default)",
                  borderRadius: "var(--evr-radius-2xs)",
                  boxShadow: "var(--evr-depth-04)",
                  padding: 4,
                  zIndex: 10,
                }}
              >
                {availableToAdd.map((id) => {
                  const s = REQ_SUPPLIERS[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      onClick={() => addSupplier(id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "8px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "var(--evr-radius-3xs)",
                        font: "var(--evr-body2)",
                        color: "var(--evr-content-primary-default)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--evr-surface-primary-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <ReqSupplierChip id={id} size={24} />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <footer className="sp-foot">
          <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn--lg btn--primary"
            onClick={() => {
              const finalRows = mode !== "manual" ? papApplyMode(rows, mode, demand) : rows;
              onSave && onSave(finalRows);
              showToast("Distribution priority saved", { kind: "success" });
              onClose && onClose();
            }}
          >
            Save priority
          </button>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ---------- AwWorkerRow -------------------------------------------------
// Shared, enriched worker row used by both AgencyWorkersPanel and
// AllPreferredWorkersPanel. Pulls the same performance profile the
// Workforce tab uses (window.wfPerfFor) and lays the key signals out in
// a multi-column metric strip so the buyer can compare candidates
// without leaving the invite flow. `compact` drops to three metrics for
// the narrower multi-supplier picker.
function AwWorkerRow({ w, isSel, onToggle, compact = false }) {
  const Stars = window.WfStars;
  const perfFn = window.wfPerfFor || (() => ({ rating: 4.5, onTime: 0, reliability: 0, worked: 0, totalHours: 0, lastShiftDays: 0 }));
  const perf = perfFn(w);
  const lastShift = perf.lastShiftDays === 0 ? "Today"
    : perf.lastShiftDays === 1 ? "1d ago"
    : perf.lastShiftDays + "d ago";
  const statusCls = w.status === "Compliant" ? "ok" : w.status === "Onboarding" ? "warn" : "bad";
  const ratingNode = (
    <span className="aw-metric-rating">
      {Stars ? <Stars value={perf.rating} size={11} /> : null}
      <b className="tabular">{perf.rating.toFixed(1)}</b>
    </span>
  );
  const metrics = compact
    ? [
        { k: "Rating", node: ratingNode },
        { k: "On-time", node: <b className="tabular">{perf.onTime}%</b> },
        { k: "Shifts", node: <b className="tabular">{perf.worked}</b> },
      ]
    : [
        { k: "Rating", node: ratingNode },
        { k: "On-time", node: <b className="tabular">{perf.onTime}%</b> },
        { k: "Reliability", node: <b className="tabular">{perf.reliability}%</b> },
        { k: "Shifts", node: <b className="tabular">{perf.worked}</b> },
        { k: "Last shift", node: <b className="tabular">{lastShift}</b> },
      ];
  return (
    <label className={"aw-row aw-row--rich" + (compact ? " aw-row--compact" : "") + (isSel ? " aw-row--sel" : "")}>
      <input
        type="checkbox"
        checked={isSel}
        onChange={() => onToggle(w.id)}
        aria-label={`Select ${w.name}`}
        disabled={!w.available}
      />
      <WorkerAvatar w={w} size={40} />
      <div className="aw-row-main">
        <div className="aw-row-line">
          <span className="aw-row-name">{w.name}</span>
          {w.matched && (
            <span className="aw-row-match">
              <Icon name="Check" size={12} />
              Match
            </span>
          )}
          <span className={"aw-row-status aw-row-status--" + statusCls}>{w.status}</span>
        </div>
        <div className="aw-row-meta">
          <span>{w.jobs.join(" · ")}</span>
          <span aria-hidden="true">·</span>
          <span>{w.region}</span>
        </div>
      </div>
      <div className="aw-metrics" role="group" aria-label="Performance">
        {metrics.map((m) => (
          <div key={m.k} className="aw-metric">
            <span className="aw-metric-k">{m.k}</span>
            <span className="aw-metric-v">{m.node}</span>
          </div>
        ))}
      </div>
    </label>
  );
}

// ---------- AgencyWorkersPanel ------------------------------------------
// Lets the user pick specific workers from each agency for the
// requisition. Opens from a PriorityRow's "X workers" chip.

function AgencyWorkersPanel({ open, onClose, supplierId, jobs = [], initialSelected = [], onSave }) {
  const supplier = REQ_SUPPLIERS[supplierId] || REQ_SUPPLIERS.sw;
  const [tab, setTab] = useStateRdp("all"); // "all" | "available" | "selected"
  const [query, setQuery] = useStateRdp("");
  const [selected, setSelected] = useStateRdp(() => new Set(initialSelected));
  // Automatic worker invitations (Agency Pro) — effective delivery
  // strategy for this requisition, surfaced by the override bar below.
  const [inviteStrategy, setInviteStrategy] = useStateRdp("simultaneous");

  useEffectRdp(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setTab("all");
      setQuery("");
    }
  }, [open, supplierId]);

  const pool = useMemoRdp(() => {
    const workers = window.WORKERS || [];
    return workers
      .filter((w) => w.supplier === supplierId)
      .map((w) => ({
        ...w,
        available: w.status !== "Expired",
        matched: jobs.length === 0 || w.jobs.some((j) => jobs.includes(j)),
      }));
  }, [supplierId, jobs]);

  const visible = useMemoRdp(() => {
    let list = pool.slice();
    if (tab === "available") list = list.filter((w) => w.available);
    else if (tab === "selected") list = list.filter((w) => selected.has(w.id));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((w) =>
        w.name.toLowerCase().includes(q) ||
        w.jobs.some((j) => j.toLowerCase().includes(q))
      );
    }
    // matched workers first
    return list.sort((a, b) => (b.matched - a.matched) || a.name.localeCompare(b.name));
  }, [pool, tab, query, selected]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allCount = pool.length;
  const availCount = pool.filter((w) => w.available).length;
  const selCount = selected.size;

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <aside
        className={"side-panel side-panel--wide" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={`Select workers from ${supplier.label}`}
        aria-hidden={!open}
      >
        <header className="sp-head">
          <div className="aw-head">
            <ReqSupplierChip id={supplierId} size={32} />
            <div>
              <h2>{supplier.label}</h2>
              <p className="sp-sub">Select workers to invite for this requisition</p>
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>
        <div className="sp-body">
          {window.AgencyInviteOverrideBar && (
            <window.AgencyInviteOverrideBar
              positions={3}
              onStrategyChange={(c) => setInviteStrategy(c.strategy)}
            />
          )}
          <div className="aw-segments" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "all"}
              className={"aw-seg" + (tab === "all" ? " aw-seg--active" : "")}
              onClick={() => setTab("all")}
            >
              All<span className="aw-seg-count">{allCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "available"}
              className={"aw-seg" + (tab === "available" ? " aw-seg--active" : "")}
              onClick={() => setTab("available")}
            >
              Available<span className="aw-seg-count">{availCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "selected"}
              className={"aw-seg" + (tab === "selected" ? " aw-seg--active" : "")}
              onClick={() => setTab("selected")}
            >
              Selected<span className="aw-seg-count">{selCount}</span>
            </button>
          </div>

          <div className="bk-search aw-search">
            <span className="bk-search-icon" aria-hidden="true">
              <Icon name="Search" size={18} />
            </span>
            <input
              type="search"
              className="bk-search-input"
              placeholder={`Search ${supplier.label} workers`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search workers"
            />
          </div>

          <div className="aw-list">
            {visible.length === 0 ? (
              <div className="aw-empty">
                <Icon name="Search" size={24} />
                <p>No workers match.</p>
              </div>
            ) : visible.map((w) => (
              <AwWorkerRow key={w.id} w={w} isSel={selected.has(w.id)} onToggle={toggle} />
            ))}
          </div>
        </div>
        <footer className="sp-foot">
          <div className="aw-foot-meta">
            <span className="aw-foot-count tabular">{selCount}</span>
            <span>selected</span>
          </div>
          <div className="aw-foot-actions">
            <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--lg btn--primary"
              onClick={() => {
                onSave && onSave(Array.from(selected));
                const verb = inviteStrategy === "staggered" ? "scheduled" : "invited";
                showToast(`${selCount} ${supplier.label} worker${selCount === 1 ? "" : "s"} ${verb}`, { kind: "success" });
                onClose && onClose();
              }}
            >
              {inviteStrategy === "staggered"
                ? `Schedule ${selCount} invitation${selCount === 1 ? "" : "s"}`
                : inviteStrategy === "smart"
                  ? `Invite ${selCount} by score`
                  : `Invite ${selCount} worker${selCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

// ---------- AllPreferredWorkersPanel ------------------------------------
// "View all" companion to AgencyWorkersPanel. Lists every supplier in a
// left rail; the right pane is the same worker-picker that
// AgencyWorkersPanel uses but scoped to the currently-selected supplier.
// Selections are kept per supplier and saved as a single map.

function AllPreferredWorkersPanel({
  open, onClose, suppliers = [], jobs = [], initialSelections = {}, onSave,
}) {
  // Selections: { [supplierId]: Set<workerId> }
  const [selections, setSelections] = useStateRdp({});
  const [activeId,  setActiveId]  = useStateRdp(suppliers[0] || "sw");
  const [query, setQuery] = useStateRdp("");
  const [tab, setTab] = useStateRdp("all"); // "all" | "available" | "selected"

  useEffectRdp(() => {
    if (open) {
      const seeded = {};
      suppliers.forEach((id) => {
        seeded[id] = new Set(initialSelections[id] || []);
      });
      setSelections(seeded);
      setActiveId(suppliers[0] || "sw");
      setQuery("");
      setTab("all");
    }
  }, [open]);

  // Build a flat worker pool keyed by supplier so we can render counts in
  // the rail without recomputing on every keystroke.
  const supplierPools = useMemoRdp(() => {
    const all = window.WORKERS || [];
    const out = {};
    suppliers.forEach((id) => {
      const pool = all
        .filter((w) => w.supplier === id)
        .map((w) => ({
          ...w,
          available: w.status !== "Expired",
          matched: jobs.length === 0 || w.jobs.some((j) => jobs.includes(j)),
        }));
      out[id] = pool;
    });
    return out;
  }, [suppliers, jobs]);

  const activePool = supplierPools[activeId] || [];
  const activeSelected = selections[activeId] || new Set();

  const visible = useMemoRdp(() => {
    let list = activePool.slice();
    if (tab === "available") list = list.filter((w) => w.available);
    else if (tab === "selected") list = list.filter((w) => activeSelected.has(w.id));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((w) =>
        w.name.toLowerCase().includes(q) ||
        w.jobs.some((j) => j.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => (b.matched - a.matched) || a.name.localeCompare(b.name));
  }, [activePool, tab, query, activeSelected]);

  const toggle = (workerId) => {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[activeId] || []);
      if (set.has(workerId)) set.delete(workerId); else set.add(workerId);
      next[activeId] = set;
      return next;
    });
  };

  const supplierMeta = REQ_SUPPLIERS[activeId] || REQ_SUPPLIERS.sw;
  const allCount = activePool.length;
  const availCount = activePool.filter((w) => w.available).length;
  const selCount = activeSelected.size;
  const totalSelected = Object.values(selections).reduce(
    (a, s) => a + (s ? s.size : 0), 0
  );

  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <aside
        className={"side-panel side-panel--wide" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Select preferred workers from suppliers"
        aria-hidden={!open}
      >
        <header className="sp-head">
          <div>
            <h2>Preferred workers</h2>
            <p className="sp-sub">
              Pick the workers you'd like each supplier to invite first ·{" "}
              <span className="tabular">{totalSelected}</span> selected across{" "}
              <span className="tabular">{suppliers.length}</span> suppliers
            </p>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="X" size={20} />
          </button>
        </header>
        <div className="sp-body apw-body">
          <div className="apw-grid">
            {/* Supplier rail */}
            <nav className="apw-rail" aria-label="Suppliers">
              {suppliers.map((id) => {
                const meta = REQ_SUPPLIERS[id] || REQ_SUPPLIERS.sw;
                const sel = selections[id] ? selections[id].size : 0;
                const pool = supplierPools[id] || [];
                const isActive = id === activeId;
                return (
                  <button
                    key={id}
                    type="button"
                    className={"apw-rail-item" + (isActive ? " apw-rail-item--active" : "")}
                    onClick={() => { setActiveId(id); setQuery(""); setTab("all"); }}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <ReqSupplierChip id={id} size={32} />
                    <span className="apw-rail-text">
                      <span className="apw-rail-name">{meta.label}</span>
                      <span className="apw-rail-meta tabular">
                        {sel > 0 ? `${sel} of ${pool.length} selected` : `${pool.length} workers available`}
                      </span>
                    </span>
                    {sel > 0 && (
                      <span className="apw-rail-badge tabular" aria-label={`${sel} selected`}>{sel}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Worker picker */}
            <section className="apw-picker" aria-label={`${supplierMeta.label} workers`}>
              <div className="apw-picker-head">
                <ReqSupplierChip id={activeId} size={28} />
                <span className="apw-picker-title">{supplierMeta.label}</span>
              </div>

              <div className="aw-segments" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "all"}
                  className={"aw-seg" + (tab === "all" ? " aw-seg--active" : "")}
                  onClick={() => setTab("all")}
                >
                  All<span className="aw-seg-count">{allCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "available"}
                  className={"aw-seg" + (tab === "available" ? " aw-seg--active" : "")}
                  onClick={() => setTab("available")}
                >
                  Available<span className="aw-seg-count">{availCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "selected"}
                  className={"aw-seg" + (tab === "selected" ? " aw-seg--active" : "")}
                  onClick={() => setTab("selected")}
                >
                  Selected<span className="aw-seg-count">{selCount}</span>
                </button>
              </div>

              <div className="bk-search aw-search">
                <span className="bk-search-icon" aria-hidden="true">
                  <Icon name="Search" size={18} />
                </span>
                <input
                  type="search"
                  className="bk-search-input"
                  placeholder={`Search ${supplierMeta.label} workers`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search workers"
                />
              </div>

              <div className="aw-list apw-list">
                {visible.length === 0 ? (
                  <div className="aw-empty">
                    <Icon name="Search" size={24} />
                    <p>No workers match.</p>
                  </div>
                ) : visible.map((w) => (
                  <AwWorkerRow key={w.id} w={w} isSel={activeSelected.has(w.id)} onToggle={toggle} compact />
                ))}
              </div>
            </section>
          </div>
        </div>
        <footer className="sp-foot">
          <div className="aw-foot-meta">
            <span className="aw-foot-count tabular">{totalSelected}</span>
            <span>selected across all suppliers</span>
          </div>
          <div className="aw-foot-actions">
            <button type="button" className="btn btn--lg btn--tertiary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn--lg btn--primary"
              onClick={() => {
                // Convert Sets → plain arrays for downstream consumers.
                const out = {};
                Object.entries(selections).forEach(([sid, set]) => {
                  out[sid] = Array.from(set);
                });
                onSave && onSave(out);
                showToast(
                  `${totalSelected} preferred worker${totalSelected === 1 ? "" : "s"} saved`,
                  { kind: "success" }
                );
                onClose && onClose();
              }}
            >
              Save preferences
            </button>
          </div>
        </footer>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, {
  AirlineDateRange,
  PriorityAllPanel,
  AllPreferredWorkersPanel,
  papModeFromMethod,
  AgencyWorkersPanel,
});
