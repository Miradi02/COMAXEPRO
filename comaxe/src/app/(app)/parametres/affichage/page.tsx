'use client';

import React from 'react';
import { Baseline, Check, Languages, Monitor, Moon, Palette, Sun, Type } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { usePreferences } from '@/context/PreferencesContext';
import { SettingsLayout, SettingsSection } from '@/components/settings/SettingsLayout';
import type { FontFamily, LocalePref, TextSize, ThemeMode } from '@/lib/prefs';

/** Pastille d'option sélectionnable (choix immédiat, sans bouton « Sauvegarder ») */
function Option({
  active,
  onClick,
  icon,
  title,
  subtitle,
  preview,
  previewStyle,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  preview?: React.ReactNode;
  previewStyle?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${
        active
          ? 'border-[#1E5BF8] bg-blue-50/60 ring-2 ring-[#1E5BF8]/15'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            active ? 'border-[#1E5BF8] bg-[#1E5BF8]' : 'border-slate-300 bg-white'
          }`}
        >
          {active && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {icon}
            {title}
          </span>
          {subtitle && <span className="block text-xs text-slate-500 mt-0.5">{subtitle}</span>}
          {preview && (
            <span
              className="block mt-3 rounded-xl bg-white border border-slate-200 px-3 py-2 text-slate-800"
              style={previewStyle}
            >
              {preview}
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

export default function AffichagePage() {
  const { t } = useI18n();
  const { prefs, resolvedTheme, update } = usePreferences();

  const isDark = prefs.theme === 'system' ? resolvedTheme === 'dark' : prefs.theme === 'dark';

  const themes: { key: ThemeMode; icon: React.ReactNode; title: string; subtitle: string }[] = [
    {
      key: 'system',
      icon: <Monitor className="w-4 h-4 text-[#1E5BF8]" />,
      title: t('Système', 'System'),
      subtitle: t(
        'Suit automatiquement le thème de votre ordinateur.',
        'Automatically follows your computer theme.'
      ),
    },
    {
      key: 'light',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      title: t('Clair', 'Light'),
      subtitle: t('Toujours clair, quel que soit le système.', 'Always light, whatever the system uses.'),
    },
    {
      key: 'dark',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      title: t('Sombre', 'Dark'),
      subtitle: t('Toujours sombre, quel que soit le système.', 'Always dark, whatever the system uses.'),
    },
  ];

  const fonts: { key: FontFamily; label: string; stack: string }[] = [
    { key: 'jakarta', label: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans', sans-serif" },
    { key: 'inter', label: 'Inter', stack: "'Inter', sans-serif" },
  ];

  const sizes: { key: TextSize; label: string; px: string; sample: string }[] = [
    { key: 'small', label: t('Petite', 'Small'), px: '14px', sample: 'Aa' },
    { key: 'normal', label: t('Normale', 'Normal'), px: '16px', sample: 'Aa' },
    { key: 'large', label: t('Grande', 'Large'), px: '18px', sample: 'Aa' },
  ];

  const languages: { key: LocalePref; title: string; subtitle: string }[] = [
    {
      key: 'auto',
      title: t('Automatique', 'Automatic'),
      subtitle: t('Selon le navigateur', 'Based on browser'),
    },
    { key: 'fr', title: 'Français', subtitle: t('Interface en français', 'Interface in French') },
    { key: 'en', title: 'English', subtitle: t('Interface en anglais', 'Interface in English') },
  ];

  return (
    <SettingsLayout>
      {/* ── THÈME ── */}
      <SettingsSection
        icon={Palette}
        title={t('Thème', 'Theme')}
        description={t(
          'Appliqué immédiatement à toute l’application, page de connexion comprise.',
          'Applied immediately across the whole app, including the sign-in page.'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themes.map((th) => (
            <Option
              key={th.key}
              active={prefs.theme === th.key}
              onClick={() => update('theme', th.key)}
              icon={th.icon}
              title={th.title}
              subtitle={th.subtitle}
            />
          ))}
        </div>

        {/* Aperçu du thème choisi */}
        <div
          className={`mt-4 rounded-2xl border p-4 transition-colors ${
            isDark ? 'bg-[#0B1220] border-[#25314A]' : 'bg-[#F8F9FD] border-slate-200'
          }`}
        >
          <div
            className={`rounded-xl border p-3 ${
              isDark ? 'bg-[#111A2C] border-[#25314A]' : 'bg-white border-slate-200/80'
            }`}
          >
            <p className="text-sm font-bold text-slate-900">{t('Aperçu', 'Preview')}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('Carte de démonstration dans le thème sélectionné.', 'Sample card in the selected theme.')}
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* ── POLICE ── */}
      <SettingsSection
        icon={Type}
        title={t('Police', 'Font')}
        description={t(
          'Deux polices sont chargées par COMAXE. Aperçu avant sélection.',
          'COMAXE loads two fonts. Preview before choosing.'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fonts.map((f) => (
            <Option
              key={f.key}
              active={prefs.fontFamily === f.key}
              onClick={() => update('fontFamily', f.key)}
              title={f.label}
              subtitle={
                f.key === 'jakarta'
                  ? t('Police par défaut de COMAXE', 'COMAXE default font')
                  : t('Alternante plus compacte', 'More compact alternative')
              }
              preview={
                <span style={{ fontFamily: f.stack }}>
                  {t('Gérez vos ventes et votre stock', 'Manage your sales and stock')}
                </span>
              }
            />
          ))}
        </div>
      </SettingsSection>

      {/* ── TAILLE DU TEXTE ── */}
      <SettingsSection
        icon={Baseline}
        title={t('Taille du texte', 'Text size')}
        description={t(
          'Redimensionne l’ensemble de l’interface pour plus de confort.',
          'Rescales the whole interface for more comfort.'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sizes.map((s) => (
            <Option
              key={s.key}
              active={prefs.textSize === s.key}
              onClick={() => update('textSize', s.key)}
              title={s.label}
              subtitle={s.px}
              preview={
                <span className="text-slate-800" style={{ fontSize: s.px }}>
                  {t('Ventes du jour', 'Today’s sales')}
                </span>
              }
            />
          ))}
        </div>
      </SettingsSection>

      {/* ── LANGUE ── */}
      <SettingsSection
        icon={Languages}
        title={t('Langue', 'Language')}
        description={t(
          'Langue de l’interface. Appliquée immédiatement à toutes les pages.',
          'Interface language. Applied immediately on every page.'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {languages.map((lg) => (
            <Option
              key={lg.key}
              active={prefs.locale === lg.key}
              onClick={() => update('locale', lg.key)}
              title={lg.title}
              subtitle={lg.subtitle}
            />
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
