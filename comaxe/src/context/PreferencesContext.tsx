'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import { useI18n } from './I18nContext';
import {
  applyPreferencesToDocument,
  DEFAULT_PREFERENCES,
  readCachedPreferences,
  resolveTheme,
  writeCachedPreferences,
  type UserPreferences,
} from '@/lib/prefs';
import { setDateFormat } from '@/lib/dateUtils';

interface PreferencesValue {
  prefs: UserPreferences;
  /** Thème réellement rendu (`system` déjà résolu) */
  resolvedTheme: 'light' | 'dark';
  /** Vrai pendant la lecture initiale en base */
  loading: boolean;
  /** Message court affiché après une écriture réussie / échouée */
  status: 'idle' | 'saving' | 'saved' | 'error';
  update: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesValue>({
  prefs: DEFAULT_PREFERENCES,
  resolvedTheme: 'light',
  loading: true,
  status: 'idle',
  update: async () => {},
});

/** Traduit une ligne de table en objet de préférences (colonnes snake_case) */
function rowToPreferences(row: Record<string, unknown>): UserPreferences {
  return {
    theme: (row.theme as UserPreferences['theme']) ?? DEFAULT_PREFERENCES.theme,
    fontFamily: (row.font_family as UserPreferences['fontFamily']) ?? DEFAULT_PREFERENCES.fontFamily,
    textSize: (row.text_size as UserPreferences['textSize']) ?? DEFAULT_PREFERENCES.textSize,
    locale: (row.locale as UserPreferences['locale']) ?? DEFAULT_PREFERENCES.locale,
    dateFormat: (row.date_format as UserPreferences['dateFormat']) ?? DEFAULT_PREFERENCES.dateFormat,
    notifyGeneral: typeof row.notify_general === 'boolean' ? row.notify_general : DEFAULT_PREFERENCES.notifyGeneral,
    notifyStock: typeof row.notify_stock === 'boolean' ? row.notify_stock : DEFAULT_PREFERENCES.notifyStock,
    notifyDebts: typeof row.notify_debts === 'boolean' ? row.notify_debts : DEFAULT_PREFERENCES.notifyDebts,
    notifyActivity: typeof row.notify_activity === 'boolean' ? row.notify_activity : DEFAULT_PREFERENCES.notifyActivity,
  };
}

function preferencesToRow(prefs: UserPreferences) {
  return {
    theme: prefs.theme,
    font_family: prefs.fontFamily,
    text_size: prefs.textSize,
    locale: prefs.locale,
    date_format: prefs.dateFormat,
    notify_general: prefs.notifyGeneral,
    notify_stock: prefs.notifyStock,
    notify_debts: prefs.notifyDebts,
    notify_activity: prefs.notifyActivity,
  };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { serverLocale, setLocale } = useI18n();

  // Cache local : appliqué immédiatement (le script inline a déjà fait le travail
  // au tout premier rendu, ce state évite tout retour en arrière visuel).
  const [prefs, setPrefs] = useState<UserPreferences>(() => readCachedPreferences());
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PreferencesValue['status']>('idle');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => resolveTheme('system'));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  // ---- Appliquer au document à chaque changement ----
  // 'auto' = suivre la locale du serveur (Accept-Language) : on ne force rien.
  const resolvedLocale = prefs.locale === 'auto' ? serverLocale : prefs.locale;

  useEffect(() => {
    applyPreferencesToDocument(prefs);
    writeCachedPreferences(prefs);
    setDateFormat(prefs.dateFormat);
    setLocale(resolvedLocale);
    // `setLocale` est stable (setState de React) — pas de boucle infinie.
  }, [prefs, resolvedLocale, setLocale]);

  // ---- Suivi du thème système (mode « Système ») ----
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light');
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ---- Chargement depuis Supabase ----
  useEffect(() => {
    mounted.current = true;
    if (authLoading) return;

    let cancelled = false;
    const load = async () => {
      if (!user) {
        // Hors session : on garde le cache local (page de connexion)
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        // Pas encore de ligne (compte créé avant la table) : on la crée.
        if (!error && !data) {
          const { data: inserted } = await supabase
            .from('user_preferences')
            .upsert({ user_id: user.id, ...preferencesToRow(readCachedPreferences()) }, { onConflict: 'user_id' })
            .select()
            .maybeSingle();
          if (!cancelled && inserted) setPrefs(rowToPreferences(inserted));
        }
        if (!cancelled) setLoading(false);
        return;
      }
      const remote = rowToPreferences(data);
      if (!cancelled) setPrefs(remote);
      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // ---- Écriture optimiste + persistance ----
  const update = useCallback(
    async <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPrefs((prev) => {
        if (prev[key] === value) return prev;
        const next = { ...prev, [key]: value };
        writeCachedPreferences(next);

        // Persistance en base (upsert idempotent)
        setStatus('saving');
        supabase
          .from('user_preferences')
          .upsert(
            { user_id: user?.id ?? '', ...preferencesToRow(next) },
            { onConflict: 'user_id' }
          )
          .then(({ error }) => {
            if (!mounted.current) return;
            if (error) {
              setStatus('error');
              return;
            }
            setStatus('saved');
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => mounted.current && setStatus('idle'), 1800);
          });

        return next;
      });
    },
    [user?.id]
  );

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const resolvedTheme = prefs.theme === 'system' ? systemTheme : prefs.theme;

  const value = useMemo<PreferencesValue>(
    () => ({ prefs, resolvedTheme, loading, status, update }),
    [prefs, resolvedTheme, loading, status, update]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  return useContext(PreferencesContext);
}
