'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Database,
  LifeBuoy,
  LogOut,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useAuth } from '@/context/AuthContext';
import { useBilling } from '@/context/BillingContext';
import { getPlan } from '@/lib/billing/plans.config';
import { SettingsButton } from '@/components/settings/SettingsLayout';
import type { LucideIcon } from 'lucide-react';

interface Category {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Petit état affiché sous le titre (statut réel, pas décoratif) */
  status?: () => string | null;
}

export default function ParametresPage() {
  const { t } = useI18n();
  const { prefs } = usePreferences();
  const { signOut } = useAuth();
  const { planId } = useBilling();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  const themeLabel = {
    system: t('Thème : Système', 'Theme: System'),
    light: t('Thème : Clair', 'Theme: Light'),
    dark: t('Thème : Sombre', 'Theme: Dark'),
  };

  const categories: Category[] = [
    {
      href: '/parametres/compte',
      icon: UserRound,
      title: t('Compte', 'Account'),
      description: t(
        'Identité du compte, informations personnelles, session et déconnexion.',
        'Account identity, personal details, session and sign out.'
      ),
    },
    {
      href: '/parametres/abonnement',
      icon: CreditCard,
      title: t('Abonnement', 'Subscription'),
      description: t(
        'Offre actuelle, statut de l’abonnement et démarrage d’un abonnement.',
        'Current plan, subscription status and getting started.'
      ),
      status: () => {
        const def = getPlan(planId ?? 'essential');
        return def.priceMonthly === 0
          ? t('Gratuit · 0 $', 'Free · $0')
          : `${def.name} · ${def.priceMonthly} $ / mois`;
      },
    },
    {
      href: '/parametres/affichage',
      icon: Palette,
      title: t('Affichage', 'Appearance'),
      description: t(
        'Thème clair ou sombre, police, taille du texte et langue.',
        'Light or dark theme, font, text size and language.'
      ),
      status: () => themeLabel[prefs.theme],
    },
    {
      href: '/parametres/notifications',
      icon: Bell,
      title: t('Notifications', 'Notifications'),
      description: t(
        'Alertes de stock, dettes et activités importantes.',
        'Stock alerts, debts and important activity.'
      ),
      status: () => {
        const n = [prefs.notifyGeneral, prefs.notifyStock, prefs.notifyDebts, prefs.notifyActivity].filter(Boolean).length;
        return n === 0 ? t('Toutes coupées', 'All off') : `${n} / 4`;
      },
    },
    {
      href: '/parametres/securite',
      icon: ShieldCheck,
      title: t('Sécurité', 'Security'),
      description: t(
        'Mot de passe, sessions actives et déconnexion des appareils.',
        'Password, active sessions and signing out other devices.'
      ),
    },
    {
      href: '/parametres/donnees',
      icon: Database,
      title: t('Données', 'Data'),
      description: t(
        'Exporter, gérer et supprimer vos données commerciales.',
        'Export, manage and delete your business data.'
      ),
    },
    {
      href: '/parametres/aide',
      icon: LifeBuoy,
      title: t('Aide et support', 'Help & support'),
      description: t(
        'Centre d’aide, contact du support et informations COMAXE.',
        'Help centre, support contact and COMAXE information.'
      ),
    },
  ];

  return (
    <div className="max-w-[1100px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map(({ href, icon: Icon, title, description, status }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 hover:border-[#1E5BF8]/40 hover:shadow-md transition-all"
          >
            <div className="p-2 rounded-xl bg-blue-50 text-[#1E5BF8] group-hover:bg-[#1E5BF8] group-hover:text-white transition-colors shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1E5BF8] group-hover:translate-x-0.5 transition-all ml-auto shrink-0" />
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
              {status && status() && (
                <span className="inline-block mt-2 text-[11px] font-bold text-[#1E5BF8] bg-blue-50 px-2 py-0.5 rounded-full">
                  {status()}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Déconnexion — coin inférieur droit */}
      <div className="mt-6 flex justify-end">
        <SettingsButton variant="danger" onClick={handleLogout} disabled={loggingOut}>
          <LogOut className={`w-4 h-4 ${loggingOut ? 'animate-spin' : ''}`} />
          {loggingOut ? t('Déconnexion…', 'Signing out…') : t('Se déconnecter', 'Sign out')}
        </SettingsButton>
      </div>
    </div>
  );
}
