// =====================================================================
// Flex Work — Country context per organization
//
//   Every org has an active *country* that drives:
//     · the flag shown beside the org name in the global nav
//     · the currency symbol used in money columns (spend, rates, fees)
//     · the regulatory framework chip shown in the org card
//     · phone format hint, week-start, default date format (advisory)
//
//   Language does NOT change with country — language lives on the user
//   profile (see pages/user-settings.jsx). This mirrors how multinational
//   Dayforce tenants work: an HR admin in Frankfurt running a French
//   subsidiary still reads the UI in German.
//
//   The picker is a searchable modal opened from the org card. Selection
//   is stored per-industry (`flexwork.country.<industry-id>`) so each
//   demo org remembers its own country.
//
//   Flag rendering uses the open-source `flag-icons` CSS (loaded in
//   index.html) — class `fi fi-<lowercase-iso2>`.
// =====================================================================

// ---------- Country reference ------------------------------------------
// The full ISO-3166-1 alpha-2 list (249 entries). Currency assignment is
// the de-facto local currency or the legal tender. `symbol` is what we
// substitute for the "$" prefix used throughout the demo data.
const COUNTRIES = [
  { code: "AF", name: "Afghanistan",                          currency: "AFN", symbol: "؋" },
  { code: "AL", name: "Albania",                              currency: "ALL", symbol: "L" },
  { code: "DZ", name: "Algeria",                              currency: "DZD", symbol: "DA" },
  { code: "AS", name: "American Samoa",                       currency: "USD", symbol: "$" },
  { code: "AD", name: "Andorra",                              currency: "EUR", symbol: "€" },
  { code: "AO", name: "Angola",                               currency: "AOA", symbol: "Kz" },
  { code: "AI", name: "Anguilla",                             currency: "XCD", symbol: "EC$" },
  { code: "AG", name: "Antigua and Barbuda",                  currency: "XCD", symbol: "EC$" },
  { code: "AR", name: "Argentina",                            currency: "ARS", symbol: "$" },
  { code: "AM", name: "Armenia",                              currency: "AMD", symbol: "֏" },
  { code: "AW", name: "Aruba",                                currency: "AWG", symbol: "ƒ" },
  { code: "AU", name: "Australia",                            currency: "AUD", symbol: "A$" },
  { code: "AT", name: "Austria",                              currency: "EUR", symbol: "€" },
  { code: "AZ", name: "Azerbaijan",                           currency: "AZN", symbol: "₼" },
  { code: "BS", name: "Bahamas",                              currency: "BSD", symbol: "B$" },
  { code: "BH", name: "Bahrain",                              currency: "BHD", symbol: "BD" },
  { code: "BD", name: "Bangladesh",                           currency: "BDT", symbol: "৳" },
  { code: "BB", name: "Barbados",                             currency: "BBD", symbol: "Bds$" },
  { code: "BY", name: "Belarus",                              currency: "BYN", symbol: "Br" },
  { code: "BE", name: "Belgium",                              currency: "EUR", symbol: "€" },
  { code: "BZ", name: "Belize",                               currency: "BZD", symbol: "BZ$" },
  { code: "BJ", name: "Benin",                                currency: "XOF", symbol: "CFA" },
  { code: "BM", name: "Bermuda",                              currency: "BMD", symbol: "BD$" },
  { code: "BT", name: "Bhutan",                               currency: "BTN", symbol: "Nu." },
  { code: "BO", name: "Bolivia",                              currency: "BOB", symbol: "Bs." },
  { code: "BA", name: "Bosnia and Herzegovina",               currency: "BAM", symbol: "KM" },
  { code: "BW", name: "Botswana",                             currency: "BWP", symbol: "P" },
  { code: "BR", name: "Brazil",                               currency: "BRL", symbol: "R$" },
  { code: "IO", name: "British Indian Ocean Territory",       currency: "USD", symbol: "$" },
  { code: "VG", name: "British Virgin Islands",               currency: "USD", symbol: "$" },
  { code: "BN", name: "Brunei",                               currency: "BND", symbol: "B$" },
  { code: "BG", name: "Bulgaria",                             currency: "BGN", symbol: "лв" },
  { code: "BF", name: "Burkina Faso",                         currency: "XOF", symbol: "CFA" },
  { code: "BI", name: "Burundi",                              currency: "BIF", symbol: "FBu" },
  { code: "CV", name: "Cabo Verde",                           currency: "CVE", symbol: "Esc" },
  { code: "KH", name: "Cambodia",                             currency: "KHR", symbol: "៛" },
  { code: "CM", name: "Cameroon",                             currency: "XAF", symbol: "FCFA" },
  { code: "CA", name: "Canada",                               currency: "CAD", symbol: "C$" },
  { code: "KY", name: "Cayman Islands",                       currency: "KYD", symbol: "CI$" },
  { code: "CF", name: "Central African Republic",             currency: "XAF", symbol: "FCFA" },
  { code: "TD", name: "Chad",                                 currency: "XAF", symbol: "FCFA" },
  { code: "CL", name: "Chile",                                currency: "CLP", symbol: "CLP$" },
  { code: "CN", name: "China",                                currency: "CNY", symbol: "¥" },
  { code: "CX", name: "Christmas Island",                     currency: "AUD", symbol: "A$" },
  { code: "CC", name: "Cocos (Keeling) Islands",              currency: "AUD", symbol: "A$" },
  { code: "CO", name: "Colombia",                             currency: "COP", symbol: "COP$" },
  { code: "KM", name: "Comoros",                              currency: "KMF", symbol: "CF" },
  { code: "CG", name: "Congo - Brazzaville",                  currency: "XAF", symbol: "FCFA" },
  { code: "CD", name: "Congo - Kinshasa",                     currency: "CDF", symbol: "FC" },
  { code: "CK", name: "Cook Islands",                         currency: "NZD", symbol: "NZ$" },
  { code: "CR", name: "Costa Rica",                           currency: "CRC", symbol: "₡" },
  { code: "CI", name: "Côte d’Ivoire",                        currency: "XOF", symbol: "CFA" },
  { code: "HR", name: "Croatia",                              currency: "EUR", symbol: "€" },
  { code: "CU", name: "Cuba",                                 currency: "CUP", symbol: "$MN" },
  { code: "CW", name: "Curaçao",                              currency: "ANG", symbol: "ƒ" },
  { code: "CY", name: "Cyprus",                               currency: "EUR", symbol: "€" },
  { code: "CZ", name: "Czechia",                              currency: "CZK", symbol: "Kč" },
  { code: "DK", name: "Denmark",                              currency: "DKK", symbol: "kr" },
  { code: "DJ", name: "Djibouti",                             currency: "DJF", symbol: "Fdj" },
  { code: "DM", name: "Dominica",                             currency: "XCD", symbol: "EC$" },
  { code: "DO", name: "Dominican Republic",                   currency: "DOP", symbol: "RD$" },
  { code: "EC", name: "Ecuador",                              currency: "USD", symbol: "$" },
  { code: "EG", name: "Egypt",                                currency: "EGP", symbol: "E£" },
  { code: "SV", name: "El Salvador",                          currency: "USD", symbol: "$" },
  { code: "GQ", name: "Equatorial Guinea",                    currency: "XAF", symbol: "FCFA" },
  { code: "ER", name: "Eritrea",                              currency: "ERN", symbol: "Nfk" },
  { code: "EE", name: "Estonia",                              currency: "EUR", symbol: "€" },
  { code: "SZ", name: "Eswatini",                             currency: "SZL", symbol: "E" },
  { code: "ET", name: "Ethiopia",                             currency: "ETB", symbol: "Br" },
  { code: "FK", name: "Falkland Islands",                     currency: "FKP", symbol: "£" },
  { code: "FO", name: "Faroe Islands",                        currency: "DKK", symbol: "kr" },
  { code: "FJ", name: "Fiji",                                 currency: "FJD", symbol: "FJ$" },
  { code: "FI", name: "Finland",                              currency: "EUR", symbol: "€" },
  { code: "FR", name: "France",                               currency: "EUR", symbol: "€" },
  { code: "GF", name: "French Guiana",                        currency: "EUR", symbol: "€" },
  { code: "PF", name: "French Polynesia",                     currency: "XPF", symbol: "₣" },
  { code: "GA", name: "Gabon",                                currency: "XAF", symbol: "FCFA" },
  { code: "GM", name: "Gambia",                               currency: "GMD", symbol: "D" },
  { code: "GE", name: "Georgia",                              currency: "GEL", symbol: "₾" },
  { code: "DE", name: "Germany",                              currency: "EUR", symbol: "€" },
  { code: "GH", name: "Ghana",                                currency: "GHS", symbol: "GH₵" },
  { code: "GI", name: "Gibraltar",                            currency: "GIP", symbol: "£" },
  { code: "GR", name: "Greece",                               currency: "EUR", symbol: "€" },
  { code: "GL", name: "Greenland",                            currency: "DKK", symbol: "kr" },
  { code: "GD", name: "Grenada",                              currency: "XCD", symbol: "EC$" },
  { code: "GP", name: "Guadeloupe",                           currency: "EUR", symbol: "€" },
  { code: "GU", name: "Guam",                                 currency: "USD", symbol: "$" },
  { code: "GT", name: "Guatemala",                            currency: "GTQ", symbol: "Q" },
  { code: "GG", name: "Guernsey",                             currency: "GBP", symbol: "£" },
  { code: "GN", name: "Guinea",                               currency: "GNF", symbol: "FG" },
  { code: "GW", name: "Guinea-Bissau",                        currency: "XOF", symbol: "CFA" },
  { code: "GY", name: "Guyana",                               currency: "GYD", symbol: "GY$" },
  { code: "HT", name: "Haiti",                                currency: "HTG", symbol: "G" },
  { code: "HN", name: "Honduras",                             currency: "HNL", symbol: "L" },
  { code: "HK", name: "Hong Kong SAR",                        currency: "HKD", symbol: "HK$" },
  { code: "HU", name: "Hungary",                              currency: "HUF", symbol: "Ft" },
  { code: "IS", name: "Iceland",                              currency: "ISK", symbol: "kr" },
  { code: "IN", name: "India",                                currency: "INR", symbol: "₹" },
  { code: "ID", name: "Indonesia",                            currency: "IDR", symbol: "Rp" },
  { code: "IR", name: "Iran",                                 currency: "IRR", symbol: "﷼" },
  { code: "IQ", name: "Iraq",                                 currency: "IQD", symbol: "ع.د" },
  { code: "IE", name: "Ireland",                              currency: "EUR", symbol: "€" },
  { code: "IM", name: "Isle of Man",                          currency: "GBP", symbol: "£" },
  { code: "IL", name: "Israel",                               currency: "ILS", symbol: "₪" },
  { code: "IT", name: "Italy",                                currency: "EUR", symbol: "€" },
  { code: "JM", name: "Jamaica",                              currency: "JMD", symbol: "J$" },
  { code: "JP", name: "Japan",                                currency: "JPY", symbol: "¥" },
  { code: "JE", name: "Jersey",                               currency: "GBP", symbol: "£" },
  { code: "JO", name: "Jordan",                               currency: "JOD", symbol: "JD" },
  { code: "KZ", name: "Kazakhstan",                           currency: "KZT", symbol: "₸" },
  { code: "KE", name: "Kenya",                                currency: "KES", symbol: "KSh" },
  { code: "KI", name: "Kiribati",                             currency: "AUD", symbol: "A$" },
  { code: "XK", name: "Kosovo",                               currency: "EUR", symbol: "€" },
  { code: "KW", name: "Kuwait",                               currency: "KWD", symbol: "KD" },
  { code: "KG", name: "Kyrgyzstan",                           currency: "KGS", symbol: "с" },
  { code: "LA", name: "Laos",                                 currency: "LAK", symbol: "₭" },
  { code: "LV", name: "Latvia",                               currency: "EUR", symbol: "€" },
  { code: "LB", name: "Lebanon",                              currency: "LBP", symbol: "ل.ل" },
  { code: "LS", name: "Lesotho",                              currency: "LSL", symbol: "M" },
  { code: "LR", name: "Liberia",                              currency: "LRD", symbol: "L$" },
  { code: "LY", name: "Libya",                                currency: "LYD", symbol: "LD" },
  { code: "LI", name: "Liechtenstein",                        currency: "CHF", symbol: "CHF" },
  { code: "LT", name: "Lithuania",                            currency: "EUR", symbol: "€" },
  { code: "LU", name: "Luxembourg",                           currency: "EUR", symbol: "€" },
  { code: "MO", name: "Macao SAR",                            currency: "MOP", symbol: "MOP$" },
  { code: "MG", name: "Madagascar",                           currency: "MGA", symbol: "Ar" },
  { code: "MW", name: "Malawi",                               currency: "MWK", symbol: "MK" },
  { code: "MY", name: "Malaysia",                             currency: "MYR", symbol: "RM" },
  { code: "MV", name: "Maldives",                             currency: "MVR", symbol: "Rf" },
  { code: "ML", name: "Mali",                                 currency: "XOF", symbol: "CFA" },
  { code: "MT", name: "Malta",                                currency: "EUR", symbol: "€" },
  { code: "MH", name: "Marshall Islands",                     currency: "USD", symbol: "$" },
  { code: "MQ", name: "Martinique",                           currency: "EUR", symbol: "€" },
  { code: "MR", name: "Mauritania",                           currency: "MRU", symbol: "UM" },
  { code: "MU", name: "Mauritius",                            currency: "MUR", symbol: "Rs" },
  { code: "YT", name: "Mayotte",                              currency: "EUR", symbol: "€" },
  { code: "MX", name: "Mexico",                               currency: "MXN", symbol: "MX$" },
  { code: "FM", name: "Micronesia",                           currency: "USD", symbol: "$" },
  { code: "MD", name: "Moldova",                              currency: "MDL", symbol: "L" },
  { code: "MC", name: "Monaco",                               currency: "EUR", symbol: "€" },
  { code: "MN", name: "Mongolia",                             currency: "MNT", symbol: "₮" },
  { code: "ME", name: "Montenegro",                           currency: "EUR", symbol: "€" },
  { code: "MS", name: "Montserrat",                           currency: "XCD", symbol: "EC$" },
  { code: "MA", name: "Morocco",                              currency: "MAD", symbol: "DH" },
  { code: "MZ", name: "Mozambique",                           currency: "MZN", symbol: "MT" },
  { code: "MM", name: "Myanmar",                              currency: "MMK", symbol: "K" },
  { code: "NA", name: "Namibia",                              currency: "NAD", symbol: "N$" },
  { code: "NR", name: "Nauru",                                currency: "AUD", symbol: "A$" },
  { code: "NP", name: "Nepal",                                currency: "NPR", symbol: "Rs" },
  { code: "NL", name: "Netherlands",                          currency: "EUR", symbol: "€" },
  { code: "NC", name: "New Caledonia",                        currency: "XPF", symbol: "₣" },
  { code: "NZ", name: "New Zealand",                          currency: "NZD", symbol: "NZ$" },
  { code: "NI", name: "Nicaragua",                            currency: "NIO", symbol: "C$" },
  { code: "NE", name: "Niger",                                currency: "XOF", symbol: "CFA" },
  { code: "NG", name: "Nigeria",                              currency: "NGN", symbol: "₦" },
  { code: "NU", name: "Niue",                                 currency: "NZD", symbol: "NZ$" },
  { code: "NF", name: "Norfolk Island",                       currency: "AUD", symbol: "A$" },
  { code: "KP", name: "North Korea",                          currency: "KPW", symbol: "₩" },
  { code: "MK", name: "North Macedonia",                      currency: "MKD", symbol: "ден" },
  { code: "MP", name: "Northern Mariana Islands",             currency: "USD", symbol: "$" },
  { code: "NO", name: "Norway",                               currency: "NOK", symbol: "kr" },
  { code: "OM", name: "Oman",                                 currency: "OMR", symbol: "OMR" },
  { code: "PK", name: "Pakistan",                             currency: "PKR", symbol: "Rs" },
  { code: "PW", name: "Palau",                                currency: "USD", symbol: "$" },
  { code: "PS", name: "Palestinian Territories",              currency: "ILS", symbol: "₪" },
  { code: "PA", name: "Panama",                               currency: "PAB", symbol: "B/." },
  { code: "PG", name: "Papua New Guinea",                     currency: "PGK", symbol: "K" },
  { code: "PY", name: "Paraguay",                             currency: "PYG", symbol: "₲" },
  { code: "PE", name: "Peru",                                 currency: "PEN", symbol: "S/" },
  { code: "PH", name: "Philippines",                          currency: "PHP", symbol: "₱" },
  { code: "PN", name: "Pitcairn Islands",                     currency: "NZD", symbol: "NZ$" },
  { code: "PL", name: "Poland",                               currency: "PLN", symbol: "zł" },
  { code: "PT", name: "Portugal",                             currency: "EUR", symbol: "€" },
  { code: "PR", name: "Puerto Rico",                          currency: "USD", symbol: "$" },
  { code: "QA", name: "Qatar",                                currency: "QAR", symbol: "QR" },
  { code: "RE", name: "Réunion",                              currency: "EUR", symbol: "€" },
  { code: "RO", name: "Romania",                              currency: "RON", symbol: "lei" },
  { code: "RU", name: "Russia",                               currency: "RUB", symbol: "₽" },
  { code: "RW", name: "Rwanda",                               currency: "RWF", symbol: "FRw" },
  { code: "WS", name: "Samoa",                                currency: "WST", symbol: "WS$" },
  { code: "SM", name: "San Marino",                           currency: "EUR", symbol: "€" },
  { code: "ST", name: "São Tomé and Príncipe",                currency: "STN", symbol: "Db" },
  { code: "SA", name: "Saudi Arabia",                         currency: "SAR", symbol: "SR" },
  { code: "SN", name: "Senegal",                              currency: "XOF", symbol: "CFA" },
  { code: "RS", name: "Serbia",                               currency: "RSD", symbol: "дин" },
  { code: "SC", name: "Seychelles",                           currency: "SCR", symbol: "SR" },
  { code: "SL", name: "Sierra Leone",                         currency: "SLE", symbol: "Le" },
  { code: "SG", name: "Singapore",                            currency: "SGD", symbol: "S$" },
  { code: "SX", name: "Sint Maarten",                         currency: "ANG", symbol: "ƒ" },
  { code: "SK", name: "Slovakia",                             currency: "EUR", symbol: "€" },
  { code: "SI", name: "Slovenia",                             currency: "EUR", symbol: "€" },
  { code: "SB", name: "Solomon Islands",                      currency: "SBD", symbol: "SI$" },
  { code: "SO", name: "Somalia",                              currency: "SOS", symbol: "Sh" },
  { code: "ZA", name: "South Africa",                         currency: "ZAR", symbol: "R" },
  { code: "KR", name: "South Korea",                          currency: "KRW", symbol: "₩" },
  { code: "SS", name: "South Sudan",                          currency: "SSP", symbol: "SS£" },
  { code: "ES", name: "Spain",                                currency: "EUR", symbol: "€" },
  { code: "LK", name: "Sri Lanka",                            currency: "LKR", symbol: "Rs" },
  { code: "BL", name: "St. Barthélemy",                       currency: "EUR", symbol: "€" },
  { code: "SH", name: "St. Helena",                           currency: "SHP", symbol: "£" },
  { code: "KN", name: "St. Kitts and Nevis",                  currency: "XCD", symbol: "EC$" },
  { code: "LC", name: "St. Lucia",                            currency: "XCD", symbol: "EC$" },
  { code: "MF", name: "St. Martin",                           currency: "EUR", symbol: "€" },
  { code: "PM", name: "St. Pierre and Miquelon",              currency: "EUR", symbol: "€" },
  { code: "VC", name: "St. Vincent and the Grenadines",       currency: "XCD", symbol: "EC$" },
  { code: "SD", name: "Sudan",                                currency: "SDG", symbol: "SDG" },
  { code: "SR", name: "Suriname",                             currency: "SRD", symbol: "Sr$" },
  { code: "SE", name: "Sweden",                               currency: "SEK", symbol: "kr" },
  { code: "CH", name: "Switzerland",                          currency: "CHF", symbol: "CHF" },
  { code: "SY", name: "Syria",                                currency: "SYP", symbol: "£S" },
  { code: "TW", name: "Taiwan",                               currency: "TWD", symbol: "NT$" },
  { code: "TJ", name: "Tajikistan",                           currency: "TJS", symbol: "SM" },
  { code: "TZ", name: "Tanzania",                             currency: "TZS", symbol: "TSh" },
  { code: "TH", name: "Thailand",                             currency: "THB", symbol: "฿" },
  { code: "TL", name: "Timor-Leste",                          currency: "USD", symbol: "$" },
  { code: "TG", name: "Togo",                                 currency: "XOF", symbol: "CFA" },
  { code: "TK", name: "Tokelau",                              currency: "NZD", symbol: "NZ$" },
  { code: "TO", name: "Tonga",                                currency: "TOP", symbol: "T$" },
  { code: "TT", name: "Trinidad and Tobago",                  currency: "TTD", symbol: "TT$" },
  { code: "TN", name: "Tunisia",                              currency: "TND", symbol: "DT" },
  { code: "TR", name: "Türkiye",                              currency: "TRY", symbol: "₺" },
  { code: "TM", name: "Turkmenistan",                         currency: "TMT", symbol: "m" },
  { code: "TC", name: "Turks and Caicos Islands",             currency: "USD", symbol: "$" },
  { code: "TV", name: "Tuvalu",                               currency: "AUD", symbol: "A$" },
  { code: "UG", name: "Uganda",                               currency: "UGX", symbol: "USh" },
  { code: "UA", name: "Ukraine",                              currency: "UAH", symbol: "₴" },
  { code: "AE", name: "United Arab Emirates",                 currency: "AED", symbol: "AED" },
  { code: "GB", name: "United Kingdom",                       currency: "GBP", symbol: "£" },
  { code: "US", name: "United States",                        currency: "USD", symbol: "$" },
  { code: "UY", name: "Uruguay",                              currency: "UYU", symbol: "$U" },
  { code: "UZ", name: "Uzbekistan",                           currency: "UZS", symbol: "сўм" },
  { code: "VU", name: "Vanuatu",                              currency: "VUV", symbol: "VT" },
  { code: "VA", name: "Vatican City",                         currency: "EUR", symbol: "€" },
  { code: "VE", name: "Venezuela",                            currency: "VES", symbol: "Bs.S" },
  { code: "VN", name: "Vietnam",                              currency: "VND", symbol: "₫" },
  { code: "VI", name: "U.S. Virgin Islands",                  currency: "USD", symbol: "$" },
  { code: "WF", name: "Wallis and Futuna",                    currency: "XPF", symbol: "₣" },
  { code: "EH", name: "Western Sahara",                       currency: "MAD", symbol: "DH" },
  { code: "YE", name: "Yemen",                                currency: "YER", symbol: "﷼" },
  { code: "ZM", name: "Zambia",                               currency: "ZMW", symbol: "ZK" },
  { code: "ZW", name: "Zimbabwe",                             currency: "ZWG", symbol: "ZWG" },
];

