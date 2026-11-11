// Utilitaires de manipulation, normalisation et filtrage de dates pour COMAXE
// La date de référence est la VRAIE date du jour (dynamique)

import type { Locale } from './i18n';
import type { DateFormatPref } from './prefs';

/**
 * Format d'affichage des dates absolues (préférence utilisateur).
 * 'long' = comportement historique ("29 octobre 2026").
 * Les autres formats sont numériques et pilotés depuis /parametres/affichage.
 */
let activeDateFormat: DateFormatPref = 'long';

export function setDateFormat(format: DateFormatPref): void {
  activeDateFormat = format;
}

export function getDateFormat(): DateFormatPref {
  return activeDateFormat;
}

/** Applique le format de date choisi sur une date normalisée YYYY-MM-DD */
function applyDateFormat(key: string, locale: Locale, style: 'short' | 'full' = 'short'): string {
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  const [y, m, d] = parts;

  if (activeDateFormat === 'dd/mm/yyyy') return `${d}/${m}/${y}`;
  if (activeDateFormat === 'mm/dd/yyyy') return `${m}/${d}/${y}`;
  if (activeDateFormat === 'yyyy-mm-dd') return key;

  const monthsFr = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = (locale === 'en' ? monthsEn : monthsFr)[parseInt(m, 10) - 1] || m;
  if (style === 'short') return `${d} ${monthName} ${y}`;

  const monthsFrFull = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const monthsEnFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const fullName = (locale === 'en' ? monthsEnFull : monthsFrFull)[parseInt(m, 10) - 1] || monthName;
  return `${d} ${fullName} ${y}`;
}

/**
 * Retourne la date d'aujourd'hui au format clé YYYY-MM-DD (dynamique)
 */
export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retourne la date d'hier au format clé YYYY-MM-DD (dynamique)
 */
export function getYesterdayKey(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Date de référence = aujourd'hui (dynamique, recalculée au chargement)
export const REFERENCE_TODAY_KEY = getTodayKey();
export const REFERENCE_TODAY_DATE = new Date();

/**
 * Normalise n'importe quel format de date en clé YYYY-MM-DD
 */
export function normalizeDateToKey(dateStr: string): string {
  if (!dateStr) return getTodayKey();

  const lower = dateStr.toLowerCase().trim();
  if (lower.includes("aujourd'hui") || lower === 'today') {
    return getTodayKey();
  }
  if (lower.includes('hier') || lower === 'yesterday') {
    return getYesterdayKey();
  }

  // Regex ISO: YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = dateStr.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Regex FR: DD/MM/YYYY ou DD-MM-YYYY
  const frMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
  }

  // Fallback si format texte comme "05 oct" ou "05 octobre 2026"
  const textMatch = dateStr.match(/(\d{1,2})\s*(jan|fév|fev|mar|avr|mai|juin|juil|aoû|aou|sep|oct|nov|déc|dec)[a-z]*\s*(\d{4})?/i);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthMap: Record<string, string> = {
      jan: '01', fév: '02', fev: '02', mar: '03', avr: '04',
      mai: '05', juin: '06', juil: '07', aoû: '08', aou: '08',
      sep: '09', oct: '10', nov: '11', déc: '12', dec: '12',
    };
    const prefix = textMatch[2].substring(0, 3).toLowerCase();
    const month = monthMap[prefix] || String(new Date().getMonth() + 1).padStart(2, '0');
    const year = textMatch[3] || String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }

  return getTodayKey();
}

/**
 * Convertit une chaîne de date en objet Date JavaScript précis
 */
