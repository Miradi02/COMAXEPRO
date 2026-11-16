'use client';

/**
 * COMAXE — Barre de navigation inférieure (mobile & tablette uniquement).
 *
 * Règles métier (demande utilisateur — refonte navigation responsive) :
 *   • TÉLÉPHONE (< 768 px) : 3 items — Dashboard · Ventes · Stock ;
 *   • TABLETTE (≥ 768 px, < 1024 px) : 4 items — + Dépenses ;
 *   • DESKTOP (≥ 1024 px) : composant totalement masqué (`lg:hidden`),
 *     la sidebar desktop existante reste la seule navigation ;
 *   • état actif TRÈS visible : capsule bleue + icône/texte accent `#1E5BF8`
 *     + graisse supérieure (jamais un simple changement subtil) ;
 *   • pages secondaires (Clients, Objectifs, Analytique…) restent accessibles
 *     via le hamburger du Header — aucune page dupliquée ;
 *   • routes Paramètres : la barre est masquée (page dédiée, retour géré
 *     par le bouton ← du Header) ;
 *   • safe-area Android/iOS : `env(safe-area-inset-bottom)` ;
 *   • la barre est légère (aucun fetch, icônes lucide déjà installées).
 *
 * Design system COMAXE : surface `bg-white`, bordure `border-slate-200/80`,
 * accent `#1E5BF8`, icônes `lucide-react`, dark mode géré par les règles
 * globales de `globals.css` (`.dark .bg-white`, `.dark .text-[#1E5BF8]`…).
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Receipt } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

interface BottomNavItem {
  href: string;
  /** Libellé FR */
  label: string;
  /** Libellé EN */
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Affiché aussi sur tablette (4ᵉ item) — masqué sur téléphone */
  tabletOnly?: boolean;
}

const ITEMS: BottomNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', labelEn: 'Dashboard', icon: LayoutDashboard },
  { href: '/ventes', label: 'Ventes', labelEn: 'Sales', icon: ShoppingBag },
  { href: '/stock', label: 'Stock', labelEn: 'Stock', icon: Package },
  { href: '/depenses', label: 'Dépenses', labelEn: 'Expenses', icon: Receipt, tabletOnly: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  // Page Paramètres = page dédiée : ni barre inférieure, ni doublon de nav.
  const isSettingsRoute =
    pathname === '/parametres' || pathname.startsWith('/parametres/');
  if (isSettingsRoute) return null;

  // Même logique d'activation que la Sidebar desktop (cohérence garantie).
  const isItemActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      data-bottom-nav
      aria-label={t('Navigation principale', 'Main navigation')}
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white border-t border-slate-200/80 shadow-[0_-6px_20px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5 pb-1">
        {ITEMS.map((item) => {
          const active = isItemActive(item.href);
          const Icon = item.icon;
          const label = item.labelEn === item.label ? item.label : t(item.label, item.labelEn);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex-col items-center justify-center gap-1 min-w-0 py-1 rounded-2xl transition-colors duration-150 ${
                // 4ᵉ item (Dépenses) : masqué sur téléphone, visible ≥ 768 px.
                // Aucune classe `flex` en commun pour éviter tout conflit.
                item.tabletOnly ? 'hidden md:flex' : 'flex'
              } ${
                active
                  ? 'text-[#1E5BF8]'
                  : 'text-slate-500 hover:text-slate-700 active:text-slate-900'
              }`}
            >
              {/* Capsule d'état actif : marqueur visuel fort */}
              <span
                className={`flex items-center justify-center h-7 px-4 rounded-full transition-colors duration-150 ${
                  active ? 'bg-blue-50/90' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </span>
              <span
                className={`text-[11px] leading-none truncate max-w-full px-0.5 ${
                  active ? 'font-extrabold' : 'font-semibold'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
