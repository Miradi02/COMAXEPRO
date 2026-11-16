'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { isDateMatching, parseToDate, getLastNDaysKeys } from '@/lib/dateUtils';

type ChartFilter = 'jour' | 'mois' | 'annee';

interface Point {
  period: string;
  salesUSD: number;
  profitUSD: number;
  expensesUSD: number;
  count: number;
}

export function SalesEvolutionChart() {
  // Défaut « mois » : vue de référence (réalisé du mois vs objectif mensuel)
  const [activeFilter, setActiveFilter] = useState<ChartFilter>('mois');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { sales, expenses, products, formatAmount, goalRecords, goalTargets } = useCommerce();
  const { t, locale } = useI18n();

  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 640, h: 176 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBox({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Helper COGS : retrouve le coût d'achat exact d'un article
  const computeItemCost = (item: { productId?: string; productName: string; purchasePrice?: number; unitPrice: number }): number => {
    const prod = products.find(
      (p) =>
        (item.productId && p.id === item.productId) ||
        p.name.toLowerCase() === item.productName.toLowerCase()
    );
    return prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
  };

  // Série temporelle réelle selon la vue active
  const chartPoints: Point[] = useMemo(() => {
    // 1. Vue JOUR : les 7 derniers jours réels (contexte de la semaine)
    if (activeFilter === 'jour') {
      return getLastNDaysKeys(7, locale).map((d) => {
        const daySales = sales.filter((s) => isDateMatching(s.date, d.key));
        const dayExpenses = expenses.filter((e) => isDateMatching(e.date, d.key));

        const salesUSD = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
        const expensesUSD = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
        const cogs = daySales.reduce(
          (acc, s) => acc + s.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0),
          0
        );

        return { period: d.label, salesUSD, profitUSD: Math.max(0, salesUSD - cogs - expensesUSD), expensesUSD, count: daySales.length };
      });
    }

    // 2. Vue MOIS : les jours du mois en cours (réalisé du mois courant)
    if (activeFilter === 'mois') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      return Array.from({ length: daysInMonth }, (_, i) => {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
        const daySales = sales.filter((s) => isDateMatching(s.date, key));
        const dayExpenses = expenses.filter((e) => isDateMatching(e.date, key));

        const salesUSD = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
        const expensesUSD = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
        const cogs = daySales.reduce(
          (acc, s) => acc + s.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0),
          0
        );

        return {
          period: String(i + 1),
          salesUSD,
          profitUSD: Math.max(0, salesUSD - cogs - expensesUSD),
          expensesUSD,
          count: daySales.length,
        };
      });
    }

    // 3. Vue ANNÉE : les 12 mois de l'année en cours
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthsFr = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = locale === 'en' ? monthsEn : monthsFr;

    return Array.from({ length: 12 }, (_, i) => {
      const monthSales = sales.filter((s) => {
        const d = parseToDate(s.date);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });
      const monthExpenses = expenses.filter((e) => {
        const d = parseToDate(e.date);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });

      const salesUSD = monthSales.reduce((acc, s) => acc + s.totalAmount, 0);
      const expensesUSD = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
      const cogs = monthSales.reduce(
        (acc, s) => acc + s.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0),
        0
      );

      return { period: monthNames[i], salesUSD, profitUSD: Math.max(0, salesUSD - cogs - expensesUSD), expensesUSD, count: monthSales.length };
    });
  }, [activeFilter, sales, expenses, products, locale]);

  // Objectif de ventes SELON LA VUE (spec : réalisé vs objectif
  // correspondant, jamais de valeur inventée) :
  //   • jour  → objectif journalier enregistré (goal_targets) ;
  //   • mois  → ligne goals « sales » de période « mois » ;
  //   • année → ligne goals « sales » de période « année » — absent,
  //     la vue Année n'affiche AUCUN objectif (pas de plafond fictif).
  const salesGoalTarget = useMemo(() => {
    if (activeFilter === 'jour') {
      return goalTargets.dailySalesTarget > 0 ? goalTargets.dailySalesTarget : 0;
    }
    const period = activeFilter === 'mois' ? 'mois' : 'annee';
    const rec = goalRecords.find((r) => r.metric === 'sales' && r.period === period);
    return rec && rec.target > 0 ? rec.target : 0;
  }, [activeFilter, goalRecords, goalTargets]);

  const maxSales = useMemo(() => Math.max(...chartPoints.map((p) => p.salesUSD), 0), [chartPoints]);
  const yMax = useMemo(() => {
    if (salesGoalTarget > 0) return Math.max(salesGoalTarget, maxSales);
    return maxSales > 0 ? maxSales : 1;
  }, [salesGoalTarget, maxSales]);

  // Réalisé de la vue : jour = ventes du jour, mois = mois courant,
  // année = cumul depuis janvier (YTD).
  const realizedSales = useMemo(() => {
    if (activeFilter === 'jour') return chartPoints[chartPoints.length - 1]?.salesUSD ?? 0;
    return chartPoints.reduce((acc, p) => acc + p.salesUSD, 0);
  }, [activeFilter, chartPoints]);
  const remainingSales = salesGoalTarget > 0 ? Math.max(0, salesGoalTarget - realizedSales) : 0;

  const totalPeriodProfit = useMemo(() => chartPoints.reduce((acc, p) => acc + p.profitUSD, 0), [chartPoints]);

  // Sous-titre de vue (contexte + objectif affiché)
  const viewBase =
    activeFilter === 'jour'
      ? t('7 derniers jours', 'Last 7 days')
      : activeFilter === 'mois'
        ? t('Jours du mois', 'Days of the month')
        : t('12 mois de l’année', '12 months of the year');
  const viewGoal =
    salesGoalTarget > 0
      ? activeFilter === 'jour'
        ? t('objectif du jour', 'daily goal')
        : activeFilter === 'mois'
          ? t('objectif du mois', 'monthly goal')
          : t('objectif de l’année', 'annual goal')
      : t('sans objectif enregistré', 'no goal recorded');

  // ── Géométrie du tracé (repère pixel mesuré) ──
  const PAD = { l: 48, r: 28, t: 18, b: 26 };
  const innerW = Math.max(40, box.w - PAD.l - PAD.r);
  const innerH = Math.max(40, box.h - PAD.t - PAD.b);
  const n = chartPoints.length;

  const xAt = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const yAt = (v: number) => PAD.t + innerH * (1 - Math.min(v, yMax) / yMax);

  const linePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.salesUSD).toFixed(1)}`).join(' ');
  const areaPath =
    n > 0
      ? `${linePath} L${xAt(n - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${xAt(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`
      : '';

  // Graduations Y : 0 / milieu / sommet (sommet = objectif)
  const yTicks = [0, yMax / 2, yMax];
  const goalY = salesGoalTarget > 0 ? yAt(salesGoalTarget) : null;

  // Étiquettes X : sous-décimées si l'espace manque
  const labelStep = Math.max(1, Math.ceil((n * 36) / innerW));

  const fmtTick = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k $` : `${Math.round(v)} $`);

  const gradientId = `se-area-${activeFilter}`;

  const hovered = hoveredIndex !== null ? chartPoints[hoveredIndex] : null;

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
              {viewBase} · {viewGoal}
            </p>
          </div>
        </div>

        {/* Boutons de Filtres Vues */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 self-start sm:self-auto">
          {(['jour', 'mois', 'annee'] as const).map((filterKey) => (
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
              {filterKey === 'jour'
                ? t('Jour', 'Day')
                : filterKey === 'mois'
                  ? t('Mois', 'Month')
                  : t('Année', 'Year')}
            </button>
          ))}
        </div>
      </div>

      {/* Courbe : X = temps, Y = montant (max = objectif) */}
      <div ref={wrapRef} className="relative h-44 sm:h-52 w-full select-none">
        <svg width={box.w} height={box.h} className="overflow-visible" role="img" aria-label={t('Évolution des ventes dans le temps', 'Sales evolution over time')}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E5BF8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1E5BF8" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grille horizontale + graduations Y */}
          {yTicks.map((v, i) => (
            <g key={`y${i}`}>
              <line
                x1={PAD.l} y1={yAt(v)} x2={PAD.l + innerW} y2={yAt(v)}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-700"
                strokeWidth={1}
                strokeDasharray={i === 0 ? '0' : '4 4'}
              />
              <text
                x={PAD.l - 8} y={yAt(v) + 3.5}
                textAnchor="end"
                className="fill-slate-400 dark:fill-slate-500"
                fontSize="10" fontWeight="600"
              >
                {fmtTick(v)}
              </text>
            </g>
          ))}

          {/* Ligne d'objectif (plafond de l'axe Y) */}
          {goalY !== null && (
            <g>
              <line
                x1={PAD.l} y1={goalY} x2={PAD.l + innerW} y2={goalY}
                stroke="#10B981" strokeWidth={1.5} strokeDasharray="6 5" opacity={0.85}
              />
              <text
                x={PAD.l + innerW} y={goalY - 7}
                textAnchor="end"
                className="fill-emerald-600 dark:fill-emerald-400"
                fontSize="10" fontWeight="700"
              >
                {t('Objectif {a}', 'Goal {a}', { a: formatAmount(salesGoalTarget) })}
              </text>
            </g>
          )}

          {/* Aire sous la courbe */}
          {n > 0 && <path d={areaPath} fill={`url(#${gradientId})`} />}

          {/* Courbe des ventes */}
          {n > 0 && (
            <path
              d={linePath}
              fill="none"
              stroke="#1E5BF8"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points + zones de survol */}
          {chartPoints.map((p, i) => {
            const isHovered = hoveredIndex === i;
            const colW = n <= 1 ? innerW : innerW / (n - 1);
            return (
              <g key={p.period}>
                <rect
                  x={xAt(i) - colW / 2}
                  y={PAD.t}
                  width={colW}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                <circle
                  cx={xAt(i)}
                  cy={yAt(p.salesUSD)}
                  r={isHovered ? 5.5 : 4}
                  fill={isHovered ? '#1548CF' : '#FFFFFF'}
                  stroke={isHovered ? '#1548CF' : '#1E5BF8'}
                  strokeWidth={2.5}
                  className="transition-all duration-150 pointer-events-none"
                />
                {/* Étiquette X */}
                {i % labelStep === 0 && (
                  <text
                    x={xAt(i)}
                    y={PAD.t + innerH + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isHovered ? '700' : '500'}
                    className={isHovered ? 'fill-[#1E5BF8]' : 'fill-slate-500 dark:fill-slate-400'}
                  >
                    {p.period}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip flottant */}
        {hovered && hoveredIndex !== null && (
          <div
            className="absolute z-20 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold shadow-xl whitespace-nowrap pointer-events-none transition-all animate-in fade-in zoom-in-95"
            style={{
              left: Math.min(Math.max(xAt(hoveredIndex), 70), box.w - 70),
              top: Math.max(yAt(hovered.salesUSD) - 58, 0),
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-slate-300 font-medium">
              {t('{p} • Ventes : ', '{p} • Sales: ', { p: hovered.period })}
              <span className="text-white font-bold">{formatAmount(hovered.salesUSD)}</span>
            </p>
            <p className="text-emerald-400 text-[10px] mt-0.5">
              {hovered.salesUSD > 0
                ? t('Bénéfice net : +{a}', 'Net profit: +{a}', { a: formatAmount(hovered.profitUSD) })
                : t('Aucune vente enregistrée', 'No sale recorded')}
            </p>
            {salesGoalTarget > 0 && (
              <p className="text-blue-300 text-[10px] mt-0.5">
                {t('Objectif : {a}', 'Goal: {a}', { a: formatAmount(salesGoalTarget) })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pied de carte : barre (rempli = réalisé) + réalisé / objectif / restant */}
      <div className="mt-4 space-y-2.5">
        {salesGoalTarget > 0 && (
          <div
            className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
            role="img"
            aria-label={t('Réalisé {a} sur objectif {b}', 'Realized {a} of goal {b}', {
              a: formatAmount(realizedSales),
              b: formatAmount(salesGoalTarget),
            })}
          >
            <div
              className="h-full rounded-full bg-[#1E5BF8] transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, (realizedSales / salesGoalTarget) * 100))}%`,
              }}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-semibold">
          <span className="text-slate-500">
            {t('Réalisé {a}', 'Realized {a}', { a: formatAmount(realizedSales) })}
          </span>
          {salesGoalTarget > 0 && (
            <>
              <span className="text-slate-400">
                {t('Objectif {b}', 'Goal {b}', { b: formatAmount(salesGoalTarget) })}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {t('Restant {c}', 'Remaining {c}', { c: formatAmount(remainingSales) })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
