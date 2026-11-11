'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Locale } from '@/lib/i18n';

/**
 * Traduction bilingue colocalisée :
 *   t('Ventes Enregistrées', 'Recorded Sales')
 *   t('{amount} encaissés', '{amount} collected', { amount: '1 500 FC' })
 *
 * - locale 'fr' → le texte français est renvoyé tel quel
 * - locale 'en' → le texte anglais, avec remplacement des jetons {nom}
 */
export type Translate = (
  fr: string,
  en: string,
  params?: Record<string, string | number>
) => string;

interface I18nValue {
  locale: Locale;
  t: Translate;
  /**
   * Locale servie par le serveur (Accept-Language), indépendamment de tout
   * choix utilisateur. Sert de référence pour la préférence « Langue : Auto ».
   */
  serverLocale: Locale;
  /**
   * Remplace la locale servie par le serveur (déduite d'Accept-Language).
   * Piloté par la préférence « Langue » de l'utilisateur (table
   * user_preferences). Identique à la locale courant → aucun rendu.
   */
  setLocale: (locale: Locale) => void;
}

function createTranslate(locale: Locale): Translate {
  return (fr, en, params) => {
    let text = locale === 'fr' ? fr : en;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        text = text.split(`{${key}}`).join(String(value));
      }
    }
    return text;
  };
}

const I18nContext = createContext<I18nValue>({
  locale: 'fr',
  t: createTranslate('fr'),
  serverLocale: 'fr',
  setLocale: () => {},
});

export function I18nProvider({
  locale: serverLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // Override préférence utilisateur (null = on suit encore le serveur)
  const [override, setOverride] = useState<Locale | null>(null);
  const locale = override ?? serverLocale;

  const setLocale = useCallback((next: Locale) => {
    setOverride((prev) => (prev === next ? prev : next));
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ locale, t: createTranslate(locale), serverLocale, setLocale }),
    [locale, serverLocale, setLocale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