const COUNTRY_BY_CODE = COUNTRIES.reduce((acc, c) => { acc[c.code] = c; return acc; }, {});

// ---------- Country picker allow-list ----------------------------------
// The popover and the cascading submenu surface ONLY these codes. The
// underlying COUNTRIES array still ships the full ISO-3166-1 list so the
// data model is complete, but the UI is intentionally scoped to the six
// markets we have country-specific policies, certifications, and
// regulatory framework chips for. See pages/locales.jsx for the
// per-(industry, country) overrides each of these resolves to.
const PICKER_COUNTRIES = ["US", "CA", "GB", "DE", "AU", "JP"];
const PICKER_COUNTRY_SET = new Set(PICKER_COUNTRIES);
const PICKER_COUNTRY_LIST = PICKER_COUNTRIES
  .map((c) => COUNTRY_BY_CODE[c])
  .filter(Boolean);

// ---------- Regulations (the marquee frameworks for high-traffic codes) -
// Anything not listed here falls back to a generic "Local labour &
// employment law" chip — accurate for a demo, vague enough not to lie.
const REGULATIONS = {
  US: ["FLSA", "I-9", "ACA", "OSHA", "EEOC"],
  CA: ["CLC", "ESA", "WSIB", "PIPEDA"],
  MX: ["LFT", "IMSS", "INFONAVIT"],
  GB: ["Working Time Regs", "AWR", "Right to Work", "IR35"],
  IE: ["OWTA", "Employment Permits Act", "GDPR"],
  DE: ["AÜG", "Arbeitszeitgesetz", "GDPR", "Mindestlohn"],
  FR: ["Code du Travail", "35h week", "GDPR"],
  ES: ["Estatuto de los Trabajadores", "ERTE", "GDPR"],
  IT: ["Jobs Act", "Naspi", "GDPR"],
  NL: ["WAB", "WAADI", "GDPR"],
  BE: ["Loi 24/07/87", "GDPR", "Dimona"],
  PT: ["Código do Trabalho", "GDPR"],
  PL: ["Kodeks pracy", "GDPR"],
  SE: ["LAS", "MBL", "GDPR"],
  NO: ["Arbeidsmiljøloven", "A-melding"],
  DK: ["Funktionærloven", "GDPR"],
  FI: ["Työsopimuslaki", "GDPR"],
  CH: ["OR Art. 319+", "ArG"],
  AT: ["AÜG", "GDPR"],
  AU: ["Fair Work Act", "Modern Awards", "Single Touch Payroll"],
  NZ: ["Employment Relations Act", "Holidays Act"],
  JP: ["Labour Standards Act", "Worker Dispatch Act"],
  KR: ["Labour Standards Act", "ERISA"],
  CN: ["Labour Contract Law", "Social Insurance Law"],
  IN: ["Shops & Establishments Act", "EPF", "ESI", "Code on Wages"],
  SG: ["Employment Act", "MOM EFMA", "PDPA"],
  HK: ["EO Cap. 57", "MPF"],
  PH: ["Labor Code", "SSS", "PhilHealth"],
  ID: ["UU Cipta Kerja", "BPJS"],
  TH: ["Labour Protection Act"],
  VN: ["Labour Code 2019"],
  MY: ["Employment Act 1955", "EPF"],
  BR: ["CLT", "eSocial", "FGTS"],
  AR: ["LCT", "ART"],
  CL: ["Código del Trabajo", "AFC"],
  CO: ["Código Sustantivo del Trabajo"],
  AE: ["UAE Labour Law", "WPS", "Emiratisation"],
  SA: ["Saudi Labor Law", "Nitaqat", "GOSI"],
  QA: ["Labor Law No. 14/2004", "WPS"],
  IL: ["Hours of Work and Rest Law"],
  TR: ["İş Kanunu 4857"],
  EG: ["Labour Law 12/2003"],
  ZA: ["BCEA", "LRA", "POPIA"],
  KE: ["Employment Act 2007"],
  NG: ["Labour Act"],
};

