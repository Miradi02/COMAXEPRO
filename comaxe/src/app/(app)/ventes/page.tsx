'use client';

import React from 'react';
import { RecentSalesTable } from '@/components/dashboard/RecentSalesTable';
import { SalesHistory } from '@/components/dashboard/SalesHistory';
import { ShoppingBag, TrendingUp, Calendar } from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';

export default function VentesPage() {
  const { sales, filteredSales, displayDateText, formatAmount } = useCommerce();
  const { t } = useI18n();

  const totalAllSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const avgBasket = sales.length > 0 ? Math.round(totalAllSales / sales.length) : 0;
  const activeDateTotal = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Ventes Enregistrées (Total)', 'Recorded Sales (Total)')}
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(totalAllSales)}
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            {t('{n} transactions enregistrées dans COMAXE', '{n} transactions recorded in COMAXE', { n: sales.length })}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Panier Moyen', 'Average Basket')}
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(avgBasket)}
          </p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {t("Moyenne sur l'ensemble des encaissements", 'Average across all collections')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Ventes ({d})', 'Sales ({d})', { d: displayDateText })}
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(activeDateTotal)}
          </p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {t(
              `${filteredSales.length} vente${filteredSales.length !== 1 ? 's' : ''} correspondant à la date active`,
              `${filteredSales.length} sale${filteredSales.length !== 1 ? 's' : ''} matching the active date`
            )}
          </p>
        </div>
      </div>

      {/* Ventes du jour / date active — logique calendrier inchangée */}
      <RecentSalesTable />

      {/* Historique complet : toutes les ventes, toutes dates */}
      <SalesHistory />
    </div>
  );
}
