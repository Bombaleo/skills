// =====================================================================
// Flex Work — Agency worker tenure + Temp-to-Perm sections   (v0.83)
//
//   Two accordion cards rendered inside WorkerDetailsPage when the
//   worker's pool is "Agency" (or "EOR" — they too are agency-sourced):
//
//     1. Tenure & worker rights
//          Country-aware view of statutory parity / qualifying clocks.
//          UK (AWR 2010), Germany (AÜG), Netherlands (WAADI/CAO),
//          France (Code du travail), and a co-employment fallback for
//          US / CA / AU / everywhere else.
//
//     2. Temp-to-perm conversion
//          Reads the supplier contract (via getSupplierContract) and
//          tracks hours billed against the contract's fee-free
//          threshold (`conversionHours`). Computes the conversion fee
//          if the buyer hired this worker today, taper included. Also
//          shows the hard tenure-limit countdown.
//
//   Exposed as window.AgencyTenureSections({ w }) so workforce.jsx can
//   drop it inline alongside the other accordions. Returns null for
//   anyone who isn't an agency-sourced worker, so it stays inert for
//   Internal, Float, Contractor, Pool workers.
// =====================================================================

// ---------- Currency formatting --------------------------------------
function _atSym() {
  if (typeof window !== "undefined" && window.curSymbol) return window.curSymbol();
  return "$";
}
function _atMoney(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sym = _atSym();
  const rounded = Math.round(n);
  // Compact for big numbers, comma-formatted for everything else.
  return `${sym}${rounded.toLocaleString()}`;
}

// ---------- Country resolution ---------------------------------------
// Workers don't always carry a country; fall back to the tenant's
// active country (see pages/countries.jsx).
function _atCountryFor(w) {
  if (w && w.countryCode) return w.countryCode;
  if (w && w.flag) return String(w.flag).toUpperCase();
  if (typeof window !== "undefined" && window.getCurrentCountry) {
    const c = window.getCurrentCountry();
    if (c && c.code) return c.code;
  }
  return "US";
}

// ---------- Deterministic per-worker seed -----------------------------
// Same id → same numbers across renders. Tunes weeks-on-assignment,
// hours billed and the optional service break so the demo roster
// shows a range of states (pre-parity, post-parity, near tenure limit,
// fee-free, etc.) without server data.
function _atSeed(id) {
  const s = String(id || "x");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function _atSyntheticAssignment(w) {
  const seed = _atSeed(w.id || w.workerId || w.name || "x");
  // Bias by shift count so a worker with 47 shifts has been on
  // assignment longer than one with 4. Floor at 2 weeks so the
  // first-day case still reads.
  const shiftsFloor = Math.max(2, Math.round((w.shifts || 4) * 1.1));
  const weeksOnAssignment = Math.min(96, shiftsFloor + (seed % 8));
  const avgHoursPerWeek = 24 + (seed % 16); // 24–39 h/wk
  const hoursWorked = Math.max(8, weeksOnAssignment * avgHoursPerWeek);
  // A small subset have a documented break in service. Used by the
  // UK qualifying clock — breaks of 6+ weeks reset AWR.
  const hasBreak = (seed % 11) === 0;
  const breakWeeks = hasBreak ? 4 + (seed % 4) : 0;
  // Start date — back-dated from "today" in the demo. Today is the
  // chrome-shared anchor when present.
  const today = (typeof window !== "undefined" && window.flexNow) ? new Date(window.flexNow()) : new Date();
  const start = new Date(today.getTime() - weeksOnAssignment * 7 * 86400000);
  return { seed, weeksOnAssignment, avgHoursPerWeek, hoursWorked, hasBreak, breakWeeks, today, start };
}
function _atFmtDate(d) {
  try {
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}
function _atAddDays(d, n) { return new Date(d.getTime() + n * 86400000); }
function _atAddWeeks(d, n) { return _atAddDays(d, n * 7); }
function _atDiffWeeks(a, b) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (7 * 86400000)));
}
function _atClampPct(v) { return Math.max(0, Math.min(100, v)); }

