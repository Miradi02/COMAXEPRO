'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { isDateMatching, parseToDate, getLastNDaysKeys } from '@/lib/dateUtils';

type ChartFilter = '7jours' | '30jours' | '12mois';

export function SalesEvolutionChart() {
  const [activeFilter, setActiveFilter] = useState<ChartFilter>('7jours');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { sales, expenses, products, formatAmount } = useCommerce();
  const { t, locale } = useI18n();

  // Helper COGS : retrouve le coût d'achat exact d'un article
  const computeItemCost = (item: { productId?: string; productName: string; purchasePrice?: number; unitPrice: number }): number => {
    const prod = products.find(
      (p) =>
        (item.productId && p.id === item.productId) ||
        p.name.toLowerCase() === item.productName.toLowerCase()
    );
    return prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
  };

  // Génération mathématique dynamique des points du graphique
  const chartPoints = useMemo(() => {
    // 1. Vue 7 Jours (les 7 derniers jours réels se terminant aujourd'hui)
    if (activeFilter === '7jours') {
      const days = getLastNDaysKeys(7, locale);

      const rawPoints = days.map((d) => {
        const daySales = sales.filter((s) => isDateMatching(s.date, d.key));
        const dayExpenses = expenses.filter((e) => isDateMatching(e.date, d.key));

        const salesUSD = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
        const expensesUSD = dayExpenses.reduce((acc, e) => acc + e.amount, 0);

        const cogs = daySales.reduce((acc, s) => {
          return acc + s.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0);
        }, 0);

        const profitUSD = Math.max(0, salesUSD - cogs - expensesUSD);
        return { period: d.label, salesUSD, profitUSD, expensesUSD, count: daySales.length };
      });

      const maxSales = Math.max(...rawPoints.map((p) => p.salesUSD), 0);

      return rawPoints.map((p) => ({
        ...p,
        percentage: maxSales > 0 && p.salesUSD > 0 ? Math.max(12, Math.round((p.salesUSD / maxSales) * 100)) : 0,
      }));
    }

    // 2. Vue 30 Jours (4 semaines glissantes se terminant aujourd'hui)
    if (activeFilter === '30jours') {
      const now = new Date();
      const getDaysRange = (startOffset: number, endOffset: number) => {
        const arr: string[] = [];
        for (let i = startOffset; i >= endOffset; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        return arr;
      };

      const weeks = [
        { label: t('Semaine -3', 'Week -3'), days: getDaysRange(27, 21) },
        { label: t('Semaine -2', 'Week -2'), days: getDaysRange(20, 14) },
        { label: t('Semaine passée', 'Last week'), days: getDaysRange(13, 7) },
        { label: t('Cette semaine', 'This week'), days: getDaysRange(6, 0) },
      ];

      const rawPoints = weeks.map((w) => {
        const weekSales = sales.filter((s) => w.days.some((d) => isDateMatching(s.date, d)));
        const weekExpenses = expenses.filter((e) => w.days.some((d) => isDateMatching(e.date, d)));

        const salesUSD = weekSales.reduce((acc, s) => acc + s.totalAmount, 0);
        const expensesUSD = weekExpenses.reduce((acc, e) => acc + e.amount, 0);

        const cogs = weekSales.reduce((acc, s) => {
          return acc + s.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0);
        }, 0);

        const profitUSD = Math.max(0, salesUSD - cogs - expensesUSD);
        return { period: w.label, salesUSD, profitUSD, expensesUSD, count: weekSales.length };
      });

      const maxSales = Math.max(...rawPoints.map((p) => p.salesUSD), 0);

      return rawPoints.map((p) => ({
        ...p,
        percentage: maxSales > 0 && p.salesUSD > 0 ? Math.max(14, Math.round((p.salesUSD / maxSales) * 100)) : 0,
      }));
    }

    // 3. Vue 12 Mois (les 12 mois de l'année en cours)
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = locale === 'en' ? monthsEn : monthsFr;

    const months = Array.from({ length: 12 }, (_, i) => ({
      label: monthNames[i],
      monthIndex: i,
      year: currentYear,
    }));

    const rawPoints = months.map((m) => {
      const monthSales = sales.filter((s) => {
        const d = parseToDate(s.date);
        return d.getMonth() === m.monthIndex && d.getFullYear() === m.year;
      });

      const monthExpenses = expenses.filter((e) => {
        const d = parseToDate(e.date);
        return d.getMonth() === m.monthIndex && d.getFullYear() === m.year;
      });

      const salesUSD = monthSales.reduce((acc, s) => acc + s.totalAmount, 0);
      const expensesUSD = monthExpenses.reduce((acc, e) => acc + e.amount, 0);

      const cogs = monthSales.reduce((acc, s) => {
        return acc + s.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0);
      }, 0);

      const profitUSD = Math.max(0, salesUSD - cogs - expensesUSD);
      return { period: m.label, salesUSD, profitUSD, expensesUSD, count: monthSales.length };
    });

    const maxSales = Math.max(...rawPoints.map((p) => p.salesUSD), 0);

    return rawPoints.map((p) => ({
      ...p,
      percentage: maxSales > 0 && p.salesUSD > 0 ? Math.max(10, Math.round((p.salesUSD / maxSales) * 100)) : 0,
    }));
  }, [activeFilter, sales, expenses, products, locale, t]);

  // Total cumulé pour le filtre actif (badge d'en-tête)
  const totalPeriodSales = useMemo(() => chartPoints.reduce((acc, p) => acc + p.salesUSD, 0), [chartPoints]);
  const totalPeriodProfit = useMemo(() => chartPoints.reduce((acc, p) => acc + p.profitUSD, 0), [chartPoints]);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
      {/* Header avec Titre, Badge et Filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">
                {t('Évolution des Ventes', 'Sales Evolution')}
              </h3>
              {totalPeriodProfit > 0 && (
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70">
                  +{formatAmount(totalPeriodProfit)} net
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Calculé en temps réel à partir des encaissements réels', 'Calculated in real time from actual collections')}
            </p>
          </div>
        </div>

        {/* Boutons de Filtres Périodes */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 self-start sm:self-auto">
          {(['7jours', '30jours', '12mois'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => {
                setActiveFilter(filterKey);
                setHoveredIndex(null);
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeFilter === filterKey
                  ? 'bg-white text-[#1E5BF8] shadow-xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              {filterKey === '7jours'
                ? t('7 jours', '7 days')
                : filterKey === '30jours'
                  ? t('30 jours', '30 days')
                  : t('12 mois', '12 months')}
            </button>
          ))}
        </div>
      </div>

      {/* Pill Capsule Bars Container */}
      <div className="h-44 sm:h-52 flex items-end justify-between gap-1.5 sm:gap-3 pt-6 pb-2 px-1">
        {chartPoints.map((item, index) => {
          const isHovered = hoveredIndex === index;
          const hasSales = item.salesUSD > 0;

          return (
            <div
              key={item.period}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Floating Tooltip */}
              {isHovered && (
                <div className="absolute -top-14 z-20 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold shadow-xl whitespace-nowrap pointer-events-none transition-all animate-in fade-in zoom-in-95">
                  <p className="text-slate-300 font-medium">
                    {t('{p} • Ventes : ', '{p} • Sales: ', { p: item.period })}
                    <span className="text-white font-bold">{formatAmount(item.salesUSD)}</span>
                  </p>
                  <p className="text-emerald-400 text-[10px] mt-0.5">
                    {hasSales
                      ? t('Bénéfice net : +{a}', 'Net profit: +{a}', { a: formatAmount(item.profitUSD) })
                      : t('Aucune vente enregistrée', 'No sale recorded')}
                  </p>
                </div>
              )}

              {/* Capsule Pill Column */}
              <div className="w-3.5 sm:w-5 h-full bg-slate-100/90 rounded-full flex flex-col justify-end p-0.5 group-hover:bg-slate-200/80 transition-colors">
                <div
                  className={`w-full rounded-full transition-all duration-500 ease-out ${
                    !hasSales
                      ? 'bg-transparent'
                      : isHovered
                        ? 'bg-[#1548CF] shadow-sm'
                        : 'bg-[#1E5BF8]'
                  }`}
                  style={{ height: `${item.percentage}%` }}
                />
              </div>

              {/* Period Label */}
              <span
                className={`text-[10px] sm:text-xs font-medium mt-2.5 transition-colors ${
                  isHovered ? 'text-[#1E5BF8] font-bold' : hasSales ? 'text-slate-700 font-semibold' : 'text-slate-400'
                }`}
              >
                {item.period}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