function getRegulations(code) {
  return REGULATIONS[code] || ["Local labour & employment law"];
}

// ---------- Industry → default country ---------------------------------
// Picked to give the demo international flavor without being arbitrary.
const INDUSTRY_DEFAULT_COUNTRY = {
  manufacturing: "US",
  hospitality:   "US",
  retail:        "GB",
  healthcare:    "CA",
  logistics:     "DE",
};

// ---------- Persistence ------------------------------------------------
function _countryStorageKey(industryId) {
  return "flexwork.country." + (industryId || "default");
}
function getCountryForIndustry(industryId) {
  try {
    const stored = window.localStorage.getItem(_countryStorageKey(industryId));
    if (stored && COUNTRY_BY_CODE[stored]) return COUNTRY_BY_CODE[stored];
  } catch (e) { /* no-op */ }
  return COUNTRY_BY_CODE[INDUSTRY_DEFAULT_COUNTRY[industryId] || "US"] || COUNTRY_BY_CODE.US;
}
function setCountryForIndustry(industryId, code) {
  try { window.localStorage.setItem(_countryStorageKey(industryId), code); } catch (e) {}
}
function getCurrentCountry() {
  const ind = (window.getIndustry && window.getIndustry()) || null;
  return getCountryForIndustry(ind ? ind.id : null);
}

