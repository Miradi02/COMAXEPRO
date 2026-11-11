'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Receipt,
  CircleDollarSign,
  Wallet,
  TrendingUp,
  FileBarChart,
  Target,
  Settings,
  CreditCard,
  X,
  Store,
} from 'lucide-react';
import { useAppShell } from '@/context/AppShellContext';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { BrandLogo } from '@/components/BrandLogo';

export function Sidebar() {
  const pathname = usePathname();
  const { isMobileMenuOpen, closeMobileMenu } = useAppShell();
  const { userProfile, storeProfile, filteredSales, products, debts, getPeriodMetrics, formatAmount } = useCommerce();
  const { t } = useI18n();

  // Badges dynamiques : calculés sur les données RÉELLES du compte connecté
  // (aucune valeur codée en dur — chaque compte affiche sa propre activité)
  const salesCount = filteredSales.length; // ventes de la date active
  const stockAlertCount = products.filter((p) => p.status === 'stock_faible' || p.status === 'rupture').length;
  const monthlyNetProfit = getPeriodMetrics('mois').netProfitUSD;
  const activeDebtCount = debts.filter((d) => d.status !== 'payee').length;

  const isCurrentActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navItemClass = (isActive: boolean) =>
    `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${
      isActive
        ? 'bg-blue-50/90 text-[#1E5BF8] font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
    }`;

  const iconClass = (isActive: boolean) =>
    `w-4 h-4 shrink-0 ${isActive ? 'text-[#1E5BF8]' : 'text-slate-400'}`;

  return (
    <>
      {/* Mobile Backdrop - strictly visible only when drawer is open */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity cursor-pointer"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Persistent Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Section: Brand & Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin">
          {/* Logo & Close Button (Mobile) */}
          <div className="flex items-center justify-between px-2 mb-8">
            <Link
              href="/dashboard"
              prefetch={true}
              className="flex items-center gap-2.5 group"
            >
              {/* Logo officiel COMAXE (logo C en clair / logo S en sombre) */}
              <BrandLogo size={36} className="group-hover:scale-105 transition-transform" />
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 font-sans leading-none">
                  comaxe
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                  {t('Gestion Commerce', 'Business Management')}
                </span>
              </div>
            </Link>

            <button
              onClick={closeMobileMenu}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label={t('Fermer le menu', 'Close menu')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sections */}
          <nav className="space-y-6">
            {/* 1. SECTION: GÉNÉRAL */}
            <div>
              <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                {t('Général', 'General')}
              </p>
              <div className="space-y-1">
                {/* Dashboard */}
                <Link
                  href="/dashboard"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/dashboard'))}
                >
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className={iconClass(isCurrentActive('/dashboard'))} />
                    <span>Dashboard</span>
                  </div>
                </Link>

                {/* Ventes */}
                <Link
                  href="/ventes"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/ventes'))}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag className={iconClass(isCurrentActive('/ventes'))} />
                    <span>{t('Ventes', 'Sales')}</span>
                  </div>
                  {salesCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 text-[#1E5BF8]">
                      +{salesCount}
                    </span>
                  )}
                </Link>

                {/* Produits & Stock */}
                <Link
                  href="/stock"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/stock'))}
                >
                  <div className="flex items-center gap-3">
                    <Package className={iconClass(isCurrentActive('/stock'))} />
                    <span>{t('Produits & Stock', 'Products & Stock')}</span>
                  </div>
                  {stockAlertCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700">
                      {t(
                        `${stockAlertCount} alerte${stockAlertCount !== 1 ? 's' : ''}`,
                        `${stockAlertCount} alert${stockAlertCount !== 1 ? 's' : ''}`
                      )}
                    </span>
                  )}
                </Link>

                {/* Clients */}
                <Link
                  href="/clients"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/clients'))}
                >
                  <div className="flex items-center gap-3">
                    <Users className={iconClass(isCurrentActive('/clients'))} />
                    <span>Clients</span>
                  </div>
                </Link>

                {/* Dépenses */}
                <Link
                  href="/depenses"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/depenses'))}
                >
                  <div className="flex items-center gap-3">
                    <Receipt className={iconClass(isCurrentActive('/depenses'))} />
                    <span>{t('Dépenses', 'Expenses')}</span>
                  </div>
                </Link>

                {/* Bénéfice */}
                <Link
                  href="/benefice"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/benefice'))}
                >
                  <div className="flex items-center gap-3">
                    <CircleDollarSign className={iconClass(isCurrentActive('/benefice'))} />
                    <span>{t('Bénéfice', 'Profit')}</span>
                  </div>
                  {monthlyNetProfit > 0 && (
                    <span
                      className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 max-w-[88px] truncate"
                      title={`${t('Bénéfice net du mois', 'Net profit this month')} : ${formatAmount(monthlyNetProfit)}`}
                    >
                      {formatAmount(monthlyNetProfit)}
                    </span>
                  )}
                </Link>

                {/* Dettes */}
                <Link
                  href="/dettes"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/dettes'))}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className={iconClass(isCurrentActive('/dettes'))} />
                    <span>{t('Dettes', 'Debts')}</span>
                  </div>
                  {activeDebtCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700">
                      {t('{n} en cours', '{n} open', { n: activeDebtCount })}
                    </span>
                  )}
                </Link>
              </div>
            </div>

            {/* 2. SECTION: ANALYSE */}
            <div>
              <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                {t('Analyse', 'Analytics')}
              </p>
              <div className="space-y-1">
                {/* Analytique */}
                <Link
                  href="/analytique"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/analytique'))}
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className={iconClass(isCurrentActive('/analytique'))} />
                    <span>{t('Analytique', 'Analytics')}</span>
                  </div>
                </Link>

                {/* Rapports */}
                <Link
                  href="/rapports"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/rapports'))}
                >
                  <div className="flex items-center gap-3">
                    <FileBarChart className={iconClass(isCurrentActive('/rapports'))} />
                    <span>{t('Rapports', 'Reports')}</span>
                  </div>
                </Link>
              </div>
            </div>

            {/* 3. SECTION: GESTION */}
            <div>
              <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                {t('Gestion', 'Management')}
              </p>
              <div className="space-y-1">
                {/* Objectifs */}
                <Link
                  href="/objectifs"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/objectifs'))}
                >
                  <div className="flex items-center gap-3">
                    <Target className={iconClass(isCurrentActive('/objectifs'))} />
                    <span>{t('Objectifs', 'Goals')}</span>
                  </div>
                </Link>

                {/* Paramètres */}
                <Link
                  href="/parametres"
                  prefetch={true}
                  className={navItemClass(isCurrentActive('/parametres'))}
                >
                  <div className="flex items-center gap-3">
                    <Settings className={iconClass(isCurrentActive('/parametres'))} />
                    <span>{t('Paramètres', 'Settings')}</span>
                  </div>
                </Link>
              </div>
            </div>

            {/* 4. SECTION: AUTRE */}
            <div>
              <p className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                {t('Autre', 'More')}
              </p>
              <div className="space-y-1">
                {/* Fintech — Bientôt */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 cursor-not-allowed select-none bg-slate-50/60 border border-dashed border-slate-200/80"
                  title={t(
                    "Service de paiement et financement marchand en cours d'intégration",
                    'Payment and merchant financing service under integration'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-slate-300" />
                    <span className="text-slate-400">Fintech</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200/70 text-slate-500 uppercase tracking-wider">
                    {t('Bientôt', 'Soon')}
                  </span>
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* Bottom Section: Merchant Store Card */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E5BF8] flex items-center justify-center shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {`${userProfile.firstName} ${userProfile.lastName}`.trim()}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {storeProfile.storeName}
                </p>
              </div>
            </div>
            <div
              className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0"
              title={t('Système opérationnel', 'System operational')}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
