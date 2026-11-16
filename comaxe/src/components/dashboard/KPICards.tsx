'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, TrendingUp, Receipt, PackageCheck, Wallet, Lock, ArrowRight } from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { isWithinHistory } from '@/lib/billing/entitlements';
import { historyLockedMessage, type LocalizedMessage } from '@/lib/billing/messages';

export function KPICards() {
  const {
    todaySalesTotal,
    todayExpensesTotal,
    todayProfitTotal,
    todaySalesCount,
    totalStockValue,
    totalStockCount,
    totalDebtRemaining,
    activeDebtsCount,
    displayDateText,
    selectedDate,
    formatAmount,
  } = useCommerce();
  const { planId } = useBilling();
  const { t, locale } = useI18n();

  const isFiltered = Boolean(selectedDate && selectedDate !== 'today');
  const dateSuffix = isFiltered ? ` (${displayDateText})` : ' ' + t("Aujourd'hui", 'Today');

  // ── Verrous d'historique (Bénéfice / Dépenses) ──
  // Règle existante appliquée à la date AFFICHÉE : hors fenêtre du plan,
  // la carte bascule sur un verrou (message centralisé + offre) sans
  // AUCUN montant. `planId === null` (abonnement pas encore résolu) →
  // aucun blocage prématuré. Aujourd'hui est toujours dans la fenêtre.
  const activeDateEnd = isFiltered ? `${selectedDate}T23:59:59.999` : null;
  const profitLocked =
    planId !== null && activeDateEnd !== null && !isWithinHistory(planId, 'profit', activeDateEnd);
  const expenseLocked =
    planId !== null && activeDateEnd !== null && !isWithinHistory(planId, 'expense', activeDateEnd);

  const lockMessage = (key: 'profit' | 'expense'): string => {
    const m: LocalizedMessage = historyLockedMessage(planId ?? 'essential', key);
    return locale === 'en' ? m.en : m.fr;
  };

  const LockAmount = ({ message }: { message: string }) => (
    <div className="my-3 flex items-start gap-2">
      <span className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0">
        <Lock className="w-4 h-4" />
      </span>
      <span className="text-xs font-semibold leading-snug text-slate-500">{message}</span>
    </div>
  );

  const LockCta = () => (
    <Link
      href="/tarifs"
      className="inline-flex items-center gap-1 text-xs font-bold text-[#1E5BF8] hover:text-[#1548CF] transition-colors"
    >
      {t('Voir les offres', 'See plans')}
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
      {/* Carte 1: VENTES (Hero Blue vibrant) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#1E5BF8] text-white p-6 shadow-lg shadow-blue-600/20 flex flex-col justify-between min-h-[160px] group transition-transform hover:-translate-y-1 duration-200">
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <svg
            className="w-full h-full object-cover"
            viewBox="0 0 300 180"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon points="120,0 260,30 300,160 180,180" fill="white" fillOpacity="0.4" />
            <polygon points="200,20 320,80 270,190" fill="white" fillOpacity="0.3" />
            <path
              d="M-20 40 L160 120 L240 20"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.5"
            />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-xs">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-white/90">
              {isFiltered
                ? `${t('Ventes', 'Sales')} (${displayDateText})`
                : t('Ventes du jour', "Today's sales")}
            </span>
          </div>
          <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
            {t('{n} ventes', '{n} sales', { n: todaySalesCount })}
          </span>
        </div>

        <div className="relative z-10 my-3 flex items-baseline gap-3">
          <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {formatAmount(todaySalesTotal)}
          </span>
        </div>

        <div className="relative z-10 text-xs font-medium text-white/80">
          {t('Total encaissé dans le commerce', 'Total collected in the business')}
        </div>
      </div>

      {/* Carte 2: BÉNÉFICE */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-600">
              {t('Bénéfice Net', 'Net Profit')}{dateSuffix}
            </span>
          </div>
          <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {t('Marge réelle', 'Actual margin')}
          </span>
        </div>

        {profitLocked ? (
          <LockAmount message={lockMessage('profit')} />
        ) : (
          <div className="my-3 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatAmount(todayProfitTotal)}
            </span>
          </div>
        )}

        {profitLocked ? (
          <LockCta />
        ) : (
          <p className="text-xs text-slate-400">
            {t("Après déduction du coût d'achat et des charges", 'After deducting purchase cost and expenses')}
          </p>
        )}
      </div>

      {/* Carte 3: DÉPENSES */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-600">
              {t('Dépenses', 'Expenses')}{dateSuffix}
            </span>
          </div>
          <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {t('Charges', 'Costs')}
          </span>
        </div>

        {expenseLocked ? (
          <LockAmount message={lockMessage('expense')} />
        ) : (
          <div className="my-3 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatAmount(todayExpensesTotal)}
            </span>
          </div>
        )}

        {expenseLocked ? (
          <LockCta />
        ) : (
          <p className="text-xs text-slate-400">
            {t('Approvisionnement, transport & frais', 'Supplies, transport & fees')}
          </p>
        )}
      </div>

      {/* Carte 4: VALEUR DU STOCK */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <PackageCheck className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-600">
              {t('Valeur du Stock', 'Stock Value')}
            </span>
          </div>
          <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8]">
            {t('{n} articles', '{n} items', { n: totalStockCount })}
          </span>
        </div>

        <div className="my-3 flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(totalStockValue)}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          {t('Total marchandises disponibles', 'Total goods available')}
        </p>
      </div>

      {/* Carte 5: DETTES À RECOUVRER */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-slate-600">
              {t('Dettes en Cours', 'Open Debts')}
            </span>
          </div>
          <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            {t('{n} dossiers', '{n} records', { n: activeDebtsCount })}
          </span>
        </div>

        <div className="my-3 flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(totalDebtRemaining)}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          {t('Créances clients à récupérer', 'Customer receivables to collect')}
        </p>
      </div>
    </div>
  );
}
