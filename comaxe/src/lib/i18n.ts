// ============================================
// COMAXE — Internationalisation (i18n)
// Le site suit la langue du navigateur :
//   • français (et dérivés fr-XX) → interface française
//   • tout autre langage          → interface anglaise (langue internationale)
// Résolution côté serveur via l'en-tête Accept-Language.
// ============================================

export type Locale = 'fr' | 'en';

export const DEFAULT_LOCALE: Locale = 'fr';

/**
 * Résout la locale depuis l'en-tête Accept-Language.
 * - absent → français (langue par défaut COMAXE)
 * - fr prioritaire → français ; sinon → anglais
 */
export function resolveLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const entries = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, ...params] = part.split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.split('=')[1]) || 0 : 1;
      return { lang: lang.trim().toLowerCase(), q };
    })
    .filter((e) => e.lang && e.lang !== '*');

  if (entries.length === 0) return DEFAULT_LOCALE;

  // Du plus préféré au moins préféré
  entries.sort((a, b) => b.q - a.q);

  for (const e of entries) {
    if (e.lang.startsWith('fr')) return 'fr';
    if (e.lang.startsWith('en')) return 'en';
  }
  // Aucune langue prise en charge détectée → anglais international
  return 'en';
}