// ---------- Country rule packs ---------------------------------------
// The "rights" arrays list what the worker is entitled to in each
// stage. Stage labels stay sentence-case per Everest content rules.
const AT_RULES = {
  GB: {
    name: "United Kingdom",
    flag: "gb",
    framework: "Agency Workers Regulations 2010 (AWR) · Regs 5, 12, 13",
    qualifyingWeeks: 12,
    stageBefore: "Pre-parity",
    stageAfter:  "Post-parity",
    beforeRights: [
      { label: "Access to collective facilities", detail: "Canteen, staff room, toilets, showers, transport, parking, on-site childcare, prayer room — same access as direct hires from day 1 (Reg 12)." },
      { label: "Information on internal vacancies", detail: "The hirer must give agency workers the same information about permanent vacancies as direct employees (Reg 13)." },
      { label: "General statutory floor", detail: "National Minimum / Living Wage, Working Time Regulations 1998, 5.6 weeks statutory leave, Equality Act 2010 apply from day 1 — these sit outside AWR but bind regardless." },
    ],
    afterRights: [
      { label: "Equal pay to a direct hire", detail: "Basic hourly rate, overtime, shift / unsocial-hours premia, holiday pay, and performance-linked bonuses must match a comparable direct employee (Reg 5)." },
      { label: "Working time, rest and night work", detail: "Same daily / weekly limits, rest breaks, and night-work conditions as the hirer's direct employees — including any enhanced entitlements above statutory minimums." },
      { label: "Paid annual leave at parity", detail: "Any enhanced annual leave the hirer offers direct employees (above the 5.6-week statutory floor) applies to the agency worker too." },
      { label: "Paid antenatal time off", detail: "Pregnant qualifying workers receive paid time off for antenatal appointments and classes; suitable alternative work or full assignment pay if H&S grounds end the assignment." },
      { label: "Not included", detail: "Occupational sick pay, occupational pensions (auto-enrolment still applies via the agency), redundancy pay, enhanced maternity / paternity pay, and loyalty / length-of-service bonuses sit outside AWR equal treatment." },
    ],
    breakRule: "A break of more than 6 weeks in the same role with the same hirer resets the 12-week clock. Breaks pause (not reset) for pregnancy / maternity up to 26 weeks post-birth, sickness up to 28 weeks, statutory leave, jury service, or a hirer-side shutdown. Anti-avoidance: deliberately structured short assignments to dodge week 12 can trigger an Employment Tribunal claim and a penalty of up to £5,000.",
    sourceLink: "GOV.UK · Agency Workers Regulations 2010 guidance · ACAS",
  },
  DE: {
    name: "Germany",
    flag: "de",
    framework: "Arbeitnehmerüberlassungsgesetz (AÜG) · §§ 1(1b), 8, 10",
    qualifyingWeeks: 39, // 9 months
    stageBefore: "CBA derogation",
    stageAfter:  "Equal pay mandatory",
    hardLimitWeeks: 78, // 18 months
    beforeRights: [
      { label: "Statutory minimum wage from day 1", detail: "The general Mindestlohn applies on day 1 across every assignment." },
      { label: "Lohnuntergrenze (sector floor)", detail: "The AÜG sector minimum wage for Zeitarbeit sets a higher floor than Mindestlohn in most regions." },
      { label: "Branchenzuschläge ramp", detail: "Sector pay supplements (metal, chemicals, etc.) increase in steps from week 6 onward, narrowing the gap to direct hires before month 9." },
      { label: "Equal working conditions in principle", detail: "§8 AÜG applies from day 1 — but an applicable CBA (IGZ / BAP) can derogate from equal pay during the first 9 months." },
    ],
    afterRights: [
      { label: "Mandatory equal pay", detail: "From month 9, basic pay, bonuses, and pay supplements must match a comparable Stammkraft (§8 AÜG). CBA derogation no longer applies." },
      { label: "Equal working conditions", detail: "Working time, leave entitlement, access to canteens / kindergarten / commuter services, and bonuses sit at parity with direct hires." },
      { label: "Anti-avoidance: payback right", detail: "If equal pay was withheld, the worker can claim back-pay from the agency for up to 3 years (Verjährung)." },
    ],
    breakRule: "An interruption of 3 months and 1 day at the same buyer resets both clocks — the 9-month equal-pay clock and the 18-month hard cap. Shorter breaks add together; sickness, parental leave, and other statutory absences pause but do not reset.",
    hardLimitNote: "Überlassungshöchstdauer: an assignment with the same buyer cannot exceed 18 months unless a binding CBA at the user (or a Tarifvertrag covering the worker) extends it. Past 18 months without derogation, an employment contract is deemed to exist with the user (§10 AÜG).",
    sourceLink: "BMAS · Arbeitnehmerüberlassungsgesetz",
  },
  NL: {
    name: "Netherlands",
    flag: "nl",
    framework: "WAADI · CAO voor Uitzendkrachten (ABU / NBBU)",
    qualifyingWeeks: 52, // Phase A = 52 weeks (post-2022 reform)
    stageBefore: "Phase A · open flex",
    stageAfter:  "Phase B · fixed-term",
    beforeRights: [
      { label: "Inlenersbeloning from day 1", detail: "The worker is paid per the hirer's own pay scale for the equivalent role — base wage, allowances, periodic pay rises, ADV, expense reimbursements." },
      { label: "Statutory minimum wage", detail: "Wettelijk minimumloon (WML) applies from week 1." },
      { label: "StiPP basic pension after 8 weeks", detail: "Enrolment in the StiPP Basisregeling kicks in once 8 weeks have been worked within the same agency." },
      { label: "Uitzendbeding (open-flex)", detail: "Either party may end the assignment with immediate effect during Phase A — no statutory notice; the contract ends automatically if the hirer recalls the worker." },
    ],
    afterRights: [
      { label: "Phase B contracts", detail: "Up to 6 fixed-term contracts over a maximum of 3 years with the same agency (chain rule). The uitzendbeding clause no longer applies." },
      { label: "StiPP Plus pension", detail: "Worker moves from the StiPP Basis regime to the more generous Plus regime at the start of Phase B." },
      { label: "Continued inlenersbeloning", detail: "Pay parity with direct hires continues throughout Phases B and C." },
      { label: "Phase C · indefinite contract", detail: "After Phase B is exhausted, an indefinite agency contract is required to continue the relationship." },
    ],
    breakRule: "A gap of more than 26 weeks between assignments at the same agency resets the phase clock to Phase A, week 1. Shorter gaps count toward the running phase. Note: the upcoming Wet Toelating Terbeschikkingstelling van Arbeidskrachten (WTTA) tightens these rules from 2027.",
    sourceLink: "ABU · CAO voor Uitzendkrachten · Rijksoverheid (WAADI)",
  },
  FR: {
    name: "France",
    flag: "fr",
    framework: "Code du travail · Travail temporaire (Articles L1251-1 à L1251-63)",
    qualifyingWeeks: 0, // Equal pay is required from day 1
    stageBefore: null,
    stageAfter:  "Égalité de traitement (day 1)",
    hardLimitWeeks: 78, // 18 months max mission (général)
    beforeRights: [],
    afterRights: [
      { label: "Equal pay from day 1", detail: "L1251-43: rémunération at least equal to what a permanent employee with the same qualification on the same post would receive at the user — including base, premia, 13th-month pay, profit-sharing in some cases." },
      { label: "Indemnité de fin de mission (IFM)", detail: "10% of total gross paid over the mission — owed at the end of every mission as a précarité bonus (L1251-32). Not owed if the worker is converted to a CDI with the user, or for student / seasonal contracts." },
      { label: "Indemnité compensatrice de congés payés (ICCP)", detail: "10% of (gross + IFM), paid at end of mission to cover unused paid leave." },
      { label: "Working time and rest at parity", detail: "Same daily / weekly hour limits, overtime triggers, rest periods, and health-and-safety rights as the user's direct employees." },
      { label: "Justified recourse only (motif)", detail: "A mission must cite a permitted motif — replacement of an absent employee, surge in activity, seasonal work, awaiting a permanent hire's arrival, etc. (L1251-6). General staffing is not a valid motif." },
    ],
    breakRule: "Délai de carence between two missions on the same post at the same user: 1⁄3 of the previous mission's duration (counted in jours d'ouverture) if the prior mission lasted 14 calendar days or more, otherwise 1⁄2. Branch-level CBAs can derogate. A new motif is required for every renewal.",
    hardLimitNote: "L1251-12: a single mission may not exceed 18 months (24 months for international assignments or for missions awaiting a known permanent arrival). Successive missions on the same post are capped together at the same ceiling.",
    sourceLink: "Service-Public.fr · Travail temporaire · Code du travail",
  },
  IE: {
    name: "Ireland",
    flag: "ie",
    framework: "Protection of Employees (Temporary Agency Work) Act 2012",
    qualifyingWeeks: 0,
    stageBefore: null,
    stageAfter:  "Equal treatment (day 1)",
    beforeRights: [],
    afterRights: [
      { label: "Equal basic pay from day 1", detail: "Same basic hourly / annual rate, shift premia, piece-work payments, overtime, Sunday work, anti-social hours, and on-call payments as a comparable direct hire (s. 6 of the 2012 Act)." },
      { label: "Working time and rest", detail: "Same working-time limits, rest periods, breaks, night work, and public holiday entitlements as comparable direct employees." },
      { label: "Annual leave at parity", detail: "Any enhanced annual leave the hirer provides over the statutory 4-week minimum (Organisation of Working Time Act 1997) applies to the agency worker too." },
      { label: "Information on vacancies", detail: "The hirer must inform agency workers of internal vacancies at the same time as direct employees." },
      { label: "Not included", detail: "Occupational pensions, occupational sick pay, employee share schemes, and maternity / paternity / adoption pay beyond the statutory floor sit outside the Act's 'pay' definition." },
    ],
    breakRule: "Successive assignments at the same hirer count as one continuous assignment for equal-pay purposes — Ireland has no break-reset rule comparable to the UK 6-week clock. The hirer carries liability for working-conditions equality; the agency carries liability for pay.",
    sourceLink: "Workplace Relations Commission · 2012 Act guidance",
  },
  US: {
    name: "United States",
    flag: "us",
    framework: "Federal: IRS / DOL / NLRB · State: AB5, NY, MA, IL · ACA",
    qualifyingWeeks: 0,
    stageBefore: null,
    stageAfter:  null,
    beforeRights: [],
    afterRights: [],
    advisory: [
      { label: "No federal parity statute", detail: "There is no federal equivalent to AWR. The US relies on misclassification doctrine (IRS 20-factor common-law test, DOL economic-realities test) plus state-level rules to police equal treatment." },
      { label: "Co-employment risk at 18 months", detail: "Per tenant policy (Settings → Worker types): a misclassification re-review fires at 18 months on assignment, >35 h/week, or single-buyer exclusivity. Hitting two of three escalates the engagement for legal review." },
      { label: "ACA affordability — month 12", detail: "Workers averaging 30+ hours/week over the look-back measurement period (typically 12 months) trigger an offer of affordable health coverage to remain in compliance with §4980H." },
      { label: "State-level parity rules", detail: "California AB5 (ABC test, exemptions for staffing firms with carve-outs), New York Wage Theft Prevention Act + NDAA, Massachusetts Independent Contractor Law (three-prong test), and Illinois Day & Temporary Labor Services Act (Equal Pay for Equal Work, eff. 2023)." },
      { label: "Illinois DTLSA · 90-day equal pay", detail: "Illinois law requires equal pay to a comparable direct employee after a worker is assigned to the same client for 90 calendar days — the closest US analogue to AWR." },
    ],
    breakRule: "Most US tests treat a break of 13 weeks or more as severing the continuous-service finding for ACA measurement and for many state-level conversion clocks. Misclassification and joint-employer doctrines look at substance, not gap length.",
    sourceLink: "Internal policy · Worker types & co-employment · IRS / DOL / state DOLs",
  },
  CA: {
    name: "Canada",
    flag: "ca",
    framework: "Provincial Employment Standards Acts (ESA) · Federal Code",
    qualifyingWeeks: 0,
    stageBefore: null,
    stageAfter:  null,
    beforeRights: [],
    afterRights: [],
    advisory: [
      { label: "Quebec · equal pay from day 1", detail: "Act respecting labour standards s. 41.2 (added 2018): a personnel placement agency cannot pay a worker a lower wage rate than employees of the client doing the same tasks at the same establishment, solely because of their agency status." },
      { label: "Ontario · no equal-pay-for-equal-work", detail: "ESA's equal-pay-for-equal-work for agency workers was repealed by Bill 47 (effective 1 Jan 2019). Ontario does require temp agencies to be licensed (Working for Workers Act, eff. 1 Jul 2024) and reasonable notice / pay in lieu on termination after 3 months." },
      { label: "British Columbia · ESA standard", detail: "BC's Employment Standards Act applies with no agency-specific parity rule; agency-licensing legislation is under consultation." },
      { label: "Federal · Canada Labour Code", detail: "Federally regulated workplaces (banking, telecom, federal transport) apply the Canada Labour Code; no agency-specific parity provision." },
      { label: "Misclassification risk", detail: "CRA Form RC4110 weighs control, ownership of tools, chance of profit / loss, and integration. Provincial WSIB / WCB premiums are owed by the employer of record." },
    ],
    breakRule: "Across most provinces a break of 13 weeks or less is treated as continuous service for ESA notice and vacation-accrual purposes. Quebec applies §41.2 per task / establishment, not per continuous assignment.",
    sourceLink: "Ministère du Travail (QC) · Ontario MOL · Canada Labour Code",
  },
  AU: {
    name: "Australia",
    flag: "au",
    framework: "Fair Work Act 2009 · Modern Awards · Closing Loopholes Act 2023",
    qualifyingWeeks: 13, // 3 months — Same Job, Same Pay eligibility threshold
    stageBefore: "Casual (with 25% loading)",
    stageAfter:  "Same Job, Same Pay eligible",
    beforeRights: [
      { label: "Casual loading from day 1", detail: "Standard 25% casual loading on the hourly rate from day 1 in lieu of paid leave entitlements (Fair Work Act s. 86)." },
      { label: "Modern Award minimum", detail: "Modern Award minimum rates apply from day 1 — labour hire workers must receive at least the relevant Award classification." },
      { label: "Superannuation guarantee", detail: "Employer super guarantee (currently 11.5%, rising to 12% from 1 July 2025) is owed from the first dollar of pay." },
    ],
    afterRights: [
      { label: "Same Job, Same Pay (Closing Loopholes)", detail: "From 1 November 2024 a labour hire employee, union, or host can apply to the Fair Work Commission for a regulated labour hire arrangement order requiring the host's enterprise agreement rate to be paid. Applies after 3 months on assignment." },
      { label: "Employee choice for conversion", detail: "From 26 August 2024 the casual conversion regime is replaced by 'employee choice': a casual can notify the employer they wish to convert to permanent after 12 months (6 months for small business employers)." },
      { label: "Unfair dismissal protections", detail: "Minimum employment period is met at 6 months (12 months for small business employers); unfair dismissal protections under Part 3-2 apply." },
      { label: "Anti-avoidance — service contracts", detail: "From 27 February 2024 it is unlawful to structure a service contract to undercut the host's enterprise agreement (s. 306E)." },
    ],
    breakRule: "Engagement gaps of 4 weeks or more in a regular pattern can reset the casual conversion clock. Same Job, Same Pay orders persist across short breaks but a 3-month break can break the 'employee of an employer who supplies them' nexus required for an order.",
    sourceLink: "Fair Work Ombudsman · FWC Closing Loopholes guidance",
  },
  JP: {
    name: "Japan",
    flag: "jp",
    framework: "Worker Dispatching Act (労働者派遣法) · 2020 Work Style Reform",
    qualifyingWeeks: 0, // Equal pay applies from day 1 since April 2020
    stageBefore: null,
    stageAfter:  "Equal-pay-for-equal-work (day 1)",
    hardLimitWeeks: 156, // 3-year limit per Article 35-3 / 40-2
    beforeRights: [],
    afterRights: [
      { label: "Equal pay for equal work (since 2020)", detail: "Since 1 April 2020 the agency (haken-moto, 派遣元) must guarantee equal or balanced treatment versus the client's regular employees doing the same work — base pay, allowances, bonuses, commuting allowance, leave, training (Articles 30-3, 30-4)." },
      { label: "Two compliance methods", detail: "The agency picks one: (1) Hakensaki-Kintō-Houshiki — match the client's direct-hire treatment, with the client legally required to share pay information; or (2) Roushi-Kyoutei-Houshiki — a labor-management agreement at the agency whose wage level is at or above the regional industry average for the role." },
      { label: "Social insurance from day 1", detail: "The agency must enrol the dispatched worker (haken-shain) in shakai-hoken (health + welfare pension) and koyo-hoken (employment + workers' accident) from the start of the contract, subject to the usual hour thresholds." },
      { label: "Career-stability obligations", detail: "Once the dispatch is approaching 3 years, the agency must take one of four employment-stability measures: ask the client to hire directly, offer a new dispatch placement, hire the worker on an indefinite agency contract, or provide other career support (Article 30)." },
      { label: "5-year indefinite conversion (Mukikenkenten)", detail: "Labor Contracts Act Art. 18: if the worker is on fixed-term contracts with the same agency for more than 5 years in total, they can demand conversion to an indefinite-term contract with the agency." },
    ],
    breakRule: "A break of 3 months and 1 day at the same client division (clean-period rule, 'クーリング期間') resets the 3-year dispatch clock. Workers employed by the agency on an indefinite-term contract, workers aged 60 or over, and certain project-based / replacement assignments are exempt from the 3-year limit entirely.",
    hardLimitNote: "Article 40-2: the same client cannot accept dispatch in the same business unit for more than 3 years without consulting the majority union or employee representative; the same individual dispatched worker cannot remain in the same division (組織単位 / soshiki-tan'i) for more than 3 years. Violating the rule triggers Article 40-6 — a 'deemed offer of employment' that the worker can accept within 1 year, converting the engagement to direct employment with the client.",
    sourceLink: "MHLW · 労働者派遣法 · JASSA guidance",
  },
};
const AT_FALLBACK = {
  name: "Default",
  flag: null,
  framework: "Local labour law — verify with country-specific policy.",
  qualifyingWeeks: 0,
  stageBefore: null,
  stageAfter:  null,
  beforeRights: [],
  afterRights: [],
  advisory: [
    { label: "No tenant-configured tenure rule", detail: "Flex Work hasn't been tuned to this country's agency rules yet — treat all clocks as advisory." },
  ],
  breakRule: "Configure a country-specific rule pack in Settings → Policies to surface tenure milestones here.",
  sourceLink: null,
};
function _atRulesFor(code) { return AT_RULES[code] || AT_FALLBACK; }

