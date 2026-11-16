'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Menu,
  Plus,
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  RotateCcw,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppShell } from '@/context/AppShellContext';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getDisplayDateLabel } from '@/lib/dateUtils';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { openMobileMenu, headerAction } = useAppShell();
  const { selectedDate, setSelectedDate, displayDateText } = useCommerce();
  const { t, locale } = useI18n();

  // Presets dynamiques pour le sélecteur global : Aujourd'hui + 5 jours précédents réels
  const dynamicDatePresets = useMemo(() => {
    const presets: { key: string; label: string; isToday?: boolean }[] = [
      {
        key: 'today',
        label: t("Aujourd'hui", 'Today'),
        isToday: true,
      },
    ];

    const now = new Date();
    for (let offset = 1; offset <= 5; offset++) {
      const d = new Date();
      d.setDate(now.getDate() - offset);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${day}`;
      const readable = getDisplayDateLabel(key, locale);

      const label =
        offset === 1
          ? locale === 'en'
            ? `Yesterday (${readable})`
            : `Hier (${readable})`
          : readable;

      presets.push({ key, label });
    }
    return presets;
  }, [locale, t]);

  // Métadonnées de routes (traduites à chaque rendu selon la langue)
  const ROUTE_INFO: Record<
    string,
    { title: string; subtitle: string; actionLabel?: string; defaultActionUrl?: string }
  > = {
    // Dashboard : consultation seule — aucun bouton d'enregistrement de vente ici
    '/dashboard': {
      title: t('Tableau de Bord Commercial', 'Business Dashboard'),
      subtitle: t(
        'Suivez les ventes, le stock, les clients et les dépenses de votre boutique',
        'Track sales, inventory, customers and expenses of your store'
      ),
    },
    '/ventes': {
      title: t('Gestion des Ventes', 'Sales Management'),
      subtitle: t(
        'Enregistrez et consultez toutes les opérations commerciales de votre boutique',
        'Record and review all business operations of your store'
      ),
      actionLabel: t('Enregistrer une Vente', 'Record a Sale'),
    },
    '/stock': {
      title: t('Produits & Stock', 'Products & Stock'),
      subtitle: t(
        "Gérez l'inventaire, les quantités disponibles et les alertes d'approvisionnement",
        'Manage inventory, available quantities and restock alerts'
      ),
      actionLabel: t('Ajouter un Produit', 'Add a Product'),
    },
    '/clients': {
      title: t('Gestion des Clients', 'Customer Management'),
      subtitle: t(
        "Base de clients, soldes impayés et historique d'achats",
        'Customer database, outstanding balances and purchase history'
      ),
      actionLabel: t('Nouveau Client', 'New Customer'),
    },
    '/depenses': {
      title: t('Dépenses du Commerce', 'Business Expenses'),
      subtitle: t(
        'Enregistrez les charges réelles (loyer, transport, approvisionnement, électricité)',
        'Record real costs (rent, transport, supplies, electricity)'
      ),
      actionLabel: t('Enregistrer une Dépense', 'Record an Expense'),
    },
    '/benefice': {
      title: t('Bénéfice Réel du Commerce', 'Real Business Profit'),
      subtitle: t(
        'Calcul automatisé de ce que votre commerce vous rapporte réellement',
        'Automatic calculation of what your business actually earns you'
      ),
      actionLabel: t('Enregistrer une Vente', 'Record a Sale'),
    },
    '/dettes': {
      title: t('Suivi des Dettes & Créances', 'Debts & Receivables Tracking'),
      subtitle: t(
        'Enregistrez et suivez les créances clients et historique de remboursement',
        'Record and track customer receivables and repayment history'
      ),
      actionLabel: t('Nouvelle Dette', 'New Debt'),
    },
    '/analytique': {
      title: t('Analytique Commerciale', 'Business Analytics'),
      subtitle: t(
        'Comprenez en profondeur la croissance et la rentabilité de votre commerce',
        'Deeply understand your business growth and profitability'
      ),
      actionLabel: t('Enregistrer une Vente', 'Record a Sale'),
    },
    '/rapports': {
      title: t('Rapports & Clôtures', 'Reports & Closings'),
      subtitle: t(
        'Exportez et consultez vos synthèses comptables et bilans périodiques',
        'Export and review your summaries and periodic statements'
      ),
      actionLabel: t('Nouveau Rapport', 'New Report'),
    },
    '/objectifs': {
      title: t('Objectifs Commerciaux', 'Business Goals'),
      subtitle: t(
        "Définissez et suivez vos paliers de chiffre d'affaires et de marge",
        'Set and track your revenue and margin milestones'
      ),
      actionLabel: t('Nouvel Objectif', 'New Goal'),
    },
    '/parametres': {
      title: t('Paramètres', 'Settings'),
      subtitle: t(
        'Centre de configuration de votre compte et de COMAXE',
        'Account and COMAXE configuration centre'
      ),
    },
    '/parametres/compte': {
      title: t('Identité du compte', 'Account identity'),
      subtitle: t(
        'Informations personnelles liées à votre compte COMAXE',
        'Personal information linked to your COMAXE account'
      ),
    },
    '/parametres/abonnement': {
      title: t('Abonnement', 'Subscription'),
      subtitle: t(
        'Votre offre COMAXE et son statut',
        'Your COMAXE plan and its status'
      ),
    },
    '/parametres/affichage': {
      title: t('Affichage', 'Appearance'),
      subtitle: t(
        'Thème, police, taille du texte et langue',
        'Theme, font, text size and language'
      ),
    },
    '/parametres/notifications': {
      title: t('Notifications', 'Notifications'),
      subtitle: t(
        'Choisissez les alertes que vous souhaitez recevoir',
        'Choose which alerts you want to receive'
      ),
    },
    '/parametres/securite': {
      title: t('Sécurité', 'Security'),
      subtitle: t(
        'Mot de passe et sessions de votre compte',
        'Password and sessions of your account'
      ),
    },
    '/parametres/donnees': {
      title: t('Données', 'Data'),
      subtitle: t(
        'Exporter, gérer et supprimer vos données commerciales',
        'Export, manage and delete your business data'
      ),
    },
    '/parametres/aide': {
      title: t('Aide et support', 'Help & support'),
      subtitle: t(
        'Centre d’aide, contact et informations COMAXE',
        'Help centre, contact and COMAXE information'
      ),
    },
  };

  const [isDateOpen, setIsDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentRouteMeta =
    ROUTE_INFO[pathname] ||
    (pathname.startsWith('/clients/')
      ? {
          title: t('Profil Client', 'Customer Profile'),
          subtitle: t('Détails et historique du compte client', 'Customer account details and history'),
          actionLabel: t('Nouvelle Vente', 'New Sale'),
        }
      : {
          title: t('Gestion Commerciale COMAXE', 'COMAXE Business Management'),
          subtitle: t('Plateforme de gestion pour commerçant', 'Management platform for merchants'),
          actionLabel: t('Enregistrer une Vente', 'Record a Sale'),
        });

  // Pages de configuration : ni bouton d'action principal, ni raccourcis
  // d'enregistrement — la page n'enregistre que des préférences.
  const isSettingsRoute = pathname === '/parametres' || pathname.startsWith('/parametres/');

  const handlePrimaryAction = () => {
    if (headerAction?.onClick) {
      headerAction.onClick();
      return;
    }

    if (pathname === '/ventes') {
      // Ouvre la modale d'enregistrement (mêmes 2 boutons = 1 seule action)
      const btn = document.querySelector('[data-add-sale-btn]') as HTMLButtonElement | null;
      if (btn) {
        btn.click();
      } else {
        const el = document.getElementById('recent-sales-table');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (pathname === '/stock') {
      const btn = document.querySelector('[data-add-product-btn]') as HTMLButtonElement | null;
      if (btn) btn.click();
    } else if (pathname === '/depenses') {
      const btn = document.querySelector('[data-add-expense-btn]') as HTMLButtonElement | null;
      if (btn) btn.click();
    } else if (pathname === '/clients') {
      const btn = document.querySelector('[data-add-client-btn]') as HTMLButtonElement | null;
      if (btn) btn.click();
    } else if (pathname === '/dettes') {
      const btn = document.querySelector('[data-add-debt-btn]') as HTMLButtonElement | null;
      if (btn) btn.click();
    } else {
      router.push('/ventes');
    }
  };

  // Retour depuis les pages Paramètres (mobile/tablette) vers l'application.
  // Historique présent → retour natif ; sinon → tableau de bord.
  const handleBackToApp = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };

  const actionLabel = headerAction?.label || currentRouteMeta.actionLabel;
  const isCustomDateActive = selectedDate && selectedDate !== 'today';

  // EN-TÊTE COMPACT mobile/tablette : UNE seule ligne de raccourcis
  // (☰ ⚙️ à gauche · raccourcis + CTA à droite), tailles réduites sous lg,
  // valeurs d'origine exactes à partir de lg (desktop strictement inchangé).
  return (
    <header className="sticky top-0 z-30 bg-[#F8F9FD]/90 backdrop-blur-md px-4 sm:px-8 py-2.5 lg:py-4 transition-all">
      <div className="flex items-center justify-between gap-2 sm:gap-3 lg:gap-4">
        {/* Left Side: Mobile Menu */}
        <div className="flex items-center gap-2 lg:gap-2.5 flex-1 max-w-md">
          {isSettingsRoute ? (
            /* Paramètres (mobile/tablette) = page dédiée : plus de hamburger
               ni de raccourcis — retour clair vers l'application normale.
               Desktop : rien (lg:hidden, sidebar desktop inchangée). */
            <button
              onClick={handleBackToApp}
              className="lg:hidden flex items-center gap-1.5 p-2 pr-3 lg:p-2.5 lg:pr-3.5 rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-colors"
              aria-label={t("Retour à l'application", 'Back to the app')}
            >
              <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="text-xs lg:text-sm font-bold">
                {t('Retour', 'Back')}
              </span>
            </button>
          ) : (
            /* Hamburger (Mobile/Tablette only) — le ⚙️ est désormais à DROITE */
            <button
              onClick={openMobileMenu}
              className="lg:hidden p-2 lg:p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs"
              aria-label={t('Ouvrir le menu', 'Open menu')}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Right Side: Main CTA + Paramètres — sur la MÊME ligne que ☰ */}
        <div className="flex items-center justify-end gap-2 lg:gap-3 flex-wrap">
          {/* Primary Action Button (absent du Dashboard : les ventes s'y consultent seulement) */}
          {actionLabel && (
            <button
              onClick={handlePrimaryAction}
              className="flex items-center gap-1.5 lg:gap-2 px-2.5 py-2 lg:px-4 lg:py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs lg:text-sm font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="whitespace-nowrap">{actionLabel}</span>
            </button>
          )}

          {/* Paramètres (TOUS formats) — en haut à droite, niveau de ☰.
              Absent des pages Paramètres (retour ↵ gère la navigation). */}
          {!isSettingsRoute && (
            <Link
              href="/parametres"
              prefetch={true}
              title={t('Paramètres', 'Settings')}
              aria-label={t('Paramètres', 'Settings')}
              className="p-2 lg:p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-600 hover:text-[#1E5BF8] hover:bg-blue-50/50 shadow-xs transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Sub-header Controls Bar (Title + Global Date Filter) — le calendrier
          est calé à DROITE sur tous les formats, y compris le téléphone. */}
      <div className="flex items-start sm:items-center justify-between gap-2 lg:gap-3 mt-3 lg:mt-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {currentRouteMeta.title}
            </h1>
            {isCustomDateActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#1E5BF8] border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E5BF8] animate-pulse" />
                {t('Filtre actif', 'Active filter')} : {displayDateText}
              </span>
            )}
          </div>
          <p className="text-xs lg:text-sm text-slate-500 mt-0.5">
            {currentRouteMeta.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 lg:gap-2.5 shrink-0 relative">
          {/* GLOBAL Date Selector with Popover — absent des pages Paramètres */}
          {!isSettingsRoute && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDateOpen(!isDateOpen)}
              aria-pressed={Boolean(isCustomDateActive)}
              className={`flex items-center gap-1.5 lg:gap-2 px-2.5 py-1.5 lg:px-3.5 lg:py-2 rounded-xl border text-xs lg:text-sm font-semibold shadow-xs transition-all ${
                isCustomDateActive
                  ? 'bg-blue-50 text-[#1E5BF8] border-blue-300 ring-2 ring-blue-500/10'
                  : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
              }`}
              title={t('Sélecteur de date global pour tout COMAXE', 'Global date picker for the whole COMAXE app')}
            >
              <CalendarIcon className={`w-3.5 h-3.5 ${isCustomDateActive ? 'text-[#1E5BF8]' : 'text-slate-400'}`} />
              <span className="font-bold">📅 {displayDateText}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Date Dropdown Popover */}
            {isDateOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3 z-50 space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t('Date Active Globale', 'Global Active Date')}
                  </span>
                  {isCustomDateActive && (
                    <button
                      onClick={() => {
                        setSelectedDate('today');
                        setIsDateOpen(false);
                      }}
                      className="text-[11px] font-bold text-[#1E5BF8] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {t("Aujourd'hui", 'Today')}
                    </button>
                  )}
                </div>

                {/* Quick Presets : Aujourd'hui + 5 jours précédents réels */}
                <div className="space-y-1">
                  {dynamicDatePresets.map((preset) => {
                    const isSelected = preset.isToday
                      ? !selectedDate || selectedDate === 'today'
                      : selectedDate === preset.key;

                    return (
                      <button
                        key={preset.key}
                        onClick={() => {
                          setSelectedDate(preset.key);
                          setIsDateOpen(false);
                        }}
                        aria-pressed={isSelected}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-[#1E5BF8] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">📅 {preset.label}</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#1E5BF8] shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Input */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">
                    {t('Choisir une date précise :', 'Pick a specific date:')}
                  </label>
                  <input
                    type="date"
                    value={
                      selectedDate && selectedDate !== 'today' ? selectedDate : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        setIsDateOpen(false);
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>

                <div className="pt-1 text-[11px] text-slate-400 text-center">
                  {t(
                    "La date sélectionnée s'applique à tout COMAXE",
                    'The selected date applies to the whole COMAXE app'
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </header>
  );
}
