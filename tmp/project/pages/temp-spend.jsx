// =====================================================================
// Flex Work — Temp spend tier
//   The demo can be scaled to simulate orgs of dramatically different
//   sizes. Picking a tier (e.g. "$50M") changes the headline numbers
//   across the prototype — shifts/year, spend, workers, locations,
//   suppliers, multi-national footprint — so the same UI reads as a
//   small business at $1M and as a global enterprise at $500M+.
//
//   Tier is persisted to localStorage (`flexwork.tempSpend`) and read at
//   page-load. The other data modules (vms-data, analytics, insights,
//   budgets, …) read TEMP_SPEND_SCALE at module-evaluation time and
//   multiply their seed numbers through it. Changing the tier therefore
//   triggers a full page reload so module-level const arrays
//   re-evaluate with the new scale.
//
//   Anchor: the seed data in the prototype was hand-tuned to feel like
//   a ~$10M organization, so the "10m" tier is the identity scale = 1.0.
//   Every other tier multiplies through (tier.spend / 10M). A tiny 0.10
//   floor keeps the smallest tier looking plausible without zeroing out
//   the unique non-numeric content of the seed data.
// =====================================================================

const TEMP_SPEND_TIERS = [
  { id: "1m",   spend: 1_000_000,   label: "$1M",    short: "1M",   shiftsYear:    1_800,   workers:     60, locations:   2, suppliers:  2, countries:  1, multiNational: false, segment: "Small business",       blurb: "Single-region, 1\u20132 sites, a few suppliers." },
  { id: "5m",   spend: 5_000_000,   label: "$5M",    short: "5M",   shiftsYear:    9_000,   workers:    280, locations:   8, suppliers:  4, countries:  1, multiNational: false, segment: "Mid-market",           blurb: "Regional operator with a handful of sites." },
  { id: "10m",  spend: 10_000_000,  label: "$10M",   short: "10M",  shiftsYear:   18_000,   workers:    560, locations:  15, suppliers:  7, countries:  1, multiNational: false, segment: "Mid-market",           blurb: "Multi-site domestic program. Baseline demo.", baseline: true },
  { id: "25m",  spend: 25_000_000,  label: "$25M",   short: "25M",  shiftsYear:   45_000,   workers:  1_400, locations:  32, suppliers: 14, countries:  1, multiNational: false, segment: "Upper mid-market",     blurb: "National footprint, dozens of sites." },
  { id: "50m",  spend: 50_000_000,  label: "$50M",   short: "50M",  shiftsYear:   90_000,   workers:  2_800, locations:  62, suppliers: 22, countries:  2, multiNational: true,  segment: "Enterprise",           blurb: "Cross-border, multi-currency, 60+ sites." },
  { id: "100m", spend: 100_000_000, label: "$100M",  short: "100M", shiftsYear:  180_000,   workers:  5_600, locations: 120, suppliers: 38, countries:  4, multiNational: true,  segment: "Enterprise",           blurb: "Continental program, 100+ sites." },
  { id: "250m", spend: 250_000_000, label: "$250M",  short: "250M", shiftsYear:  450_000,   workers: 14_000, locations: 240, suppliers: 60, countries:  9, multiNational: true,  segment: "Global enterprise",    blurb: "Multi-continent, 200+ sites." },
  { id: "500m", spend: 500_000_000, label: "$500M+", short: "500M+",shiftsYear: 1_050_000,  workers: 32_000, locations: 480, suppliers: 95, countries: 22, multiNational: true,  segment: "Global enterprise",    blurb: "1M+ shifts/yr, hundreds of locations, 20+ countries." },
];

const TEMP_SPEND_BY_ID = TEMP_SPEND_TIERS.reduce((acc, t) => { acc[t.id] = t; return acc; }, {});
const TEMP_SPEND_BASELINE_ID = "10m";
const TEMP_SPEND_BASELINE = TEMP_SPEND_BY_ID[TEMP_SPEND_BASELINE_ID];

function getCurrentTempSpendId() {
  try {
    const stored = window.localStorage.getItem("flexwork.tempSpend");
    if (stored && TEMP_SPEND_BY_ID[stored]) return stored;
  } catch (e) { /* no-op */ }
  return TEMP_SPEND_BASELINE_ID;
}
function setCurrentTempSpendId(id) {
  if (!TEMP_SPEND_BY_ID[id]) return;
  try { window.localStorage.setItem("flexwork.tempSpend", id); } catch (e) {}
}
function getTempSpend() {
  return TEMP_SPEND_BY_ID[getCurrentTempSpendId()] || TEMP_SPEND_BASELINE;
}

// Scale factor relative to the $10M baseline. The seed data files
// multiply their hardcoded numbers through this at module-eval time.
const TEMP_SPEND_SCALE = (getTempSpend().spend / TEMP_SPEND_BASELINE.spend);

