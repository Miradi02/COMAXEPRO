// ============================================
// COMAXE — Préférences utilisateur
// Source de vérité : table Supabase `user_preferences` (RLS).
// Un cache localStorage permet d'appliquer la préférence INSTANTANÉMENT
// au chargement (script inline du layout) avant même la résolution de la
// session : aucun clignotement de thème.
// ============================================

import type { Locale } from './i18n';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type FontFamily = 'jakarta' | 'inter';
export type TextSize = 'small' | 'normal' | 'large';
export type DateFormatPref = 'long' | 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
/**
 * 'auto' = suivre la langue du navigateur (logique Accept-Language historique
 * de COMAXE). 'fr' / 'en' = choix explicite de l'utilisateur.
 */
export type LocalePref = 'auto' | Locale;

export interface UserPreferences {
  theme: ThemeMode;
  fontFamily: FontFamily;
  textSize: TextSize;
  locale: LocalePref;
  dateFormat: DateFormatPref;
  notifyGeneral: boolean;
  notifyStock: boolean;
  notifyDebts: boolean;
  notifyActivity: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  fontFamily: 'jakarta',
  textSize: 'normal',
  locale: 'auto',
  dateFormat: 'long',
  notifyGeneral: true,
  notifyStock: true,
  notifyDebts: true,
  notifyActivity: false,
};

export const PREFERENCES_STORAGE_KEY = 'comaxe.preferences';

/** Taille de police de base (html) selon la préférence */
export const TEXT_SIZE_PX: Record<TextSize, string> = {
  small: '14px',
  normal: '16px',
  large: '18px',
};

/** Pile de polices réellement chargées par le layout (Google Fonts) */
export const FONT_STACK: Record<FontFamily, string> = {
  jakarta: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  inter: "'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/** Thème réellement appliqué : `system` suit les préférences du système */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Lit le cache local (jamais utilisé comme source de vérité après la session) */
export function readCachedPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writeCachedPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* stockage indisponible : le thème reste appliqué pour la session */
  }
}

/**
 * Applique les préférences au document (thème, police, taille, langue).
 * Fonction unique utilisée par le contexte ET réservée au script inline
 * du layout pour le premier rendu.
 */
export function applyPreferencesToDocument(prefs: UserPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const dark = resolveTheme(prefs.theme) === 'dark';
  root.classList.toggle('dark', dark);
  root.style.setProperty('--comaxe-text-size', TEXT_SIZE_PX[prefs.textSize] ?? TEXT_SIZE_PX.normal);
  root.style.setProperty('--comaxe-font', FONT_STACK[prefs.fontFamily] ?? FONT_STACK.jakarta);
  // 'auto' → on laisse l'attribut lang tel qu'il a été rendu par le serveur
  if (prefs.locale !== 'auto') root.lang = prefs.locale;
}

/**
 * Script inline exécuté dans <head> AVANT le premier rendu.
 * Il tourne avant le chargement des modules : il ne peut pas importer
 * `applyPreferencesToDocument`, d'où ce miroir minimal (5 lignes) qui
 * applique strictement les mêmes jetons — c'est ce qui évite le
 * clignotement blanc/bleu au chargement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=JSON.parse(localStorage.getItem('${PREFERENCES_STORAGE_KEY}')||'{}');
var m=p.theme||'system';
var dark=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
r.classList.toggle('dark',!!dark);
r.style.setProperty('--comaxe-text-size',({small:'14px',normal:'16px',large:'18px'})[p.textSize]||'16px');
r.style.setProperty('--comaxe-font',p.fontFamily==='inter'?"'Inter','Plus Jakarta Sans',sans-serif":"'Plus Jakarta Sans','Inter',sans-serif");
if(p.locale==='fr'||p.locale==='en')r.lang=p.locale;
}catch(e){}})();`;
