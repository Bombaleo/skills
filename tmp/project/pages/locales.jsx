// =====================================================================
// Flex Work — Per-(industry, country) localization pack
//
//   Loaded AFTER countries.jsx and BEFORE credentialing.jsx + settings-
//   policies.jsx. Each (industry, country) entry can override:
//
//     · cred.domain      — credentialing header, primary source, packet
//                          name, KPI labels, audit/PSV CTA labels
//     · cred.catalogOverrides
//                        — partial replacements for the per-industry
//                          credential catalog, keyed by credential code
//     · cred.stringSwaps — straight `replace` pairs applied across the
//                          full pack (catches license numbers, free-text
//                          source notes, "California" in dates, etc.)
//     · certifications   — list of certification policy seeds for the
//                          Settings → Policies page. When present, they
//                          REPLACE the US certification rows for that
//                          industry.
//
//   The picker is limited to PICKER_COUNTRIES (see countries.jsx);
//   anything not listed below silently falls back to the US baseline.
// =====================================================================

// ---------- Certification policy template -------------------------------
// Keeps cert seeds compact while still rendering full detail (rules,
// enforcement, ack roll-up, history, docs). Industries pass in the
// distinctive bits; the rest is shared.
function _locMkCert(opts) {
  const {
    id, industry, country, name, summary, credential, issuer, cadence,
    locations = [], roles = [], scope_extra, version = "v1.0", status = "Active",
    enforce = "block", warn = "60 days", psv = true, upload = true,
    eligible = 200, current = null, owner,
    docs = [],
  } = opts;
  const acked = current == null ? Math.max(eligible - Math.round(eligible * 0.06), 0) : current;
  return {
    id,
    industries: [industry],
    countries: [country],
    type: "certifications",
    status,
    name,
    summary,
    scope: { locations, roles, ...(scope_extra || {}) },
    owner: owner || { name: "Compliance lead", initials: "CL" },
    version,
    lastReview: opts.lastReview || "Apr 12 2026",
    nextReview: opts.nextReview || "Apr 12 2027",
    rules: {
      credential,
      issuer,
      cadence,
      psv,
      warnWindow: warn,
      blockWindow: enforce === "block",
      uploadRequired: upload,
    },
    enforcement: { mode: enforce === "block" ? "block" : "warn", strike: enforce === "block" ? null : 2, block: enforce === "block" },
    ack: { required: true, cadence: "Annual + on hire", current: acked, eligible },
    docs: docs.length ? docs : [{ name: `${id}_policy.pdf`, size: "612 KB" }],
    history: [
      { date: opts.lastReview || "Apr 12 2026", who: (owner && owner.name) || "Compliance lead", what: "Annual review — no changes" },
    ],
  };
}

// ---------- Non-cert policy templates -----------------------------------
// Attendance: working time, breaks, overtime, on-call rules — country-
// specific (CA Labor Code → Ontario ESA → UK WTR → ArbZG → NES → 労基法).
function _locMkAttendance(opts) {
  const {
    id, industry, country, name, summary,
    breakMin = "—", restBreak = "—", otThreshold = "—",
    lateGrace = "7 min", callOut = "2 hours", noShowEsc = true, geo = false,
    locations = [], roles = [], version = "v1.0", status = "Active",
    owner, eligible = 300, enforce = "warn", strike = 2, premium,
  } = opts;
  return {
    id,
    industries: [industry], countries: [country],
    type: "attendance", status, name, summary,
    scope: { locations, roles },
    owner: owner || { name: "Compliance lead", initials: "CL" },
    version,
    lastReview: opts.lastReview || "Mar 12 2026",
    nextReview: opts.nextReview || "Mar 12 2027",
    rules: { breakMin, restBreak, otThreshold, lateGrace, noShowEsc, callOut, geo },
    enforcement: {
      mode: enforce, strike: enforce === "warn" ? strike : null, block: enforce === "block",
      ...(premium ? { premium } : {}),
    },
    ack: { required: true, cadence: "Annual + on hire", current: Math.max(eligible - 12, 0), eligible },
    docs: [{ name: `${id}_attendance.pdf`, size: "212 KB" }],
    history: [{ date: opts.lastReview || "Mar 12 2026", who: (owner && owner.name) || "Compliance lead", what: "Annual review" }],
  };
}

// Background: criminal / identity / drug-screen screening — country-
// specific vendors and lookback windows (CPIC, DBS, Führungszeugnis,
// AFP, 警察犯歴).
function _locMkBackground(opts) {
  const {
    id, industry, country, name, summary,
    pkg = "Standard", drug = "None", randomDrug = false,
    vendor, refresh = "Every 3 years", lookback = "5 years",
    locations = [], roles = [], version = "v1.0", status = "Active",
    owner, enforce = "block",
  } = opts;
  return {
    id,
    industries: [industry], countries: [country],
    type: "background", status, name, summary,
    scope: { locations, roles },
    owner: owner || { name: "Compliance lead", initials: "CL" },
    version,
    lastReview: opts.lastReview || "Mar 12 2026",
    nextReview: opts.nextReview || "Mar 12 2027",
    rules: { package: pkg, drug, randomDrug, vendor, refresh, lookback },
    enforcement: { mode: enforce, block: enforce === "block" },
    ack: { required: false },
    docs: [{ name: `${id}_screening_contract.pdf`, size: "1.1 MB" }],
    history: [{ date: opts.lastReview || "Mar 12 2026", who: (owner && owner.name) || "Compliance lead", what: "Annual review" }],
  };
}

// Safety: hazards / PPE / drill cadence — country-specific authorities
// (CSA, HSE, BG, SafeWork, 厚労省).
function _locMkSafety(opts) {
  const {
    id, industry, country, name, summary,
    scope_text = "", ppe = "", drillCadence = "Annual", incidentLog = "Supervisor co-sign", rtw = true,
    locations = [], roles = [], version = "v1.0", status = "Active",
    owner, enforce = "block", eligible = 192,
  } = opts;
  return {
    id,
    industries: [industry], countries: [country],
    type: "safety", status, name, summary,
    scope: { locations, roles },
    owner: owner || { name: "Compliance lead", initials: "CL" },
    version,
    lastReview: opts.lastReview || "Mar 12 2026",
    nextReview: opts.nextReview || "Mar 12 2027",
    rules: { scope: scope_text, ppe, drillCadence, incidentLog, rtw },
    enforcement: { mode: enforce, block: enforce === "block" },
    ack: { required: true, cadence: "Annual", current: Math.max(eligible - 4, 0), eligible },
    docs: [{ name: `${id}_safety_plan.pdf`, size: "920 KB" }],
    history: [{ date: opts.lastReview || "Mar 12 2026", who: (owner && owner.name) || "Compliance lead", what: "Annual review" }],
  };
}

// Training: country-specific local orientation / module — used for
// localized replacements of "California training" etc.
function _locMkTraining(opts) {
  const {
    id, industry, country, name, summary,
    course = "", duration = "60 minutes", delivery = "e-learning",
    passing = "80%", renew = "Annual", vendor = "In-house",
    locations = [], roles = [], version = "v1.0", status = "Active",
    owner, enforce = "warn", eligible = 200,
  } = opts;
  return {
    id,
    industries: [industry], countries: [country],
    type: "training", status, name, summary,
    scope: { locations, roles },
    owner: owner || { name: "Compliance lead", initials: "CL" },
    version,
    lastReview: opts.lastReview || "Mar 12 2026",
    nextReview: opts.nextReview || "Mar 12 2027",
    rules: { course, duration, delivery, passing, renew, vendor },
    enforcement: { mode: enforce, strike: enforce === "warn" ? 1 : null, block: enforce === "block" },
    ack: { required: true, cadence: "Annual", current: Math.max(eligible - 14, 0), eligible },
    docs: [{ name: `${id}_training.pdf`, size: "480 KB" }],
    history: [{ date: opts.lastReview || "Mar 12 2026", who: (owner && owner.name) || "Compliance lead", what: "Annual review" }],
  };
}

