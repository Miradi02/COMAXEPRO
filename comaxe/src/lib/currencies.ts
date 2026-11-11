// ============================================
// COMAXE — Catalogue des devises internationales
// Devises d'Afrique, d'Europe, d'Asie, d'Amérique et d'Océanie.
// Chaque devise est identifiée par son code ISO 4217 (ex: 'CDF').
// ============================================

export type Continent = 'Afrique' | 'Europe' | 'Asie' | 'Amérique' | 'Océanie';

export interface Currency {
  /** Code ISO 4217 — valeur stockée en base (ex: 'CDF') */
  code: string;
  /** Nom affiché en français */
  name: string;
  /** Symbole d'affichage (ex: '$', 'FCFA', '€') */
  symbol: string;
  continent: Continent;
}

export const CONTINENTS: Continent[] = ['Afrique', 'Europe', 'Asie', 'Amérique', 'Océanie'];

export const CURRENCIES: Currency[] = [
  // ───────────── AFRIQUE ─────────────
  { code: 'CDF', name: 'Franc congolais', symbol: 'FC', continent: 'Afrique' },
  { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'FCFA', continent: 'Afrique' },
  { code: 'XAF', name: 'Franc CFA (BEAC)', symbol: 'FCFA', continent: 'Afrique' },
  { code: 'NGN', name: 'Naira nigérian', symbol: '₦', continent: 'Afrique' },
  { code: 'GHS', name: 'Cedi ghanéen', symbol: '₵', continent: 'Afrique' },
  { code: 'KES', name: 'Shilling kenyan', symbol: 'KSh', continent: 'Afrique' },
  { code: 'UGX', name: 'Shilling ougandais', symbol: 'USh', continent: 'Afrique' },
  { code: 'TZS', name: 'Shilling tanzanien', symbol: 'TSh', continent: 'Afrique' },
  { code: 'RWF', name: 'Franc rwandais', symbol: 'FRw', continent: 'Afrique' },
  { code: 'ETB', name: 'Birr éthiopien', symbol: 'Br', continent: 'Afrique' },
  { code: 'ZAR', name: 'Rand sud-africain', symbol: 'R', continent: 'Afrique' },
  { code: 'EGP', name: 'Livre égyptienne', symbol: 'E£', continent: 'Afrique' },
  { code: 'MAD', name: 'Dirham marocain', symbol: 'DH', continent: 'Afrique' },
  { code: 'DZD', name: 'Dinar algérien', symbol: 'DA', continent: 'Afrique' },
  { code: 'TND', name: 'Dinar tunisien', symbol: 'DT', continent: 'Afrique' },
  { code: 'LYD', name: 'Dinar libyen', symbol: 'LD', continent: 'Afrique' },
  { code: 'AOA', name: 'Kwanza angolais', symbol: 'Kz', continent: 'Afrique' },
  { code: 'MZN', name: 'Métical mozambicain', symbol: 'MT', continent: 'Afrique' },
  { code: 'ZMW', name: 'Kwacha zambien', symbol: 'ZK', continent: 'Afrique' },
  { code: 'ZWL', name: 'Dollar zimbabwéen', symbol: 'Zi$', continent: 'Afrique' },
  { code: 'BIF', name: 'Franc burundais', symbol: 'FBu', continent: 'Afrique' },
  { code: 'MUR', name: 'Roupie mauricienne', symbol: 'Rs', continent: 'Afrique' },
  { code: 'GNF', name: 'Franc guinéen', symbol: 'FG', continent: 'Afrique' },
  { code: 'SLE', name: 'Leone sierra-leonais', symbol: 'Le', continent: 'Afrique' },
  { code: 'SDG', name: 'Livre soudanaise', symbol: 'SDG', continent: 'Afrique' },
  { code: 'SSP', name: 'Livre sud-soudanaise', symbol: '£', continent: 'Afrique' },
  { code: 'SOS', name: 'Shilling somalien', symbol: 'Sh.So.', continent: 'Afrique' },
  { code: 'DJF', name: 'Franc djiboutien', symbol: 'DJF', continent: 'Afrique' },
  { code: 'KMF', name: 'Franc comorien', symbol: 'CF', continent: 'Afrique' },
  { code: 'MGA', name: 'Ariary malgache', symbol: 'Ar', continent: 'Afrique' },
  { code: 'MWK', name: 'Kwacha malawite', symbol: 'MK', continent: 'Afrique' },
  { code: 'NAD', name: 'Dollar namibien', symbol: 'N$', continent: 'Afrique' },
  { code: 'CVE', name: 'Escudo cap-verdien', symbol: 'CVE', continent: 'Afrique' },
  { code: 'GMD', name: 'Dalasi gambien', symbol: 'D', continent: 'Afrique' },
  { code: 'LRD', name: 'Dollar libérien', symbol: 'L$', continent: 'Afrique' },
  { code: 'MRU', name: 'Ouguiya mauritanienne', symbol: 'UM', continent: 'Afrique' },
  { code: 'STN', name: 'Dobra santoméen', symbol: 'Db', continent: 'Afrique' },
  { code: 'SZL', name: 'Lilangeni swazi', symbol: 'L', continent: 'Afrique' },
  { code: 'LSL', name: 'Loti lesothan', symbol: 'L', continent: 'Afrique' },
  { code: 'BWP', name: 'Pula botswanais', symbol: 'P', continent: 'Afrique' },
  { code: 'AWG', name: 'Florin arubais', symbol: 'ƒ', continent: 'Afrique' },

  // ───────────── EUROPE ─────────────
  { code: 'EUR', name: 'Euro', symbol: '€', continent: 'Europe' },
  { code: 'GBP', name: 'Livre sterling', symbol: '£', continent: 'Europe' },
  { code: 'CHF', name: 'Franc suisse', symbol: 'CHF', continent: 'Europe' },
  { code: 'SEK', name: 'Couronne suédoise', symbol: 'kr', continent: 'Europe' },
  { code: 'NOK', name: 'Couronne norvégienne', symbol: 'kr', continent: 'Europe' },
  { code: 'DKK', name: 'Couronne danoise', symbol: 'kr', continent: 'Europe' },
  { code: 'PLN', name: 'Zloty polonais', symbol: 'zł', continent: 'Europe' },
  { code: 'CZK', name: 'Couronne tchèque', symbol: 'Kč', continent: 'Europe' },
  { code: 'HUF', name: 'Forint hongrois', symbol: 'Ft', continent: 'Europe' },
  { code: 'RON', name: 'Leu roumain', symbol: 'lei', continent: 'Europe' },
  { code: 'BGN', name: 'Lev bulgare', symbol: 'лв', continent: 'Europe' },
  { code: 'RSD', name: 'Dinar serbe', symbol: 'дин.', continent: 'Europe' },
  { code: 'UAH', name: 'Hryvnia ukrainienne', symbol: '₴', continent: 'Europe' },
  { code: 'RUB', name: 'Rouble russe', symbol: '₽', continent: 'Europe' },
  { code: 'TRY', name: 'Lire turque', symbol: '₺', continent: 'Europe' },
  { code: 'ISK', name: 'Couronne islandaise', symbol: 'kr', continent: 'Europe' },
  { code: 'ALL', name: 'Lek albanais', symbol: 'L', continent: 'Europe' },
  { code: 'BAM', name: 'Mark convertible', symbol: 'KM', continent: 'Europe' },
  { code: 'MKD', name: 'Denar macédonien', symbol: 'ден', continent: 'Europe' },
  { code: 'MDL', name: 'Leu moldave', symbol: 'L', continent: 'Europe' },
  { code: 'GEL', name: 'Lari géorgien', symbol: '₾', continent: 'Europe' },
  { code: 'AMD', name: 'Dram arménien', symbol: '֏', continent: 'Europe' },
  { code: 'AZN', name: 'Manat azerbaïjanais', symbol: '₼', continent: 'Europe' },
  { code: 'KZT', name: 'Tenge kazakh', symbol: '₸', continent: 'Europe' },
  { code: 'KGS', name: 'Som kirghize', symbol: 'с', continent: 'Europe' },
  { code: 'TJS', name: 'Somoni tadjik', symbol: 'SM', continent: 'Europe' },
  { code: 'TMT', name: 'Manat turkmène', symbol: 'm', continent: 'Europe' },
  { code: 'BYN', name: 'Rouble biélorusse', symbol: 'Br', continent: 'Europe' },

  // ───────────── ASIE ─────────────
  { code: 'CNY', name: 'Yuan chinois', symbol: '¥', continent: 'Asie' },
  { code: 'JPY', name: 'Yen japonais', symbol: '¥', continent: 'Asie' },
  { code: 'KRW', name: 'Won sud-coréen', symbol: '₩', continent: 'Asie' },
  { code: 'INR', name: 'Roupie indienne', symbol: '₹', continent: 'Asie' },
  { code: 'IDR', name: 'Roupie indonésienne', symbol: 'Rp', continent: 'Asie' },
  { code: 'MYR', name: 'Ringgit malais', symbol: 'RM', continent: 'Asie' },
  { code: 'THB', name: 'Baht thaïlandais', symbol: '฿', continent: 'Asie' },
  { code: 'VND', name: 'Dong vietnamien', symbol: '₫', continent: 'Asie' },
  { code: 'PHP', name: 'Peso philippin', symbol: '₱', continent: 'Asie' },
  { code: 'SGD', name: 'Dollar singapourien', symbol: 'S$', continent: 'Asie' },
  { code: 'HKD', name: 'Dollar de Hong Kong', symbol: 'HK$', continent: 'Asie' },
  { code: 'TWD', name: 'Nouveau dollar taïwanais', symbol: 'NT$', continent: 'Asie' },
  { code: 'PKR', name: 'Roupie pakistanaise', symbol: '₨', continent: 'Asie' },
  { code: 'BDT', name: 'Taka bengalais', symbol: '৳', continent: 'Asie' },
  { code: 'LKR', name: 'Roupie sri-lankaise', symbol: 'Rs', continent: 'Asie' },
  { code: 'NPR', name: 'Roupie népalaise', symbol: 'रू', continent: 'Asie' },
  { code: 'MNT', name: 'Tögrög mongol', symbol: '₮', continent: 'Asie' },
  { code: 'AED', name: 'Dirham des Émirats', symbol: 'د.إ', continent: 'Asie' },
  { code: 'SAR', name: 'Riyal saoudien', symbol: '﷼', continent: 'Asie' },
  { code: 'QAR', name: 'Riyal qatari', symbol: 'QR', continent: 'Asie' },
  { code: 'KWD', name: 'Dinar koweïtien', symbol: 'KD', continent: 'Asie' },
  { code: 'BHD', name: 'Dinar bahreïni', symbol: 'BD', continent: 'Asie' },
  { code: 'OMR', name: 'Rial omanais', symbol: '﷼', continent: 'Asie' },
  { code: 'YER', name: 'Rial yéménite', symbol: '﷼', continent: 'Asie' },
  { code: 'IQD', name: 'Dinar irakien', symbol: 'ع.د', continent: 'Asie' },
  { code: 'ILS', name: 'Nouveau shekel israélien', symbol: '₪', continent: 'Asie' },
  { code: 'JOD', name: 'Dinar jordanien', symbol: 'JD', continent: 'Asie' },
  { code: 'LBP', name: 'Livre libanaise', symbol: 'ل.ل', continent: 'Asie' },
  { code: 'IRR', name: 'Rial iranien', symbol: '﷼', continent: 'Asie' },
  { code: 'AFN', name: 'Afghani', symbol: '؋', continent: 'Asie' },
  { code: 'MMK', name: 'Kyat birman', symbol: 'K', continent: 'Asie' },
  { code: 'KHR', name: 'Riel cambodgien', symbol: '៛', continent: 'Asie' },
  { code: 'LAK', name: 'Kip laotien', symbol: '₭', continent: 'Asie' },
  { code: 'BTN', name: 'Ngultrum bhoutanais', symbol: 'Nu.', continent: 'Asie' },
  { code: 'MVR', name: 'Rufiyaa maldivienne', symbol: 'Rf', continent: 'Asie' },
  { code: 'BND', name: 'Dollar brunéien', symbol: 'B$', continent: 'Asie' },
  { code: 'MOP', name: 'Pataca macana', symbol: 'MOP$', continent: 'Asie' },
  { code: 'UZS', name: 'Soïm ouzbek', symbol: "so'm", continent: 'Asie' },

  // ───────────── AMÉRIQUE ─────────────
  { code: 'USD', name: 'Dollar américain', symbol: '$', continent: 'Amérique' },
  { code: 'CAD', name: 'Dollar canadien', symbol: 'CA$', continent: 'Amérique' },
  { code: 'MXN', name: 'Peso mexicain', symbol: '$', continent: 'Amérique' },
  { code: 'BRL', name: 'Real brésilien', symbol: 'R$', continent: 'Amérique' },
  { code: 'ARS', name: 'Peso argentin', symbol: '$', continent: 'Amérique' },
  { code: 'CLP', name: 'Peso chilien', symbol: '$', continent: 'Amérique' },
  { code: 'COP', name: 'Peso colombien', symbol: '$', continent: 'Amérique' },
  { code: 'PEN', name: 'Sol péruvien', symbol: 'S/', continent: 'Amérique' },
  { code: 'VES', name: 'Bolívar vénézuélien', symbol: 'Bs.', continent: 'Amérique' },
  { code: 'UYU', name: 'Peso uruguayen', symbol: '$U', continent: 'Amérique' },
  { code: 'PYG', name: 'Guarani paraguayen', symbol: '₲', continent: 'Amérique' },
  { code: 'BOB', name: 'Boliviano', symbol: 'Bs', continent: 'Amérique' },
  { code: 'CRC', name: 'Colón costaricain', symbol: '₡', continent: 'Amérique' },
  { code: 'PAB', name: 'Balboa panaméen', symbol: 'B/.', continent: 'Amérique' },
  { code: 'DOP', name: 'Peso dominicain', symbol: 'RD$', continent: 'Amérique' },
  { code: 'HTG', name: 'Gourde haïtienne', symbol: 'G', continent: 'Amérique' },
  { code: 'JMD', name: 'Dollar jamaïcain', symbol: 'J$', continent: 'Amérique' },
  { code: 'TTD', name: 'Dollar trinidadien', symbol: 'TT$', continent: 'Amérique' },
  { code: 'XCD', name: 'Dollar des Caraïbes', symbol: 'EC$', continent: 'Amérique' },
  { code: 'GTQ', name: 'Quetzal guatémaltèque', symbol: 'Q', continent: 'Amérique' },
  { code: 'HNL', name: 'Lempira hondurienne', symbol: 'L', continent: 'Amérique' },
  { code: 'NIO', name: 'Córdoba nicaraguayen', symbol: 'C$', continent: 'Amérique' },
  { code: 'CUP', name: 'Peso cubain', symbol: '$', continent: 'Amérique' },
  { code: 'BBD', name: 'Dollar barbadien', symbol: 'Bds$', continent: 'Amérique' },
  { code: 'BZD', name: 'Dollar bélizien', symbol: 'BZ$', continent: 'Amérique' },
  { code: 'GYD', name: 'Dollar guyanien', symbol: 'GY$', continent: 'Amérique' },
  { code: 'SRD', name: 'Dollar surinamais', symbol: '$', continent: 'Amérique' },
  { code: 'ANG', name: 'Florin antillais', symbol: 'ƒ', continent: 'Amérique' },
  { code: 'FKP', name: 'Livre des Falkland', symbol: '£', continent: 'Amérique' },
  { code: 'SVC', name: 'Colón salvadorien', symbol: '₡', continent: 'Amérique' },

  // ───────────── OCÉANIE ─────────────
  { code: 'AUD', name: 'Dollar australien', symbol: 'A$', continent: 'Océanie' },
  { code: 'NZD', name: 'Dollar néo-zélandais', symbol: 'NZ$', continent: 'Océanie' },
  { code: 'FJD', name: 'Dollar fidjien', symbol: 'FJ$', continent: 'Océanie' },
  { code: 'PGK', name: 'Kina papou', symbol: 'K', continent: 'Océanie' },
  { code: 'VUV', name: 'Vatu vanuatuan', symbol: 'VT', continent: 'Océanie' },
  { code: 'WST', name: 'Samoan tala', symbol: 'WS$', continent: 'Océanie' },
  { code: 'SBD', name: 'Dollar des Îles Salomon', symbol: 'SI$', continent: 'Océanie' },
  { code: 'TOP', name: "Pa'anga tongien", symbol: 'T$', continent: 'Océanie' },
  { code: 'KID', name: 'Dollar kiribatien', symbol: '$', continent: 'Océanie' },
  { code: 'MCK', name: 'Dollar nauruan', symbol: '$', continent: 'Océanie' },
];

/**
 * Retourne la définition d'une devise à partir de son code ISO.
 * Gère aussi l'ancien format stocké en base (ex: 'USD ($)', 'FCFA', 'CDF').
 */
export function getCurrency(value: string | null | undefined): Currency | undefined {
  if (!value) return undefined;
  // Essai 1 : code ISO exact
  const exact = CURRENCIES.find((c) => c.code === value.toUpperCase().trim());
  if (exact) return exact;
  // Essai 2 : ancien format 'USD ($)' → 'USD'
  const legacyCode = value.split(' ')[0].replace(/[()]/g, '').toUpperCase().trim();
  return CURRENCIES.find((c) => c.code === legacyCode);
}

/** Symbole d'affichage d'une devise (avec repli '$' pour l'ancien format). */
export function getCurrencySymbol(value: string | null | undefined): string {
  const cur = getCurrency(value);
  if (cur) return cur.symbol;
  // Anciens formats libres : 'FCFA' → FCFA, 'USD ($)' → $, 'CDF' → FC
  if (value && value.includes('FCFA')) return 'FCFA';
  return '$';
}