// ---------- Number scaling helpers ------------------------------------
//   scaleN(n)         — multiply by scale, round to integer
//   scaleN(n, "k")    — round to nearest 100 (for thousands-range values)
//   scaleN(n, "10k")  — round to nearest 1,000
//   scaleN(n, "100k") — round to nearest 10,000
//   scaleMoney(n)     — alias for scaleN(n); use when the value is $-denominated
//   scaleSmall(n)     — for small integer counts (workers on a shift, etc.)
//                       — never go below 1 unless the scale is < 0.5 AND the
//                       input was already >= 2.
const TS_ROUND = {
  "k":    100,
  "10k":  1_000,
  "100k": 10_000,
  "1m":   100_000,
};
function scaleN(n, grain) {
  if (typeof n !== "number" || !isFinite(n)) return n;
  const v = n * TEMP_SPEND_SCALE;
  const step = TS_ROUND[grain];
  if (step) return Math.max(0, Math.round(v / step) * step);
  return Math.round(v);
}
function scaleMoney(n, grain) { return scaleN(n, grain); }
function scaleSmall(n) {
  if (typeof n !== "number" || !isFinite(n)) return n;
  const v = n * TEMP_SPEND_SCALE;
  if (v < 1 && n >= 1 && TEMP_SPEND_SCALE >= 0.5) return 1;
  return Math.round(v);
}

// Format a scaled money value into a short string ($1.2M, $84k, $620).
// Reads the active currency symbol so country switches still apply.
function scaleMoneyShort(n) {
  const sym = (typeof window !== "undefined" && window.curSymbol) ? window.curSymbol() : "$";
  const v = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (v >= 1_000_000_000) return `${sign}${sym}${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${sign}${sym}${(v / 1_000_000).toFixed(v >= 100_000_000 ? 0 : 1)}M`;
  if (v >= 1_000)         return `${sign}${sym}${Math.round(v / 1_000)}k`;
  return `${sign}${sym}${Math.round(v).toLocaleString("en-US")}`;
}

// Apply scaling to every numeric field of a record (deep). Useful for
// scaling the supplier-split objects in SPEND_WEEKLY. Strings are left
// alone. Returns a NEW object — does not mutate input.
function scaleRecord(rec, grain) {
  if (!rec || typeof rec !== "object") return rec;
  if (Array.isArray(rec)) return rec.map((x) => scaleRecord(x, grain));
  const out = {};
  for (const k of Object.keys(rec)) {
    const v = rec[k];
    if (typeof v === "number") out[k] = scaleN(v, grain);
    else if (v && typeof v === "object") out[k] = scaleRecord(v, grain);
    else out[k] = v;
  }
  return out;
}

// ---------- Money-string scaling --------------------------------------
// Parse a formatted money string like "$1,234.56" or "€1.295,40" or "—",
// scale through TEMP_SPEND_SCALE, and re-emit in the same shape (sym +
// thousands grouping + 2 decimal places). Falls back to the original
// string for non-monetary inputs ("—", empty, etc.). Used by the
// SUPPLIERS / LOCATIONS row data where `spend` ships as a pre-formatted
// string baked at the $10M baseline.
function scaleMoneyStr(str) {
  if (typeof str !== "string") return str;
  const trimmed = str.trim();
  if (!trimmed || trimmed === "—") return str;
  // Strip everything that isn't a digit, comma, dot, or minus. Then
  // figure out which separator is the decimal (whichever appears LAST
  // and only once) — covers en-US ("$1,234.56") and de-DE ("€1.234,56").
  const symMatch = trimmed.match(/^([^\d\-]*)/);
  const sym = (symMatch && symMatch[1].trim()) || "";
  const digits = trimmed.replace(/[^\d.,\-]/g, "");
  if (!digits || digits === "-") return str;
  const lastDot   = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  let decimalSep = "";
  if (lastDot > lastComma) decimalSep = ".";
  else if (lastComma > lastDot) decimalSep = ",";
  // Heuristic: only treat as decimal if it's followed by 1-2 digits;
  // otherwise it's a thousands separator (e.g. "1,234" not "1.23").
  if (decimalSep) {
    const idx = decimalSep === "." ? lastDot : lastComma;
    const tail = digits.slice(idx + 1);
    if (tail.length > 2 || tail.length === 0) decimalSep = "";
  }
  let intPart = digits;
  let fracPart = "";
  if (decimalSep) {
    const idx = decimalSep === "." ? lastDot : lastComma;
    intPart = digits.slice(0, idx);
    fracPart = digits.slice(idx + 1);
  }
  // Now strip thousands separators from the int part.
  intPart = intPart.replace(/[.,]/g, "");
  const raw = parseFloat(intPart + (fracPart ? "." + fracPart : ""));
  if (!isFinite(raw)) return str;
  const scaled = raw * TEMP_SPEND_SCALE;
  // Re-format. Default to en-US-style grouping unless original used the
  // European convention (comma as decimal).
  const useEuro = decimalSep === ",";
  const hadDecimals = fracPart.length > 0;
  const showFrac = hadDecimals ? 2 : 0;
  // For very large scaled values, drop the cents — "$1,234,567" reads
  // cleaner than "$1,234,567.00" in tables.
  const dropCents = showFrac > 0 && Math.abs(scaled) >= 100_000;
  const fixed = scaled.toFixed(dropCents ? 0 : showFrac);
  const [intStr, fracStr] = fixed.split(".");
  const intGrouped = intStr.replace(/(\d)(?=(\d{3})+(?!\d))/g, useEuro ? "$1." : "$1,");
  const body = fracStr ? `${intGrouped}${useEuro ? "," : "."}${fracStr}` : intGrouped;
  return `${sym}${body}`;
}