// =====================================================================
// HEALTHCARE
// =====================================================================
const _HEALTHCARE = {
  CA: {
    cred: {
      domain: {
        heroLabel: "Accreditation Canada survey · Thursday May 7",
        heroBody: "7 of 8 active nurses are credential-ready. 1 expired flu shot is auto-suspending bookings until renewed. CNO registration is current; CNPS coverage confirmed.",
        sourceName: "College of Nurses of Ontario (CNO)",
        sourceMeta: "Last verified Apr 22 2026 · automated daily against CNO public register",
        secondaryLabel: "Canadian Nurses Protective Society",
        auditAction: "Accreditation Canada packet",
        psvAction: "Run CNO PSV batch",
        psvToast: "PSV batch run started — 8 nurses across College of Nurses of Ontario",
        packetToast: "Accreditation Canada packet generated — see Downloads",
      },
      catalogOverrides: {
        license: { label: "RN registration (CNO)", cadence: "Annual" },
        bls:     { label: "BLS-HCP (HSFC)",        cadence: "1 yr"  },
        acls:    { label: "ACLS (HSFC)",           cadence: "2 yrs" },
        flu:     { label: "Influenza vaccine",     cadence: "Annual" },
        tb:      { label: "TB screen",             cadence: "Annual" },
      },
      stringSwaps: [
        ["CA Board of Registered Nursing", "College of Nurses of Ontario"],
        ["PSV — CA Board", "PSV — CNO"],
        ["AHA #BLS",       "HSFC #BLS"],
        ["AHA",            "HSFC"],
        ["CA-RN-",         "ON-RN-"],
        ["CA-LPN-",        "ON-RPN-"],
        ["LPN —",          "RPN —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-ca-h-1", industry: "healthcare", country: "CA",
        name: "RN registration — Ontario (CNO)",
        summary: "Active College of Nurses of Ontario registration required to book any RN-titled shift in Ontario facilities.",
        credential: "RN registration", issuer: "College of Nurses of Ontario", cadence: "Annual",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["RN"],
        owner: { name: "Priya Aravind", initials: "PA" },
        version: "v2.1",
      }),
      _locMkCert({
        id: "loc-ca-h-2", industry: "healthcare", country: "CA",
        name: "BLS-HCP — Heart & Stroke Foundation",
        summary: "Active HSFC BLS-HCP card; 1-year cycle; required for any direct-patient-care role.",
        credential: "BLS-HCP", issuer: "Heart and Stroke Foundation of Canada", cadence: "Annual",
        locations: ["All Mercy sites"], roles: ["RN", "RPN", "PSW"],
        version: "v1.2", warn: "30 days",
      }),
      _locMkCert({
        id: "loc-ca-h-3", industry: "healthcare", country: "CA",
        name: "ACLS — HSFC (ICU + ED)",
        summary: "Advanced Cardiac Life Support certification, unit-conditional. ICU + ED only.",
        credential: "ACLS", issuer: "Heart and Stroke Foundation of Canada", cadence: "2 years",
        locations: ["Mercy Memorial"], roles: ["RN — ICU", "RN — ED"], version: "v1.1",
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-ca-h-a1", industry: "healthcare", country: "CA",
        name: "Ontario ESA — hours of work & meal breaks",
        summary: "ESA Part VII — 30 min eating period after 5 consecutive hours, 8h daily / 48h weekly limits, 11h daily rest, premium pay over weekly cap.",
        breakMin: "30 min unpaid after 5 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: ">44 hrs/week (ON)",
        callOut: "4 hours",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["All non-management"],
        eligible: 412, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-ca-h-b1", industry: "healthcare", country: "CA",
        name: "Vulnerable Sector Check — Clinical",
        summary: "RCMP/CPIC criminal record check including Vulnerable Sector screening; required pre-deployment for all clinical roles.",
        pkg: "Healthcare (VSC)", drug: "Pre-employment screen", vendor: "Sterling Canada",
        refresh: "Every 3 years", lookback: "10 years",
        locations: ["All Mercy facilities"], roles: ["All clinical roles"], version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-ca-h-s1", industry: "healthcare", country: "CA",
        name: "Exposure-control plan — CSA Z94 + WSIB",
        summary: "WSIB-aligned exposure-control plan: needlestick, splash, contaminated linen. PPE per CSA Z94. Post-exposure reporting to WSIB within 72 h.",
        scope_text: "Bloodborne pathogens — needlestick, splash, contaminated linen",
        ppe: "Gloves · gown · eye protection · N95 (CSA Z94.4 fit-tested)",
        drillCadence: "Bi-annual",
        incidentLog: "WSIB Form 7",
        locations: ["All clinical facilities"], roles: ["All clinical roles", "Housekeeping"],
        eligible: 412, version: "v2.0",
      }),
    ],
    },

  GB: {
    cred: {
      domain: {
        heroLabel: "CQC inspection · Thursday May 7",
        heroBody: "7 of 8 active nurses are credential-ready. 1 expired flu shot is auto-suspending bookings until renewed. NMC PIN check is current for all RNs; Enhanced DBS confirmed.",
        sourceName: "Nursing & Midwifery Council (NMC) register",
        sourceMeta: "Last verified Apr 22 2026 · automated daily against NMC public PIN check",
        secondaryLabel: "DBS Enhanced disclosure",
        auditAction: "CQC evidence packet",
        psvAction: "Run NMC PIN batch",
        psvToast: "PIN batch run started — 8 nurses against NMC register",
        packetToast: "CQC evidence packet generated — see Downloads",
      },
      catalogOverrides: {
        license: { label: "NMC registration",          cadence: "Annual" },
        bls:     { label: "BLS (RCUK)",                cadence: "1 yr"  },
        acls:    { label: "ILS / ALS (RCUK)",          cadence: "1 yr"  },
        flu:     { label: "Flu vaccine",               cadence: "Annual" },
        tb:      { label: "Occupational health screen", cadence: "On hire" },
      },
      stringSwaps: [
        ["CA Board of Registered Nursing", "Nursing and Midwifery Council"],
        ["PSV — CA Board", "PIN — NMC"],
        ["AHA #BLS",       "RCUK #BLS"],
        ["AHA",            "RCUK"],
        ["CA-RN-",         "NMC-"],
        ["CA-LPN-",        "NMC-AP-"],
        ["LPN —",          "Associate practitioner —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-gb-h-1", industry: "healthcare", country: "GB",
        name: "NMC PIN — Registered Nurse",
        summary: "Active Nursing and Midwifery Council PIN required to book any RN-titled shift in UK facilities. Live PIN check runs daily.",
        credential: "NMC registration", issuer: "Nursing and Midwifery Council", cadence: "Annual",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["RN"],
        version: "v2.0",
      }),
      _locMkCert({
        id: "loc-gb-h-2", industry: "healthcare", country: "GB",
        name: "BLS — Resuscitation Council UK",
        summary: "RCUK Basic Life Support; annual; required for any direct-patient-care role.",
        credential: "BLS", issuer: "Resuscitation Council UK", cadence: "Annual",
        roles: ["RN", "HCA"], warn: "30 days",
      }),
      _locMkCert({
        id: "loc-gb-h-3", industry: "healthcare", country: "GB",
        name: "DBS Enhanced — Adult Workforce",
        summary: "Enhanced DBS with barred list check; required pre-deployment for all clinical roles.",
        credential: "DBS Enhanced", issuer: "Disclosure & Barring Service", cadence: "3 years",
        roles: ["RN", "HCA", "AP"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-gb-h-a1", industry: "healthcare", country: "GB",
        name: "Working Time Regulations 1998 — rest & breaks",
        summary: "WTR 1998 — 20 min rest break after 6 hrs, 11 hr daily rest, 48 hr/week max (with opt-out), 5.6 weeks statutory leave.",
        breakMin: "20 min unpaid after 6 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: "48 hrs/week (opt-out available)",
        callOut: "4 hours",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["All clinical roles"],
        eligible: 412, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-gb-h-b1", industry: "healthcare", country: "GB",
        name: "DBS Enhanced + Update Service",
        summary: "Enhanced DBS check with Adult Workforce barred-list; enrolled on DBS Update Service for continuous monitoring.",
        pkg: "Healthcare (DBS Enhanced)", drug: "Occupational health screen", vendor: "DBS — UK Government",
        refresh: "Continuous (Update Service)", lookback: "All available",
        locations: ["All Mercy facilities"], roles: ["All clinical roles"], version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-gb-h-s1", industry: "healthcare", country: "GB",
        name: "COSHH + Sharps Regulations 2013",
        summary: "Control of Substances Hazardous to Health (COSHH) + Health and Safety (Sharps Instruments in Healthcare) Regulations 2013 — exposure plan, PPE, safer sharps, RIDDOR-reportable incidents.",
        scope_text: "Bloodborne pathogens — needlestick, splash, contaminated linen",
        ppe: "Gloves · apron · eye protection · FFP3 mask (face-fit tested)",
        drillCadence: "Bi-annual",
        incidentLog: "RIDDOR + Datix",
        locations: ["All clinical facilities"], roles: ["All clinical roles"],
        eligible: 412, version: "v2.0",
      }),
    ],
    },

  DE: {
    cred: {
      domain: {
        heroLabel: "MDK Pflegevisite · Donnerstag 7. Mai",
        heroBody: "7 von 8 aktiven Pflegefachpersonen sind einsatzbereit. 1 abgelaufene Grippeimpfung führt zur Sperre, bis erneuert. Anerkennungsurkunden sind aktuell.",
        sourceName: "Bezirksregierung — Anerkennung Pflegefachperson",
        sourceMeta: "Letzte Prüfung 22.04.2026 · tägliche Abgleichung",
        secondaryLabel: "Polizeiliches Führungszeugnis",
        auditAction: "MDK-Prüfpaket",
        psvAction: "Anerkennungs-Prüfung starten",
        psvToast: "Prüflauf gestartet — 8 Pflegefachpersonen gegen Bezirksregierung",
        packetToast: "MDK-Prüfpaket erstellt — siehe Downloads",
      },
      catalogOverrides: {
        license: { label: "Pflegefachperson Anerkennung", cadence: "Unbefristet" },
        bls:     { label: "BLS-Schulung",                 cadence: "Jährlich"   },
        acls:    { label: "Reanimation (ERC ALS)",        cadence: "2 Jahre"    },
        flu:     { label: "Grippeschutzimpfung",          cadence: "Jährlich"   },
        tb:      { label: "G24 Untersuchung",             cadence: "Jährlich"   },
        fit:     { label: "Atemschutz Dichtsitzprüfung",  cadence: "Jährlich"   },
        drug:    { label: "Drogenscreening",              cadence: "Einstellung"},
        orient:  { label: "Einrichtungseinweisung",       cadence: "Pro Haus"   },
      },
      stringSwaps: [
        ["CA Board of Registered Nursing", "Bezirksregierung"],
        ["PSV — CA Board", "Abgleich — Bezirksregierung"],
        ["AHA #BLS",       "ERC #BLS"],
        ["AHA",            "ERC"],
        ["CA-RN-",         "DE-Pfl-"],
        ["CA-LPN-",        "DE-PflH-"],
        ["LPN —",          "Pflegehelfer:in —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-de-h-1", industry: "healthcare", country: "DE",
        name: "Anerkennung Pflegefachperson — NRW",
        summary: "Berufsurkunde Pflegefachperson (Bezirksregierung) ist Voraussetzung für jede Pflegetätigkeit.",
        credential: "Pflegefachperson Anerkennung", issuer: "Bezirksregierung Düsseldorf", cadence: "Unbefristet",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["Pflegefachperson"],
        version: "v2.0",
      }),
      _locMkCert({
        id: "loc-de-h-2", industry: "healthcare", country: "DE",
        name: "BLS / Reanimation (ERC)",
        summary: "Jährliche BLS-Schulung nach ERC-Leitlinien; verpflichtend für alle patientennahen Rollen.",
        credential: "BLS", issuer: "European Resuscitation Council", cadence: "Jährlich",
        roles: ["Pflegefachperson"],
      }),
      _locMkCert({
        id: "loc-de-h-3", industry: "healthcare", country: "DE",
        name: "Hygiene §43 IfSG",
        summary: "Belehrung nach Infektionsschutzgesetz §43; bei Einstellung und alle 2 Jahre.",
        credential: "IfSG §43 Belehrung", issuer: "Gesundheitsamt", cadence: "2 Jahre",
        roles: ["Pflegefachperson", "Servicekraft"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-de-h-a1", industry: "healthcare", country: "DE",
        name: "ArbZG — Höchstarbeitszeit & Ruhepausen",
        summary: "Arbeitszeitgesetz — max 8h/Tag (10h mit Ausgleich), 11h Ruhezeit, 30 min Pause nach 6h, 45 min nach 9h. Sonn- und Feiertagsruhe.",
        breakMin: "30 min nach 6 Std., 45 min nach 9 Std.",
        restBreak: "11 Std. tägliche Ruhezeit",
        otThreshold: ">8 Std./Tag (Ausgleich binnen 24 Wochen)",
        callOut: "4 Stunden",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["Pflegefachperson", "Hilfskraft"],
        eligible: 412, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-de-h-b1", industry: "healthcare", country: "DE",
        name: "Erweitertes Führungszeugnis — Klinikbereich",
        summary: "Erweitertes polizeiliches Führungszeugnis (§30a BZRG) ist vor Einsatzbeginn verpflichtend; alle 3 Jahre erneuert.",
        pkg: "Erweitertes Führungszeugnis", drug: "Einstellungsuntersuchung G42", vendor: "Bundeszentralregister",
        refresh: "Alle 3 Jahre", lookback: "Vollständig",
        locations: ["Alle Mercy-Einrichtungen"], roles: ["Pflegefachperson", "Hilfskraft"], version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-de-h-s1", industry: "healthcare", country: "DE",
        name: "BioStoffV — Biologische Arbeitsstoffe",
        summary: "Biostoffverordnung + TRBA 250: Schutzstufenkonzept, persönliche Schutzausrüstung, Nadelstichverletzungen, Meldung an BG.",
        scope_text: "Biologische Arbeitsstoffe — Nadelstich, Spritzer, Kontamination",
        ppe: "Handschuhe · Schutzkittel · Schutzbrille · FFP3-Maske (Dichtsitzprüfung)",
        drillCadence: "Jährlich",
        incidentLog: "BG-Meldung + interne Akte",
        locations: ["Alle klinischen Einrichtungen"], roles: ["Pflegefachperson", "Hilfskraft"],
        eligible: 412, version: "v2.0",
      }),
    ],
    },

  AU: {
    cred: {
      domain: {
        heroLabel: "ACSQHC accreditation · Thursday May 7",
        heroBody: "7 of 8 active nurses are credential-ready. 1 expired flu shot is auto-suspending bookings until renewed. AHPRA registration is current; NDIS Worker Screening confirmed.",
        sourceName: "AHPRA — Nursing & Midwifery Board",
        sourceMeta: "Last verified Apr 22 2026 · automated daily against AHPRA public register",
        secondaryLabel: "NDIS Worker Screening",
        auditAction: "ACSQHC accreditation packet",
        psvAction: "Run AHPRA register batch",
        psvToast: "Register batch run started — 8 nurses against AHPRA",
        packetToast: "ACSQHC accreditation packet generated — see Downloads",
      },
      catalogOverrides: {
        license: { label: "AHPRA registration", cadence: "Annual" },
        bls:     { label: "BLS (ARC)",          cadence: "1 yr"   },
        acls:    { label: "ALS (ARC)",          cadence: "2 yrs"  },
        flu:     { label: "Influenza vaccine",  cadence: "Annual" },
        tb:      { label: "TB screen",          cadence: "Annual" },
        fit:     { label: "N95 fit test",       cadence: "Annual" },
      },
      stringSwaps: [
        ["CA Board of Registered Nursing", "AHPRA"],
        ["PSV — CA Board", "Verified — AHPRA"],
        ["AHA #BLS",       "ARC #BLS"],
        ["AHA",            "ARC"],
        ["CA-RN-",         "NMW-"],
        ["CA-LPN-",        "NMW-EN-"],
        ["LPN —",          "EN —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-au-h-1", industry: "healthcare", country: "AU",
        name: "AHPRA registration — Nursing",
        summary: "Current AHPRA registration with the Nursing and Midwifery Board required for all RN shifts.",
        credential: "AHPRA registration", issuer: "Nursing and Midwifery Board of Australia", cadence: "Annual",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["RN"], version: "v2.0",
      }),
      _locMkCert({
        id: "loc-au-h-2", industry: "healthcare", country: "AU",
        name: "BLS — Australian Resuscitation Council",
        summary: "ARC BLS; annual; mandatory for all clinical staff.",
        credential: "BLS", issuer: "Australian Resuscitation Council", cadence: "Annual",
        roles: ["RN", "EN", "AIN"],
      }),
      _locMkCert({
        id: "loc-au-h-3", industry: "healthcare", country: "AU",
        name: "NDIS Worker Screening Check",
        summary: "Clearance under the NDIS Worker Screening Check; required for any worker delivering NDIS-funded supports.",
        credential: "NDIS Worker Screening", issuer: "NDIS Quality and Safeguards Commission", cadence: "5 years",
        roles: ["RN", "EN", "AIN"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-au-h-a1", industry: "healthcare", country: "AU",
        name: "Nurses Award + NES — hours & breaks",
        summary: "Nurses Award 2020 + National Employment Standards — 38h ordinary week, 10-hour rest between rosters, paid meal break on shifts over 8 hrs, weekend / public-holiday penalty rates.",
        breakMin: "30 min paid meal after 5 hrs",
        restBreak: "10 hr rest between rosters",
        otThreshold: ">38 hrs/week (penalty rates apply)",
        callOut: "4 hours",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["RN", "EN", "AIN"],
        eligible: 412, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-au-h-b1", industry: "healthcare", country: "AU",
        name: "AFP National Police Check — Healthcare",
        summary: "Australian Federal Police National Police Check + Working with Vulnerable People (state-issued); refreshed every 3 years.",
        pkg: "Healthcare (AFP NPC + WWVP)", drug: "Pre-employment screen", vendor: "Australian Federal Police",
        refresh: "Every 3 years", lookback: "10 years",
        locations: ["All Mercy facilities"], roles: ["All clinical roles"], version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-au-h-s1", industry: "healthcare", country: "AU",
        name: "WHS Hazardous Chemicals + AS/NZS 1715",
        summary: "WHS Regulation 2017 — exposure-control plan, AS/NZS 1715 fit testing, SafeWork incident reporting within 24 h for notifiable incidents.",
        scope_text: "Bloodborne pathogens — needlestick, splash, contaminated linen",
        ppe: "Gloves · gown · eye protection · P2/N95 (AS/NZS 1715 fit-tested)",
        drillCadence: "Bi-annual",
        incidentLog: "SafeWork notifiable incident",
        locations: ["All clinical facilities"], roles: ["All clinical roles", "Housekeeping"],
        eligible: 412, version: "v2.0",
      }),
    ],
    },

  JP: {
    cred: {
      domain: {
        heroLabel: "JCQHC 病院機能評価 · 5月7日(木)",
        heroBody: "現役看護師8名のうち7名が稼働可能です。1名のインフルエンザワクチン期限切れにより、更新まで予約が自動停止しています。看護師免許は全員有効。",
        sourceName: "厚生労働省 看護師免許照会",
        sourceMeta: "最終確認 2026年4月22日 · 毎日自動照合",
        secondaryLabel: "JCI Japan 基準",
        auditAction: "病院機能評価パケット",
        psvAction: "免許照会を実行",
        psvToast: "免許照会開始 — 看護師8名 / 厚生労働省",
        packetToast: "病院機能評価パケットを作成しました",
      },
      catalogOverrides: {
        license: { label: "看護師免許",         cadence: "永久" },
        bls:     { label: "BLS",                 cadence: "1年" },
        acls:    { label: "ACLS",                cadence: "2年" },
        flu:     { label: "インフル予防接種",   cadence: "毎年" },
        tb:      { label: "結核検査",           cadence: "毎年" },
        fit:     { label: "N95 マスクフィット", cadence: "毎年" },
      },
      stringSwaps: [
        ["CA Board of Registered Nursing", "厚生労働省"],
        ["PSV — CA Board", "免許照会 — 厚労省"],
        ["AHA #BLS",       "JRC #BLS"],
        ["AHA",            "JRC"],
        ["CA-RN-",         "JP-Kango-"],
        ["CA-LPN-",        "JP-Junk-"],
        ["LPN —",          "准看護師 —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-jp-h-1", industry: "healthcare", country: "JP",
        name: "看護師免許 — 厚生労働省",
        summary: "厚生労働省発行の看護師免許は、看護師職での就業に必須。免許番号で日次照合。",
        credential: "看護師免許", issuer: "厚生労働省", cadence: "永久",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["看護師"], version: "v2.0",
      }),
      _locMkCert({
        id: "loc-jp-h-2", industry: "healthcare", country: "JP",
        name: "BLS — 日本救急医療財団",
        summary: "JRC BLS。1年更新。患者接遇のある全職に必須。",
        credential: "BLS", issuer: "日本救急医療財団 (JRC)", cadence: "毎年",
        roles: ["看護師", "准看護師"],
      }),
      _locMkCert({
        id: "loc-jp-h-3", industry: "healthcare", country: "JP",
        name: "感染症抗体検査 (麻疹/風疹/水痘/おたふく)",
        summary: "4ウイルス抗体検査結果が必要。陰性の場合はワクチン接種が必要。",
        credential: "抗体検査パネル", issuer: "産業医", cadence: "雇用時",
        roles: ["看護師", "准看護師", "助手"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-jp-h-a1", industry: "healthcare", country: "JP",
        name: "労基法 — 労働時間・休憩",
        summary: "労働基準法 — 1日8時間/週40時間、6時間超で45分・8時間超で60分の休憩、36協定届出範囲を超えない時間外勤務。",
        breakMin: "6時間超で45分、8時間超で60分",
        restBreak: "勤務間11時間以上推奨",
        otThreshold: "週40時間超 (36協定範囲内)",
        callOut: "4時間",
        locations: ["Mercy Memorial", "Mercy Medical Plaza"], roles: ["看護師", "准看護師", "助手"],
        eligible: 412, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-jp-h-b1", industry: "healthcare", country: "JP",
        name: "身元保証 + 健康診断",
        summary: "雇用前に身元保証書の受領、雇入時健康診断、麻疹・風疹・水痘・おたふくの抗体検査結果を提出。",
        pkg: "雇入時パッケージ", drug: "雇入時健康診断", vendor: "産業医・人事",
        refresh: "雇用時のみ", lookback: "5年",
        locations: ["全Mercy施設"], roles: ["看護師", "准看護師", "助手"], version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-jp-h-s1", industry: "healthcare", country: "JP",
        name: "院内感染対策 + 針刺し事故",
        summary: "感染症の予防及び感染症の患者に対する医療に関する法律に基づく院内感染対策、針刺し事故時の即時報告と暴露後予防 (PEP)。",
        scope_text: "血液媒介病原体 — 針刺し、飛散、汚染リネン",
        ppe: "手袋・ガウン・ゴーグル・N95マスク (フィットチェック済)",
        drillCadence: "年2回",
        incidentLog: "労災 + 院内ヒヤリハット",
        locations: ["全臨床施設"], roles: ["看護師", "准看護師", "清掃"],
        eligible: 412, version: "v2.0",
      }),
    ],
    },
};

// =====================================================================
// HOSPITALITY
// =====================================================================
const _HOSPITALITY = {
  CA: {
    cred: {
      domain: {
        heroLabel: "AGCO inspection · Saturday wedding · 240 guests",
        heroBody: "12 of 14 banquet staff are bookable. 1 expired Smart Serve (Charlie) is auto-suspending alcohol service tonight; 1 Food Handler expires in 14 d.",
        sourceName: "Alcohol & Gaming Commission of Ontario (AGCO)",
        sourceMeta: "Last verified Apr 22 2026 · Smart Serve registry + AGCO licence lookup",
        secondaryLabel: "Background check",
        auditAction: "Public Health Ontario packet",
        psvAction: "Verify Smart Serve",
        psvToast: "Cross-checking 14 active workers against Smart Serve registry + AGCO",
        packetToast: "Public Health Ontario packet generated — Resort Way property",
      },
      catalogOverrides: {
        tips:     { label: "Smart Serve",           cadence: "5 yrs" },
        servsafe: { label: "Food Handler (ON)",     cadence: "5 yrs" },
        fhandler: { label: "Allergen training",     cadence: "Annual" },
        age21:    { label: "Age 19+ (alcohol)",     cadence: "One-time" },
      },
      stringSwaps: [
        ["State Alcohol Beverage Control", "AGCO"],
        ["TIPS / RBS",                     "Smart Serve"],
        ["ServSafe Manager",               "Food Handler (ON)"],
        ["ServSafe",                       "Food Handler"],
        ["CA-FHC-",                        "ON-FHC-"],
        ["CA-RBS-",                        "ON-SS-"],
        ["WA-FHC-",                        "BC-FHC-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-ca-y-1", industry: "hospitality", country: "CA",
        name: "Smart Serve — Bar service",
        summary: "Active Smart Serve certification; required for all staff serving or selling alcohol in Ontario.",
        credential: "Smart Serve", issuer: "Smart Serve Ontario", cadence: "5 years",
        locations: ["Aurora Resort Way", "Beach Club Annex"], roles: ["Bartender", "Server"],
      }),
      _locMkCert({
        id: "loc-ca-y-2", industry: "hospitality", country: "CA",
        name: "Food Handler Certificate — Ontario",
        summary: "Public Health Ontario approved Food Handler Certification; required for any role handling food.",
        credential: "Food Handler", issuer: "Public Health Ontario", cadence: "5 years",
        locations: ["All Aurora properties"], roles: ["Banquet Server", "Cook"],
      }),
      _locMkCert({
        id: "loc-ca-y-3", industry: "hospitality", country: "CA",
        name: "Age 19+ verification — Alcohol",
        summary: "Worker DOB verified on file before any alcohol-service assignment (Ontario legal age: 19).",
        credential: "Age 19+ (alcohol)", issuer: "I-9 / DOB verification", cadence: "One-time",
        roles: ["Bartender", "Server (bar shift)"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-ca-y-a1", industry: "hospitality", country: "CA",
        name: "Ontario ESA — banquet shift breaks",
        summary: "ESA Part VII — 30 min eating period after 5 hrs, 11 hr daily rest. Banquet shifts cross-midnight require 24 hr advance notice.",
        breakMin: "30 min unpaid after 5 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: ">44 hrs/week (ON)",
        callOut: "4 hours",
        locations: ["Aurora Resort Way", "Beach Club Annex"], roles: ["Banquet Server", "Bartender"],
        eligible: 138, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-ca-y-b1", industry: "hospitality", country: "CA",
        name: "Pre-employment background — Hospitality (CA)",
        summary: "Sterling Canada CPIC criminal record check + ID verification at hire; refreshed every 3 years.",
        pkg: "Standard", drug: "None", vendor: "Sterling Canada",
        refresh: "Every 3 years", lookback: "5 years",
        locations: ["All Aurora properties"], roles: ["All worker roles"], version: "v2.0",
      }),
    ],
    },

  GB: {
    cred: {
      domain: {
        heroLabel: "Environmental Health visit · Saturday wedding · 240 guests",
        heroBody: "12 of 14 banquet staff are bookable. 1 expired Personal Licence (Charlie) is auto-suspending alcohol service tonight; 1 Level 2 Food Safety expires in 14 d.",
        sourceName: "Personal Licence registry · Local Authority",
        sourceMeta: "Last verified Apr 22 2026 · checked against issuing council records",
        secondaryLabel: "Right to Work (Home Office)",
        auditAction: "EHO compliance packet",
        psvAction: "Verify alcohol licences",
        psvToast: "Cross-checking 14 workers against Personal Licence holder records",
        packetToast: "Environmental Health packet generated — Resort Way property",
      },
      catalogOverrides: {
        tips:     { label: "Personal Licence",      cadence: "10 yrs"  },
        servsafe: { label: "L2 Food Safety",        cadence: "3 yrs"   },
        fhandler: { label: "Allergen (Natasha's)",  cadence: "Annual"  },
        age21:    { label: "Age 18+ (alcohol)",     cadence: "One-time"},
      },
      stringSwaps: [
        ["State Alcohol Beverage Control", "Local Authority Licensing"],
        ["TIPS / RBS",                     "Personal Licence"],
        ["ServSafe Manager",               "L3 Food Safety Supervisor"],
        ["ServSafe",                       "L2 Food Safety"],
        ["CA-FHC-",                        "UK-FS2-"],
        ["CA-RBS-",                        "UK-PAL-"],
        ["WA-FHC-",                        "UK-FS2-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-gb-y-1", industry: "hospitality", country: "GB",
        name: "Personal Licence — Bar service",
        summary: "Personal Licence under the Licensing Act 2003; required to authorise the sale of alcohol on premises.",
        credential: "Personal Licence", issuer: "Local Authority Licensing", cadence: "10 years",
        locations: ["Aurora Resort Way"], roles: ["Bar Manager", "Duty Manager"],
      }),
      _locMkCert({
        id: "loc-gb-y-2", industry: "hospitality", country: "GB",
        name: "Level 2 Food Safety — Catering",
        summary: "Level 2 Award in Food Safety for Catering; mandatory training before handling open food.",
        credential: "L2 Food Safety", issuer: "Highfield / RSPH", cadence: "3 years",
        locations: ["All Aurora properties"], roles: ["Chef", "Server"],
      }),
      _locMkCert({
        id: "loc-gb-y-3", industry: "hospitality", country: "GB",
        name: "Allergen training — Natasha's Law",
        summary: "Allergen-awareness training; mandatory for all food-handling roles after Natasha's Law (PPDS labelling).",
        credential: "Allergen training", issuer: "Food Standards Agency-approved provider", cadence: "Annual",
        roles: ["Chef", "Server"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-gb-y-a1", industry: "hospitality", country: "GB",
        name: "Working Time Regulations — banquet & bar",
        summary: "WTR 1998 — 20 min rest after 6 hrs, 11 hr daily rest, 48 hr/week max (opt-out). Late-night licensed-premises rules apply for shifts ending after 2 a.m.",
        breakMin: "20 min unpaid after 6 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: "48 hrs/week (opt-out available)",
        callOut: "4 hours",
        locations: ["Aurora Resort Way"], roles: ["Banquet Server", "Bar Manager"],
        eligible: 138, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-gb-y-b1", industry: "hospitality", country: "GB",
        name: "DBS Basic + Right to Work — Hospitality",
        summary: "Basic Disclosure & Barring Service check + Home Office Right to Work share-code; refreshed every 3 years.",
        pkg: "Standard (DBS Basic)", drug: "None", vendor: "DBS — UK Government",
        refresh: "Every 3 years", lookback: "All available",
        locations: ["All Aurora properties"], roles: ["All worker roles"], version: "v2.0",
      }),
    ],
    },

  DE: {
    cred: {
      domain: {
        heroLabel: "Gesundheitsamt-Begehung · Samstag Hochzeit · 240 Gäste",
        heroBody: "12 von 14 Bankett-Mitarbeitenden einsatzbereit. 1 abgelaufene Gaststättenunterrichtung sperrt Alkoholausschank heute Abend; 1 Gesundheitszeugnis läuft in 14 Tagen ab.",
        sourceName: "IHK — Gaststättenunterrichtung",
        sourceMeta: "Letzte Prüfung 22.04.2026 · IHK Belehrungsregister",
        secondaryLabel: "Gesundheitszeugnis §43 IfSG",
        auditAction: "Gesundheitsamt-Paket",
        psvAction: "IHK-Belehrungen prüfen",
        psvToast: "Abgleich gestartet — 14 Mitarbeitende gegen IHK + Gesundheitsamt",
        packetToast: "Gesundheitsamt-Paket erstellt — Resort Way",
      },
      catalogOverrides: {
        tips:     { label: "Gaststättenunterrichtung", cadence: "Einmalig" },
        servsafe: { label: "Hygieneschulung",         cadence: "Jährlich"  },
        fhandler: { label: "Allergenschulung",        cadence: "Jährlich"  },
        age21:    { label: "Alter 18+ (Alkohol)",     cadence: "Einmalig"  },
      },
      stringSwaps: [
        ["State Alcohol Beverage Control", "IHK / Gesundheitsamt"],
        ["TIPS / RBS",                     "Gaststättenunterrichtung"],
        ["ServSafe Manager",               "Hygieneschulung"],
        ["ServSafe",                       "Hygieneschulung"],
        ["CA-FHC-",                        "DE-Gsh-"],
        ["CA-RBS-",                        "DE-Gst-"],
        ["WA-FHC-",                        "DE-Gsh-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-de-y-1", industry: "hospitality", country: "DE",
        name: "Gaststättenunterrichtung (IHK)",
        summary: "IHK-Belehrung gemäß §4 GastG ist vor jedem Schankrechtseinsatz verpflichtend.",
        credential: "Gaststättenunterrichtung", issuer: "IHK", cadence: "Einmalig",
        locations: ["Aurora Resort Way"], roles: ["Schankkraft", "Servicekraft"],
      }),
      _locMkCert({
        id: "loc-de-y-2", industry: "hospitality", country: "DE",
        name: "Gesundheitszeugnis nach §43 IfSG",
        summary: "Belehrung des Gesundheitsamts nach §43 Infektionsschutzgesetz; bei Einstellung und alle 2 Jahre Auffrischung.",
        credential: "Gesundheitszeugnis §43 IfSG", issuer: "Gesundheitsamt", cadence: "2 Jahre",
        roles: ["Servicekraft", "Köchin/Koch"],
      }),
      _locMkCert({
        id: "loc-de-y-3", industry: "hospitality", country: "DE",
        name: "Hygieneschulung — HACCP",
        summary: "Jährliche Hygieneschulung nach HACCP-Konzept; verpflichtend für alle Mitarbeitenden mit Lebensmittelkontakt.",
        credential: "Hygieneschulung", issuer: "Inhaus/IHK-Trainer", cadence: "Jährlich",
        roles: ["Servicekraft", "Köchin/Koch"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-de-y-a1", industry: "hospitality", country: "DE",
        name: "ArbZG — Gastgewerbe Arbeitszeit",
        summary: "Arbeitszeitgesetz + Manteltarifvertrag Gastronomie — 8h/Tag, 11h Ruhezeit, 30 min Pause nach 6h, Zuschläge für Nacht/Sonn-/Feiertag.",
        breakMin: "30 min nach 6 Std., 45 min nach 9 Std.",
        restBreak: "11 Std. tägliche Ruhezeit",
        otThreshold: ">8 Std./Tag (mit Ausgleich)",
        callOut: "4 Stunden",
        locations: ["Aurora Resort Way"], roles: ["Servicekraft", "Köchin/Koch"],
        eligible: 138, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-de-y-b1", industry: "hospitality", country: "DE",
        name: "Polizeiliches Führungszeugnis — Gastronomie",
        summary: "Polizeiliches Führungszeugnis vor Einsatzbeginn (§30 BZRG); alle 3 Jahre erneuert. Plus Aufenthaltstitel-Prüfung bei Drittstaatler:innen.",
        pkg: "Standard (Führungszeugnis)", drug: "Keine", vendor: "Bundeszentralregister",
        refresh: "Alle 3 Jahre", lookback: "Vollständig",
        locations: ["Alle Aurora-Häuser"], roles: ["Alle Mitarbeitenden"], version: "v2.0",
      }),
    ],
    },

  AU: {
    cred: {
      domain: {
        heroLabel: "Liquor & Gaming NSW audit · Saturday wedding · 240 guests",
        heroBody: "12 of 14 banquet staff are bookable. 1 expired RSA (Charlie) is auto-suspending alcohol service tonight; 1 Food Safety Supervisor expires in 14 d.",
        sourceName: "Liquor & Gaming NSW — RSA registry",
        sourceMeta: "Last verified Apr 22 2026 · NSW competency card lookup",
        secondaryLabel: "National Police Check",
        auditAction: "L&GNSW compliance packet",
        psvAction: "Verify RSA competency cards",
        psvToast: "Cross-checking 14 workers against L&GNSW competency card registry",
        packetToast: "L&GNSW compliance packet generated — Resort Way property",
      },
      catalogOverrides: {
        tips:     { label: "RSA",                  cadence: "5 yrs"   },
        servsafe: { label: "Food Safety Supervisor", cadence: "5 yrs" },
        fhandler: { label: "Food Handler",         cadence: "Annual"  },
        age21:    { label: "Age 18+ (alcohol)",    cadence: "One-time"},
      },
      stringSwaps: [
        ["State Alcohol Beverage Control", "Liquor & Gaming NSW"],
        ["TIPS / RBS",                     "RSA"],
        ["ServSafe Manager",               "Food Safety Supervisor"],
        ["ServSafe",                       "Food Safety"],
        ["CA-FHC-",                        "NSW-FSS-"],
        ["CA-RBS-",                        "NSW-RSA-"],
        ["WA-FHC-",                        "VIC-FH-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-au-y-1", industry: "hospitality", country: "AU",
        name: "RSA — Responsible Service of Alcohol",
        summary: "Active NSW RSA competency card; required for any role serving alcohol.",
        credential: "RSA", issuer: "Liquor & Gaming NSW", cadence: "5 years",
        locations: ["Aurora Resort Way"], roles: ["Bartender", "Server"],
      }),
      _locMkCert({
        id: "loc-au-y-2", industry: "hospitality", country: "AU",
        name: "Food Safety Supervisor — FSANZ",
        summary: "Food Safety Supervisor certificate required for at least one nominated person per food premises.",
        credential: "Food Safety Supervisor", issuer: "FSANZ-approved RTO", cadence: "5 years",
        locations: ["All Aurora properties"], roles: ["Sous Chef", "Banquet Captain"],
      }),
      _locMkCert({
        id: "loc-au-y-3", industry: "hospitality", country: "AU",
        name: "Working Rights — VEVO",
        summary: "Right-to-work verification via DHA VEVO; refreshed on visa expiry.",
        credential: "VEVO check", issuer: "Department of Home Affairs", cadence: "Per visa",
        roles: ["All hospitality staff"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-au-y-a1", industry: "hospitality", country: "AU",
        name: "Hospitality Award + NES — hours & breaks",
        summary: "Hospitality Industry (General) Award 2020 + NES — 38h ordinary week, 10 hr break between shifts, 30 min unpaid meal after 5 hrs, weekend + public-holiday penalty rates.",
        breakMin: "30 min unpaid after 5 hrs",
        restBreak: "10 hr rest between shifts",
        otThreshold: ">38 hrs/week (penalty rates apply)",
        callOut: "4 hours",
        locations: ["Aurora Resort Way"], roles: ["Banquet Server", "Bartender"],
        eligible: 138, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-au-y-b1", industry: "hospitality", country: "AU",
        name: "AFP National Police Check + VEVO — Hospitality",
        summary: "AFP National Police Check + DHA VEVO Right to Work verification at hire; refreshed every 3 years.",
        pkg: "Standard (AFP NPC + VEVO)", drug: "None", vendor: "Australian Federal Police",
        refresh: "Every 3 years", lookback: "10 years",
        locations: ["All Aurora properties"], roles: ["All worker roles"], version: "v2.0",
      }),
    ],
    },

  JP: {
    cred: {
      domain: {
        heroLabel: "保健所立入検査 · 土曜結婚式 · 240名",
        heroBody: "宴会スタッフ14名のうち12名が稼働可能。1名の食品衛生責任者期限切れにより、本日アルコール提供を自動停止。1名は14日以内に期限切れ。",
        sourceName: "都道府県食品衛生協会",
        sourceMeta: "最終確認 2026年4月22日 · 食品衛生責任者台帳と毎日照合",
        secondaryLabel: "在留資格 (入管法)",
        auditAction: "保健所提出パケット",
        psvAction: "食品衛生責任者を照会",
        psvToast: "照合開始 — 14名 / 食品衛生協会",
        packetToast: "保健所提出パケットを作成しました",
      },
      catalogOverrides: {
        tips:     { label: "食品衛生責任者",    cadence: "永久" },
        servsafe: { label: "防火管理者",       cadence: "永久" },
        fhandler: { label: "アレルゲン研修",   cadence: "毎年" },
        age21:    { label: "20歳以上 (酒)",    cadence: "一度" },
      },
      stringSwaps: [
        ["State Alcohol Beverage Control", "都道府県食品衛生協会"],
        ["TIPS / RBS",                     "食品衛生責任者"],
        ["ServSafe Manager",               "防火管理者"],
        ["ServSafe",                       "食品衛生責任者"],
        ["CA-FHC-",                        "JP-SE-"],
        ["CA-RBS-",                        "JP-BK-"],
        ["WA-FHC-",                        "JP-SE-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-jp-y-1", industry: "hospitality", country: "JP",
        name: "食品衛生責任者 — 飲食店",
        summary: "食品衛生法により、各営業施設に1名以上の食品衛生責任者の配置が必須。",
        credential: "食品衛生責任者", issuer: "都道府県食品衛生協会", cadence: "永久",
        locations: ["Aurora Resort Way"], roles: ["店長", "シェフ"],
      }),
      _locMkCert({
        id: "loc-jp-y-2", industry: "hospitality", country: "JP",
        name: "防火管理者 (甲種)",
        summary: "消防法に基づく防火管理者選任。30名以上収容施設では甲種が必要。",
        credential: "防火管理者 甲種", issuer: "消防庁", cadence: "永久",
        locations: ["全アウローラ施設"], roles: ["店長", "副店長"],
      }),
      _locMkCert({
        id: "loc-jp-y-3", industry: "hospitality", country: "JP",
        name: "20歳以上確認 — 飲酒",
        summary: "日本国内のアルコール提供は満20歳以上の確認が必須。生年月日台帳と照合。",
        credential: "年齢確認 (20歳+)", issuer: "在留カード / 身分証", cadence: "一度",
        roles: ["バーテンダー", "サーバー"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-jp-y-a1", industry: "hospitality", country: "JP",
        name: "労基法 — 飲食店勤務時間",
        summary: "労働基準法 — 1日8時間/週40時間、6時間超で45分・8時間超で60分の休憩、深夜割増 (22時以降25%)。",
        breakMin: "6時間超で45分、8時間超で60分",
        restBreak: "勤務間11時間以上推奨",
        otThreshold: "週40時間超 (36協定範囲内)",
        callOut: "4時間",
        locations: ["Aurora Resort Way"], roles: ["サーバー", "バーテンダー"],
        eligible: 138, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-jp-y-b1", industry: "hospitality", country: "JP",
        name: "身元保証 + 在留資格 — 飲食店",
        summary: "雇用前に身元保証書、在留カード確認、健康診断結果を提出。外国人材は資格外活動許可を確認。",
        pkg: "雇入時パッケージ", drug: "雇入時健康診断", vendor: "人事 / 入管",
        refresh: "雇用時のみ", lookback: "5年",
        locations: ["全Aurora施設"], roles: ["全スタッフ"], version: "v2.0",
      }),
    ],
    },
};

// =====================================================================
// RETAIL
// =====================================================================
const _RETAIL = {
  CA: {
    cred: {
      domain: {
        heroLabel: "Boxing Week surge · 640 shifts · 40 stores",
        heroBody: "11 of 14 surge workers are credential-ready. 1 expired age verification is blocking alcohol-aisle assignment; 1 ESA attestation expires in 14 d.",
        sourceName: "Sterling Talent Solutions — Canada",
        sourceMeta: "Last verified Apr 22 2026 · automated on hire + every 3 yrs",
        secondaryLabel: "Provincial Liquor Board (LCBO)",
        auditAction: "Bill 148 / ESA packet",
        psvAction: "Re-run background checks",
        psvToast: "Background-check re-runs queued via Sterling Canada — 14 workers",
        packetToast: "Ontario ESA compliance packet generated — Flagship Toronto",
      },
      catalogOverrides: {
        age21: { label: "Age 19+ (alcohol)", cadence: "One-time" },
        age18: { label: "Age 18+ (tobacco)", cadence: "One-time" },
        fww:   { label: "ESA attestation",   cadence: "Per province" },
      },
      stringSwaps: [
        ["Sterling Background Check", "Sterling Canada"],
        ["Fair Workweek",             "ESA scheduling"],
        ["NYC, SF, Seattle, Oregon, Chicago", "Toronto, Ottawa, Vancouver"],
        ["NYC —",                     "Toronto —"],
        ["SF —",                      "Vancouver —"],
        ["Seattle attestation",       "Toronto ESA attestation"],
        ["OR —",                      "ON —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-ca-r-1", industry: "retail", country: "CA",
        name: "Age 19+ verification — Alcohol",
        summary: "Worker DOB verified before any alcohol-aisle or LCBO-counter assignment (Ontario legal age: 19).",
        credential: "Age 19+ (alcohol)", issuer: "I-9 / DOB verification", cadence: "One-time",
        locations: ["All Northwind ON stores"], roles: ["Cashier · alcohol"],
      }),
      _locMkCert({
        id: "loc-ca-r-2", industry: "retail", country: "CA",
        name: "Smart Serve — Beer & Wine aisle",
        summary: "Smart Serve certification required where the store sells beer/wine on-premise (Ontario grocery).",
        credential: "Smart Serve", issuer: "Smart Serve Ontario", cadence: "5 years",
        roles: ["Cashier · alcohol"],
      }),
      _locMkCert({
        id: "loc-ca-r-3", industry: "retail", country: "CA",
        name: "Background check — Pre-hire",
        summary: "Sterling Canada criminal record check before deployment; refreshed every 3 years.",
        credential: "CPIC criminal check", issuer: "Sterling Canada", cadence: "3 years",
        roles: ["All store associates"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-ca-r-a1", industry: "retail", country: "CA",
        name: "Ontario ESA — predictable scheduling",
        summary: "ESA Part VII — 30 min eating period after 5 hrs, 11 hr daily rest. Bill 148 amendments: 4 hr minimum on call-in.",
        breakMin: "30 min unpaid after 5 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: ">44 hrs/week (ON)",
        callOut: "4 hours",
        premium: "3-hour minimum pay on cancelled shift within 48 h",
        locations: ["All Northwind ON stores"], roles: ["All hourly retail roles"],
        eligible: 326, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-ca-r-b1", industry: "retail", country: "CA",
        name: "Pre-employment background — Retail (CA)",
        summary: "Sterling Canada CPIC + ID verification; 5-panel drug screen for jewelry / electronics roles.",
        pkg: "Standard", drug: "5-panel", vendor: "Sterling Canada",
        refresh: "Every 3 years", lookback: "5 years",
        locations: ["All Northwind ON stores"], roles: ["All hourly retail roles"], version: "v2.0",
      }),
    ],
    },

  GB: {
    cred: {
      domain: {
        heroLabel: "Boxing Day surge · 640 shifts · 40 stores",
        heroBody: "11 of 14 surge workers are credential-ready. 1 expired Challenge 25 attestation is blocking age-restricted aisle assignment; 1 DBS Basic expires in 14 d.",
        sourceName: "DBS Basic — UK",
        sourceMeta: "Last verified Apr 22 2026 · automated on hire + every 3 yrs",
        secondaryLabel: "Right to Work (Home Office)",
        auditAction: "HMRC NMW evidence packet",
        psvAction: "Re-run DBS Basic",
        psvToast: "DBS Basic re-runs queued — 14 workers",
        packetToast: "HMRC NMW compliance packet generated — Flagship London",
      },
      catalogOverrides: {
        age21: { label: "Age 18+ (alcohol)", cadence: "One-time" },
        age18: { label: "Age 18+ (tobacco)", cadence: "One-time" },
        fww:   { label: "WTR attestation",   cadence: "Per role" },
      },
      stringSwaps: [
        ["Sterling Background Check", "DBS — UK Government"],
        ["Fair Workweek",             "Working Time Regs"],
        ["NYC, SF, Seattle, Oregon, Chicago", "London, Manchester, Birmingham"],
        ["NYC —",                     "London —"],
        ["SF —",                      "Manchester —"],
        ["Seattle attestation",       "Manchester WTR attestation"],
        ["OR —",                      "BHM —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-gb-r-1", industry: "retail", country: "GB",
        name: "Challenge 25 — Age verification",
        summary: "Anyone appearing under 25 must be ID-checked before any age-restricted sale (alcohol, tobacco, knives).",
        credential: "Challenge 25 training", issuer: "Trading Standards", cadence: "Annual",
        locations: ["All Northwind UK stores"], roles: ["Cashier"],
      }),
      _locMkCert({
        id: "loc-gb-r-2", industry: "retail", country: "GB",
        name: "DBS Basic — Pre-hire",
        summary: "Basic Disclosure & Barring Service check before deployment; refreshed every 3 years.",
        credential: "DBS Basic", issuer: "Disclosure & Barring Service", cadence: "3 years",
        roles: ["All store associates"],
      }),
      _locMkCert({
        id: "loc-gb-r-3", industry: "retail", country: "GB",
        name: "Right to Work — Home Office",
        summary: "Right-to-work verification via Home Office digital check; refresh on visa expiry.",
        credential: "RTW check", issuer: "Home Office", cadence: "Per visa",
        roles: ["All store associates"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-gb-r-a1", industry: "retail", country: "GB",
        name: "Working Time Regulations — Retail",
        summary: "WTR 1998 — 20 min rest after 6 hrs, 11 hr daily rest, 48 hr/week max (opt-out). Sunday Trading Act limits for large stores.",
        breakMin: "20 min unpaid after 6 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: "48 hrs/week (opt-out available)",
        callOut: "4 hours",
        locations: ["All Northwind UK stores"], roles: ["All hourly retail roles"],
        eligible: 326, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-gb-r-b1", industry: "retail", country: "GB",
        name: "DBS Basic — Retail (UK)",
        summary: "Basic DBS check at hire + Home Office Right to Work share-code; refreshed every 3 years.",
        pkg: "Standard (DBS Basic)", drug: "None", vendor: "DBS — UK Government",
        refresh: "Every 3 years", lookback: "All available",
        locations: ["All Northwind UK stores"], roles: ["All hourly retail roles"], version: "v2.0",
      }),
    ],
    },

  DE: {
    cred: {
      domain: {
        heroLabel: "Schlussverkauf · 640 Schichten · 40 Filialen",
        heroBody: "11 von 14 Aushilfen einsatzbereit. 1 abgelaufene JuSchG-Altersprüfung blockiert Alkohol-Regal-Einsatz; 1 Führungszeugnis läuft in 14 Tagen ab.",
        sourceName: "Bundeszentralregister — Polizeiliches Führungszeugnis",
        sourceMeta: "Letzte Prüfung 22.04.2026 · automatisiert vor Einsatz + alle 3 Jahre",
        secondaryLabel: "Aufenthaltstitel (Ausländerbehörde)",
        auditAction: "Zoll-FKS Prüfpaket",
        psvAction: "Führungszeugnisse erneuern",
        psvToast: "Führungszeugnis-Erneuerung gestartet — 14 Mitarbeitende",
        packetToast: "Zoll-FKS Prüfpaket erstellt — Flagship Berlin",
      },
      catalogOverrides: {
        age21: { label: "Alter 18+ (Alkohol)", cadence: "Einmalig" },
        age18: { label: "Alter 18+ (Tabak)",   cadence: "Einmalig" },
        fww:   { label: "ArbZG-Bestätigung",   cadence: "Pro Rolle" },
      },
      stringSwaps: [
        ["Sterling Background Check", "Polizeiliches Führungszeugnis"],
        ["Fair Workweek",             "ArbZG-Bestätigung"],
        ["NYC, SF, Seattle, Oregon, Chicago", "Berlin, Hamburg, München"],
        ["NYC —",                     "Berlin —"],
        ["SF —",                      "Hamburg —"],
        ["Seattle attestation",       "Hamburg ArbZG-Bestätigung"],
        ["OR —",                      "BY —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-de-r-1", industry: "retail", country: "DE",
        name: "JuSchG Altersnachweis",
        summary: "Vor jedem alkohol- oder tabakbezogenen Verkauf muss das Alter (18+) gemäß JuSchG geprüft werden.",
        credential: "JuSchG-Schulung", issuer: "Filialleitung", cadence: "Jährlich",
        locations: ["Alle Northwind DE Filialen"], roles: ["Kassenkraft"],
      }),
      _locMkCert({
        id: "loc-de-r-2", industry: "retail", country: "DE",
        name: "Polizeiliches Führungszeugnis — vor Einsatz",
        summary: "Erweitertes Führungszeugnis vor Einsatzbeginn; alle 3 Jahre erneuert.",
        credential: "Führungszeugnis", issuer: "Bundeszentralregister", cadence: "3 Jahre",
        roles: ["Alle Mitarbeitenden"],
      }),
      _locMkCert({
        id: "loc-de-r-3", industry: "retail", country: "DE",
        name: "Aufenthaltstitel — Arbeitserlaubnis",
        summary: "Prüfung des Aufenthaltstitels gemäß AufenthG vor Vertragsabschluss; Aktualisierung bei Verlängerung.",
        credential: "Aufenthaltstitel", issuer: "Ausländerbehörde", cadence: "Pro Titel",
        roles: ["Alle Mitarbeitenden"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-de-r-a1", industry: "retail", country: "DE",
        name: "ArbZG + LadSchlG — Einzelhandel",
        summary: "Arbeitszeitgesetz + Ladenschlussgesetz — 8h/Tag, 11h Ruhezeit, 30 min Pause nach 6h, Sonntagsverkaufsverbot mit Ausnahmen.",
        breakMin: "30 min nach 6 Std., 45 min nach 9 Std.",
        restBreak: "11 Std. tägliche Ruhezeit",
        otThreshold: ">8 Std./Tag (mit Ausgleich)",
        callOut: "4 Stunden",
        locations: ["Alle Northwind DE Filialen"], roles: ["Kassenkraft", "Verkaufskraft"],
        eligible: 326, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-de-r-b1", industry: "retail", country: "DE",
        name: "Führungszeugnis + Aufenthaltstitel — Einzelhandel",
        summary: "Polizeiliches Führungszeugnis vor Einsatzbeginn (§30 BZRG); plus Aufenthaltstitel-Prüfung. Alle 3 Jahre erneuert.",
        pkg: "Standard (Führungszeugnis)", drug: "Keine", vendor: "Bundeszentralregister",
        refresh: "Alle 3 Jahre", lookback: "Vollständig",
        locations: ["Alle Northwind DE Filialen"], roles: ["Alle Mitarbeitenden"], version: "v2.0",
      }),
    ],
    },

  AU: {
    cred: {
      domain: {
        heroLabel: "Boxing Day surge · 640 shifts · 40 stores",
        heroBody: "11 of 14 surge workers are credential-ready. 1 expired RSA is blocking liquor-aisle assignment; 1 VEVO check expires in 14 d.",
        sourceName: "Australian Federal Police Check",
        sourceMeta: "Last verified Apr 22 2026 · automated on hire + every 3 yrs",
        secondaryLabel: "VEVO Working Rights",
        auditAction: "Fair Work Ombudsman packet",
        psvAction: "Re-run AFP Check",
        psvToast: "AFP Check re-runs queued — 14 workers",
        packetToast: "Fair Work Ombudsman packet generated — Flagship Sydney",
      },
      catalogOverrides: {
        age21: { label: "Age 18+ (alcohol)", cadence: "One-time" },
        age18: { label: "Age 18+ (tobacco)", cadence: "One-time" },
        fww:   { label: "Retail Award attestation", cadence: "Per role" },
      },
      stringSwaps: [
        ["Sterling Background Check", "Australian Federal Police Check"],
        ["Fair Workweek",             "Retail Award"],
        ["NYC, SF, Seattle, Oregon, Chicago", "Sydney, Melbourne, Brisbane"],
        ["NYC —",                     "Sydney —"],
        ["SF —",                      "Melbourne —"],
        ["Seattle attestation",       "Melbourne Award attestation"],
        ["OR —",                      "BNE —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-au-r-1", industry: "retail", country: "AU",
        name: "RSA — Liquor aisle",
        summary: "Active state RSA required for any role selling alcohol in NSW/VIC/QLD stores.",
        credential: "RSA", issuer: "Liquor & Gaming NSW (and state equivalents)", cadence: "5 years",
        locations: ["NSW/VIC/QLD stores"], roles: ["Cashier · alcohol"],
      }),
      _locMkCert({
        id: "loc-au-r-2", industry: "retail", country: "AU",
        name: "AFP National Police Check",
        summary: "Australian Federal Police National Police Check before deployment; refreshed every 3 years.",
        credential: "National Police Check", issuer: "Australian Federal Police", cadence: "3 years",
        roles: ["All store associates"],
      }),
      _locMkCert({
        id: "loc-au-r-3", industry: "retail", country: "AU",
        name: "Working Rights — VEVO",
        summary: "Department of Home Affairs VEVO check before deployment and on visa renewal.",
        credential: "VEVO check", issuer: "Department of Home Affairs", cadence: "Per visa",
        roles: ["All store associates"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-au-r-a1", industry: "retail", country: "AU",
        name: "General Retail Award + NES",
        summary: "General Retail Industry Award 2020 + NES — 38h ordinary week, 12 hr rest between shifts, 30 min unpaid meal after 5 hrs, weekend + public-holiday penalty rates.",
        breakMin: "30 min unpaid after 5 hrs",
        restBreak: "12 hr rest between shifts",
        otThreshold: ">38 hrs/week (penalty rates apply)",
        callOut: "3 hours",
        locations: ["All Northwind AU stores"], roles: ["All hourly retail roles"],
        eligible: 326, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-au-r-b1", industry: "retail", country: "AU",
        name: "AFP National Police Check + VEVO — Retail",
        summary: "AFP NPC + DHA VEVO Right to Work verification at hire; refreshed every 3 years.",
        pkg: "Standard (AFP NPC + VEVO)", drug: "5-panel", vendor: "Australian Federal Police",
        refresh: "Every 3 years", lookback: "10 years",
        locations: ["All Northwind AU stores"], roles: ["All hourly retail roles"], version: "v2.0",
      }),
    ],
    },

  JP: {
    cred: {
      domain: {
        heroLabel: "歳末セール · 640シフト · 40店舗",
        heroBody: "増員スタッフ14名のうち11名が稼働可能。1名の年齢確認研修期限切れにより、酒類売場の配置を自動停止。1名は14日以内に期限切れ。",
        sourceName: "警察庁 犯歴照会",
        sourceMeta: "最終確認 2026年4月22日 · 雇用時および3年ごとに自動照合",
        secondaryLabel: "在留カード / 在留資格",
        auditAction: "労働基準監督署 提出パケット",
        psvAction: "犯歴照会を再実行",
        psvToast: "犯歴照会を14名に対し再実行",
        packetToast: "労基署提出パケットを作成しました",
      },
      catalogOverrides: {
        age21: { label: "20歳以上 (酒)",  cadence: "一度" },
        age18: { label: "20歳以上 (たばこ)", cadence: "一度" },
        fww:   { label: "36協定遵守",     cadence: "店舗ごと" },
      },
      stringSwaps: [
        ["Sterling Background Check", "警察庁 犯歴照会"],
        ["Fair Workweek",             "36協定"],
        ["NYC, SF, Seattle, Oregon, Chicago", "東京・大阪・名古屋"],
        ["NYC —",                     "東京 —"],
        ["SF —",                      "大阪 —"],
        ["Seattle attestation",       "名古屋 36協定確認"],
        ["OR —",                      "OSA —"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-jp-r-1", industry: "retail", country: "JP",
        name: "年齢確認研修 — 酒類・たばこ",
        summary: "未成年者飲酒禁止法・未成年者喫煙禁止法に基づき、満20歳以上の確認が必須。",
        credential: "年齢確認研修", issuer: "店舗教育担当", cadence: "毎年",
        locations: ["全Northwind日本店舗"], roles: ["レジスタッフ"],
      }),
      _locMkCert({
        id: "loc-jp-r-2", industry: "retail", country: "JP",
        name: "在留資格・就労資格確認",
        summary: "出入国管理及び難民認定法に基づき、雇用前に在留資格と就労可否を確認。",
        credential: "在留カード確認", issuer: "出入国在留管理庁", cadence: "在留期間ごと",
        roles: ["全スタッフ"],
      }),
      _locMkCert({
        id: "loc-jp-r-3", industry: "retail", country: "JP",
        name: "36協定 — 時間外労働",
        summary: "労基法36条届出範囲を超えない勤務シフト編成。月45時間・年360時間上限。",
        credential: "36協定遵守", issuer: "労働基準監督署", cadence: "年次",
        roles: ["全店長・副店長"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-jp-r-a1", industry: "retail", country: "JP",
        name: "労基法 — 小売店勤務時間",
        summary: "労働基準法 — 1日8時間/週40時間、6時間超で45分・8時間超で60分の休憩、深夜割増 (22時以降25%)、36協定範囲を超えない。",
        breakMin: "6時間超で45分、8時間超で60分",
        restBreak: "勤務間11時間以上推奨",
        otThreshold: "週40時間超 (36協定範囲内)",
        callOut: "4時間",
        locations: ["全Northwind日本店舗"], roles: ["レジスタッフ", "販売スタッフ"],
        eligible: 326, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-jp-r-b1", industry: "retail", country: "JP",
        name: "身元保証 + 在留資格 — 小売",
        summary: "雇用前に身元保証書、在留カード確認、健康診断結果を提出。",
        pkg: "雇入時パッケージ", drug: "雇入時健康診断", vendor: "人事",
        refresh: "雇用時のみ", lookback: "5年",
        locations: ["全Northwind日本店舗"], roles: ["全スタッフ"], version: "v2.0",
      }),
    ],
    },
};

// =====================================================================
// MANUFACTURING
// =====================================================================
const _MANUFACTURING = {
  CA: {
    cred: {
      domain: {
        heroLabel: "MOL workplace inspection · Friday May 15",
        heroBody: "12 of 14 line workers fully cleared. 1 expired Lift Truck cert (Marcus) is auto-suspending power-equipment shifts; 1 WHMIS refresher expires in 14 d.",
        sourceName: "Ontario Working at Heights provider",
        sourceMeta: "Card lookups verified Apr 22 2026 · daily reconciliation",
        secondaryLabel: "WSIB clearance",
        auditAction: "MOL inspection packet",
        psvAction: "Verify WHMIS / WAH",
        psvToast: "Verifying 14 workers against WHMIS + Working at Heights registries",
        packetToast: "MOL packet generated for Plant #02",
      },
      catalogOverrides: {
        osha:     { label: "WHMIS 2015",                cadence: "Annual" },
        osha30:   { label: "Working at Heights",        cadence: "3 yrs"  },
        forklift: { label: "Lift Truck Operator (CSA)", cadence: "3 yrs"  },
      },
      stringSwaps: [
        ["OSHA Outreach Trainer Portal", "Ontario WAH provider"],
        ["OSHA-10",                      "WHMIS 2015"],
        ["OSHA-30",                      "Working at Heights"],
        ["OSHA 300",                     "MOL incident log"],
        ["OSHA #B-",                     "WHMIS-ON-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-ca-m-1", industry: "manufacturing", country: "CA",
        name: "WHMIS 2015 — General workplace",
        summary: "Workplace Hazardous Materials Information System training under Health Canada; mandatory annual refresh.",
        credential: "WHMIS 2015", issuer: "Health Canada-aligned provider", cadence: "Annual",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["Operator", "Assembler"],
      }),
      _locMkCert({
        id: "loc-ca-m-2", industry: "manufacturing", country: "CA",
        name: "Working at Heights — Ontario",
        summary: "MOL-approved Working at Heights training required before any work above 3 m on construction projects.",
        credential: "Working at Heights", issuer: "MOL-approved provider", cadence: "3 years",
        roles: ["Operator", "Maintenance"],
      }),
      _locMkCert({
        id: "loc-ca-m-3", industry: "manufacturing", country: "CA",
        name: "Lift Truck Operator — CSA B335",
        summary: "CSA B335-compliant Lift Truck Operator training required for powered industrial truck operation.",
        credential: "Lift Truck Operator (CSA B335)", issuer: "CSA-approved trainer", cadence: "3 years",
        roles: ["Forklift operator"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-ca-m-a1", industry: "manufacturing", country: "CA",
        name: "Ontario ESA — line worker hours",
        summary: "ESA Part VII — 30 min eating period after 5 hrs, 8h daily / 48h weekly limits, 11 hr daily rest, premium pay over weekly cap.",
        breakMin: "30 min unpaid after 5 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: ">44 hrs/week (ON)",
        callOut: "4 hours",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["All line roles"],
        eligible: 192, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-ca-m-b1", industry: "manufacturing", country: "CA",
        name: "Pre-employment background — Manufacturing (CA)",
        summary: "Sterling Canada CPIC + 5-panel drug screen at hire; on-cause re-test enabled. Cannabis testing on-cause only.",
        pkg: "Standard", drug: "5-panel", vendor: "Sterling Canada",
        refresh: "Hire only", lookback: "5 years",
        locations: ["All Atlas plants"], roles: ["All worker roles"], version: "v2.0",
      }),
      _locMkTraining({
        id: "loc-ca-m-t1", industry: "manufacturing", country: "CA",
        name: "Energy isolation — CSA Z460",
        summary: "Hazardous Energy Control — CSA Z460-13 / OHSA O. Reg. 851 s. 75-76 — energy-control procedure training; annual refresh.",
        course: "Energy isolation — CSA Z460",
        duration: "90 minutes",
        delivery: "Instructor-led",
        renew: "Annual",
        locations: ["All Atlas plants"], roles: ["Operator", "Maintenance"],
        eligible: 192, enforce: "block", version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-ca-m-s1", industry: "manufacturing", country: "CA",
        name: "Respiratory protection — CSA Z94.4",
        summary: "CSA Z94.4 quantitative fit test; annual; auto-suspend respirator zones on expiry. WSIB exposure reporting.",
        scope_text: "Respirator-required zones — paint, solvent, abrasive blast",
        ppe: "Half-face APR + cartridge per zone matrix (CSA Z94.4 fit-tested)",
        drillCadence: "Annual",
        incidentLog: "WSIB Form 7",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["Operator (respirator zone)"],
        eligible: 96, version: "v2.0",
      }),
    ],
    },

  GB: {
    cred: {
      domain: {
        heroLabel: "HSE inspection · Friday May 15",
        heroBody: "12 of 14 line workers fully cleared. 1 expired FLT licence (Marcus) is auto-suspending power-equipment shifts; 1 IOSH refresher expires in 14 d.",
        sourceName: "RTITB / NEBOSH database",
        sourceMeta: "Card lookups verified Apr 22 2026 · daily reconciliation",
        secondaryLabel: "CSCS Card register",
        auditAction: "HSE inspection packet",
        psvAction: "Verify CSCS / FLT cards",
        psvToast: "Verifying 14 workers against CSCS + RTITB registries",
        packetToast: "HSE inspection packet generated for Plant #02",
      },
      catalogOverrides: {
        osha:     { label: "IOSH Working Safely",    cadence: "3 yrs" },
        osha30:   { label: "NEBOSH NGC",             cadence: "5 yrs" },
        forklift: { label: "FLT Licence (RTITB)",    cadence: "3 yrs" },
      },
      stringSwaps: [
        ["OSHA Outreach Trainer Portal", "RTITB / NEBOSH"],
        ["OSHA-10",                      "IOSH"],
        ["OSHA-30",                      "NEBOSH NGC"],
        ["OSHA 300",                     "RIDDOR log"],
        ["OSHA #B-",                     "CSCS-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-gb-m-1", industry: "manufacturing", country: "GB",
        name: "IOSH Working Safely",
        summary: "Foundation H&S certificate for all UK workplace operatives.",
        credential: "IOSH Working Safely", issuer: "IOSH-approved provider", cadence: "3 years",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["Operator", "Assembler"],
      }),
      _locMkCert({
        id: "loc-gb-m-2", industry: "manufacturing", country: "GB",
        name: "FLT Licence — RTITB",
        summary: "RTITB-accredited Fork Lift Truck operator licence; required for all powered MHE operation.",
        credential: "FLT Licence", issuer: "RTITB-accredited instructor", cadence: "3 years",
        roles: ["Forklift operator"],
      }),
      _locMkCert({
        id: "loc-gb-m-3", industry: "manufacturing", country: "GB",
        name: "CSCS Card — site access",
        summary: "Construction Skills Certification Scheme card; required for site access on regulated projects.",
        credential: "CSCS Card", issuer: "CSCS", cadence: "5 years",
        roles: ["Operator", "Maintenance"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-gb-m-a1", industry: "manufacturing", country: "GB",
        name: "WTR 1998 — Manufacturing",
        summary: "Working Time Regulations — 20 min rest after 6 hrs, 11 hr daily rest, 48 hr/week max (opt-out available).",
        breakMin: "20 min unpaid after 6 hrs",
        restBreak: "11 hr daily rest",
        otThreshold: "48 hrs/week (opt-out available)",
        callOut: "4 hours",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["All line roles"],
        eligible: 192, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-gb-m-b1", industry: "manufacturing", country: "GB",
        name: "BS 7858 vetting — Manufacturing (UK)",
        summary: "BS 7858 employment screening: identity, RTW, criminal record, 5-year employment history.",
        pkg: "BS 7858", drug: "Pre-employment screen", vendor: "DBS-approved provider",
        refresh: "Every 3 years", lookback: "5 years",
        locations: ["All Atlas plants"], roles: ["All worker roles"], version: "v2.0",
      }),
      _locMkTraining({
        id: "loc-gb-m-t1", industry: "manufacturing", country: "GB",
        name: "Safe isolation — HSG253",
        summary: "HSE guidance HSG253 — safe isolation of plant and equipment; annual refresh. Replaces US LOTO.",
        course: "Safe isolation — HSG253",
        duration: "90 minutes",
        delivery: "Instructor-led",
        renew: "Annual",
        locations: ["All Atlas plants"], roles: ["Operator", "Maintenance"],
        eligible: 192, enforce: "block", version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-gb-m-s1", industry: "manufacturing", country: "GB",
        name: "RPE fit testing — HSE INDG479",
        summary: "HSE INDG479 — face-fit test all tight-fitting respiratory protective equipment; annual; RIDDOR-reportable on incident.",
        scope_text: "Respirator-required zones — paint, solvent, abrasive blast",
        ppe: "Half-mask APR + cartridge per zone matrix (HSE INDG479 fit-tested)",
        drillCadence: "Annual",
        incidentLog: "RIDDOR",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["Operator (respirator zone)"],
        eligible: 96, version: "v2.0",
      }),
    ],
    },

  DE: {
    cred: {
      domain: {
        heroLabel: "Berufsgenossenschaft-Audit · Freitag 15. Mai",
        heroBody: "12 von 14 Linienkräften sind freigegeben. 1 abgelaufener Gabelstaplerschein (Marcus) sperrt Flurförderzeuge; 1 Unterweisung läuft in 14 Tagen ab.",
        sourceName: "DGUV Schein-Datenbank",
        sourceMeta: "Prüfungen bestätigt am 22.04.2026 · tägliche Abgleichung",
        secondaryLabel: "Polizeiliches Führungszeugnis",
        auditAction: "BG-Prüfpaket",
        psvAction: "Scheine verifizieren",
        psvToast: "Prüfung gestartet — 14 Mitarbeitende gegen DGUV / SiFa",
        packetToast: "BG-Prüfpaket für Werk #02 erstellt",
      },
      catalogOverrides: {
        osha:     { label: "Unterweisung §12 ArbSchG",       cadence: "Jährlich" },
        osha30:   { label: "SiFa-Grundkurs",                 cadence: "5 Jahre"  },
        forklift: { label: "Gabelstaplerschein (DGUV V 68)", cadence: "Jährliche Unterweisung" },
      },
      stringSwaps: [
        ["OSHA Outreach Trainer Portal", "DGUV / BG"],
        ["OSHA-10",                      "Unterweisung §12"],
        ["OSHA-30",                      "SiFa-Grundkurs"],
        ["OSHA 300",                     "BG-Meldung"],
        ["OSHA #B-",                     "DGUV-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-de-m-1", industry: "manufacturing", country: "DE",
        name: "Unterweisung §12 ArbSchG",
        summary: "Jährliche Unterweisung nach §12 Arbeitsschutzgesetz für alle Mitarbeitenden mit Maschinen- oder Gefahrstoffkontakt.",
        credential: "Unterweisung §12", issuer: "Vorgesetzte:r", cadence: "Jährlich",
        locations: ["Atlas Werk #02", "Atlas Werk #04"], roles: ["Operator:in", "Monteur:in"],
      }),
      _locMkCert({
        id: "loc-de-m-2", industry: "manufacturing", country: "DE",
        name: "Gabelstaplerschein — DGUV V 68",
        summary: "Befähigung zum Führen von Flurförderzeugen gemäß DGUV Vorschrift 68; jährliche Unterweisung.",
        credential: "Gabelstaplerschein", issuer: "DGUV-anerkannter Trainer", cadence: "Jährliche Unterweisung",
        roles: ["Gabelstaplerfahrer:in"],
      }),
      _locMkCert({
        id: "loc-de-m-3", industry: "manufacturing", country: "DE",
        name: "SiFa-Grundkurs — Fachkraft für Arbeitssicherheit",
        summary: "Grundausbildung Fachkraft für Arbeitssicherheit (SiFa) für die nominierte SiFa pro Standort.",
        credential: "SiFa Grundkurs", issuer: "DGUV-anerkannter Träger", cadence: "5 Jahre",
        roles: ["Sicherheitsbeauftragte"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-de-m-a1", industry: "manufacturing", country: "DE",
        name: "ArbZG — Produktion",
        summary: "Arbeitszeitgesetz — max 8h/Tag (10h mit Ausgleich), 11h Ruhezeit, 30 min Pause nach 6h, Sonn- und Feiertagsruhe.",
        breakMin: "30 min nach 6 Std., 45 min nach 9 Std.",
        restBreak: "11 Std. tägliche Ruhezeit",
        otThreshold: ">8 Std./Tag (Ausgleich binnen 24 Wochen)",
        callOut: "4 Stunden",
        locations: ["Atlas Werk #02", "Atlas Werk #04"], roles: ["Alle Linientätigkeiten"],
        eligible: 192, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-de-m-b1", industry: "manufacturing", country: "DE",
        name: "Polizeiliches Führungszeugnis — Produktion",
        summary: "Polizeiliches Führungszeugnis vor Einsatzbeginn (§30 BZRG); G25 Eignungsuntersuchung für sicherheitsrelevante Tätigkeiten.",
        pkg: "Standard (Führungszeugnis + G25)", drug: "G25 Eignung", vendor: "Bundeszentralregister",
        refresh: "Alle 3 Jahre", lookback: "Vollständig",
        locations: ["Alle Atlas-Werke"], roles: ["Alle Mitarbeitenden"], version: "v2.0",
      }),
      _locMkTraining({
        id: "loc-de-m-t1", industry: "manufacturing", country: "DE",
        name: "Freischalten / Sichern — BetrSichV",
        summary: "Betriebssicherheitsverordnung §6 — Freischalten und gegen Wiedereinschalten sichern; jährliche Unterweisung durch SiFa.",
        course: "Freischalten / 5 Sicherheitsregeln",
        duration: "90 Minuten",
        delivery: "Präsenzschulung",
        renew: "Jährlich",
        locations: ["Alle Atlas-Werke"], roles: ["Maschinenführer:in", "Instandhaltung"],
        eligible: 192, enforce: "block", version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-de-m-s1", industry: "manufacturing", country: "DE",
        name: "Atemschutz — DGUV Regel 112-190",
        summary: "DGUV Regel 112-190 — Atemschutzgeräte: Tauglichkeitsuntersuchung G26, jährliche Unterweisung, BG-Meldung bei Vorfall.",
        scope_text: "Atemschutzzonen — Lackiererei, Lösemittel, Strahlanlage",
        ppe: "Halbmaske + Filter pro Zonen-Matrix (G26 Eignung + Dichtsitz)",
        drillCadence: "Jährlich",
        incidentLog: "BG-Unfallanzeige",
        locations: ["Atlas Werk #02", "Atlas Werk #04"], roles: ["Mitarbeitende Atemschutzzone"],
        eligible: 96, version: "v2.0",
      }),
    ],
    },

  AU: {
    cred: {
      domain: {
        heroLabel: "SafeWork NSW audit · Friday May 15",
        heroBody: "12 of 14 line workers fully cleared. 1 expired Forklift HRWL (Marcus) is auto-suspending power-equipment shifts; 1 White Card check expires in 14 d.",
        sourceName: "WorkCover NSW — HRWL register",
        sourceMeta: "Card lookups verified Apr 22 2026 · daily reconciliation",
        secondaryLabel: "National Police Check",
        auditAction: "SafeWork NSW packet",
        psvAction: "Verify HRWL / White Card",
        psvToast: "Verifying 14 workers against HRWL + White Card registries",
        packetToast: "SafeWork NSW packet generated for Plant #02",
      },
      catalogOverrides: {
        osha:     { label: "White Card",            cadence: "Permanent" },
        osha30:   { label: "Site Supervisor (CITB)", cadence: "5 yrs" },
        forklift: { label: "Forklift HRWL (LF/LO)", cadence: "5 yrs" },
      },
      stringSwaps: [
        ["OSHA Outreach Trainer Portal", "WorkCover NSW"],
        ["OSHA-10",                      "White Card"],
        ["OSHA-30",                      "Site Supervisor (CITB)"],
        ["OSHA 300",                     "SafeWork incident log"],
        ["OSHA #B-",                     "WC-AU-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-au-m-1", industry: "manufacturing", country: "AU",
        name: "White Card — General Construction",
        summary: "General Construction Induction (White Card) required for any site work in NSW/VIC/QLD.",
        credential: "White Card", issuer: "RTO via CITB", cadence: "Permanent",
        locations: ["Atlas Plant #02"], roles: ["Operator", "Maintenance"],
      }),
      _locMkCert({
        id: "loc-au-m-2", industry: "manufacturing", country: "AU",
        name: "Forklift HRWL — Class LF / LO",
        summary: "High Risk Work Licence (LF or LO) issued by SafeWork; required for forklift operation.",
        credential: "Forklift HRWL", issuer: "SafeWork NSW (and state equivalents)", cadence: "5 years",
        roles: ["Forklift operator"],
      }),
      _locMkCert({
        id: "loc-au-m-3", industry: "manufacturing", country: "AU",
        name: "Isolation procedures — LOTO",
        summary: "Site-specific lockout/tagout isolation training under WHS Regulation; annual refresh.",
        credential: "Isolation procedures", issuer: "In-house WHS officer", cadence: "Annual",
        roles: ["Operator", "Maintenance"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-au-m-a1", industry: "manufacturing", country: "AU",
        name: "Manufacturing Award + NES",
        summary: "Manufacturing and Associated Industries and Occupations Award + NES — 38h ordinary week, 10 hr rest between shifts, paid meal break after 5 hrs.",
        breakMin: "30 min paid meal after 5 hrs",
        restBreak: "10 hr rest between shifts",
        otThreshold: ">38 hrs/week (penalty rates apply)",
        callOut: "4 hours",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["All line roles"],
        eligible: 192, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-au-m-b1", industry: "manufacturing", country: "AU",
        name: "AFP National Police Check — Manufacturing",
        summary: "AFP NPC + Pre-employment medical (AS/NZS 4308 drug screen) at hire; on-cause re-test enabled.",
        pkg: "Standard (AFP NPC)", drug: "AS/NZS 4308 5-panel", vendor: "Australian Federal Police",
        refresh: "Every 3 years", lookback: "10 years",
        locations: ["All Atlas plants"], roles: ["All worker roles"], version: "v2.0",
      }),
      _locMkTraining({
        id: "loc-au-m-t1", industry: "manufacturing", country: "AU",
        name: "Plant isolation — WHS Reg. 195-197",
        summary: "WHS Regulation 195-197 — isolation procedures for plant; annual refresh per SafeWork Code of Practice.",
        course: "Plant isolation — WHS",
        duration: "90 minutes",
        delivery: "Instructor-led",
        renew: "Annual",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["Operator", "Maintenance"],
        eligible: 192, enforce: "block", version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-au-m-s1", industry: "manufacturing", country: "AU",
        name: "Respiratory protection — AS/NZS 1715/1716",
        summary: "AS/NZS 1715 selection + AS/NZS 1716 product standard; quantitative fit test annual; SafeWork notifiable on incident.",
        scope_text: "Respirator-required zones — paint, solvent, abrasive blast",
        ppe: "Half-face APR + cartridge per zone matrix (AS/NZS 1715 fit-tested)",
        drillCadence: "Annual",
        incidentLog: "SafeWork notifiable incident",
        locations: ["Atlas Plant #02", "Atlas Plant #04"], roles: ["Operator (respirator zone)"],
        eligible: 96, version: "v2.0",
      }),
    ],
    },

  JP: {
    cred: {
      domain: {
        heroLabel: "労働基準監督署 検査 · 5月15日(金)",
        heroBody: "ライン作業員14名のうち12名が完全に許可済み。1名のフォークリフト技能講習期限切れ(Marcus)により、動力機器シフトを自動停止。1名は14日以内に期限切れ。",
        sourceName: "厚生労働省 安全衛生免許",
        sourceMeta: "技能講習修了証 2026年4月22日確認 · 日次照合",
        secondaryLabel: "健康診断結果",
        auditAction: "労基署 提出パケット",
        psvAction: "技能講習を照会",
        psvToast: "照合開始 — 14名 / 厚労省・労働局",
        packetToast: "労基署提出パケットを作成しました — 工場#02",
      },
      catalogOverrides: {
        osha:     { label: "安全衛生教育",           cadence: "毎年" },
        osha30:   { label: "職長・安全衛生責任者教育", cadence: "5年" },
        forklift: { label: "フォークリフト技能講習", cadence: "永久 (年1回再教育)" },
      },
      stringSwaps: [
        ["OSHA Outreach Trainer Portal", "厚生労働省"],
        ["OSHA-10",                      "安全衛生教育"],
        ["OSHA-30",                      "職長教育"],
        ["OSHA 300",                     "労災報告"],
        ["OSHA #B-",                     "JP-SH-"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-jp-m-1", industry: "manufacturing", country: "JP",
        name: "安全衛生教育 — 雇入れ時",
        summary: "労働安全衛生法第59条に基づく雇入れ時安全衛生教育。毎年再教育を実施。",
        credential: "雇入れ時安全衛生教育", issuer: "事業者", cadence: "毎年",
        locations: ["Atlas 工場#02", "Atlas 工場#04"], roles: ["オペレーター", "組立工"],
      }),
      _locMkCert({
        id: "loc-jp-m-2", industry: "manufacturing", country: "JP",
        name: "フォークリフト運転技能講習",
        summary: "労働安全衛生規則第36条 — 1トン以上のフォークリフト運転には技能講習修了が必須。",
        credential: "フォークリフト技能講習修了証", issuer: "登録教習機関", cadence: "永久 (年次再教育)",
        roles: ["フォークリフト運転者"],
      }),
      _locMkCert({
        id: "loc-jp-m-3", industry: "manufacturing", country: "JP",
        name: "職長・安全衛生責任者教育",
        summary: "労働安全衛生法第60条 — 建設業・製造業の職長は法定教育を受講。",
        credential: "職長教育", issuer: "登録教習機関", cadence: "5年",
        roles: ["職長", "ライン長"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-jp-m-a1", industry: "manufacturing", country: "JP",
        name: "労基法 + 36協定 — 製造現場",
        summary: "労働基準法 — 1日8時間/週40時間、6時間超で45分・8時間超で60分の休憩、36協定届出範囲を超えない時間外勤務。",
        breakMin: "6時間超で45分、8時間超で60分",
        restBreak: "勤務間11時間以上推奨",
        otThreshold: "週40時間超 (36協定範囲内)",
        callOut: "4時間",
        locations: ["Atlas 工場#02", "Atlas 工場#04"], roles: ["全ライン作業員"],
        eligible: 192, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-jp-m-b1", industry: "manufacturing", country: "JP",
        name: "身元保証 + 健康診断 — 製造",
        summary: "雇用前に身元保証書、雇入時健康診断、有機溶剤健康診断 (該当者)を提出。3年ごとに更新。",
        pkg: "雇入時パッケージ", drug: "雇入時 + 有機溶剤健診", vendor: "産業医・人事",
        refresh: "3年ごと", lookback: "5年",
        locations: ["全Atlas工場"], roles: ["全作業員"], version: "v2.0",
      }),
      _locMkTraining({
        id: "loc-jp-m-t1", industry: "manufacturing", country: "JP",
        name: "機械の電源遮断・施錠 — 安衛則",
        summary: "労働安全衛生規則第107条 — 機械の掃除・修理時の運転停止と起動防止策の徹底。年次再教育。",
        course: "電源遮断・施錠 (LOTO相当)",
        duration: "90分",
        delivery: "対面講義",
        renew: "毎年",
        locations: ["全Atlas工場"], roles: ["オペレーター", "保全"],
        eligible: 192, enforce: "block", version: "v2.0",
      }),
      _locMkSafety({
        id: "loc-jp-m-s1", industry: "manufacturing", country: "JP",
        name: "呼吸用保護具 — JIS T 8150",
        summary: "JIS T 8150 — 呼吸用保護具の選択・使用・保守。フィットテストは1年ごと。労災発生時は即時労基署報告。",
        scope_text: "呼吸用保護具必須エリア — 塗装、有機溶剤、ブラスト",
        ppe: "半面マスク + カートリッジ (ゾーン別 / JIS T 8150 フィット済)",
        drillCadence: "毎年",
        incidentLog: "労災報告",
        locations: ["Atlas 工場#02", "Atlas 工場#04"], roles: ["呼吸用保護具エリア作業員"],
        eligible: 96, version: "v2.0",
      }),
    ],
    },
};

// =====================================================================
// LOGISTICS
// =====================================================================
const _LOGISTICS = {
  CA: {
    cred: {
      domain: {
        heroLabel: "Transport Canada audit · Tuesday May 12",
        heroBody: "11 of 14 drivers fully cleared. 1 expired Driver Medical is auto-suspending route assignment; 1 TDG endorsement expires in 14 d.",
        sourceName: "MTO (Ontario) — AZ Licence record",
        sourceMeta: "Last verified Apr 22 2026 · daily reconciliation against provincial registries",
        secondaryLabel: "TDG Training registry",
        auditAction: "Transport Canada packet",
        psvAction: "Run MTO record check",
        psvToast: "MTO record checks queued — 14 drivers",
        packetToast: "Transport Canada packet generated — Midland fleet",
      },
      catalogOverrides: {
        // Logistics catalog uses different codes — leave generic; stringSwaps cover most labels
      },
      stringSwaps: [
        ["FMCSA Pre-employment Screening", "MTO record check"],
        ["FMCSA",                          "MTO"],
        ["CDL Class A",                    "AZ Licence Class 1"],
        ["CDL",                            "AZ Licence"],
        ["DOT physical",                   "Driver Medical (CMV)"],
        ["HAZMAT endorsement",             "TDG endorsement"],
        ["TWIC",                           "TDG card"],
        ["FMCSA PSP",                      "MTO PSP equivalent"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-ca-l-1", industry: "logistics", country: "CA",
        name: "AZ Licence — Class 1",
        summary: "Ontario AZ (Class 1) commercial driver licence required for any tractor-trailer assignment.",
        credential: "AZ Licence Class 1", issuer: "Ontario Ministry of Transportation", cadence: "5 years",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["Driver · Class 1"],
      }),
      _locMkCert({
        id: "loc-ca-l-2", industry: "logistics", country: "CA",
        name: "Driver Medical Examination — CMV",
        summary: "Commercial Motor Vehicle Driver Medical Exam; 5-year cycle (3-year after age 46); auto-suspend on expiry.",
        credential: "CMV Medical", issuer: "MTO-approved physician", cadence: "5 years",
        roles: ["Driver · Class 1"],
      }),
      _locMkCert({
        id: "loc-ca-l-3", industry: "logistics", country: "CA",
        name: "TDG endorsement — Dangerous Goods",
        summary: "Transportation of Dangerous Goods training required for placarded shipments.",
        credential: "TDG endorsement", issuer: "Transport Canada-approved trainer", cadence: "3 years",
        roles: ["Driver · hazmat"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-ca-l-a1", industry: "logistics", country: "CA",
        name: "Federal Hours-of-Service — Commercial Drivers",
        summary: "Commercial Vehicle Drivers Hours of Service Regulations (federal) — 13 hr driving / 14 hr on-duty / 10 hr off-duty + ELD logging.",
        breakMin: "30 min after 8 hrs driving",
        restBreak: "10 hr off-duty",
        otThreshold: "70 hrs/7 days or 120 hrs/14 days",
        callOut: "4 hours",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["All driver roles"],
        eligible: 144, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-ca-l-b1", industry: "logistics", country: "CA",
        name: "CDOR + random drug & cannabis — Logistics (CA)",
        summary: "Commercial Driver Operating Record (CDOR) pull annually + random drug & alcohol per Cannabis Act + Transport Canada thresholds.",
        pkg: "DOT-equivalent (Transport Canada)", drug: "5-panel + cannabis", randomDrug: true,
        vendor: "Sterling Canada + DriverCheck",
        refresh: "Annual", lookback: "5 years",
        locations: ["All terminals"], roles: ["All driver roles"], version: "v2.0",
      }),
    ],
    },

  GB: {
    cred: {
      domain: {
        heroLabel: "DVSA OCRS audit · Tuesday May 12",
        heroBody: "11 of 14 drivers fully cleared. 1 expired DVLA D4 medical is auto-suspending route assignment; 1 ADR licence expires in 14 d.",
        sourceName: "DVSA — driver record",
        sourceMeta: "Last verified Apr 22 2026 · daily reconciliation against DVSA",
        secondaryLabel: "Driver CPC card register",
        auditAction: "DVSA OCRS packet",
        psvAction: "Run DVSA record check",
        psvToast: "DVSA record checks queued — 14 drivers",
        packetToast: "DVSA OCRS packet generated — Midland fleet",
      },
      catalogOverrides: {},
      stringSwaps: [
        ["FMCSA Pre-employment Screening", "DVSA driver record"],
        ["FMCSA",                          "DVSA"],
        ["CDL Class A",                    "HGV Cat C+E Licence"],
        ["CDL",                            "HGV Licence"],
        ["DOT physical",                   "DVLA D4 medical"],
        ["HAZMAT endorsement",             "ADR Licence"],
        ["TWIC",                           "DBS Standard"],
        ["FMCSA PSP",                      "DVSA OCRS"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-gb-l-1", industry: "logistics", country: "GB",
        name: "HGV Licence — Category C+E",
        summary: "DVSA Category C+E licence required for articulated lorry operation.",
        credential: "HGV C+E Licence", issuer: "DVSA", cadence: "5 years (medical)",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["Driver · C+E"],
      }),
      _locMkCert({
        id: "loc-gb-l-2", industry: "logistics", country: "GB",
        name: "Driver CPC — 35h periodic training",
        summary: "Driver Certificate of Professional Competence: 35 hours of periodic training every 5 years.",
        credential: "Driver CPC", issuer: "JAUPT-approved trainer", cadence: "5 years (35h)",
        roles: ["Driver · C+E"],
      }),
      _locMkCert({
        id: "loc-gb-l-3", industry: "logistics", country: "GB",
        name: "ADR Licence — Dangerous Goods",
        summary: "ADR Driver Training Certificate (Vocational) required for placarded loads.",
        credential: "ADR Licence", issuer: "DVSA-approved trainer", cadence: "5 years",
        roles: ["Driver · hazmat"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-gb-l-a1", industry: "logistics", country: "GB",
        name: "GB Drivers' Hours — Reg (EC) 561/2006",
        summary: "EU Driving Hours rules (retained in UK law): 9 hr daily driving (10 hr twice weekly), 45 min break after 4.5 hr, 11 hr daily rest, 45 hr weekly rest.",
        breakMin: "45 min after 4.5 hr driving",
        restBreak: "11 hr daily rest",
        otThreshold: "56 hrs/week and 90 hrs/2 weeks",
        callOut: "4 hours",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["All driver roles"],
        eligible: 144, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-gb-l-b1", industry: "logistics", country: "GB",
        name: "DVSA driver record + DBS Standard — Logistics (UK)",
        summary: "DVSA driver record monitoring + DBS Standard at hire; refreshed every 3 years.",
        pkg: "DVSA + DBS Standard", drug: "Pre-employment + random", randomDrug: true,
        vendor: "DBS — UK Government + DVSA",
        refresh: "Annual (DVSA) / 3 yrs (DBS)", lookback: "5 years",
        locations: ["All terminals"], roles: ["All driver roles"], version: "v2.0",
      }),
    ],
    },

  DE: {
    cred: {
      domain: {
        heroLabel: "BAG-Kontrolle · Dienstag 12. Mai",
        heroBody: "11 von 14 Fahrer:innen sind freigegeben. 1 abgelaufenes ärztliches Gutachten sperrt Tourenzuweisung; 1 ADR-Schein läuft in 14 Tagen ab.",
        sourceName: "Fahrerlaubnisbehörde",
        sourceMeta: "Letzte Prüfung 22.04.2026 · tägliche Abgleichung",
        secondaryLabel: "ADR-Schein Datenbank",
        auditAction: "BAG-Prüfpaket",
        psvAction: "Fahrerlaubnis prüfen",
        psvToast: "Prüfungen gestartet — 14 Fahrer:innen / Fahrerlaubnisbehörde",
        packetToast: "BAG-Paket erstellt — Midland Flotte",
      },
      catalogOverrides: {},
      stringSwaps: [
        ["FMCSA Pre-employment Screening", "Fahrerlaubnisbehörde"],
        ["FMCSA",                          "BAG"],
        ["CDL Class A",                    "LKW-Führerschein CE"],
        ["CDL",                            "LKW-Führerschein"],
        ["DOT physical",                   "Ärztliches Gutachten §11 FeV"],
        ["HAZMAT endorsement",             "ADR-Schein"],
        ["TWIC",                           "Polizeiliches Führungszeugnis"],
        ["FMCSA PSP",                      "BAG-Auskunft"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-de-l-1", industry: "logistics", country: "DE",
        name: "LKW-Führerschein — Klasse CE",
        summary: "Führerschein Klasse CE für Sattelzüge; medizinische Untersuchung alle 5 Jahre (ab 50 alle 1–2 Jahre).",
        credential: "Führerschein CE", issuer: "Fahrerlaubnisbehörde", cadence: "5 Jahre (Medizin)",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["LKW-Fahrer:in"],
      }),
      _locMkCert({
        id: "loc-de-l-2", industry: "logistics", country: "DE",
        name: "Berufskraftfahrer-Qualifikation (BKrFQG)",
        summary: "Beschleunigte Grundqualifikation + 35h Weiterbildung alle 5 Jahre (Schlüsselzahl 95).",
        credential: "BKrFQG / Schlüsselzahl 95", issuer: "IHK-anerkannter Träger", cadence: "5 Jahre (35h)",
        roles: ["LKW-Fahrer:in"],
      }),
      _locMkCert({
        id: "loc-de-l-3", industry: "logistics", country: "DE",
        name: "ADR-Schein — Gefahrgut",
        summary: "ADR-Bescheinigung für die Beförderung gefährlicher Güter; 5-Jahres-Zyklus.",
        credential: "ADR-Schein", issuer: "IHK / DEKRA", cadence: "5 Jahre",
        roles: ["Fahrer:in · Gefahrgut"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-de-l-a1", industry: "logistics", country: "DE",
        name: "Lenk- und Ruhezeiten — VO (EG) 561/2006",
        summary: "EU-Lenk- und Ruhezeiten: 9 Std. tägliche Lenkzeit (10 Std. zweimal wöchentlich), 45 min Pause nach 4,5 Std., 11 Std. tägliche Ruhezeit.",
        breakMin: "45 min nach 4,5 Std. Lenkzeit",
        restBreak: "11 Std. tägliche Ruhezeit",
        otThreshold: "56 Std./Woche und 90 Std./2 Wochen",
        callOut: "4 Stunden",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["LKW-Fahrer:in"],
        eligible: 144, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-de-l-b1", industry: "logistics", country: "DE",
        name: "Führungszeugnis + BAG-Auskunft — Logistik",
        summary: "Polizeiliches Führungszeugnis + BAG-Auskunft zur Berufskraftfahrer-Qualifikation; ärztliches Gutachten §11 FeV alle 5 Jahre.",
        pkg: "Standard (Führungszeugnis + BAG)", drug: "Ärztliches Gutachten §11 FeV", randomDrug: false,
        vendor: "Bundeszentralregister + BAG",
        refresh: "Alle 5 Jahre", lookback: "Vollständig",
        locations: ["Alle Terminals"], roles: ["LKW-Fahrer:in"], version: "v2.0",
      }),
    ],
    },

  AU: {
    cred: {
      domain: {
        heroLabel: "NHVR audit · Tuesday May 12",
        heroBody: "11 of 14 drivers fully cleared. 1 expired medical is auto-suspending route assignment; 1 Dangerous Goods Licence expires in 14 d.",
        sourceName: "NHVR — Heavy Vehicle Licence record",
        sourceMeta: "Last verified Apr 22 2026 · daily reconciliation",
        secondaryLabel: "Fatigue Management (BFM/AFM)",
        auditAction: "NHVR audit packet",
        psvAction: "Run NHVR record check",
        psvToast: "NHVR record checks queued — 14 drivers",
        packetToast: "NHVR packet generated — Midland fleet",
      },
      catalogOverrides: {},
      stringSwaps: [
        ["FMCSA Pre-employment Screening", "NHVR record check"],
        ["FMCSA",                          "NHVR"],
        ["CDL Class A",                    "MC Heavy Vehicle Licence"],
        ["CDL",                            "Heavy Vehicle Licence"],
        ["DOT physical",                   "NHVR Medical Assessment"],
        ["HAZMAT endorsement",             "Dangerous Goods Licence (ADG7)"],
        ["TWIC",                           "MSIC"],
        ["FMCSA PSP",                      "NHVR PSP equivalent"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-au-l-1", industry: "logistics", country: "AU",
        name: "MC Heavy Vehicle Licence",
        summary: "Multi-Combination Heavy Vehicle licence required for B-double / road train operation.",
        credential: "MC Heavy Vehicle Licence", issuer: "State licensing authority", cadence: "5 years",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["Driver · MC"],
      }),
      _locMkCert({
        id: "loc-au-l-2", industry: "logistics", country: "AU",
        name: "Basic Fatigue Management (BFM)",
        summary: "NHVR-accredited BFM/AFM training; required before any extended work-and-rest hours operation.",
        credential: "BFM Accreditation", issuer: "NHVR-approved auditor", cadence: "Annual",
        roles: ["Driver · MC"],
      }),
      _locMkCert({
        id: "loc-au-l-3", industry: "logistics", country: "AU",
        name: "Dangerous Goods Licence (ADG7)",
        summary: "ADG7 dangerous goods licence required for placarded loads.",
        credential: "Dangerous Goods Licence", issuer: "State licensing authority", cadence: "5 years",
        roles: ["Driver · hazmat"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-au-l-a1", industry: "logistics", country: "AU",
        name: "HVNL — Heavy Vehicle Driver Fatigue",
        summary: "Heavy Vehicle National Law — Standard Hours: 12 hr work / 7 hr rest in 24 hr period. BFM and AFM allow extended limits with accreditation.",
        breakMin: "Continuous 15 min after 5.25 hr",
        restBreak: "7 hr continuous rest in any 24 hr",
        otThreshold: "Standard Hours / BFM / AFM tiers",
        callOut: "4 hours",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["All driver roles"],
        eligible: 144, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-au-l-b1", industry: "logistics", country: "AU",
        name: "AFP NPC + DAMP — Logistics (AU)",
        summary: "AFP National Police Check + Drug & Alcohol Management Plan (random + post-incident); refreshed every 3 years.",
        pkg: "AFP NPC + DAMP", drug: "AS/NZS 4308 5-panel", randomDrug: true,
        vendor: "Australian Federal Police",
        refresh: "Every 3 years", lookback: "10 years",
        locations: ["All terminals"], roles: ["All driver roles"], version: "v2.0",
      }),
    ],
    },

  JP: {
    cred: {
      domain: {
        heroLabel: "国土交通省 監査 · 5月12日(火)",
        heroBody: "ドライバー14名のうち11名が完全クリア。1名の健康診断期限切れによりルート割り当てを自動停止。1名は14日以内に期限切れ。",
        sourceName: "国土交通省 大型免許照会",
        sourceMeta: "最終確認 2026年4月22日 · 日次照合",
        secondaryLabel: "運行管理者 資格",
        auditAction: "国交省 提出パケット",
        psvAction: "大型免許を照会",
        psvToast: "照合開始 — 14名 / 国交省",
        packetToast: "国交省パケットを作成しました — Midlandフリート",
      },
      catalogOverrides: {},
      stringSwaps: [
        ["FMCSA Pre-employment Screening", "国土交通省 大型免許"],
        ["FMCSA",                          "国交省"],
        ["CDL Class A",                    "大型自動車免許"],
        ["CDL",                            "大型免許"],
        ["DOT physical",                   "適性診断・健康診断"],
        ["HAZMAT endorsement",             "危険物取扱者 (乙四等)"],
        ["TWIC",                           "MSIC同等資格"],
        ["FMCSA PSP",                      "国交省 安全情報"],
      ],
    },
    certifications: [
      _locMkCert({
        id: "loc-jp-l-1", industry: "logistics", country: "JP",
        name: "大型自動車免許",
        summary: "車両総重量11トン以上 / 最大積載量6.5トン以上の車両運転に必須。",
        credential: "大型自動車免許", issuer: "公安委員会", cadence: "3〜5年 (更新)",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["大型ドライバー"],
      }),
      _locMkCert({
        id: "loc-jp-l-2", industry: "logistics", country: "JP",
        name: "運行管理者 (貨物)",
        summary: "貨物自動車運送事業法に基づき、各営業所に運行管理者の選任が義務付けられている。",
        credential: "運行管理者 (貨物)", issuer: "自動車事故対策機構 (NASVA)", cadence: "5年 (講習)",
        roles: ["運行管理者"],
      }),
      _locMkCert({
        id: "loc-jp-l-3", industry: "logistics", country: "JP",
        name: "危険物取扱者 (乙種第4類)",
        summary: "ガソリン・軽油等の引火性液体を運搬するには乙種第4類が必要。",
        credential: "危険物取扱者 乙種第4類", issuer: "総務省 消防庁", cadence: "永久 (3年講習)",
        roles: ["危険物ドライバー"],
      }),
    ],
    policies: [
      _locMkAttendance({
        id: "loc-jp-l-a1", industry: "logistics", country: "JP",
        name: "改善基準告示 — 自動車運転者の労働時間",
        summary: "厚生労働省 改善基準告示 — 1日13時間以内 (上限15時間)、連続運転4時間ごとに30分以上の休憩、勤務間インターバル11時間。",
        breakMin: "連続運転4時間ごとに30分",
        restBreak: "勤務間インターバル11時間",
        otThreshold: "1ヶ月284時間以内 (拘束時間)",
        callOut: "4時間",
        locations: ["Midland Terminal SLC", "Midland Terminal DEN"], roles: ["全ドライバー"],
        eligible: 144, version: "v2.0",
      }),
      _locMkBackground({
        id: "loc-jp-l-b1", industry: "logistics", country: "JP",
        name: "適性診断 + アルコールチェック",
        summary: "国土交通省 適性診断 (初任・適齢) + 運行管理者によるアルコールチェック (出庫前・帰庫時)。",
        pkg: "適性診断", drug: "アルコールチェック (毎日)", randomDrug: true,
        vendor: "自動車事故対策機構 (NASVA)",
        refresh: "適齢 65歳以降 3年ごと", lookback: "全期間",
        locations: ["全Midlandターミナル"], roles: ["全ドライバー"], version: "v2.0",
      }),
    ],
    },
};

// =====================================================================
// Public LOCALE_PACK
// =====================================================================
const LOCALE_PACK = {
  healthcare:    _HEALTHCARE,
  hospitality:   _HOSPITALITY,
  retail:        _RETAIL,
  manufacturing: _MANUFACTURING,
  logistics:     _LOGISTICS,
};

// Returns the locale entry for the active industry + country, or null if
// US (the baseline) or any combination not explicitly defined.
function getLocaleFor(industryId, countryCode) {
  if (!industryId || !countryCode) return null;
  if (countryCode === "US") return null;
  const ind = LOCALE_PACK[industryId];
  if (!ind) return null;
  return ind[countryCode] || null;
}

// Apply a list of [from, to] pairs to a string. Skip non-strings.
function _applyStringSwaps(v, swaps) {
  if (typeof v !== "string" || !swaps || !swaps.length) return v;
  let out = v;
  for (const [from, to] of swaps) {
    if (!from || from === to) continue;
    if (out.indexOf(from) !== -1) out = out.split(from).join(to);
  }
  return out;
}

// Deep-walk an object/array and apply string swaps. Returns a NEW
// structure so the input pack is untouched.
function _deepSwap(input, swaps) {
  if (input == null) return input;
  if (typeof input === "string") return _applyStringSwaps(input, swaps);
  if (Array.isArray(input)) return input.map((x) => _deepSwap(x, swaps));
  if (typeof input === "object") {
    const out = {};
    for (const k of Object.keys(input)) out[k] = _deepSwap(input[k], swaps);
    return out;
  }
  return input;
}

// Given the US-baseline credentialing pack (from credentialing.jsx) and
// the active country, return a localized pack. Country-specific overrides
// take precedence over deep string swaps.
function localizeCredPack(basePack, industryId, countryCode) {
  const loc = getLocaleFor(industryId, countryCode);
  if (!loc || !loc.cred) return basePack;
  const { domain: dOver, catalogOverrides = {}, stringSwaps = [] } = loc.cred;

  // 1) Deep string-swap the entire pack so license numbers and source
  //    notes pick up the localization, then layer specific overrides on
  //    top.
  const swapped = _deepSwap(basePack, stringSwaps);

  // 2) Domain — merge override fields.
  const domain = { ...swapped.domain, ...(dOver || {}) };

  // 3) Catalog — replace per-code label/cadence/required when overridden.
  const catalog = swapped.catalog.map((c) => {
    const o = catalogOverrides[c.code];
    return o ? { ...c, ...o } : c;
  });

  return { ...swapped, domain, catalog };
}

// Given the US-baseline POL_SEED list filtered to (industry, country) by
// settings-policies.jsx::polSeedFor — i.e. with US-only rows already
// excluded — return a country-localized list:
//   · Append LOCALE_PACK[industry][country].certifications (the
//     country-specific cert pack — CNO / NMC / AHPRA / IHK / 厚労省 …).
//   · Append LOCALE_PACK[industry][country].policies (country-specific
//     attendance, background, safety, training entries that fill the
//     gap left by US-only rows being filtered out).
//   · Apply string swaps (regulator names, license-number prefixes) to
//     baseline rows so any references in summaries pick up the swap too.
function localizePolicyList(baseRows, industryId, countryCode) {
  const loc = getLocaleFor(industryId, countryCode);
  if (!loc) return baseRows;

  const swaps = (loc.cred && loc.cred.stringSwaps) || [];
  const swapped = swaps.length ? baseRows.map((r) => _deepSwap(r, swaps)) : baseRows;

  const localCerts    = (loc.certifications || []).map((r) => ({ ...r }));
  const localPolicies = (loc.policies       || []).map((r) => ({ ...r }));
  return [...localCerts, ...localPolicies, ...swapped];
}

Object.assign(window, {
  LOCALE_PACK,
  getLocaleFor,
  localizeCredPack,
  localizePolicyList,
});
