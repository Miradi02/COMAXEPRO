'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Truck,
  Zap,
  Package,
  Home,
  Wifi,
  Users,
  Trash2,
  X,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { ExpenseCategory } from '@/types';
import { useAppShell } from '@/context/AppShellContext';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getCurrency } from '@/lib/currencies';

export default function DepensesPage() {
  const { setHeaderAction } = useAppShell();
  const {
    expenses,
    filteredExpenses,
    addExpense,
    deleteExpense,
    requestConfirmation,
    displayDateText,
    selectedDate,
    formatAmount,
    storeProfile,
  } = useCommerce();
  const { t } = useI18n();

  const currencySymbol = getCurrency(storeProfile.currency)?.symbol ?? '';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAllDates, setShowAllDates] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New expense form
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('transport');
  const [newAmount, setNewAmount] = useState<number>(20);

  // Source list: filtered by global active date unless user requests all dates
  const baseExpenses = showAllDates ? expenses : filteredExpenses;

  const displayedExpenses = baseExpenses.filter((e) => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const matchesSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const activeDateExpensesTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const transportAndSupplyExpenses = expenses
    .filter((e) => e.category === 'approvisionnement' || e.category === 'transport')
    .reduce((sum, e) => sum + e.amount, 0);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim() || newAmount <= 0) return;

    addExpense({
      date: selectedDate && selectedDate !== 'today' ? `${displayDateText}, 12:00` : t("Aujourd'hui, 16:10", 'Today, 16:10'),
      category: newCategory,
      description: newDesc.trim(),
      amount: Number(newAmount),
    });

    setIsAddModalOpen(false);
    setNewDesc('');
    setNewAmount(20);
  };

  const handleDeleteExpense = (id: string) => {
    // Rule 19 & 20: Confirm deletion of expense, recalculate profit & totals
    requestConfirmation({
      title: t('Suppression de dépense', 'Delete expense'),
      message: t('Voulez-vous vraiment supprimer cette dépense ?', 'Do you really want to delete this expense?'),
      onConfirm: () => {
        deleteExpense(id);
      },
    });
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'approvisionnement':
        return <Package className="w-3.5 h-3.5 text-blue-600" />;
      case 'transport':
        return <Truck className="w-3.5 h-3.5 text-amber-600" />;
      case 'electricite':
        return <Zap className="w-3.5 h-3.5 text-yellow-600" />;
      case 'loyer':
        return <Home className="w-3.5 h-3.5 text-purple-600" />;
      case 'internet':
        return <Wifi className="w-3.5 h-3.5 text-cyan-600" />;
      case 'salaires':
        return <Users className="w-3.5 h-3.5 text-emerald-600" />;
      case 'autres':
      default:
        return <Receipt className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  // Libellé traduit de la catégorie (la valeur stockée reste en clé)
  const getCategoryLabel = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'approvisionnement':
        return t('Approvisionnement', 'Supplies');
      case 'transport':
        return t('Transport', 'Transport');
      case 'loyer':
        return t('Loyer', 'Rent');
      case 'electricite':
        return t('Électricité', 'Electricity');
      case 'internet':
        return 'Internet';
      case 'salaires':
        return t('Salaires', 'Salaries');
      case 'autres':
      default:
        return t('Autres', 'Other');
    }
  };

  useEffect(() => {
    setHeaderAction({
      label: t('Enregistrer une Dépense', 'Record an Expense'),
      onClick: () => setIsAddModalOpen(true),
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction, t]);

  return (
    <div className="space-y-6">
      {/* Active Global Date Notification Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#1E5BF8]" />
          <span className="text-xs font-semibold text-slate-700">
            {t('Filtre actif : ', 'Active filter: ')}<strong className="text-slate-900">📅 {displayDateText}</strong>
          </span>
          <span className="text-xs text-slate-400">
            {t(
              `(${filteredExpenses.length} dépense${filteredExpenses.length !== 1 ? 's' : ''} trouvée${filteredExpenses.length !== 1 ? 's' : ''})`,
              `(${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''} found)`
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAllDates(!showAllDates)}
            aria-pressed={showAllDates}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              showAllDates
                ? 'bg-blue-50 text-[#1E5BF8] border border-blue-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {showAllDates
              ? t('Filtrer par date active', 'Filter by active date')
              : t('Afficher toutes les dates', 'Show all dates')}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Dépenses ({d})', 'Expenses ({d})', { d: displayDateText })}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(activeDateExpensesTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              `${filteredExpenses.length} opération${filteredExpenses.length !== 1 ? 's' : ''} enregistrée${filteredExpenses.length !== 1 ? 's' : ''}`,
              `${filteredExpenses.length} operation${filteredExpenses.length !== 1 ? 's' : ''} recorded`
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Dépenses Totales', 'Total Expenses')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(totalMonthExpenses)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('Charges fixes + variables du commerce', 'Fixed + variable business costs')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Approvisionnement & Transport', 'Supplies & Transport')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(transportAndSupplyExpenses)}
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            {totalMonthExpenses > 0
              ? t('{p}% du budget total dépensé', '{p}% of total budget spent', {
                  p: Math.round((transportAndSupplyExpenses / totalMonthExpenses) * 100),
                })
              : t('0% du budget', '0% of budget')}
          </p>
        </div>
      </div>

      {/* Expenses List Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        {/* Header controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t('Journal des Dépenses', 'Expense Journal')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Toutes les dépenses décaissées pour le fonctionnement de la boutique', 'All expenses paid out to run the store')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('Filtrer dépense...', 'Filter expense...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
              />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('Enregistrer Dépense', 'Record Expense')}</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 rounded-l-xl">{t('Date & Heure', 'Date & Time')}</th>
                <th className="py-3 px-4">{t('Catégorie', 'Category')}</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">{t('Montant ({s})', 'Amount ({s})', { s: currencySymbol })}</th>
                <th className="py-3 px-4 text-center rounded-r-xl">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {displayedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {t('Aucune dépense enregistrée pour cette période.', 'No expenses recorded for this period.')}
                  </td>
                </tr>
              ) : (
                displayedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                          {exp.id}
                        </span>
                        <span>{exp.date}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">
                        {getCategoryIcon(exp.category)}
                        {getCategoryLabel(exp.category)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-rose-600 text-sm whitespace-nowrap">
                      -{formatAmount(exp.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={t('Supprimer la dépense', 'Delete expense')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Enregistrer une Dépense */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {t('Enregistrer une Dépense', 'Record an Expense')}
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Catégorie de charge *', 'Cost category *')}
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                >
                  <option value="approvisionnement">{t('Approvisionnement marchand', 'Merchant supplies')}</option>
                  <option value="transport">{t('Transport / Course réassort', 'Transport / Restock trip')}</option>
                  <option value="loyer">{t('Loyer du local', 'Premises rent')}</option>
                  <option value="electricite">{t('Électricité & Compteur', 'Electricity & Meter')}</option>
                  <option value="internet">{t('Connexion Internet', 'Internet Connection')}</option>
                  <option value="salaires">{t('Salaires & Commissions', 'Salaries & Commissions')}</option>
                  <option value="autres">{t('Autres frais divers', 'Other miscellaneous fees')}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Description / Justificatif *', 'Description / Receipt *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('ex: Frais taxi aller-retour grossiste', 'e.g. Round-trip taxi fee to wholesaler')}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Montant Décaissé ({s}) *', 'Amount Paid ({s}) *', { s: currencySymbol })}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newAmount}
                  onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 active:scale-95 transition-all mt-2"
              >
                {t('Valider la Dépense dans COMAXE', 'Confirm Expense in COMAXE')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