// ---------- List inflation --------------------------------------------
//   Scale a hand-curated data list (REQUISITIONS, TIMESHEETS, INVOICES,
//   LOCATIONS, WORKERS, …) up or down based on the active temp-spend
//   tier so the same surface reads as a $1M small business (a handful
//   of rows) or a $500M global program (hundreds of rows).
//
//   At scale >= 1 the helper appends synthetic clones of the base rows
//   (cycling through them) with derived IDs to fill out the target row
//   count. At scale < 1 it filters the base list down, but always
//   preserves the IDs listed in opts.preserveIds so deep links from
//   triage / approvals / activity feed never resolve to a missing row.
//
//   Caps target rows at opts.maxRows (default 250) so the largest tier
//   stays performant; floors at min(opts.minRows, base.length) so even
//   the smallest tier reads as a working VMS rather than an empty page.
//
//   makeClone(src, cloneIdx) → partial-override object. Use to mint a
//   fresh ID (e.g. random 10-char code for requisitions, "TS-9xxxx" for
//   timesheets) and any other per-row variance worth carrying.
function inflateList(base, opts) {
  if (!Array.isArray(base) || base.length === 0) return base ? base.slice() : [];
  const {
    idKey = "id",
    preserveIds = [],
    makeClone = null,
    minRows = 6,
    maxRows = 250,
    mult = 1,
  } = opts || {};
  const scale = TEMP_SPEND_SCALE * mult;
  // Target row count: base.length * scale, clamped.
  let target = Math.round(base.length * scale);
  target = Math.max(target, Math.min(minRows, base.length));
  target = Math.min(target, maxRows);

  if (target >= base.length) {
    // Grow — cycle through base, cloning until we hit target.
    const out = base.slice();
    const need = target - base.length;
    for (let i = 0; i < need; i++) {
      const src = base[i % base.length];
      const cloneIdx = i + 1;
      const override = makeClone ? makeClone(src, cloneIdx) : null;
      const overrideObj = override || {};
      const fallbackId = `${src[idKey]}~${cloneIdx}`;
      out.push({ ...src, ...overrideObj, [idKey]: overrideObj[idKey] || fallbackId });
    }
    return out;
  }
  // Shrink — keep preserved rows + first N optional rows (in source order).
  const preserve = new Set(preserveIds);
  const must = base.filter((r) => preserve.has(r[idKey]));
  const opt  = base.filter((r) => !preserve.has(r[idKey]));
  const need = Math.max(0, target - must.length);
  // Stitch back together respecting source order so the visible list
  // doesn't jump around between scales.
  const keep = new Set(must.concat(opt.slice(0, need)));
  return base.filter((r) => keep.has(r));
}

// Mint a random 10-char A-Z 0-9 code shaped like the seed requisition
// IDs ("J6K7L8M9N0") — deterministic per (baseId, cloneIdx) so the same
// row gets the same synthetic ID across reloads.
function _reqClonedId(baseId, cloneIdx) {
  let h = 0;
  const seed = `${baseId}#${cloneIdx}`;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const NUMS  = "0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    h = (h * 1103515245 + 12345 + i * 7) | 0;
    const set = i % 2 === 0 ? ALPHA : NUMS;
    out += set[Math.abs(h) % set.length];
  }
  return out;
}

Object.assign(window, {
  TEMP_SPEND_TIERS, TEMP_SPEND_BY_ID, TEMP_SPEND_BASELINE_ID, TEMP_SPEND_BASELINE,
  TEMP_SPEND_SCALE,
  getCurrentTempSpendId, setCurrentTempSpendId, getTempSpend,
  scaleN, scaleMoney, scaleSmall, scaleMoneyShort, scaleMoneyStr, scaleRecord,
  inflateList, _reqClonedId,
});
