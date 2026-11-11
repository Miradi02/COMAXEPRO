// ============================================
// COMAXE — Catalogue des pays
// Choix du pays d'implantation du commerce, groupé par continent.
// ============================================

import { Continent } from './currencies';

export interface Country {
  /** Code ISO 3166-1 alpha-2 (ex: 'CD') */
  code: string;
  /** Nom affiché en français */
  name: string;
  /** Drapeau emoji */
  flag: string;
  continent: Continent;
  /** Devise principale du pays (code ISO 4217) — pré-sélection proposée */
  currency: string;
}

export const COUNTRIES: Country[] = [
  // ───────────── AFRIQUE ─────────────
  { code: 'AO', name: 'Angola', flag: '🇦🇴', continent: 'Afrique', currency: 'AOA' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯', continent: 'Afrique', currency: 'XOF' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', continent: 'Afrique', currency: 'BWP' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', continent: 'Afrique', currency: 'XOF' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', continent: 'Afrique', currency: 'BIF' },
  { code: 'CV', name: 'Cap-Vert', flag: '🇨🇻', continent: 'Afrique', currency: 'CVE' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲', continent: 'Afrique', currency: 'XAF' },
  { code: 'KM', name: 'Comores', flag: '🇰🇲', continent: 'Afrique', currency: 'KMF' },
  { code: 'CG', name: 'Congo-Brazzaville', flag: '🇨🇬', continent: 'Afrique', currency: 'XAF' },
  { code: 'CD', name: 'RD Congo (Kinshasa)', flag: '🇨🇩', continent: 'Afrique', currency: 'CDF' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮', continent: 'Afrique', currency: 'XOF' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯', continent: 'Afrique', currency: 'DJF' },
  { code: 'EG', name: 'Égypte', flag: '🇪🇬', continent: 'Afrique', currency: 'EGP' },
  { code: 'ER', name: 'Érythrée', flag: '🇪🇷', continent: 'Afrique', currency: 'USD' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', continent: 'Afrique', currency: 'SZL' },
  { code: 'ET', name: 'Éthiopie', flag: '🇪🇹', continent: 'Afrique', currency: 'ETB' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦', continent: 'Afrique', currency: 'XAF' },
  { code: 'GM', name: 'Gambie', flag: '🇬🇲', continent: 'Afrique', currency: 'GMD' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', continent: 'Afrique', currency: 'GHS' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳', continent: 'Afrique', currency: 'GNF' },
  { code: 'GQ', name: 'Guinée équatoriale', flag: '🇬🇶', continent: 'Afrique', currency: 'XAF' },
  { code: 'GW', name: 'Guinée-Bissau', flag: '🇬🇼', continent: 'Afrique', currency: 'XOF' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', continent: 'Afrique', currency: 'KES' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸', continent: 'Afrique', currency: 'LSL' },
  { code: 'LR', name: 'Libéria', flag: '🇱🇷', continent: 'Afrique', currency: 'LRD' },
  { code: 'LY', name: 'Libye', flag: '🇱🇾', continent: 'Afrique', currency: 'LYD' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬', continent: 'Afrique', currency: 'MGA' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', continent: 'Afrique', currency: 'MWK' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', continent: 'Afrique', currency: 'XOF' },
  { code: 'MR', name: 'Mauritanie', flag: '🇲🇷', continent: 'Afrique', currency: 'MRU' },
  { code: 'MU', name: 'Maurice', flag: '🇲🇺', continent: 'Afrique', currency: 'MUR' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦', continent: 'Afrique', currency: 'MAD' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿', continent: 'Afrique', currency: 'MZN' },
  { code: 'NA', name: 'Namibie', flag: '🇳🇦', continent: 'Afrique', currency: 'NAD' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪', continent: 'Afrique', currency: 'XOF' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', continent: 'Afrique', currency: 'NGN' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', continent: 'Afrique', currency: 'RWF' },
  { code: 'ST', name: 'Sao Tomé-et-Principe', flag: '🇸🇹', continent: 'Afrique', currency: 'STN' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳', continent: 'Afrique', currency: 'XOF' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨', continent: 'Afrique', currency: 'MUR' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱', continent: 'Afrique', currency: 'SLE' },
  { code: 'SO', name: 'Somalie', flag: '🇸🇴', continent: 'Afrique', currency: 'SOS' },
  { code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦', continent: 'Afrique', currency: 'ZAR' },
  { code: 'SS', name: 'Soudan du Sud', flag: '🇸🇸', continent: 'Afrique', currency: 'SSP' },
  { code: 'SD', name: 'Soudan', flag: '🇸🇩', continent: 'Afrique', currency: 'SDG' },
  { code: 'TZ', name: 'Tanzanie', flag: '🇹🇿', continent: 'Afrique', currency: 'TZS' },
  { code: 'TD', name: 'Tchad', flag: '🇹🇩', continent: 'Afrique', currency: 'XAF' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', continent: 'Afrique', currency: 'XOF' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳', continent: 'Afrique', currency: 'TND' },
  { code: 'UG', name: 'Ouganda', flag: '🇺🇬', continent: 'Afrique', currency: 'UGX' },
  { code: 'ZM', name: 'Zambie', flag: '🇿🇲', continent: 'Afrique', currency: 'ZMW' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', continent: 'Afrique', currency: 'ZWL' },

  // ───────────── EUROPE ─────────────
  { code: 'FR', name: 'France', flag: '🇫🇷', continent: 'Europe', currency: 'EUR' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪', continent: 'Europe', currency: 'EUR' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭', continent: 'Europe', currency: 'CHF' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', continent: 'Europe', currency: 'GBP' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪', continent: 'Europe', currency: 'EUR' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹', continent: 'Europe', currency: 'EUR' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸', continent: 'Europe', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', continent: 'Europe', currency: 'EUR' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱', continent: 'Europe', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺', continent: 'Europe', currency: 'EUR' },
  { code: 'IE', name: 'Irlande', flag: '🇮🇪', continent: 'Europe', currency: 'EUR' },
  { code: 'AT', name: 'Autriche', flag: '🇦🇹', continent: 'Europe', currency: 'EUR' },
  { code: 'GR', name: 'Grèce', flag: '🇬🇷', continent: 'Europe', currency: 'EUR' },
  { code: 'PL', name: 'Pologne', flag: '🇵🇱', continent: 'Europe', currency: 'PLN' },
  { code: 'CZ', name: 'Tchéquie', flag: '🇨🇿', continent: 'Europe', currency: 'CZK' },
  { code: 'RO', name: 'Roumanie', flag: '🇷🇴', continent: 'Europe', currency: 'RON' },
  { code: 'BG', name: 'Bulgarie', flag: '🇧🇬', continent: 'Europe', currency: 'BGN' },
  { code: 'HU', name: 'Hongrie', flag: '🇭🇺', continent: 'Europe', currency: 'HUF' },
  { code: 'SE', name: 'Suède', flag: '🇸🇪', continent: 'Europe', currency: 'SEK' },
  { code: 'NO', name: 'Norvège', flag: '🇳🇴', continent: 'Europe', currency: 'NOK' },
  { code: 'DK', name: 'Danemark', flag: '🇩🇰', continent: 'Europe', currency: 'DKK' },
  { code: 'FI', name: 'Finlande', flag: '🇫🇮', continent: 'Europe', currency: 'EUR' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', continent: 'Europe', currency: 'UAH' },
  { code: 'RU', name: 'Russie', flag: '🇷🇺', continent: 'Europe', currency: 'RUB' },
  { code: 'TR', name: 'Turquie', flag: '🇹🇷', continent: 'Europe', currency: 'TRY' },

  // ───────────── ASIE ─────────────
  { code: 'CN', name: 'Chine', flag: '🇨🇳', continent: 'Asie', currency: 'CNY' },
  { code: 'JP', name: 'Japon', flag: '🇯🇵', continent: 'Asie', currency: 'JPY' },
  { code: 'KR', name: 'Corée du Sud', flag: '🇰🇷', continent: 'Asie', currency: 'KRW' },
  { code: 'IN', name: 'Inde', flag: '🇮🇳', continent: 'Asie', currency: 'INR' },
  { code: 'ID', name: 'Indonésie', flag: '🇮🇩', continent: 'Asie', currency: 'IDR' },
  { code: 'MY', name: 'Malaisie', flag: '🇲🇾', continent: 'Asie', currency: 'MYR' },
  { code: 'TH', name: 'Thaïlande', flag: '🇹🇭', continent: 'Asie', currency: 'THB' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', continent: 'Asie', currency: 'VND' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', continent: 'Asie', currency: 'PHP' },
  { code: 'SG', name: 'Singapour', flag: '🇸🇬', continent: 'Asie', currency: 'SGD' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', continent: 'Asie', currency: 'PKR' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', continent: 'Asie', currency: 'BDT' },
  { code: 'SA', name: 'Arabie saoudite', flag: '🇸🇦', continent: 'Asie', currency: 'SAR' },
  { code: 'AE', name: 'Émirats arabes unis', flag: '🇦🇪', continent: 'Asie', currency: 'AED' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦', continent: 'Asie', currency: 'QAR' },
  { code: 'KW', name: 'Koweït', flag: '🇰🇼', continent: 'Asie', currency: 'KWD' },
  { code: 'IL', name: 'Israël', flag: '🇮🇱', continent: 'Asie', currency: 'ILS' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷', continent: 'Asie', currency: 'IRR' },

  // ───────────── AMÉRIQUE ─────────────
  { code: 'US', name: 'États-Unis', flag: '🇺🇸', continent: 'Amérique', currency: 'USD' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', continent: 'Amérique', currency: 'CAD' },
  { code: 'MX', name: 'Mexique', flag: '🇲🇽', continent: 'Amérique', currency: 'MXN' },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷', continent: 'Amérique', currency: 'BRL' },
  { code: 'AR', name: 'Argentine', flag: '🇦🇷', continent: 'Amérique', currency: 'ARS' },
  { code: 'CL', name: 'Chili', flag: '🇨🇱', continent: 'Amérique', currency: 'CLP' },
  { code: 'CO', name: 'Colombie', flag: '🇨🇴', continent: 'Amérique', currency: 'COP' },
  { code: 'PE', name: 'Pérou', flag: '🇵🇪', continent: 'Amérique', currency: 'PEN' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', continent: 'Amérique', currency: 'VES' },
  { code: 'HT', name: 'Haïti', flag: '🇭🇹', continent: 'Amérique', currency: 'HTG' },
  { code: 'DO', name: 'République dominicaine', flag: '🇩🇴', continent: 'Amérique', currency: 'DOP' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', continent: 'Amérique', currency: 'CUP' },
  { code: 'JM', name: 'Jamaïque', flag: '🇯🇲', continent: 'Amérique', currency: 'JMD' },
  { code: 'TT', name: 'Trinité-et-Tobago', flag: '🇹🇹', continent: 'Amérique', currency: 'TTD' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', continent: 'Amérique', currency: 'PAB' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', continent: 'Amérique', currency: 'UYU' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', continent: 'Amérique', currency: 'PYG' },
  { code: 'BO', name: 'Bolivie', flag: '🇧🇴', continent: 'Amérique', currency: 'BOB' },
  { code: 'EC', name: 'Équateur', flag: '🇪🇨', continent: 'Amérique', currency: 'USD' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾', continent: 'Amérique', currency: 'GYD' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', continent: 'Amérique', currency: 'SRD' },

  // ───────────── OCÉANIE ─────────────
  { code: 'AU', name: 'Australie', flag: '🇦🇺', continent: 'Océanie', currency: 'AUD' },
  { code: 'NZ', name: 'Nouvelle-Zélande', flag: '🇳🇿', continent: 'Océanie', currency: 'NZD' },
  { code: 'FJ', name: 'Fidji', flag: '🇫🇯', continent: 'Océanie', currency: 'FJD' },
  { code: 'PG', name: 'Papouasie-Nouvelle-Guinée', flag: '🇵🇬', continent: 'Océanie', currency: 'PGK' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', continent: 'Océanie', currency: 'VUV' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸', continent: 'Océanie', currency: 'WST' },
  { code: 'SB', name: 'Îles Salomon', flag: '🇸🇧', continent: 'Océanie', currency: 'SBD' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴', continent: 'Océanie', currency: 'TOP' },
];
