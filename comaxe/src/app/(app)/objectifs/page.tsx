'use client';

import React, { useEffect, useState } from 'react';
import {
  Target,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useCommerce, type MutationResult } from '@/context/CommerceContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { useAppShell } from '@/context/AppShellContext';
import { FeatureLocked } from '@/components/billing/FeatureLocked';
import { isFeatureUnlocked } from '@/lib/billing/entitlements';
import { getCurrentMonthLabel } from '@/lib/dateUtils';
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

const EMPTY_FORM = { metric: 'sales' as GoalMetric, title: '', target: '', period: 'mois' as GoalPeriod };

export default function ObjectifsPage() {
  const { goals, goalRecords, addGoal, updateGoal, deleteGoal, formatAmount, requestConfirmation } = useCommerce();
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

  const monthLabel = getCurrentMonthLabel(locale);

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
      {/* Introduction Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <Target className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {t('Objectifs Mensuels du Commerce', 'Monthly Business Goals')}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('Chaque vente ou dépense enregistrée dans COMAXE recalcule instantanément votre avancement.', 'Every sale or expense recorded in COMAXE instantly recalculates your progress.')}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-200 inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {t('Mois en cours : ', 'Current month: ')}{monthLabel}
          </span>
          <button
            onClick={() => {
              setEditingGoal(null);
              setForm(EMPTY_FORM);
              setFormError('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Nouvel Objectif', 'New Goal')}</span>
          </button>
        </div>
      </div>

      {/* Grille des Objectifs */}
      {goals.length === 0 ? (
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
          {goals.map((g) => {
            const IconComp = g.metric ? ICON_BY_METRIC[g.metric] : Target;
            const isOverExpenses = g.metric === 'expenses' && g.percentage > 100;

            return (
              <div
                key={g.id}
                className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-blue-50 text-[#1E5BF8] shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate" title={g.title}>
                          {g.title}
                        </h3>
                        <span className="text-xs text-slate-400 block truncate">
                          {g.period}{g.category ? ` • ${g.category}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Actions : Modifier / Supprimer */}
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
                        onClick={() => handleDelete(g.id, g.title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={t('Supprimer cet objectif', 'Delete this goal')}
                        aria-label={t('Supprimer cet objectif', 'Delete this goal')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {g.status && (
                    <span
                      className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border mb-3 ${
                        isOverExpenses
                          ? 'text-rose-700 bg-rose-50 border-rose-200/60'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200/60'
                      }`}
                    >
                      {g.status}
                    </span>
                  )}

                  {/* Progression Values */}
                  <div className="my-5">
                    <div className="flex justify-between items-baseline mb-2 gap-2">
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {g.isCount ? `${g.currentUSD} ${g.unit || t('articles', 'items')}` : formatAmount(g.currentUSD)}
                      </span>
                      <span className="text-xs font-bold text-slate-400 shrink-0">
                        {g.isCount
                          ? t('Cible : {v}', 'Target: {v}', { v: `${g.targetUSD} ${g.unit || t('articles', 'items')}` })
                          : t('Cible : {v}', 'Target: {v}', { v: formatAmount(g.targetUSD) })}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isOverExpenses ? 'bg-rose-500' : 'bg-[#1E5BF8]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, g.percentage))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom percentage */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">{t('Taux de réalisation :', 'Achievement rate:')}</span>
                  <span className={`text-base font-extrabold ${isOverExpenses ? 'text-rose-600' : 'text-[#1E5BF8]'}`}>
                    {g.percentage} %
                  </span>
                </div>
              </div>
            );
          })}
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
