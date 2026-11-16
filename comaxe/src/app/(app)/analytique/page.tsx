'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Award,
  Flame,
  PieChart,
  Lightbulb,
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

type PeriodOption = 'jour' | '7j' | '30j' | '3m' | '6m' | '12m' | 'personnalise';

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

  // --- « À retenir » : 2 à 4 observations tirées des données réelles de la période ---
  const insights = useMemo(() => {
    const out: { icon: React.ReactNode; text: string; tone: string }[] = [];
    const salesTotal = periodData.totalSalesUSD;

    // 1. Marge nette
    if (salesTotal > 0) {
      const m = periodData.netMarginPercentage;
      out.push({
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        text:
          m >= 25
            ? t('Bonne rentabilité : {m}% de marge nette sur {a}.', 'Good profitability: {m}% net margin on {a}.', { m, a: formatAmount(periodData.netProfitUSD) })
            : m >= 10
              ? t('Marge nette correcte à {m}% — surveillez vos dépenses.', 'Correct net margin at {m}% — watch your expenses.', { m })
              : t('Marge nette faible ({m}%) : agissez sur les coûts.', 'Low net margin ({m}%): act on costs.', { m }),
        tone: m >= 25 ? 'text-emerald-600 bg-emerald-50 border-emerald-200/60' : m >= 10 ? 'text-[#1E5BF8] bg-blue-50 border-blue-200/60' : 'text-rose-600 bg-rose-50 border-rose-200/60',
      });
    }

    // 2. Catégorie dominante
    if (categoryBreakdown.length > 0) {
      const top = categoryBreakdown[0];
      const share = salesTotal > 0 ? Math.round((top.revenue / salesTotal) * 100) : 0;
      out.push({
        icon: <Flame className="w-3.5 h-3.5" />,
        text: t('{c} domine vos ventes : {a} ({p}% du chiffre d’affaires).', '{c} leads your sales: {a} ({p}% of revenue).', { c: top.category, a: formatAmount(top.revenue), p: share }),
        tone: 'text-[#1E5BF8] bg-blue-50 border-blue-200/60',
      });
    }

    // 3. Mode d'encaissement dominant
    const topPm = [...paymentBreakdown].sort((a, b) => b.amount - a.amount)[0];
    if (topPm && topPm.amount > 0) {
      out.push({
        icon: <PieChart className="w-3.5 h-3.5" />,
        text: t('Encaissements majoritairement en {l} : {p}% du volume.', 'Collections mostly in {l}: {p}% of volume.', { l: topPm.label, p: topPm.pct }),
        tone: 'text-[#1E5BF8] bg-blue-50 border-blue-200/60',
      });
    }

    // 4. Rotation du stock
    const rot = parseFloat(stockRotationRate);
    out.push({
      icon: <Layers className="w-3.5 h-3.5" />,
      text:
        rot >= 2
          ? t('Stock bien animé : rotation {r} sur la période.', 'Stock well active: {r} rotation over the period.', { r: stockRotationRate })
          : t('Stock peu animé ({r}) : relancez les ventes des produits en réserve.', 'Slow stock ({r}): push sales of stored products.', { r: stockRotationRate }),
      tone: rot >= 2 ? 'text-emerald-600 bg-emerald-50 border-emerald-200/60' : 'text-amber-700 bg-amber-50 border-amber-200/60',
    });

    return out.slice(0, 4);
  }, [periodData, categoryBreakdown, paymentBreakdown, stockRotationRate, t, formatAmount]);

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
            { key: 'jour', label: t("Aujourd'hui", 'Today') },
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
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
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
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Anneau de répartition */}
            <div className="relative shrink-0" aria-hidden>
              <svg width="112" height="112" viewBox="0 0 42 42" className="-rotate-90">
                <circle cx="21" cy="21" r="15.9155" fill="none" strokeWidth="6" className="stroke-slate-100" />
                {(() => {
                  const colors = ['#1E5BF8', '#10B981', '#F59E0B'];
                  let offset = 25;
                  return paymentBreakdown.map((pm, i) => {
                    const seg = pm.pct > 0 ? pm.pct : 0;
                    const el = (
                      <circle
                        key={pm.label}
                        cx="21" cy="21" r="15.9155" fill="none"
                        strokeWidth="6"
                        stroke={colors[i % colors.length]}
                        strokeDasharray={`${seg} ${100 - seg}`}
                        strokeDashoffset={offset}
                        strokeLinecap={seg >= 100 ? 'butt' : 'round'}
                      />
                    );
                    offset -= seg;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-extrabold text-slate-900">{formatAmount(periodData.totalSalesUSD)}</span>
                <span className="text-[10px] text-slate-400 font-semibold">{t('total', 'total')}</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3 text-xs">
              {paymentBreakdown.map((pm, i) => (
                <div key={pm.label} className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ['#1E5BF8', '#10B981', '#F59E0B'][i % 3] }} />
                    {pm.label}
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 block">{formatAmount(pm.amount)}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{t('{p}% du volume', '{p}% of volume', { p: pm.pct })}</span>
                  </div>
                </div>
              ))}
            </div>
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

      {/* ===== « À RETENIR » : 2 à 4 observations réelles ===== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {t('À retenir', 'Key takeaways')}
          </h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-auto">
            {t('Période : {p}', 'Period: {p}', { p: periodData.periodLabel })}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${ins.tone}`}>
              <span className="shrink-0 mt-0.5">{ins.icon}</span>
              <p className="text-xs font-semibold leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