export function parseToDate(dateStr: string): Date {
  const key = normalizeDateToKey(dateStr);
  const [year, month, day] = key.split('-').map(Number);

  // Recherche éventuelle de l'heure HH:mm
  const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
  const hours = timeMatch ? parseInt(timeMatch[1], 10) : 12;
  const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Vérifie si une opération correspond exactement à la date sélectionnée dans le sélecteur global.
 * Aucun filtre n'accepte de correspondance laxiste sur 'Aujourd'hui' :
 * la date de l'opération doit réellement correspondre au calendrier du jour.
 */
export function isDateMatching(itemDate: string, selectedDate: string | null): boolean {
  if (!itemDate) return false;
  const itemKey = normalizeDateToKey(itemDate);
  const targetKey =
    !selectedDate || selectedDate === 'today' || selectedDate === 'aujourdhui'
      ? getTodayKey()
      : normalizeDateToKey(selectedDate);

  return itemKey === targetKey;
}

/**
 * Formate la date d'une opération pour un affichage intelligent :
 * - Si l'opération date d'aujourd'hui : "Aujourd'hui, HH:mm"
 * - Si elle date d'hier : "Hier, HH:mm"
 * - Si le jour est passé : la date et l'heure réelles s'affichent ("29 oct 2026, 23:35")
 */
export function formatOperationDate(dateStr: string, locale: Locale = 'fr'): string {
  if (!dateStr) return '';
  const itemKey = normalizeDateToKey(dateStr);
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})/);
  const timeStr = timeMatch ? `, ${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '';

  if (itemKey === todayKey) {
    return locale === 'en' ? `Today${timeStr}` : `Aujourd'hui${timeStr}`;
  }
  if (itemKey === yesterdayKey) {
    return locale === 'en' ? `Yesterday${timeStr}` : `Hier${timeStr}`;
  }

  // Date passée : affiche la date et l'heure réelles
  const parts = itemKey.split('-');
  if (parts.length === 3) {
    return `${applyDateFormat(itemKey, locale)}${timeStr}`;
  }

  return dateStr;
}

/**
 * Génère une chaîne de date et heure absolue pour l'enregistrement en base
 * (ne stocke JAMAIS le texte relatif 'Aujourd'hui' en base de données !)
 */
export function getNowOperationDate(selectedDate?: string | null): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (selectedDate && selectedDate !== 'today' && selectedDate !== 'aujourdhui') {
    const key = normalizeDateToKey(selectedDate);
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y} ${timeStr}`;
  }

  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${timeStr}`;
}

/**
 * Libellé lisible pour l'en-tête et les badges (français par défaut)
 */
export function getDisplayDateLabel(selectedDate: string | null, locale: Locale = 'fr'): string {
  const todayKey = getTodayKey();
  const isEn = locale === 'en';
  if (!selectedDate || selectedDate === 'today' || selectedDate === 'aujourdhui') {
    return isEn ? 'Today' : "Aujourd'hui";
  }

  const key = normalizeDateToKey(selectedDate);
  const parts = key.split('-');
  if (parts.length === 3) {
    // « Aujourd'hui » suivi de la date complète, selon le format choisi
    const full = applyDateFormat(key, locale, 'full');
    if (key === todayKey) {
      return isEn ? `Today (${full})` : `Aujourd'hui (${full})`;
    }
    return full;
  }

  return selectedDate;
}

/**
 * Retourne le libellé du mois courant (ex: "Octobre 2026" / "October 2026")
 */
export function getCurrentMonthLabel(locale: Locale = 'fr'): string {
  const now = new Date();
  const monthsFr = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const months = locale === 'en' ? monthsEn : monthsFr;
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Vérifie si une opération s'inscrit dans une plage temporelle par rapport à la date de référence
 */
export function isWithinPeriodRange(
  itemDate: string,
  period: '7j' | '30j' | '3m' | '6m' | '12m' | 'semaine' | 'mois' | '3mois' | 'annee' | 'personnalise',
  referenceDate: Date = new Date()
): boolean {
  const opDate = parseToDate(itemDate);
  const diffTime = referenceDate.getTime() - opDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // Si l'opération est postérieure au futur immédiat (> 1 jour d'avance), on l'exclut
  if (diffDays < -1) return false;

  switch (period) {
    case '7j':
    case 'semaine':
      return diffDays <= 7 && diffDays >= -0.5;

    case '30j':
    case 'mois':
      return diffDays <= 30 && diffDays >= -0.5;

    case '3m':
    case '3mois':
      return diffDays <= 92 && diffDays >= -0.5;

    case '6m':
      return diffDays <= 183 && diffDays >= -0.5;

    case '12m':
    case 'annee':
      return diffDays <= 365 && diffDays >= -0.5;

    case 'personnalise':
    default:
      return true;
  }
}

/**
 * Retourne les N derniers jours au format { key, label } pour les graphiques d'évolution
 */
export function getLastNDaysKeys(n: number, locale: Locale = 'fr'): { key: string; label: string }[] {
  const days: { key: string; label: string }[] = [];
  const now = new Date();
  const todayKey = getTodayKey();
  const monthsFr = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = String(d.getDate()).padStart(2, '0');
    const label =
      key === todayKey
        ? locale === 'en'
          ? 'Today'
          : "Aujourd'hui"
        : locale === 'en'
          ? `${monthsEn[d.getMonth()]} ${day}`
          : `${day} ${monthsFr[d.getMonth()]}`;
    days.push({ key, label });
  }
  return days;
}
