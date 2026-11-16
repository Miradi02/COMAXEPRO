'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Wallet,
  Eye,
  History,
} from 'lucide-react';
import { useCommerce, type MutationResult } from '@/context/CommerceContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { useAppShell } from '@/context/AppShellContext';
import { FeatureLocked } from '@/components/billing/FeatureLocked';
import { isFeatureUnlocked } from '@/lib/billing/entitlements';
import { getTodayKey, normalizeDateToKey } from '@/lib/dateUtils';
import type { GoalMetric, GoalPeriod, GoalRecord } from '@/types';

const METRIC_OPTIONS: { value: GoalMetric; labelFr: string; labelEn: string }[] = [
  { value: 'sales', labelFr: 'Chiffre d’affaires (ventes)', labelEn: 'Sales revenue' },
  { value: 'profit', labelFr: 'Bénéfice net', labelEn: 'Net profit' },
  { value: 'pieces', labelFr: 'Pièces vendues (unités)', labelEn: 'Units sold' },
  { value: 'expenses', labelFr: 'Plafond de dépenses', labelEn: 'Expenses ceiling' },
];

const PERIOD_OPTIONS: { value: GoalPeriod; labelFr: string; labelEn: string }[] = [
  { value: 'semaine', labelFr: 'Cette semaine', labelEn: 'This week' },
  { value: 'mois', labelFr: 'Ce mois', labelEn: 'This month' },
  { value: 'annee', labelFr: 'Cette année', labelEn: 'This year' },
];

const DEFAULT_TITLE_BY_METRIC: Record<GoalMetric, [string, string]> = {
  sales: ['Objectif de Ventes Mensuel', 'Monthly Sales Target'],
  profit: ['Objectif de Bénéfice Net', 'Net Profit Target'],
  pieces: ['Volume de Pièces Vendues', 'Units Sold Volume'],
  expenses: ['Plafond des Dépenses Récurrentes', 'Recurring Expenses Ceiling'],
};

const CATEGORY_BY_METRIC: Record<GoalMetric, [string, string]> = {
  sales: ["Chiffre d'affaires", 'Revenue'],
  profit: ['Rentabilité', 'Profitability'],
  pieces: ['Volume de Stock', 'Stock Volume'],
  expenses: ['Contrôle des Coûts', 'Cost Control'],
};

const ICON_BY_METRIC: Record<GoalMetric, typeof Target> = {
  sales: ShoppingBag,
  profit: TrendingUp,
  pieces: Target,
  expenses: Receipt,
};