// ---------- Currency replacement ---------------------------------------
// Source data is pre-formatted as USD (e.g. "$128,450"). When the active
// country uses a different currency, swap the leading "$" with the local
// symbol. We DO NOT convert the underlying value — the demo treats the
// number as a notional spend; FX is out of scope.
function applyCurrency(value) {
  if (typeof value !== "string") return value;
  if (value.indexOf("$") === -1) return value;
  const sym = getCurrentCountry().symbol;
  if (sym === "$") return value;
  // Replace every "$" — incl. embedded ("+$0.95/hr") — but skip $$ in case.
  return value.split("$").join(sym);
}

// Track the symbol currently baked into module-level data arrays so a
// later switch can swap precisely (e.g. £ → € rather than $ → €).
window.__activeCurrencySymbol = getCurrentCountry().symbol;

// Live symbol — always reads the most recent value. Use this anywhere
// you'd otherwise hardcode "$".
function curSymbol() {
  return window.__activeCurrencySymbol || getCurrentCountry().symbol || "$";
}

// Centralised money formatter. Reads the live symbol at call time so
// every render after a country switch picks up the new currency.
//   fmtCurrency(48320)                       → "$48,320"   (or £48,320, etc.)
//   fmtCurrency(0.95, { cents: true })       → "$0.95"
//   fmtCurrency(72500, { compact: true })    → "$72.5k"
//   fmtCurrency(-1200)                       → "-$1,200"
function fmtCurrency(n, opts = {}) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sym  = curSymbol();
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n);
  if (opts.compact && abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${sym}${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  const min = opts.cents ? 2 : 0;
  return `${sign}${sym}${abs.toLocaleString(undefined, {
    minimumFractionDigits: min,
    maximumFractionDigits: opts.cents ? 2 : (opts.maxFractionDigits != null ? opts.maxFractionDigits : 0),
  })}`;
}

// Instant country switch — rewrites currency symbols on every registered
// data array in place, persists the new selection, and asks the App
// component to bump its context epoch so React re-renders the tree.
// No page reload. Language is untouched.
function applyCountryInstant(code) {
  const next = COUNTRY_BY_CODE[code];
  if (!next) return false;
  const ind = (window.getIndustry && window.getIndustry()) || null;
  if (!ind) return false;

  const oldSym = window.__activeCurrencySymbol || "$";
  const newSym = next.symbol;

  // Persist FIRST so any code that reads getCurrentCountry() during the
  // re-render sees the new selection.
  setCountryForIndustry(ind.id, code);

  if (oldSym !== newSym) {
    // Deep-walk every registered currency array so nested strings
    // (history[].what, rules.vendor, etc) get the same swap as top-
    // level fields.
    const swap = (v) => (typeof v === "string" && v.indexOf(oldSym) !== -1)
      ? v.split(oldSym).join(newSym) : v;
    if (typeof window.walkRegisteredCurrencyData === "function") {
      window.walkRegisteredCurrencyData(swap);
    } else {
      // Fallback (shouldn't happen — industry.jsx loads first).
      const arrays = window._currencyArrays || [];
      for (const arr of arrays) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (!item || typeof item !== "object") continue;
          for (const k of Object.keys(item)) {
            const v = item[k];
            if (typeof v === "string" && v.indexOf(oldSym) !== -1) {
              item[k] = v.split(oldSym).join(newSym);
            }
          }
        }
      }
    }
    window.__activeCurrencySymbol = newSym;
  }

  // Expose the active symbol as a CSS custom property so stylesheets
  // (e.g. money-field affordances) can render it without inlining "$".
  _syncCurrencyCssVar();

  if (typeof window.__bumpFlexContext === "function") {
    window.__bumpFlexContext();
  }
  return true;
}