// ============================================================
// SECTION 1 — Tenure & worker rights
// ============================================================

function AtTenureBody({ w, ctx }) {
  const Icon = window.Icon;
  const country = _atCountryFor(w);
  const rules   = _atRulesFor(country);

  // Effective weeks on the qualifying clock — reset by any break ≥6w.
  const breakResets = rules.breakRule && ctx.hasBreak && ctx.breakWeeks >= 6;
  const effectiveWeeks = breakResets
    ? Math.max(1, ctx.weeksOnAssignment - ctx.breakWeeks - 2)
    : ctx.weeksOnAssignment;

  const qWeeks = rules.qualifyingWeeks;
  const parityReached = qWeeks === 0 || effectiveWeeks >= qWeeks;
  const weeksToParity = Math.max(0, qWeeks - effectiveWeeks);
  const parityDate    = _atAddWeeks(ctx.start, qWeeks + (breakResets ? ctx.breakWeeks + 2 : 0));
  const parityReachedOn = parityReached && qWeeks > 0
    ? _atAddWeeks(ctx.start, qWeeks + (breakResets ? ctx.breakWeeks + 2 : 0))
    : null;
  const pctParity = qWeeks > 0 ? _atClampPct(Math.round((effectiveWeeks / qWeeks) * 100)) : 100;

  // Hard tenure limit (Germany / France carry one explicitly; otherwise
  // the supplier-contract `tenureLimitWeeks` is the soft cap surfaced
  // here. We pick whichever is *lower* — country statute wins.)
  const sc = (w.supplier && window.getSupplierContract) ? window.getSupplierContract(w.supplier) : null;
  const contractLimit = sc && sc.contractTerms && sc.contractTerms.tenureLimitWeeks;
  const statutoryLimit = rules.hardLimitWeeks || null;
  const hardLimit = (statutoryLimit && contractLimit)
    ? Math.min(statutoryLimit, contractLimit)
    : (statutoryLimit || contractLimit || null);
  const hardLimitSource = (statutoryLimit && (!contractLimit || statutoryLimit <= contractLimit))
    ? `${rules.name} statute`
    : (contractLimit ? "Agency contract" : null);
  const weeksToLimit = hardLimit ? Math.max(0, hardLimit - ctx.weeksOnAssignment) : null;
  const limitPct     = hardLimit ? _atClampPct(Math.round((ctx.weeksOnAssignment / hardLimit) * 100)) : 0;
  const limitTone    = !hardLimit ? "ok"
                      : limitPct >= 90 ? "err"
                      : limitPct >= 70 ? "warn"
                      : "ok";

  // Banner pills.
  const pills = [];
  if (rules.stageAfter && qWeeks === 0) {
    pills.push({ label: rules.stageAfter, tone: "ok" });
  } else if (parityReached && rules.stageAfter) {
    pills.push({ label: rules.stageAfter, tone: "ok" });
  } else if (rules.stageBefore) {
    pills.push({ label: rules.stageBefore, tone: "info" });
  }
  if (limitTone === "warn") pills.push({ label: `${weeksToLimit} weeks to tenure limit`, tone: "warn" });
  if (limitTone === "err")  pills.push({ label: `Tenure limit ${weeksToLimit > 0 ? `in ${weeksToLimit} weeks` : "reached"}`, tone: "err" });

  return (
    <div className="at-body">
      {/* Banner — country, framework, stage pills */}
      <div className="at-banner">
        <div className="at-banner-main">
          <span className="at-banner-flag" aria-hidden="true">
            {rules.flag ? <span className={`fi fi-${rules.flag}`} style={{ width: 28, height: 20, borderRadius: 3 }} /> : <Icon name="Globe" size={20} />}
          </span>
          <div>
            <div className="at-banner-title">
              {rules.name} · agency worker tenure
            </div>
            <div className="at-banner-sub">{rules.framework}</div>
          </div>
        </div>
        <div className="at-banner-pills">
          {pills.map((p, i) => (
            <span key={i} className={`at-pill at-pill--${p.tone}`}>{p.label}</span>
          ))}
        </div>
      </div>

      {/* Stat strip — 3 metrics */}
      <div className="at-stats">
        <div className="at-stat">
          <span className="at-stat-label">Assignment start</span>
          <span className="at-stat-val tabular">{_atFmtDate(ctx.start)}</span>
          <span className="at-stat-sub">{ctx.weeksOnAssignment} weeks ago</span>
        </div>
        <div className="at-stat">
          <span className="at-stat-label">Hours billed (assignment)</span>
          <span className="at-stat-val tabular">{ctx.hoursWorked.toLocaleString()} h</span>
          <span className="at-stat-sub">≈ {ctx.avgHoursPerWeek} h/wk average</span>
        </div>
        <div className="at-stat">
          <span className="at-stat-label">Continuous service</span>
          <span className="at-stat-val tabular">{effectiveWeeks} {effectiveWeeks === 1 ? "week" : "weeks"}</span>
          <span className="at-stat-sub">{breakResets ? "after break reset" : "no break in service"}</span>
        </div>
      </div>

      {/* Qualifying clock — only when there's an actual threshold */}
      {qWeeks > 0 && (
        <div className="at-clock">
          <div className="at-clock-head">
            <div>
              <div className="at-clock-title">Qualifying clock · week {Math.min(effectiveWeeks, qWeeks)} of {qWeeks}</div>
              <div className="at-clock-sub">
                {parityReached
                  ? `${rules.stageAfter} reached on ${_atFmtDate(parityReachedOn || ctx.today)}.`
                  : `${weeksToParity} more ${weeksToParity === 1 ? "week" : "weeks"} until ${rules.stageAfter} on ${_atFmtDate(parityDate)}.`}
              </div>
            </div>
            <div className={`at-clock-status at-clock-status--${parityReached ? "ok" : "info"}`}>
              <Icon name={parityReached ? "Check" : "Hourglass"} size={14} />
              {parityReached ? rules.stageAfter : rules.stageBefore}
            </div>
          </div>
          <div className="at-bar" role="progressbar" aria-valuenow={pctParity} aria-valuemin="0" aria-valuemax="100">
            <div className="at-bar-fill at-bar-fill--ok" style={{ width: `${pctParity}%` }} />
            {/* Tick at the qualifying boundary */}
            <span className="at-bar-tick" aria-hidden="true" style={{ left: "100%" }}>
              <span className="at-bar-tick-dot" />
              <span className="at-bar-tick-label">wk {qWeeks}</span>
            </span>
          </div>
        </div>
      )}

      {/* Rights stage cards: stageBefore + stageAfter (or single-stage / advisory) */}
      <div className="at-rights">
        {/* Pre-parity card */}
        {rules.stageBefore && rules.beforeRights.length > 0 && (
          <AtRightsCard
            stage={rules.stageBefore}
            since={`since week 1`}
            active={!parityReached}
            tone="info"
            rights={rules.beforeRights}
          />
        )}
        {/* Post-parity card */}
        {rules.stageAfter && rules.afterRights.length > 0 && (
          <AtRightsCard
            stage={rules.stageAfter}
            since={qWeeks > 0
              ? (parityReached
                ? `since ${_atFmtDate(parityReachedOn || ctx.today)}`
                : `from ${_atFmtDate(parityDate)}`)
              : `since week 1`}
            active={parityReached}
            tone={parityReached ? "ok" : "muted"}
            rights={rules.afterRights}
          />
        )}
        {/* Advisory card (US/CA — no formal parity, but flag risk thresholds) */}
        {rules.advisory && rules.advisory.length > 0 && (
          <AtRightsCard
            stage="Co-employment & benefits"
            since="advisory"
            active
            tone="info"
            rights={rules.advisory}
          />
        )}
      </div>

      {/* Hard tenure limit — only when one is in force */}
      {hardLimit && (
        <div className={`at-limit at-limit--${limitTone}`}>
          <div className="at-limit-head">
            <span className="at-limit-ic" aria-hidden="true">
              <Icon name={limitTone === "err" ? "Alert" : limitTone === "warn" ? "Hourglass" : "TimeAdd"} size={18} />
            </span>
            <div className="at-limit-text">
              <div className="at-limit-title">
                Maximum assignment: {hardLimit} weeks
                <span className="at-limit-source">· {hardLimitSource}</span>
              </div>
              <div className="at-limit-sub">
                {limitTone === "err"
                  ? `Worker is at or past the maximum. ${rules.hardLimitNote || "Convert, rotate, or end the assignment."}`
                  : limitTone === "warn"
                  ? `${weeksToLimit} ${weeksToLimit === 1 ? "week" : "weeks"} remaining. Plan conversion, rotation, or end-of-assignment now.`
                  : `${ctx.weeksOnAssignment} of ${hardLimit} weeks used. ${rules.hardLimitNote || ""}`}
              </div>
            </div>
            <div className="at-limit-num tabular">
              <span className="at-limit-num-big">{ctx.weeksOnAssignment}</span>
              <span className="at-limit-num-of">/ {hardLimit} wk</span>
            </div>
          </div>
          <div className="at-bar">
            <div className={`at-bar-fill at-bar-fill--${limitTone}`} style={{ width: `${limitPct}%` }} />
          </div>
        </div>
      )}

      {/* Breaks in service */}
      {rules.breakRule && (
        <div className="at-breaks">
          <div className="at-breaks-head">
            <span className="at-breaks-ic" aria-hidden="true">
              <Icon name={ctx.hasBreak ? "TimeUndo" : "Information"} size={16} />
            </span>
            <div className="at-breaks-text">
              <div className="at-breaks-title">
                Breaks in service · {ctx.hasBreak ? `${ctx.breakWeeks}-week gap on file` : "none on file"}
              </div>
              <div className="at-breaks-sub">{rules.breakRule}</div>
            </div>
          </div>
        </div>
      )}

      {/* Source footer */}
      <div className="at-source">
        <Icon name="Document" size={14} />
        <span>Source: {rules.sourceLink || "Local labour law"}</span>
      </div>
    </div>
  );
}

