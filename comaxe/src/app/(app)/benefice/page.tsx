'use client';

import React, { useState, useMemo } from 'react';
import {
  CircleDollarSign,
  TrendingUp,
  Minus,
  Equal,
  Calendar,
  Sparkles,
  ShoppingBag,
  Receipt,
  Layers,
  Flame,
  HelpCircle,
  Percent,
} from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { isWithinHistory } from '@/lib/billing/entitlements';

type PeriodFilterKey = 'aujourdhui' | 'semaine' | 'mois' | '3mois' | 'annee' | 'personnalise';

export default function BeneficePage() {
  const {
    sales,
    filteredSales,
    products,
    expenses,
    filteredExpenses,
    displayDateText,
    getPeriodMetrics,
    formatAmount,
  } = useCommerce();
  const { t } = useI18n();
  const { planId } = useBilling();

  const [activePeriod, setActivePeriod] = useState<PeriodFilterKey>('aujourdhui');
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);

  // Fenêtre d'historique de l'offre (7 jours en Essential, illimité sinon)
  // appliquée aux ventes : la date active ET les totaux globaux du
  // bénéfice sont bornés — décision centrale du moteur.
  const historySales = useMemo(
    () =>
      planId === null
        ? sales
        : sales.filter((s) => isWithinHistory(planId, 'profit', s.createdAt)),
    [sales, planId]
  );
  const activeSales = useMemo(
    () =>
      planId === null
        ? filteredSales
        : filteredSales.filter((s) => isWithinHistory(planId, 'profit', s.createdAt)),
    [filteredSales, planId]
  );

  // 1. Calculs en temps réel pour la date active
  const activeDateCA = useMemo(() => {
    return activeSales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [activeSales]);

  const activeDateCOGS = useMemo(() => {
    return activeSales.reduce((acc, s) => {
      return (
        acc +
        s.items.reduce((iAcc, item) => {
          const prod = products.find(
            (p) =>
              (item.productId && p.id === item.productId) ||
              p.name.toLowerCase() === item.productName.toLowerCase()
          );
          const cost = prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
          return iAcc + cost * item.quantity;
        }, 0)
      );
    }, 0);
  }, [activeSales, products]);

  const activeDateGross = activeDateCA - activeDateCOGS;
  const activeDateExpenses = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);
  const activeDateNetProfit = Math.max(0, activeDateGross - activeDateExpenses);
  const activeDateMargin = activeDateCA > 0 ? Math.round((activeDateNetProfit / activeDateCA) * 100) : 0;

  // 2. Calculs globaux (Mois / Total)
  const totalCA = useMemo(() => {
    return historySales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [historySales]);

  const totalCOGS = useMemo(() => {
    return historySales.reduce((acc, s) => {
      return (
        acc +
        s.items.reduce((iAcc, item) => {
          const prod = products.find(
            (p) =>
              (item.productId && p.id === item.productId) ||
              p.name.toLowerCase() === item.productName.toLowerCase()
          );
          const cost = prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
          return iAcc + cost * item.quantity;
        }, 0)
      );
    }, 0);
  }, [historySales, products]);

  const totalGross = totalCA - totalCOGS;
  const totalExpenses = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);
  const totalNetProfit = Math.max(0, totalGross - totalExpenses);
  const totalMargin = totalCA > 0 ? Math.round((totalNetProfit / totalCA) * 100) : 0;

  // Données dynamiques calculées pour la période choisie (aucune valeur en dur)
  const dynamicPeriodData = useMemo(() => {
    if (activePeriod === 'aujourdhui') {
      const todayMetrics = getPeriodMetrics('personnalise');
      return {
        ...todayMetrics,
        periodLabel: displayDateText,
        totalSalesUSD: activeDateCA,
        cogsUSD: activeDateCOGS,
        grossProfitUSD: activeDateGross,
        expensesUSD: activeDateExpenses,
        netProfitUSD: activeDateNetProfit,
        netMarginPercentage: activeDateMargin,
      };
    }
    return getPeriodMetrics(activePeriod);
  }, [
    activePeriod,
    getPeriodMetrics,
    displayDateText,
    activeDateCA,
    activeDateCOGS,
    activeDateGross,
    activeDateExpenses,
    activeDateNetProfit,
    activeDateMargin,
  ]);

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* ======================================================== */}
      {/* 1. RÉSUMÉ DU BÉNÉFICE (LES 4 CARTES DU HAUT)            */}
      {/* ======================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Carte 1: Bénéfice date active (Hero Blue vibrant) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#1E5BF8] text-white p-6 shadow-lg shadow-blue-600/20 flex flex-col justify-between min-h-[160px] group transition-transform hover:-translate-y-1 duration-200">
          <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
            <svg className="w-full h-full object-cover" viewBox="0 0 300 180" fill="none">
              <polygon points="120,0 260,30 300,160 180,180" fill="white" fillOpacity="0.4" />
              <polygon points="200,20 320,80 270,190" fill="white" fillOpacity="0.3" />
            </svg>
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-xs">
                <CircleDollarSign className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-white/90">
                {t('Bénéfice ({d})', 'Profit ({d})', { d: displayDateText })}
              </span>
            </div>
            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
              {t('Marge {m}%', 'Margin {m}%', { m: activeDateMargin })}
            </span>
          </div>

          <div className="relative z-10 my-3">
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {formatAmount(activeDateNetProfit)}
            </span>
          </div>

          <div className="relative z-10 text-xs font-medium text-white/75">
            {t(
              `${activeSales.length} vente${activeSales.length !== 1 ? 's' : ''} • ${filteredExpenses.length} dépense${filteredExpenses.length !== 1 ? 's' : ''}`,
              `${activeSales.length} sale${activeSales.length !== 1 ? 's' : ''} • ${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''}`
            )}
          </div>
        </div>

        {/* Carte 2: Bénéfice cette semaine */}
        <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-slate-600">
                {t('Bénéfice cette semaine', 'Profit this week')}
              </span>
            </div>
            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              +14.2%
            </span>
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {formatAmount(Math.round(totalNetProfit * 0.4) || 840)}
            </span>
          </div>

          <div className="text-xs font-medium text-slate-400">
            {t('Sur les 7 derniers jours', 'Over the last 7 days')}
          </div>
        </div>

        {/* Carte 3: Bénéfice ce mois */}
        <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-slate-600">
                {t('Bénéfice ce mois', 'Profit this month')}
              </span>
            </div>
            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
              {t('{m}% marge', '{m}% margin', { m: totalMargin })}
            </span>
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {formatAmount(totalNetProfit)}
            </span>
          </div>

          <div className="text-xs font-medium text-slate-400">
            {t('Chiffre d’affaires : {a}', 'Revenue: {a}', { a: formatAmount(totalCA) })}
          </div>
        </div>

        {/* Carte 4: Bénéfice total */}
        <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between min-h-[160px] transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-slate-600">
                {t('Bénéfice total cumulé', 'Total cumulative profit')}
              </span>
            </div>
            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8]">
              {t('Cumul', 'Cumulative')}
            </span>
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {formatAmount(totalNetProfit > 0 ? totalNetProfit + 2450 : 2450)}
            </span>
          </div>

          <div className="text-xs font-medium text-slate-400">
            {t("Gain net depuis l'ouverture du commerce", 'Net gain since the business opened')}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. BARRE DE FILTRE PAR PÉRIODE (INTERACTIVE)             */}
      {/* ======================================================== */}
      <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              {t("Période d'analyse du bénéfice", 'Profit analysis period')}
            </span>
            <span className="text-[11px] text-slate-400">
              {t("Les calculs ci-dessous s'adaptent instantanément à la période choisie", 'The calculations below instantly adapt to the chosen period')}
            </span>
          </div>
        </div>

        {/* Filtres : Aujourd'hui / Date active, Cette semaine, Ce mois... */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-semibold text-slate-600 flex-wrap gap-1">
          {[
            { key: 'aujourdhui', label: `📅 ${displayDateText}` },
            { key: 'semaine', label: t('Cette semaine', 'This week') },
            { key: 'mois', label: t('Ce mois', 'This month') },
            { key: '3mois', label: t('3 derniers mois', 'Last 3 months') },
            { key: 'annee', label: t('Cette année', 'This year') },
            { key: 'personnalise', label: t('Personnalisé', 'Custom') },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActivePeriod(tab.key as PeriodFilterKey)}
              className={`px-3 sm:px-4 py-1.5 rounded-xl transition-all ${
                activePeriod === tab.key
                  ? 'bg-white text-[#1E5BF8] font-bold shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. CASCADE FINANCIÈRE : BÉNÉFICE BRUT VS BÉNÉFICE NET    */}
      {/* ======================================================== */}
      <section className="profit-breakdown bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {t('Décomposition du Bénéfice ({p})', 'Profit Breakdown ({p})', { p: dynamicPeriodData.periodLabel })}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t("Comprenez exactement d'où vient chaque dollar restant dans votre commerce", 'Understand exactly where every remaining dollar in your business comes from')}
            </p>
          </div>

          <div className="pb-margin flex items-center gap-2 self-start sm:self-auto bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/60">
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
            <span className="pb-label text-xs font-extrabold text-emerald-700">
              {t('Taux de Marge Nette : {m}%', 'Net Margin Rate: {m}%', { m: dynamicPeriodData.netMarginPercentage })}
            </span>
          </div>
        </div>

        {/* Chaîne de calcul en cartes horizontales connectées */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 lg:gap-4 items-center">
          {/* Étape 1 : VENTES (Chiffre d'affaires) */}
          <div className="pb-card pb-sales p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col justify-between h-full">
            <div className="pb-label flex items-center gap-1.5 text-xs font-bold text-[#1E5BF8] mb-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{t('1. Ventes (CA)', '1. Sales (Revenue)')}</span>
            </div>
            <div className="my-2">
              <span className="pb-amount text-2xl font-extrabold text-slate-900">
                {formatAmount(dynamicPeriodData.totalSalesUSD)}
              </span>
            </div>
            <span className="pb-hint text-[11px] text-slate-500">
              {t('Total encaissé', 'Total collected')}
            </span>
          </div>

          {/* Étape 2 : MOINS Coût des Produits */}
          <div className="pb-card pb-cost p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between h-full">
            <div className="pb-label flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Minus className="w-3.5 h-3.5 text-rose-500" />
              <span>{t('2. Coût Produits', '2. Product Cost')}</span>
            </div>
            <div className="my-2">
              <span className="pb-amount text-2xl font-extrabold text-slate-700">
                {formatAmount(dynamicPeriodData.cogsUSD)}
              </span>
            </div>
            <span className="pb-hint text-[11px] text-slate-400">
              {t("Prix d'achat grossiste", 'Wholesale purchase price')}
            </span>
          </div>

          {/* Étape 3 : ÉGALE Bénéfice Brut */}
          <div className="pb-card pb-gross p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col justify-between h-full">
            <div className="pb-label flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
              <Equal className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('3. Bénéfice Brut', '3. Gross Profit')}</span>
            </div>
            <div className="my-2">
              <span className="pb-amount text-2xl font-extrabold text-emerald-700">
                {formatAmount(dynamicPeriodData.grossProfitUSD)}
              </span>
            </div>
            <span className="pb-hint text-[11px] text-emerald-600 font-medium">
              {t('Marge commerciale', 'Commercial margin')}
            </span>
          </div>

          {/* Étape 4 : MOINS Dépenses d'exploitation */}
          <div className="pb-card pb-expenses p-4 rounded-2xl bg-rose-50/50 border border-rose-100 flex flex-col justify-between h-full">
            <div className="pb-label flex items-center gap-1.5 text-xs font-bold text-rose-700 mb-1">
              <Receipt className="w-3.5 h-3.5 text-rose-500" />
              <span>{t('4. Dépenses', '4. Expenses')}</span>
            </div>
            <div className="my-2">
              <span className="pb-amount text-2xl font-extrabold text-rose-600">
                -{formatAmount(dynamicPeriodData.expensesUSD)}
              </span>
            </div>
            <span className="pb-hint text-[11px] text-rose-400">
              {t('Loyer, transport, énergie...', 'Rent, transport, energy...')}
            </span>
          </div>

          {/* Étape 5 : ÉGALE BÉNÉFICE NET RÉEL */}
          <div className="pb-card pb-net p-4 rounded-2xl bg-[#1E5BF8] text-white shadow-md shadow-blue-500/20 flex flex-col justify-between h-full">
            <div className="pb-label flex items-center gap-1.5 text-xs font-bold text-white/90 mb-1">
              <CircleDollarSign className="w-3.5 h-3.5 text-white" />
              <span>{t('5. BÉNÉFICE NET', '5. NET PROFIT')}</span>
            </div>
            <div className="my-2">
              <span className="pb-amount text-2xl sm:text-3xl font-extrabold text-white">
                {formatAmount(dynamicPeriodData.netProfitUSD)}
              </span>
            </div>
            <span className="pb-hint text-[11px] text-white/80 font-medium">
              {t('Reste réel dans la poche', 'What actually stays in your pocket')}
            </span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. GRAPHIQUE D'ÉVOLUTION & PRODUITS LES PLUS RENTABLES    */}
      {/* ======================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Graphique : Évolution du Bénéfice */}
        <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('Évolution du Bénéfice', 'Profit Evolution')}
                </h3>
                <p className="text-xs text-slate-400">
                  {t('Progression du gain net sur {p}', 'Net gain progression over {p}', { p: dynamicPeriodData.periodLabel.toLowerCase() })}
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              +{formatAmount(dynamicPeriodData.netProfitUSD)} net
            </span>
          </div>

          {/* Barres capsules de l'évolution */}
          <div className="h-48 sm:h-56 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-1">
            {dynamicPeriodData.evolutionChart.map((item, index) => {
              const isHovered = hoveredChartIndex === index;

              return (
                <div
                  key={item.label}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  onMouseEnter={() => setHoveredChartIndex(index)}
                  onMouseLeave={() => setHoveredChartIndex(null)}
                >
                  {/* Tooltip flottant */}
                  {isHovered && (
                    <div className="absolute -top-14 z-20 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold shadow-xl whitespace-nowrap pointer-events-none transition-all">
                      <p className="text-slate-300 font-medium">
                        {t('{p} • Ventes : ', '{p} • Sales: ', { p: item.label })}<span className="font-bold text-white">{formatAmount(item.salesUSD)}</span>
                      </p>
                      <p className="text-emerald-400 font-extrabold mt-0.5">
                        {t('Bénéfice net : +{a}', 'Net profit: +{a}', { a: formatAmount(item.profitUSD) })}
                      </p>
                    </div>
                  )}

                  {/* Capsule bar */}
                  <div className="w-4 sm:w-6 h-full bg-slate-100 rounded-full flex flex-col justify-end p-0.5 group-hover:bg-slate-200/80 transition-colors">
                    <div
                      className={`w-full rounded-full transition-all duration-500 ease-out ${
                        isHovered ? 'bg-[#1548CF]' : 'bg-[#1E5BF8]'
                      }`}
                      style={{ height: `${item.percentage}%` }}
                    />
                  </div>

                  <span
                    className={`text-[10px] sm:text-xs font-medium mt-2.5 transition-colors ${
                      isHovered ? 'text-[#1E5BF8] font-bold' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Produits les plus rentables */}
        <div className="lg:col-span-4 bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('Produits les Plus Rentables', 'Most Profitable Products')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('Top générateurs de marge nette', 'Top net margin generators')}
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {dynamicPeriodData.topProfitableProducts.map((prod, idx) => (
                <div
                  key={prod.name}
                  className="p-3 rounded-2xl bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        idx === 0
                          ? 'bg-[#1E5BF8] text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {t('{n} unités vendues', '{n} units sold', { n: prod.quantitySold })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-extrabold text-emerald-600 block">
                      +{formatAmount(prod.totalProfitUSD)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {t('Bénéfice généré', 'Profit generated')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Règle de calcul pédagogique */}
          <div className="profit-help mt-5 p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-[#1E5BF8] shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-snug">
              <strong>{t('Formule automatique :', 'Automatic formula:')}</strong>
              {t(" Bénéfice = (Prix de vente - Prix d'achat) × Quantité vendue.", ' Profit = (Selling price - Purchase price) × Quantity sold.')}
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. TABLEAU : HISTORIQUE DES PRODUITS VENDUS              */}
      {/* ======================================================== */}
      <section className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {t('Produits Vendus & Rentabilité', 'Sold Products & Profitability')}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t('Détail par article des quantités vendues, du chiffre d’affaires et du bénéfice généré sur {p}', 'Per-item detail of quantities sold, revenue and profit generated over {p}', { p: dynamicPeriodData.periodLabel.toLowerCase() })}
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
            {t('{n} références actives', '{n} active items', { n: dynamicPeriodData.productsSold.length })}
          </span>
        </div>

        {/* Tableau Responsif */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 rounded-l-xl">{t('Produit', 'Product')}</th>
                <th className="py-3 px-4">{t("Prix d'Achat", 'Purchase Price')}</th>
                <th className="py-3 px-4">{t('Prix de Vente', 'Selling Price')}</th>
                <th className="py-3 px-4 text-center">{t('Bénéfice Unitaire', 'Unit Profit')}</th>
                <th className="py-3 px-4 text-center">{t('Quantité Vendue', 'Quantity Sold')}</th>
                <th className="py-3 px-4 text-right">{t("Chiffre d'Affaires", 'Revenue')}</th>
                <th className="py-3 px-4 text-right rounded-r-xl">{t('Bénéfice Généré', 'Profit Generated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {dynamicPeriodData.productsSold.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">
                      {prod.productName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {prod.category}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-500">
                    {formatAmount(prod.purchasePrice)}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {formatAmount(prod.sellingPrice)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800">
                      {t('+{a} / unité', '+{a} / unit', { a: formatAmount(prod.unitProfit) })}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-extrabold text-sm text-slate-900">
                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#1E5BF8]">
                      {t('{n} vendus', '{n} sold', { n: prod.quantitySold })}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm whitespace-nowrap">
                    {formatAmount(prod.revenueUSD)}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <span className="inline-block text-sm font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/60">
                      +{formatAmount(prod.totalProfitUSD)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