// Push the active currency symbol onto :root as a CSS variable for use
// in stylesheets — e.g. `.bud-money-input::before { content: var(--evr-currency-symbol); }`.
function _syncCurrencyCssVar() {
  if (typeof document === "undefined") return;
  const sym = window.__activeCurrencySymbol || (getCurrentCountry().symbol || "$");
  try {
    document.documentElement.style.setProperty("--evr-currency-symbol", JSON.stringify(sym));
  } catch (e) { /* no-op */ }
}
// Initial sync on module load so CSS picks up the persisted country.
_syncCurrencyCssVar();

// ---------- Country picker (popover) -----------------------------------
// Anchored dropdown — opens beneath the org-card country chip, sized like
// a typical menu. Click a country to apply immediately; no separate Apply
// button needed. Closes on outside-click or Esc.
function CountryPicker({ open, anchorRef, currentCode, onClose, onSelect }) {
  const [query, setQuery] = React.useState("");
  const [pos, setPos]     = React.useState(null);
  const popRef            = React.useRef(null);
  const inputRef          = React.useRef(null);

  // Position the popover under the anchor; recompute on resize/scroll.
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    const reposition = () => {
      const el = anchorRef && anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const POP_W = Math.max(r.width, 320);
      const GAP   = 6;
      const MARGIN = 12;
      const MIN_H  = 260; // floor before we flip upward
      const MAX_H  = 420; // ceiling regardless of available space
      // Prefer to align left edge with the anchor, but keep on-screen.
      let left = r.left;
      if (left + POP_W > window.innerWidth - MARGIN) {
        left = Math.max(MARGIN, window.innerWidth - MARGIN - POP_W);
      }
      // Compute available space below vs above; pick whichever side fits,
      // and cap the popover height to what's actually available there.
      const spaceBelow = window.innerHeight - r.bottom - GAP - MARGIN;
      const spaceAbove = r.top - GAP - MARGIN;
      let top, height;
      if (spaceBelow >= MIN_H || spaceBelow >= spaceAbove) {
        top    = r.bottom + GAP;
        height = Math.max(160, Math.min(MAX_H, spaceBelow));
      } else {
        height = Math.max(160, Math.min(MAX_H, spaceAbove));
        top    = r.top - GAP - height;
      }
      setPos({ top, left, width: POP_W, height });
    };
    reposition();
    const id = setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 30);
    const onKey  = (e) => { if (e.key === "Escape") onClose(); };
    const onDown = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (anchorRef && anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !pos) return null;

  const q = query.trim().toLowerCase();
  // Source list is the picker allow-list, not the full COUNTRIES array.
  // Currency, policies, and certifications are localized only for these
  // six markets — see pages/locales.jsx.
  const source = PICKER_COUNTRY_LIST;
  const filtered = !q ? source : source.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    c.code.toLowerCase().includes(q) ||
    c.currency.toLowerCase().includes(q)
  );

  // Portal to <body> so the popover escapes the GlobalNav's transform-induced
  // containing block (a transformed ancestor breaks position:fixed coords).
  const node = (
    <div
      ref={popRef}
      className="cp-pop"
      role="dialog"
      aria-label="Change country"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, height: pos.height }}
    >
      <div className="cp-pop-head">
        <div className="cp-pop-title">Country for this organization</div>
        <button type="button" className="iconbtn cp-pop-close" onClick={onClose} aria-label="Close">
          <Icon name="Cancel" size={16} />
        </button>
      </div>

      <div className="cp-pop-search">
        <span className="cp-pop-search-icon" aria-hidden="true">
          <Icon name="Search" size={16} />
        </span>
        <input
          ref={inputRef}
          type="search"
          className="cp-pop-search-input"
          placeholder="Filter countries or currencies"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search countries"
        />
      </div>

      <ul className="cp-pop-list" role="listbox" aria-label="Countries">
        {filtered.length === 0 ? (
          <li className="cp-pop-empty">No matches</li>
        ) : (
          filtered.map((c) => {
            const isCurrent = c.code === currentCode;
            return (
              <li
                key={c.code}
                role="option"
                aria-selected={isCurrent}
                className={`cp-pop-row${isCurrent ? " cp-pop-row--current" : ""}`}
                onClick={() => onSelect && onSelect(c.code)}
              >
                <span className={`fi fi-${c.code.toLowerCase()} cp-pop-flag`} aria-hidden="true" />
                <span className="cp-pop-name">{c.name}</span>
                <span className="cp-pop-curr">{c.currency}</span>
                {isCurrent && (
                  <span className="cp-pop-check" aria-hidden="true">
                    <Icon name="Check" size={14} />
                  </span>
                )}
              </li>
            );
          })
        )}
      </ul>

      <div className="cp-pop-foot">
        <Icon name="Information" size={14} />
        <span>Language stays in your account settings.</span>
      </div>
    </div>
  );

  return (typeof ReactDOM !== "undefined" && ReactDOM.createPortal)
    ? ReactDOM.createPortal(node, document.body)
    : node;
}

Object.assign(window, {
  COUNTRIES, COUNTRY_BY_CODE, REGULATIONS,
  PICKER_COUNTRIES, PICKER_COUNTRY_LIST,
  INDUSTRY_DEFAULT_COUNTRY,
  getCountryForIndustry, setCountryForIndustry, getCurrentCountry,
  getRegulations, applyCurrency, applyCountryInstant,
  curSymbol, fmtCurrency,
  CountryPicker,
});