const MONTHS_FULL: Record<'fr' | 'en', string[]> = {
  fr: [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
};

const EMPTY_FORM = { metric: 'sales' as GoalMetric, title: '', target: '', period: 'mois' as GoalPeriod };

type Tone = 'good' | 'warn' | 'danger';
interface GoalView {
  id: string;
  rec: GoalRecord;
  current: number;
  target: number;
  pct: number;
  isCount: boolean;
  unit: string;
  tone: Tone;
  statusLabel: string;
  bucket: 'reached' | 'ontrack' | 'watch';
  prevPctDelta: number | null; // évolution en % vs mois précédent (valeur atteinte)
}

const TONE_CLASSES: Record<Tone, { pill: string; bar: string; pct: string }> = {
  good: {
    pill: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
    bar: 'bg-emerald-500',
    pct: 'text-emerald-600',
  },
  warn: {
    pill: 'text-amber-700 bg-amber-50 border-amber-200/60',
    bar: 'bg-amber-500',
    pct: 'text-amber-600',
  },
  danger: {
    pill: 'text-rose-700 bg-rose-50 border-rose-200/60',
    bar: 'bg-rose-500',
    pct: 'text-rose-600',
  },
};

export default function ObjectifsPage() {
  const { goalRecords, addGoal, updateGoal, deleteGoal, formatAmount, requestConfirmation, sales, expenses, products } = useCommerce();
  const { t, locale } = useI18n();
  const { setHeaderAction } = useAppShell();
  const { planId, loading: billingLoading } = useBilling();

  // Verrou fonctionnel : la page ne s'ouvre que si l'abonnement actif
  // débloque les Objectifs (décision centrale, aucune règle de plan ici).
  const goalsUnlocked = planId !== null && isFeatureUnlocked(planId, 'goals');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Sélecteur de mois : 0 = mois courant, -1 = mois précédent, … (12 mois maximum)
  const [monthOffset, setMonthOffset] = useState(0);

  // --- Agrégats réels sur une plage de jours (clés YYYY-MM-DD comparables lexicographiquement) ---
  const computeAgg = (fromKey: string, toKey: string) => {
    let s = 0, cogs = 0, e = 0, pieces = 0;
    for (const sale of sales) {
      const k = normalizeDateToKey(sale.date);
      if (k < fromKey || k > toKey) continue;
      s += sale.totalAmount;
      for (const it of sale.items) {
        pieces += it.quantity;
        const prod = products.find(
          (p) => (it.productId && p.id === it.productId) || p.name.toLowerCase() === it.productName.toLowerCase()
        );
        const cost = prod ? prod.purchasePrice : it.purchasePrice || it.unitPrice * 0.7;
        cogs += cost * it.quantity;
      }
    }
    for (const exp of expenses) {
      const k = normalizeDateToKey(exp.date);
      if (k < fromKey || k > toKey) continue;
      e += exp.amount;
    }
    const profit = Math.max(0, s - cogs - e);
    return { sales: s, expenses: e, profit, pieces };
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const today = new Date();
  const todayKey = getTodayKey();
  const selDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const selY = selDate.getFullYear();
  const selM = selDate.getMonth(); // 0-based
  const selM1 = selM + 1;
  const isCurrentSel = monthOffset === 0;
  const daysInSelMonth = new Date(selY, selM1, 0).getDate();
  const monthPrefix = `${selY}-${pad(selM1)}`;
  const monthFromKey = `${monthPrefix}-01`;
  const monthToKey = isCurrentSel ? todayKey : `${monthPrefix}-${pad(daysInSelMonth)}`;

  const monthLabel = `${MONTHS_FULL[locale === 'en' ? 'en' : 'fr'][selM]} ${selY}`;

  const prevDate = new Date(selY, selM - 1, 1);
  const prevDays = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate();
  const prevFromKey = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-01`;
  const prevToKey = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(prevDays)}`;

  // Jours restants (réels) pour le rythme quotidien
  const daysLeftMonth = isCurrentSel ? Math.max(1, daysInSelMonth - today.getDate() + 1) : 0;
  const daysLeftYear = isCurrentSel ? Math.max(1, Math.round((new Date(selY, 11, 31).getTime() - today.getTime()) / 86400000) + 1) : 0;
  const daysLeftWeek = isCurrentSel ? Math.max(1, 7 - ((today.getDay() + 6) % 7)) : 0;
  // Progression temporelle attendue (%) pour les statuts intelligents
  const pacePct = isCurrentSel ? (today.getDate() / daysInSelMonth) * 100 : 100;

  const monthAgg = useMemo(() => computeAgg(monthFromKey, monthToKey), [monthFromKey, monthToKey, sales, expenses, products]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevAgg = useMemo(() => computeAgg(prevFromKey, prevToKey), [prevFromKey, prevToKey, sales, expenses, products]); // eslint-disable-line react-hooks/exhaustive-deps

  const rangeForPeriod = (period: GoalPeriod): { from: string; to: string; daysLeft: number } => {
    if (period === 'mois') return { from: monthFromKey, to: monthToKey, daysLeft: daysLeftMonth };
    if (period === 'annee') {
      const to = isCurrentSel ? todayKey : monthToKey;
      return { from: `${selY}-01-01`, to, daysLeft: daysLeftYear };
    }
    const to = isCurrentSel ? todayKey : monthToKey;
    const end = new Date(`${to}T12:00:00`);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`, to, daysLeft: daysLeftWeek };
  };

  const valueFor = (metric: GoalMetric, from: string, to: string): number => {
    const a = computeAgg(from, to);
    if (metric === 'sales') return a.sales;
    if (metric === 'profit') return a.profit;
    if (metric === 'pieces') return a.pieces;
    return a.expenses;
  };

  // --- Construction des vues d'objectifs (données réelles du mois sélectionné) ---
  const goalViews: GoalView[] = useMemo(() => {
    const fmtPct = (v: number) => Math.round(v * 10) / 10;

    return goalRecords.map((rec) => {
      const { from, to, daysLeft } = rangeForPeriod(rec.period);
      const current = valueFor(rec.metric, from, to);
      const target = rec.target;
      const pct = target > 0 ? fmtPct((current / target) * 100) : 0;
      const isCount = rec.metric === 'pieces';
      const unit = rec.unit || t('articles', 'items');

      let tone: Tone = 'good';
      let statusLabel = '';
      let bucket: GoalView['bucket'] = 'watch';

      if (rec.metric === 'expenses') {
        // Un plafond de dépenses n'est JAMAIS « positif » quand il est dépassé
        if (pct > 100) {
          tone = 'danger';
          statusLabel = t('Limite dépassée', 'Limit exceeded');
          bucket = 'watch';
        } else if (pct >= 85) {
          tone = 'warn';
          statusLabel = t('Proche de la limite', 'Close to the limit');
          bucket = 'watch';
        } else {
          tone = 'good';
          statusLabel = t('Sous contrôle', 'Under control');
          bucket = 'reached';
        }
      } else if (pct >= 100) {
        tone = 'good';
        statusLabel = t('Atteint', 'Reached');
        bucket = 'reached';
      } else if (pct >= pacePct - 10) {
        tone = 'good';
        statusLabel = t('En bonne voie', 'On track');
        bucket = 'ontrack';
      } else if (pct >= pacePct - 30) {
        tone = 'warn';
        statusLabel = t('À surveiller', 'To watch');
        bucket = 'watch';
      } else {
        tone = 'danger';
        statusLabel = t('En retard', 'Behind schedule');
        bucket = 'watch';
      }

      // Comparaison avec le mois précédent (uniquement pour les objectifs de mois)
      let prevPctDelta: number | null = null;
      if (rec.period === 'mois') {
        const prevCurrent = valueFor(rec.metric, prevFromKey, prevToKey);
        if (prevCurrent > 0) {
          prevPctDelta = fmtPct(((current - prevCurrent) / prevCurrent) * 100);
        } else if (current > 0) {
          prevPctDelta = null; // aucun mois de référence → pas de comparaison inventée
        }
      }

      return {
        id: rec.id,
        rec,
        current,
        target,
        pct,
        isCount,
        unit,
        tone,
        statusLabel,
        bucket,
        prevPctDelta,
        daysLeftRef: daysLeft,
      } as GoalView & { daysLeftRef: number };
    });
  }, [goalRecords, monthFromKey, monthToKey, prevFromKey, prevToKey, pacePct, sales, expenses, products, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const reachedCount = goalViews.filter((g) => g.bucket === 'reached').length;
  const onTrackCount = goalViews.filter((g) => g.bucket === 'ontrack').length;
  const watchCount = goalViews.filter((g) => g.bucket === 'watch').length;

  const salesGoal = goalRecords.find((r) => r.metric === 'sales' && r.period === 'mois');
  const salesGoalTarget = salesGoal?.target ?? 0;
  const salesPct = salesGoalTarget > 0 ? Math.round((monthAgg.sales / salesGoalTarget) * 1000) / 10 : 0;

  // Historique : 3 mois précédents vs l'objectif de ventes mensuel (données réelles)
  const history = useMemo(() => {
    if (!salesGoal || salesGoal.target <= 0) return [];
    const rows: { label: string; pct: number }[] = [];
    for (let k = 1; k <= 3; k++) {
      const d = new Date(selY, selM - k, 1);
      const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const to = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(dim)}`;
      if (to > todayKey) continue;
      const a = computeAgg(from, to);
      rows.push({
        label: `${MONTHS_FULL[locale === 'en' ? 'en' : 'fr'][d.getMonth()]} ${d.getFullYear()}`,
        pct: Math.round((a.sales / salesGoal.target) * 1000) / 10,
      });
    }
    return rows;
  }, [salesGoal?.id, salesGoal?.target, selY, selM, sales, expenses, products, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtPctFr = (v: number) => `${v.toFixed(1).replace('.', locale === 'en' ? '.' : ',')} %`;

  const overviewPhrase = (() => {
    if (monthAgg.profit <= 0 && monthAgg.sales > 0) return t('Moins de bénéfice que prévu : surveillez vos dépenses.', 'Lower profit than expected: watch your expenses.');
    if (salesGoalTarget > 0 && salesPct >= 100) return t('Objectif de ventes atteint, excellent travail !', 'Sales goal reached, excellent work!');
    if (salesGoalTarget > 0 && salesPct >= pacePct - 10) return t('Vous êtes dans le rythme pour atteindre vos objectifs.', 'You are on track to reach your goals.');
    if (monthAgg.sales === 0) return t('Aucune vente enregistrée ce mois-ci.', 'No sale recorded this month.');
    return t('Un effort est nécessaire pour rester dans le rythme.', 'Extra effort is needed to stay on track.');
  })();

  // --- CTA global « Nouvel Objectif » (en-tête) ---
  useEffect(() => {
    if (!goalsUnlocked) {
      setHeaderAction(null);
      return;
    }
    setHeaderAction({
      label: t('Nouvel Objectif', 'New Goal'),
      onClick: () => {
        setEditingGoal(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setIsModalOpen(true);
      },
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction, t, goalsUnlocked]);

  const openEdit = (goalId: string) => {
    const rec = goalRecords.find((g) => g.id === goalId);
    if (!rec) return;
    setEditingGoal(rec);
    setForm({
      metric: rec.metric,
      title: rec.title,
      target: String(rec.target),
      period: rec.period,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(form.target);
    if (Number.isNaN(target) || target < 0) {
      setFormError(t('La cible doit être un nombre positif.', 'The target must be a positive number.'));
      return;
    }
    const title = form.title.trim() || t(DEFAULT_TITLE_BY_METRIC[form.metric][0], DEFAULT_TITLE_BY_METRIC[form.metric][1]);
    const category = t(CATEGORY_BY_METRIC[form.metric][0], CATEGORY_BY_METRIC[form.metric][1]);
    const unit = form.metric === 'pieces' ? t('articles', 'items') : undefined;

    setSaving(true);
    try {
      let res: MutationResult;
      if (editingGoal) {
        res = await updateGoal(editingGoal.id, {
          metric: form.metric,
          title,
          category,
          target,
          unit,
          period: form.period,
        });
      } else {
        res = await addGoal({ metric: form.metric, title, category, target, unit, period: form.period });
      }
      // Fonctionnalité verrouillée (abonnement) → message centralisé, modale ouverte
      if (!res.success) {
        setFormError(res.error || t("Échec de l'enregistrement de l'objectif", 'Failed to save the goal'));
        return;
      }
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setEditingGoal(null);
      setFormError('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (goalId: string, goalTitle: string) => {
    requestConfirmation({
      title: t('Supprimer l’objectif', 'Delete goal'),
      message: t(
        'Voulez-vous vraiment supprimer l’objectif « {t} » ? Cette action est définitive.',
        'Do you really want to delete the goal "{t}"? This action cannot be undone.',
        { t: goalTitle }
      ),
      onConfirm: () => {
        deleteGoal(goalId);
      },
    });
  };

  const fmtValue = (v: number, isCount: boolean, unit: string) =>
    isCount ? `${Math.round(v)} ${unit}` : formatAmount(v);

  const paceForGoal = (g: GoalView & { daysLeftRef?: number }) => {
    const remaining = g.target - g.current;
    if (remaining <= 0) return null;
    const dl = g.rec.period === 'mois' ? daysLeftMonth : g.rec.period === 'annee' ? daysLeftYear : daysLeftWeek;
    if (!isCurrentSel || dl <= 0) return null;
    const rate = Math.ceil(remaining / dl);
    if (g.rec.metric === 'expenses') {
      return t('Il reste {d} jours : ne dépensez pas plus de {r} par jour.', ' {d} days left: do not spend more than {r} per day.', { d: dl, r: formatAmount(rate) });
    }
    return t('Il reste {d} jours : visez {r} par jour.', '{d} days left: aim for {r} per day.', {
      d: dl,
      r: g.isCount ? `${rate} ${g.unit}` : formatAmount(rate),
    });
  };

  // --- Verrous fonctionnels (repli si le middleware a laissé passer) ---
  if (billingLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label="Chargement">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E5BF8]" />
      </div>
    );
  }
  if (!goalsUnlocked) {
    return (
      <div className="space-y-6">
        <FeatureLocked feature="goals" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 1. EN-TÊTE ===== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <Target className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {t('Objectifs', 'Goals')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('Fixez vos objectifs, suivez vos progrès et gardez le contrôle de votre activité.', 'Set your goals, track your progress and keep control of your business.')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Sélecteur de mois */}
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-1">
            <button
              onClick={() => setMonthOffset((o) => Math.max(-12, o - 1))}
              className="p-1 rounded-full text-[#1E5BF8] hover:bg-blue-100 transition-colors"
              aria-label={t('Mois précédent', 'Previous month')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[#1E5BF8] inline-flex items-center gap-1.5 px-1 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {t('Objectifs — ', 'Goals — ')}{monthLabel}
            </span>
            <button
              onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
              disabled={monthOffset >= 0}
              className="p-1 rounded-full text-[#1E5BF8] hover:bg-blue-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={t('Mois suivant', 'Next month')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ===== 2. RÉSUMÉ DE PROGRESSION ===== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {t('Votre progression ce mois', 'Your progress this month')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 min-w-0">
            <span className="text-2xl" aria-hidden>🎯</span>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-slate-900">{reachedCount}</p>
              <p className="text-xs text-slate-500 truncate">{t('atteints', 'reached')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 min-w-0">
            <span className="text-2xl" aria-hidden>🟢</span>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-emerald-700">{onTrackCount}</p>
              <p className="text-xs text-emerald-700/80 truncate">{t('en bonne voie', 'on track')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 min-w-0">
            <span className="text-2xl" aria-hidden>🟠</span>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-amber-700">{watchCount}</p>
              <p className="text-xs text-amber-700/80 truncate">{t('à surveiller', 'to watch')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 3. CARTES DES OBJECTIFS ===== */}
      {goalViews.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-10 border border-slate-200/80 shadow-xs text-center">
          <Target className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {t('Aucun objectif pour le moment.', 'No goal for the moment.')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('Cliquez sur « Nouvel Objectif » pour fixer votre premier palier.', 'Click "New Goal" to set your first milestone.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {goalViews.map((g) => {
            const IconComp = ICON_BY_METRIC[g.rec.metric] || Target;
            const tc = TONE_CLASSES[g.tone];
            const over = g.rec.metric === 'expenses' && g.pct > 100;
            const remaining = Math.max(0, g.target - g.current);

            return (
              <div
                key={g.id}
                className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-blue-50 text-[#1E5BF8] shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate" title={g.rec.title}>
                          {g.rec.title}
                        </h3>
                        <span className="text-xs text-slate-400 block truncate">
                          {monthLabel}{g.rec.category ? ` • ${g.rec.category}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(g.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1E5BF8] hover:bg-blue-50 transition-colors"
                        title={t('Modifier cet objectif', 'Edit this goal')}
                        aria-label={t('Modifier cet objectif', 'Edit this goal')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(g.id, g.rec.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={t('Supprimer cet objectif', 'Delete this goal')}
                        aria-label={t('Supprimer cet objectif', 'Delete this goal')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border mb-3 ${tc.pill}`}>
                    {over ? `🔴 ${g.statusLabel}` : g.statusLabel}
                  </span>

                  {/* Valeurs : atteint / cible / reste */}
                  <div className="my-4">
                    <div className="flex justify-between items-baseline mb-2 gap-2">
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight min-w-0 truncate">
                        {fmtValue(g.current, g.isCount, g.unit)}
                      </span>
                      <span className="text-xs font-bold text-slate-400 shrink-0">
                        {t('Cible : {v}', 'Target: {v}', { v: fmtValue(g.target, g.isCount, g.unit) })}
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${tc.bar}`}
                        style={{ width: `${Math.min(100, Math.max(0, g.pct))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-slate-500">
                      {g.pct >= 100 && !over
                        ? t('Objectif atteint !', 'Goal reached!')
                        : over
                          ? t('Plafond dépassé de {v}', 'Ceiling exceeded by {v}', { v: fmtValue(g.current - g.target, false, '') })
                          : t('Encore {v}', '{v} to go', { v: fmtValue(remaining, g.isCount, g.unit) })}
                    </span>
                    <span className={`text-base font-extrabold ${tc.pct}`}>
                      {fmtPctFr(g.pct)}
                    </span>
                  </div>
                </div>

                {/* Comparaison mois précédent + rythme */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400 font-semibold">
                    {g.prevPctDelta !== null
                      ? `${g.prevPctDelta >= 0 ? '+' : ''}${fmtPctFr(g.prevPctDelta)} ${t('vs mois précédent', 'vs previous month')}`
                      : t('Premier mois de comparaison', 'First month of comparison')}
                  </span>
                  <button
                    onClick={() => openEdit(g.id)}
                    className="text-[#1E5BF8] font-bold hover:underline"
                  >
                    {t('Modifier', 'Edit')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 5. 💡 POUR ATTEINDRE VOS OBJECTIFS ===== */}
      {isCurrentSel && goalViews.some((g) => g.pct < 100 && (g.rec.metric !== 'expenses' || g.pct <= 100)) && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <Lightbulb className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              💡 {t('Pour atteindre vos objectifs', 'To reach your goals')}
            </h3>
          </div>
          <ul className="space-y-3">
            {goalViews
              .filter((g) => g.pct < 100)
              .map((g) => {
                const pace = paceForGoal(g as GoalView & { daysLeftRef?: number });
                return (
                  <li key={g.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                    <span className="font-bold text-slate-900 text-sm min-w-0">
                      {g.rec.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      {g.rec.metric === 'expenses'
                        ? t('Encore {v} avant la limite', '{v} left before the limit', { v: formatAmount(Math.max(0, g.target - g.current)) })
                        : t('Reste {v}', '{v} remaining', { v: fmtValue(Math.max(0, g.target - g.current), g.isCount, g.unit) })}
                    </span>
                    {pace && <span className="text-xs font-bold text-[#1E5BF8]">{pace}</span>}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* ===== 6. 💰 VOTRE ARGENT CE MOIS-CI ===== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <Wallet className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            💰 {t('Votre argent ce mois-ci', 'Your money this month')}
          </h3>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 px-4 py-3">
            <span className="font-semibold text-slate-600 inline-flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-[#1E5BF8]" /> {t('Ventes', 'Sales')}</span>
            <span className="font-extrabold text-slate-900">{formatAmount(monthAgg.sales)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 px-4 py-3">
            <span className="font-semibold text-slate-600 inline-flex items-center gap-2"><Receipt className="w-4 h-4 text-rose-500" /> {t('Dépenses', 'Expenses')}</span>
            <span className="font-extrabold text-rose-600">− {formatAmount(monthAgg.expenses)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3">
            <span className="font-semibold text-emerald-700 inline-flex items-center gap-2"><TrendingUp className="w-4 h-4" /> {t('Bénéfice', 'Profit')}</span>
            <span className="font-extrabold text-emerald-700">{formatAmount(monthAgg.profit)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200/60 bg-blue-50/60 px-4 py-3">
            <span className="font-semibold text-[#1E5BF8] inline-flex items-center gap-2"><Target className="w-4 h-4" /> {t('Objectif de ventes', 'Sales goal')}</span>
            <span className="font-extrabold text-[#1E5BF8]">
              {salesGoalTarget > 0 ? `${fmtPctFr(salesPct)} ${t('atteint', 'reached')}` : t('Non défini', 'Not set')}
            </span>
          </div>
        </div>
      </div>

      {/* ===== 7. VOTRE MOIS EN UN COUP D'ŒIL ===== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <Eye className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {t('Votre mois en un coup d’œil', 'Your month at a glance')}
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('Ventes', 'Sales'), value: formatAmount(monthAgg.sales) },
            { label: t('Dépenses', 'Expenses'), value: formatAmount(monthAgg.expenses) },
            { label: t('Bénéfice', 'Profit'), value: formatAmount(monthAgg.profit) },
            { label: t('Pièces vendues', 'Units sold'), value: `${Math.round(monthAgg.pieces)}` },
          ].map((it) => (
            <div key={it.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">{it.label}</p>
              <p className="text-lg font-extrabold text-slate-900 truncate mt-0.5">{it.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-3">{overviewPhrase}</p>
      </div>

      {/* ===== 8. HISTORIQUE DES MOIS PRÉCÉDENTS ===== */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <History className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {t('Historique', 'History')}
            </h3>
          </div>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-600 truncate">{h.label}</span>
                <span className={`font-extrabold shrink-0 ${h.pct >= 100 ? 'text-emerald-600' : h.pct >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {fmtPctFr(h.pct)} {h.pct >= 100 ? '✅' : h.pct >= 70 ? '🟠' : '🔴'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== MODALE : NOUVEAU / MODIFIER UN OBJECTIF ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <Target className="w-4 h-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {editingGoal
                    ? t('Modifier l’objectif', 'Edit goal')
                    : t('Nouvel Objectif', 'New Goal')}
                </h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label={t('Fermer', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Grandeur suivie *', 'Tracked metric *')}
                </label>
                <select
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value as GoalMetric })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {t(m.labelFr, m.labelEn)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Intitulé de l’objectif', 'Goal title')}
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t(
                    DEFAULT_TITLE_BY_METRIC[form.metric][0],
                    DEFAULT_TITLE_BY_METRIC[form.metric][1]
                  )}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {t('Laissez vide pour utiliser l’intitulé par défaut.', 'Leave empty to use the default title.')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {form.metric === 'pieces'
                      ? t('Cible (unités) *', 'Target (units) *')
                      : t('Cible ($) *', 'Target ($) *')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    placeholder={form.metric === 'pieces' ? '200' : '10000'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t('Période *', 'Period *')}
                  </label>
                  <select
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value as GoalPeriod })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  >
                    {PERIOD_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {t(p.labelFr, p.labelEn)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                {t(
                  'La valeur atteinte est recalculée en direct à chaque vente ou dépense enregistrée.',
                  'The achieved value is recalculated live at every recorded sale or expense.'
                )}
              </p>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-wait"
              >
                {saving
                  ? t('Enregistrement...', 'Saving...')
                  : editingGoal
                    ? t('Enregistrer les modifications', 'Save changes')
                    : t('Créer l’objectif dans COMAXE', 'Create the goal in COMAXE')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
