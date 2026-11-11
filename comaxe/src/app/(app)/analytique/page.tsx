'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Award,
  Flame,
  PieChart,
  Loader2,
} from 'lucide-react';
import { SalesEvolutionChart } from '@/components/dashboard/SalesEvolutionChart';
import { TopSellingProducts } from '@/components/dashboard/TopSellingProducts';
import { useCommerce } from '@/context/CommerceContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { FeatureLocked } from '@/components/billing/FeatureLocked';
import { isFeatureUnlocked } from '@/lib/billing/entitlements';
import { isWithinPeriodRange } from '@/lib/dateUtils';

type PeriodOption = '7j' | '30j' | '3m' | '6m' | '12m' | 'personnalise';

export default function AnalytiquePage() {
  const [periodFilter, setPeriodFilter] = useState<PeriodOption>('30j');
  const { sales, expenses, products, getPeriodMetrics, totalStockValue, formatAmount } = useCommerce();
  const { t } = useI18n();
  const { planId, loading: billingLoading } = useBilling();

  // Verrou fonctionnel : Analytique réservée aux offres qui la débloquent.
  const analyticsUnlocked = planId !== null && isFeatureUnlocked(planId, 'analytics');

  // Calculs 100% réels à partir de la source de vérité pour la période sélectionnée
  const periodData = useMemo(() => {
    return getPeriodMetrics(periodFilter);
  }, [periodFilter, getPeriodMetrics]);

  const periodSales = useMemo(() => {
    if (periodFilter === 'personnalise') return sales;
    return sales.filter((s) => isWithinPeriodRange(s.date, periodFilter));
  }, [sales, periodFilter]);

  const periodExpenses = useMemo(() => {
    if (periodFilter === 'personnalise') return expenses;
    return expenses.filter((e) => isWithinPeriodRange(e.date, periodFilter));
  }, [expenses, periodFilter]);

  // Rotation du stock réelle = Coût des marchandises vendues / Valeur du stock
  const stockRotationRate = useMemo(() => {
    if (totalStockValue <= 0) return '1.0×';
    const rate = Math.round((periodData.cogsUSD / totalStockValue) * 10) / 10;
    return `${Math.max(0.5, rate)}×`;
  }, [periodData.cogsUSD, totalStockValue]);

  // Répartition par mode de paiement dans la période
  const paymentBreakdown = useMemo(() => {
    const counts = { especes: 0, mobile_money: 0, carte: 0 };
    periodSales.forEach((s) => {
      counts[s.paymentMethod] = (counts[s.paymentMethod] || 0) + s.totalAmount;
    });
    const total = periodData.totalSalesUSD || 1;
    return [
      { label: t('Espèces', 'Cash'), amount: counts.especes, pct: Math.round((counts.especes / total) * 100) },
      { label: 'Mobile Money', amount: counts.mobile_money, pct: Math.round((counts.mobile_money / total) * 100) },
      { label: t('Carte Bancaire', 'Bank Card'), amount: counts.carte, pct: Math.round((counts.carte / total) * 100) },
    ];
  }, [periodSales, periodData.totalSalesUSD, t]);

  // Catégories les plus performantes dans la période
  const categoryBreakdown = useMemo(() => {
    const catMap = new Map<string, { revenue: number; profit: number }>();
    periodSales.forEach((s) => {
      s.items.forEach((it) => {
        const prod = products.find(
          (p) => (it.productId && p.id === it.productId) || p.name.toLowerCase() === it.productName.toLowerCase()
        );
        const cat = prod ? prod.category : t('Accessoires', 'Accessories');
        const cost = prod ? prod.purchasePrice : it.purchasePrice || it.unitPrice * 0.7;
        const profit = (it.unitPrice - cost) * it.quantity;

        const current = catMap.get(cat) || { revenue: 0, profit: 0 };
        current.revenue += it.total;
        current.profit += profit;
        catMap.set(cat, current);
      });
    });

    return Array.from(catMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        revenue: data.revenue,
        profit: data.profit,
        margin: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [periodSales, products, t]);

  // --- Verrous fonctionnels (repli si le middleware a laissé passer) ---
  if (billingLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E5BF8]" />
      </div>
    );
  }
  if (!analyticsUnlocked) {
    return (
      <div className="space-y-6">
        <FeatureLocked feature="analytics" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre de Filtre par Période */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#1E5BF8]" />
          <span className="text-xs font-bold text-slate-700">
            {t("Période d'analyse :", 'Analysis period:')}
          </span>
          <span className="text-xs text-slate-400">
            ({periodData.periodLabel})
          </span>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 flex-wrap gap-1">
          {([
            { key: '7j', label: t('7 jours', '7 days') },
            { key: '30j', label: t('30 jours', '30 days') },
            { key: '3m', label: t('3 mois', '3 months') },
            { key: '6m', label: t('6 mois', '6 months') },
            { key: '12m', label: t('12 mois', '12 months') },
            { key: 'personnalise', label: t('Personnalisé', 'Custom') },
          ] as const).map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodFilter(p.key)}
              className={`px-3 py-1 rounded-lg transition-all ${
                periodFilter === p.key
                  ? 'bg-white text-[#1E5BF8] font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cartes KPI Calculées en direct (Zéro multiplicateur arbitraire) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('Ventes Totales', 'Total Sales')}
          </span>
          <p className="text-3xl font-extrabold text-slate-900">
            {formatAmount(periodData.totalSalesUSD)}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {t('{n} ventes sur la période', '{n} sales in the period', { n: periodSales.length })}
          </span>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('Bénéfice Net', 'Net Profit')}
          </span>
          <p className="text-3xl font-extrabold text-slate-900">
            {formatAmount(periodData.netProfitUSD)}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {t('Marge commerciale {m}%', 'Commercial margin {m}%', { m: periodData.netMarginPercentage })}
          </span>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('Dépenses Décaissées', 'Expenses Paid')}
          </span>
          <p className="text-3xl font-extrabold text-slate-900">
            {formatAmount(periodData.expensesUSD)}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 mt-2">
            <TrendingDown className="w-3.5 h-3.5" />
            {t('{n} charges réelles', '{n} actual costs', { n: periodExpenses.length })}
          </span>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('Rotation du Stock', 'Stock Rotation')}
          </span>
          <p className="text-3xl font-extrabold text-slate-900">
            {stockRotationRate}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 mt-2">
            <Layers className="w-3.5 h-3.5" />
            {t('{n} références actives', '{n} active items', { n: products.length })}
          </span>
        </div>
      </div>

      {/* Graphiques et Produits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-8">
          <SalesEvolutionChart />
        </div>
        <div className="lg:col-span-4">
          <TopSellingProducts />
        </div>
      </div>

      {/* Détails complémentaires : Modes de paiement & Catégories réelles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
        {/* Modes de paiement */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <PieChart className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {t("Répartition des Modes d'Encaissement", 'Breakdown of Collection Methods')}
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            {paymentBreakdown.map((pm) => (
              <div key={pm.label} className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                <span className="font-bold text-slate-800">{pm.label}</span>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 block">{formatAmount(pm.amount)}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{t('{p}% du volume', '{p}% of volume', { p: pm.pct })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Catégories réelles */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {t('Catégories les Plus Rentables', 'Most Profitable Categories')}
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            {categoryBreakdown.length > 0 ? (
              categoryBreakdown.map((cat) => (
                <div key={cat.category} className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{cat.category}</span>
                    <span className="text-[10px] text-slate-400">{t('Ventes : {a}', 'Sales: {a}', { a: formatAmount(cat.revenue) })}</span>
                  </div>
                  <span className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    {t('Marge brute {m}%', 'Gross margin {m}%', { m: cat.margin })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-xs py-4 text-center">
                {t('Aucune vente enregistrée sur cette période', 'No sales recorded in this period')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