function AtRightsCard({ stage, since, active, tone, rights }) {
  const Icon = window.Icon;
  return (
    <div className={`at-rights-card at-rights-card--${tone} ${active ? "is-active" : "is-inactive"}`}>
      <div className="at-rights-card-head">
        <span className="at-rights-card-stage">{stage}</span>
        <span className="at-rights-card-since">{since}</span>
        {active && <span className="at-rights-card-flag"><Icon name="Check" size={12} />Active</span>}
      </div>
      <ul className="at-rights-list">
        {rights.map((r, i) => (
          <li key={i} className="at-rights-row">
            <span className="at-rights-row-ic" aria-hidden="true">
              <Icon name={active ? "Check" : "Information"} size={14} />
            </span>
            <div className="at-rights-row-text">
              <div className="at-rights-row-label">{r.label}</div>
              <div className="at-rights-row-detail">{r.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// SECTION 2 — Temp-to-perm conversion
// ============================================================

function AtConversionBody({ w, ctx }) {
  const Icon = window.Icon;
  const showToast = window.showToast || (() => {});
  const REQ_SUPPLIERS = window.REQ_SUPPLIERS || {};
  const sup = w.supplier ? (REQ_SUPPLIERS[w.supplier] || null) : null;

  // Read the supplier contract — fall back to sensible defaults if
  // getSupplierContract isn't loaded yet (defensive only; it's bundled
  // via supplier-contract.jsx which loads early).
  const sc = (w.supplier && window.getSupplierContract) ? window.getSupplierContract(w.supplier) : null;
  const terms = (sc && sc.contractTerms) || { conversionHours: 1040, conversionFeePct: 25, tenureLimitWeeks: 78 };
  const threshold = terms.conversionHours || 1040;
  const feePct    = terms.conversionFeePct != null ? terms.conversionFeePct : 25;

  // Estimate the worker's annualized base salary if converted. The
  // contract fee is "% of first-year salary" — we infer a base from
  // the supplier bill rate via the standard ~30% markup heuristic
  // (markup data lives on the supplier contract, but we treat it as
  // an estimate either way).
  const positionRate = (() => {
    if (typeof window === "undefined" || !window.POSITIONS) return 22;
    const job = (w.jobs && w.jobs[0]) || null;
    if (!job) return 22;
    const pos = window.POSITIONS.find((p) => p.name === job);
    return (pos && pos.payRate) || 22;
  })();
  // Bill rate ≈ payRate × (1 + supplier markup). The buyer hires
  // direct at the *pay* rate, not the bill rate, so we annualize the
  // pay rate side (2080 hours = 40h × 52w).
  const annualBase = Math.round(positionRate * 2080 / 100) * 100;

  // Linear taper of the fee from 100% at hour 0 → 0% at conversionHours.
  // This is the most common pattern in US/UK temp contracts; the
  // contract page exposes the upper bound only, but the taper is
  // referenced in §4.2 of the standard MSA template.
  const hoursWorked = ctx.hoursWorked;
  const taperRemaining = _atClampPct(((threshold - hoursWorked) / threshold) * 100);
  const currentFee = Math.max(0, Math.round(annualBase * (feePct / 100) * (taperRemaining / 100)));
  const fullFee    = Math.round(annualBase * (feePct / 100));
  const feeFree    = hoursWorked >= threshold;

  const feeProgress = _atClampPct(Math.round((hoursWorked / threshold) * 100));
  const hoursRemaining = Math.max(0, threshold - hoursWorked);
  const weeksRemaining = ctx.avgHoursPerWeek > 0 ? Math.ceil(hoursRemaining / ctx.avgHoursPerWeek) : 0;
  const feeFreeDate = _atAddWeeks(ctx.today, weeksRemaining);

  const tenureLimit = terms.tenureLimitWeeks || 78;

  return (
    <div className="at-body">
      {/* Banner */}
      <div className="at-banner">
        <div className="at-banner-main">
          <span className="at-banner-flag" aria-hidden="true">
            <Icon name="PersonAuthorize" size={20} />
          </span>
          <div>
            <div className="at-banner-title">
              Temp-to-perm conversion
              {sup && <span className="at-banner-sub-inline"> · via {sup.label}</span>}
            </div>
            <div className="at-banner-sub">
              Per the {sup ? sup.label : "supplier"} MSA · {feePct}% of first-year salary, tapering to {_atMoney(0)} after {threshold.toLocaleString()} billed hours.
            </div>
          </div>
        </div>
        <div className="at-banner-pills">
          {feeFree
            ? <span className="at-pill at-pill--ok">Fee-free conversion</span>
            : <span className="at-pill at-pill--info">{Math.round(taperRemaining)}% of fee remaining</span>}
        </div>
      </div>

      {/* Hero: conversion cost today */}
      <div className="at-hero">
        <div className="at-hero-main">
          <div className="at-hero-label">If converted today, the agency fee would be</div>
          <div className="at-hero-amount tabular">
            {feeFree ? _atMoney(0) : _atMoney(currentFee)}
          </div>
          <div className="at-hero-sub">
            {feeFree
              ? `Worker has cleared ${threshold.toLocaleString()} billed hours — no conversion fee owed.`
              : (
                <React.Fragment>
                  {feePct}% of estimated first-year base ({_atMoney(annualBase)}) ={" "}
                  <span className="tabular">{_atMoney(fullFee)}</span>{", tapered "}
                  <span className="tabular">{Math.round(100 - taperRemaining)}%</span>{" by hours already billed."}
                </React.Fragment>
              )}
          </div>
        </div>
        <div className="at-hero-side">
          <div className="at-hero-side-row">
            <span className="at-hero-side-label">Full fee at hour 0</span>
            <span className="at-hero-side-val tabular">{_atMoney(fullFee)}</span>
          </div>
          <div className="at-hero-side-row">
            <span className="at-hero-side-label">Fee at fee-free hour</span>
            <span className="at-hero-side-val tabular">{_atMoney(0)}</span>
          </div>
          <div className="at-hero-side-row at-hero-side-row--bold">
            <span className="at-hero-side-label">Owed today</span>
            <span className="at-hero-side-val tabular">{feeFree ? _atMoney(0) : _atMoney(currentFee)}</span>
          </div>
        </div>
      </div>

      {/* Hours billed → fee-free conversion progress */}
      <div className="at-clock">
        <div className="at-clock-head">
          <div>
            <div className="at-clock-title">
              Billed hours · <span className="tabular">{hoursWorked.toLocaleString()}</span> of <span className="tabular">{threshold.toLocaleString()}</span>
            </div>
            <div className="at-clock-sub">
              {feeFree
                ? `Fee-free since ${_atFmtDate(_atAddWeeks(ctx.start, Math.ceil(threshold / Math.max(1, ctx.avgHoursPerWeek))))}.`
                : `${hoursRemaining.toLocaleString()} hours to fee-free conversion · ~${weeksRemaining} ${weeksRemaining === 1 ? "week" : "weeks"} at current pace (${_atFmtDate(feeFreeDate)}).`}
            </div>
          </div>
          <div className={`at-clock-status at-clock-status--${feeFree ? "ok" : "info"}`}>
            <Icon name={feeFree ? "Check" : "Hourglass"} size={14} />
            {feeFree ? "Fee-free" : `${feeProgress}% there`}
          </div>
        </div>
        <div className="at-bar">
          <div className={`at-bar-fill at-bar-fill--${feeFree ? "ok" : "info"}`} style={{ width: `${feeProgress}%` }} />
        </div>
      </div>

      {/* Tenure limit (from contract) — short read */}
      <div className="at-limit at-limit--info">
        <div className="at-limit-head">
          <span className="at-limit-ic" aria-hidden="true">
            <Icon name="TimeAdd" size={18} />
          </span>
          <div className="at-limit-text">
            <div className="at-limit-title">
              Contractual tenure limit: {tenureLimit} weeks
              <span className="at-limit-source">· {sup ? sup.label : "Supplier"} MSA</span>
            </div>
            <div className="at-limit-sub">
              Maximum contiguous weeks on assignment before the agency relationship has to be re-evaluated, paused, or converted.
            </div>
          </div>
          <div className="at-limit-num tabular">
            <span className="at-limit-num-big">{ctx.weeksOnAssignment}</span>
            <span className="at-limit-num-of">/ {tenureLimit} wk</span>
          </div>
        </div>
        <div className="at-bar">
          <div className="at-bar-fill at-bar-fill--info" style={{ width: `${_atClampPct(Math.round((ctx.weeksOnAssignment / tenureLimit) * 100))}%` }} />
        </div>
      </div>

      {/* Fee schedule table — 5 anchor rows */}
      <div className="at-schedule">
        <div className="at-schedule-head">
          <div className="at-schedule-title">Conversion fee schedule</div>
          <div className="at-schedule-sub">Linear taper from {feePct}% of first-year salary at hour 0 to {_atMoney(0)} at hour {threshold.toLocaleString()}.</div>
        </div>
        <div className="at-schedule-rows" role="table">
          <div className="at-schedule-row at-schedule-row--head" role="row">
            <div role="columnheader">Billed hours</div>
            <div role="columnheader">% of full fee</div>
            <div role="columnheader" className="at-r">Fee owed</div>
          </div>
          {[0, Math.round(threshold * 0.25), Math.round(threshold * 0.5), Math.round(threshold * 0.75), threshold].map((h, i) => {
            const remain = ((threshold - h) / threshold) * 100;
            const fee    = Math.max(0, Math.round(annualBase * (feePct / 100) * (remain / 100)));
            const here   = h <= hoursWorked && (i === 4 ? feeFree : hoursWorked < (i < 4 ? Math.round(threshold * 0.25 * (i + 1)) : threshold + 1));
            const isCurrent = (h <= hoursWorked) && ((i === 4) ? feeFree : (i < 4 && hoursWorked < Math.round(threshold * 0.25 * (i + 1))));
            return (
              <div key={i} className={`at-schedule-row ${isCurrent ? "is-current" : ""}`} role="row">
                <div role="cell" className="tabular">{h.toLocaleString()} h</div>
                <div role="cell" className="tabular">{Math.round(remain)}%</div>
                <div role="cell" className="at-r tabular">{_atMoney(fee)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="at-actions">
        <button
          type="button"
          className="btn btn--md btn--primary"
          onClick={() => showToast(`Conversion request sent to ${sup ? sup.label : "supplier"}`)}
        >
          <Icon name="PersonPlus" size={14} />Request conversion
        </button>
        <button
          type="button"
          className="btn btn--md btn--secondary"
          onClick={() => showToast("Opening supplier contract terms")}
        >
          <Icon name="Document" size={14} />Open contract terms
        </button>
        <button
          type="button"
          className="btn btn--md btn--tertiary"
          onClick={() => showToast("Conversion estimate copied")}
        >
          <Icon name="Copy" size={14} />Copy estimate
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Top-level: drop-in shell for WorkerDetailsPage
// =====================================================================
function AgencyTenureSections({ w }) {
  if (!w) return null;
  // Only agency-sourced workers get these sections. Contractor / Pro
  // workers have their own classification + agreement surfaces, and
  // Internal / Float workers aren't agency-sourced.
  const isAgencyish = w.pool === "Agency" || w.pool === "EOR";
  if (!isAgencyish) return null;
  if (!window.WfAccordionCard) return null;

  // Skip for Professional engagement-type rows — they get the Contract
  // terms accordion instead, which is the SOW analog of conversion.
  if (w._professionalRow) return null;

  const A = window.WfAccordionCard;
  const ctx = _atSyntheticAssignment(w);

  return (
    <React.Fragment>
      <A
        icon="Hourglass"
        title="Tenure & worker rights"
        subtitle="Statutory parity clock, day-1 rights, and the maximum assignment window for this country."
        defaultOpen
      >
        <AtTenureBody w={w} ctx={ctx} />
      </A>
      <A
        icon="PersonAuthorize"
        title="Temp-to-perm conversion"
        subtitle="Hours billed against the agency fee-free threshold, with the fee owed if converted today."
        defaultOpen
      >
        <AtConversionBody w={w} ctx={ctx} />
      </A>
      <A
        icon="Pay"
        title="Rate progression"
        subtitle="Projected pay and bill rate at each tenure milestone, sourced from the supplier contract's rate card."
      >
        <AtRateProgressionBody w={w} ctx={ctx} />
      </A>
    </React.Fragment>
  );
}

// =====================================================================
// Rate progression — supplier-facing view of how the rate climbs
// as the worker accrues tenure on the assignment. Reads the supplier
// contract via window.getSupplierContract, finds the position row
// that matches the worker's role, and projects the bill rate at the
// four standard tenure milestones (start · 90d · 180d · 365d). The
// uplift schedule is the inverse of the pricing-config "Tenure
// deduction" group — early-tenure rates run -5%, post-90d settle at
// the contracted base, post-180d add +2% retention bump, post-365d
// add +4% annual review. Schedule lives here as a constant so the
// supplier-side preview can render even before the agency's tenure
// policies are wired into pricing-config.
// =====================================================================
const AT_TENURE_SCHEDULE = [
  { id: "start",  label: "Start of assignment", days: 0,   uplift: -5, hint: "First-90-days deduction · agency onboarding cost share" },
  { id: "d90",    label: "After 90 days",       days: 90,  uplift: 0,  hint: "Returns to contracted base rate" },
  { id: "d180",   label: "After 180 days",      days: 180, uplift: 2,  hint: "Retention bump — supplier-side talent hold" },
  { id: "d365",   label: "After 365 days",      days: 365, uplift: 4,  hint: "Annual review uplift on the rate card row" },
];

function AtRateProgressionBody({ w, ctx }) {
  const Icon = window.Icon;
  const getContract = window.getSupplierContract;
  const rowSkillPremiums = window.rowSkillPremiums || (() => []);
  const rowClassification = window.rowClassification || (() => ({ burdenPct: 22, label: "W-2" }));

  // Resolve the supplier contract → position row. Fall back to a
  // reasonable default if either is missing so the preview still
  // renders for demo workers without a wired-up contract.
  const supplierId = w.supplierId || w.supplier?.id;
  const contract = supplierId && getContract ? getContract(supplierId) : null;
  const role = String(w.jobs?.[0] || w.role || "").toLowerCase();
  const row = (contract && Array.isArray(contract.positions))
    ? (contract.positions.find((p) => (p.name || "").toLowerCase().includes(role)) || contract.positions[0])
    : null;

  if (!row) {
    return (
      <div className="at-empty">
        <Icon name="Info" size={14} />
        <span>No rate-card row found for this supplier yet. Once the agency contract is published, milestones populate automatically.</span>
      </div>
    );
  }

  const basePay = row.payRatePref || row.payRate || 22;
  const cls = rowClassification(row);
  const skills = rowSkillPremiums(row);
  const skillPct = skills.reduce((a, s) => a + s.pct, 0);
  // Use the operating-district average for the markup chain when no
  // position-level override is set — same logic as RateCardsCard.
  const districts = contract?.operatingDistricts || [];
  const dvals = districts.map((id) => contract?.districtMarkups?.[id] ?? 20);
  const avgDistrict = dvals.length ? Math.round(dvals.reduce((a, b) => a + b, 0) / dvals.length) : 25;
  const markup = row.positionMarkup || avgDistrict;
  const sym = (() => {
    if (typeof window !== "undefined" && window.rowCurrencySymbol) return window.rowCurrencySymbol(row, contract);
    return _atSym();
  })();
  const startedAt = ctx?.start || new Date();
  const today = ctx?.today || new Date();
  const daysOnAssignment = Math.max(0, Math.round((today.getTime() - startedAt.getTime()) / 86400000));

  // v0.81 · Rate-engine recommendations (Agency) — milestones are
  // whatever the bound config's tenure-band rule declares, not a static
  // four-stop schedule. Resolve the tenure band from the contract's
  // pricing rules; build one milestone per band boundary; compute pay +
  // bill at each through the shared engine (computeBillRate) so the
  // numbers track every layer the admin authored. Falls back to the
  // constant schedule when the engine or a typed tenure rule is absent.
  const engineCtx = (day) => ({
    date: today.toISOString().slice(0, 10),
    country: contract?.country || (row && row.country) || "US",
    currency: (window.rowCurrencySymbol ? undefined : undefined),
    districtMarkup: row.positionMarkup ? undefined : avgDistrict,
    workerTenureDays: day,
  });
  const rules = (window.contractPricingRules ? window.contractPricingRules(contract) : []) || [];
  const tenureRule = rules.find((r) => r.primitive && r.primitive.target === "tenure" && r.primitive.kind === "band");
  const engineOn = !!(window.computeBillRate && tenureRule && Array.isArray(tenureRule.primitive.bands));

  let schedule;
  if (engineOn) {
    const bands = tenureRule.primitive.bands.slice().sort((a, b) => (a.lt || 0) - (b.lt || 0));
    let prev = 0;
    schedule = bands
      .map((b) => {
        const day = prev; prev = b.lt;
        return { day, uplift: b.value || 0 };
      })
      .filter((m) => m.day < 9000)
      .map((m) => ({
        id: m.day === 0 ? "start" : `d${m.day}`,
        label: m.day === 0 ? "Start of assignment" : `After ${m.day} days`,
        days: m.day,
        uplift: m.uplift,
        hint: m.uplift < 0
          ? "Tenure deduction · early-assignment rate"
          : m.uplift > 0
            ? "Tenure uplift from the pricing configuration"
            : "Contracted base — no tenure adjustment",
      }));
  } else {
    schedule = AT_TENURE_SCHEDULE;
  }

  // Compute pay & bill at each milestone.
  const projections = schedule.map((m, idx) => {
    let pay, bill;
    if (engineOn) {
      const res = window.computeBillRate(row, contract, engineCtx(m.days));
      pay = res.pay;
      bill = res.bill;
    } else {
      pay = basePay * (1 + m.uplift / 100);
      const loaded = pay * (1 + (cls.burdenPct + skillPct) / 100);
      bill = loaded * (1 + markup / 100);
    }
    const date = _atAddDays(startedAt, m.days);
    const passed = daysOnAssignment >= m.days;
    const nextDay = schedule[idx + 1] ? schedule[idx + 1].days : Infinity;
    const current = passed && daysOnAssignment < nextDay;
    return { ...m, pay, bill, date, passed, current };
  });

  // Today's effective rate for the summary row above the milestones.
  const currentMilestone = projections.filter((p) => p.passed).slice(-1)[0] || projections[0];

  // Where do we go from here? Next un-passed milestone gives the
  // forward-looking countdown ("Bill rate climbs to $X in 23 days").
  const next = projections.find((p) => !p.passed);

  return (
    <div className="at-rate-prog">
      <div className="at-rate-prog-head">
        <div className="at-rate-prog-head-left">
          <div className="at-rate-prog-h">Currently billing</div>
          <div className="at-rate-prog-current tabular">{sym}{Math.round(currentMilestone.bill)}<span>/hr</span></div>
          <div className="at-rate-prog-current-sub">
            Pay {sym}{currentMilestone.pay.toFixed(2)}/hr &middot; {cls.label} burden +{cls.burdenPct}%
            {skillPct > 0 && ` · skills +${skillPct}%`} &middot; markup {markup}%
          </div>
        </div>
        <div className="at-rate-prog-head-right">
          <div className="at-rate-prog-h">{next ? "Next milestone" : "Schedule complete"}</div>
          {next ? (
            <React.Fragment>
              <div className="at-rate-prog-next tabular">{sym}{Math.round(next.bill)}<span>/hr</span></div>
              <div className="at-rate-prog-next-sub">
                {next.label.toLowerCase()} &middot; in {Math.max(0, next.days - daysOnAssignment)} days
              </div>
            </React.Fragment>
          ) : (
            <div className="at-rate-prog-next-sub">All tenure uplifts active. Annual rate-card review next.</div>
          )}
        </div>
      </div>

      <ol className="at-rate-milestones" aria-label="Tenure milestones">
        {projections.map((m, i) => (
          <li key={m.id} className={`at-rate-milestone ${m.passed ? "is-passed" : ""} ${m.current ? "is-current" : ""}`}>
            <div className="at-rate-milestone-rail" aria-hidden="true">
              <span className="at-rate-milestone-dot" />
              {i < projections.length - 1 && <span className="at-rate-milestone-line" />}
            </div>
            <div className="at-rate-milestone-body">
              <div className="at-rate-milestone-h">
                <span className="at-rate-milestone-label">{m.label}</span>
                <span className="at-rate-milestone-date">{_atFmtDate(m.date)}</span>
              </div>
              <div className="at-rate-milestone-rates tabular">
                <span><b>{sym}{m.pay.toFixed(2)}</b> pay</span>
                <span><b>{sym}{Math.round(m.bill)}</b> bill</span>
                <span className={`at-rate-milestone-uplift ${m.uplift > 0 ? "is-up" : m.uplift < 0 ? "is-down" : ""}`}>
                  {m.uplift > 0 ? `+${m.uplift}%` : m.uplift < 0 ? `${m.uplift}%` : "base"}
                </span>
              </div>
              <p className="at-rate-milestone-hint">{m.hint}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="at-rate-prog-foot">
        {engineOn
          ? <React.Fragment>Milestones are read from the bound pricing configuration&apos;s tenure-band rule and run through the shared rate engine (<b>{row.name}</b>, {sym}{basePay}/hr base). Edit the band in Settings &rarr; Pricing and these milestones change with it &mdash; same engine the rate-card breakdown uses.</React.Fragment>
          : <React.Fragment>Projections compose the contract rate card (<b>{row.name}</b>, {sym}{basePay}/hr preferred) with the program&apos;s tenure schedule. Mid-cycle changes — statutory minimums, retention raises, skill-cert uplifts — flow through automatically when the contract row updates.</React.Fragment>}
      </p>
    </div>
  );
}


// =====================================================================
// v0.79 · G5 — Bench rate-bumps roll-up.
//
// Aggregates every agency worker whose tenure-band crossing lands in
// the next 30 / 60 / 90 days. Reads from window.WORKERS (filtered to
// the viewing agency) and surfaces the projected bill-rate uplift per
// worker and the program total. Read-only; no new write paths.
//
// Mount on the agency bench view by importing AgencyBenchRateBumps from
// window — the bench page already has slots for "near-term" cards.
// =====================================================================
function AgencyBenchRateBumps({ agencyId }) {
  const Icon = window.Icon;
  const workers = ((typeof window !== "undefined" && window.WORKERS) || [])
    .filter((w) => !agencyId || w.supplier === agencyId);
  const getContract = window.getSupplierContract;

  // Synth a tenure-days field per worker so the projection has rows
  // before a real intake feed is wired. Real implementation reads from
  // engagement.tenureDays.
  const projection = workers.map((w) => {
    const seed = _atSeed(w.id || w.name || "x");
    const tenureDays = 30 + (seed % 200);                  // 30 – 230
    const nextBand = tenureDays < 90 ? 90 : tenureDays < 180 ? 180 : tenureDays < 365 ? 365 : null;
    const daysOut = nextBand ? (nextBand - tenureDays) : null;
    if (daysOut == null || daysOut > 90) return null;
    // Bill-rate uplift estimate — the typed tenure rule moves -5% → 0%
    // at the 90-day mark, so the bump is roughly +5% on the loaded
    // bill rate.
    const contract = getContract ? getContract(w.supplier) : null;
    const row = contract && (contract.positions || []).find((p) => (w.jobs || []).includes(p.name));
    let billPre = 0, billPost = 0;
    if (row && window.runRateStages) {
      const ctx = { date: new Date().toISOString().slice(0, 10), country: contract.country || "US" };
      billPre  = Math.round(window.runRateStages(row, contract, { ...ctx, workerTenureDays: tenureDays }).billRate);
      billPost = Math.round(window.runRateStages(row, contract, { ...ctx, workerTenureDays: nextBand }).billRate);
    }
    return { worker: w, tenureDays, nextBand, daysOut, billPre, billPost, uplift: billPost - billPre };
  }).filter(Boolean).sort((a, b) => a.daysOut - b.daysOut);

  const total = projection.reduce((a, r) => a + r.uplift, 0);
  const buckets = {
    "30":  projection.filter((r) => r.daysOut <= 30),
    "60":  projection.filter((r) => r.daysOut > 30 && r.daysOut <= 60),
    "90":  projection.filter((r) => r.daysOut > 60 && r.daysOut <= 90),
  };

  if (projection.length === 0) {
    return (
      <div className="at-bench-empty">
        <Icon name="Hourglass" size={20} />
        <p>No tenure-band crossings projected in the next 90 days.</p>
      </div>
    );
  }

  return (
    <div className="at-bench-rollup">
      <header className="at-bench-rollup-h">
        <div>
          <h3>Rate bumps coming up</h3>
          <p>Projected loaded-bill uplift across {projection.length} bench worker{projection.length === 1 ? "" : "s"}.</p>
        </div>
        <div className="at-bench-rollup-total">
          <span>Aggregate uplift / hr</span>
          <b className="tabular">+${total.toFixed(0)}</b>
        </div>
      </header>
      <div className="at-bench-rollup-grid">
        {["30", "60", "90"].map((bk) => (
          <div className="at-bench-rollup-bucket" key={bk}>
            <h4>Within {bk} days</h4>
            <span className="at-bench-rollup-bucket-count tabular">{buckets[bk].length}</span>
            <ul>
              {buckets[bk].slice(0, 5).map((r, i) => (
                <li key={i}>
                  <span>{r.worker.name}</span>
                  <span className="tabular at-bench-rollup-uplift">+${r.uplift}/hr</span>
                </li>
              ))}
              {buckets[bk].length > 5 && <li className="at-bench-rollup-more">+{buckets[bk].length - 5} more</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  AgencyTenureSections,
  AgencyBenchRateBumps,
  _atRulesFor,
  AT_RULES,
});
