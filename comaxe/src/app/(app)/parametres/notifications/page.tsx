'use client';

import React from 'react';
import {
  Bell,
  BellRing,
  PackageSearch,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCommerce } from '@/context/CommerceContext';
import { usePreferences } from '@/context/PreferencesContext';
import { SettingsLayout, SettingsSection } from '@/components/settings/SettingsLayout';
import type { UserPreferences } from '@/lib/prefs';

function Toggle({
  checked,
  onChange,
  label,
  description,
  badge,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-800">{label}</p>
          {badge && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-100">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 max-w-lg">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/30 ${
          checked ? 'bg-[#1E5BF8]' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const { prefs, update, status } = usePreferences();
  const { products, debts, filteredSales } = useCommerce();

  const stockAlerts = products.filter((p) => p.status === 'stock_faible' || p.status === 'rupture').length;
  const activeDebts = debts.filter((d) => d.status !== 'payee').length;
  const todaySales = filteredSales.length;

  const rows: {
    key: keyof Pick<UserPreferences, 'notifyGeneral' | 'notifyStock' | 'notifyDebts' | 'notifyActivity'>;
    icon: LucideIcon;
    label: string;
    description: string;
    badge?: string;
  }[] = [
    {
      key: 'notifyGeneral',
      icon: Bell,
      label: t('Notifications générales', 'General notifications'),
      description: t(
        'Messages importants de COMAXE : mises à jour, rappels et informations du compte.',
        'Important COMAXE messages: updates, reminders and account information.'
      ),
    },
    {
      key: 'notifyStock',
      icon: PackageSearch,
      label: t('Alertes de stock', 'Stock alerts'),
      description: t(
        'Produits en rupture ou bientôt en rupture de stock.',
        'Products out of stock or running low.'
      ),
      badge: `${stockAlerts} ${t('en alerte', 'alerting')}`,
    },
    {
      key: 'notifyDebts',
      icon: Wallet,
      label: t('Alertes sur les dettes', 'Debt alerts'),
      description: t(
        'Dettes clients non soldées et échéances à relancer.',
        'Outstanding customer debts and dues to follow up.'
      ),
      badge: `${activeDebts} ${t('en cours', 'open')}`,
    },
    {
      key: 'notifyActivity',
      icon: TrendingUp,
      label: t('Activités importantes', 'Important activity'),
      description: t(
        'Résumé de l’activité commerciale : ventes et encaissements du jour.',
        'Business activity summary: today’s sales and collections.'
      ),
      badge: `${todaySales} ${t('vente(s)', 'sale(s)')}`,
    },
  ];

  const enabledCount = rows.filter((r) => prefs[r.key]).length;

  return (
    <SettingsLayout>
      <SettingsSection
        icon={BellRing}
        title={t('Préférences de notification', 'Notification preferences')}
        description={t(
          'Choisissez les alertes à recevoir. Chaque choix est enregistré dans votre compte.',
          'Choose which alerts to receive. Every choice is stored on your account.'
        )}
        action={
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${
              status === 'saved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : status === 'error'
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {status === 'saved'
              ? t('Enregistré', 'Saved')
              : status === 'error'
                ? t('Échec', 'Failed')
                : `${enabledCount} / ${rows.length}`}
          </span>
        }
      >
        <div>
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.key} className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8] shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <Toggle
                    checked={prefs[row.key]}
                    onChange={(v) => update(row.key, v)}
                    label={row.label}
                    description={row.description}
                    badge={row.badge}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Sparkles}
        title={t('À propos des alertes', 'About alerts')}
        description={t(
          'Les compteurs affichés sont calculés sur vos données réelles du moment.',
          'The counters shown are computed from your actual current data.'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: t('Produits en alerte', 'Products alerting'), value: stockAlerts },
            { label: t('Dettes en cours', 'Open debts'), value: activeDebts },
            { label: t('Ventes (date active)', 'Sales (active date)'), value: todaySales },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3"
            >
              <p className="text-xl font-extrabold text-slate-900">{s.value}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
