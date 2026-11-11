'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Trash2,
  DollarSign,
  TrendingUp,
  History,
  Eye,
  Calendar,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Debt, DebtPayment, DebtStatus, DebtHistoryOperation } from '@/types';
import { useAppShell } from '@/context/AppShellContext';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getCurrency } from '@/lib/currencies';

// Date du jour au format JJ/MM/AAAA (défaut dynamique des formulaires)
const todayFr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function DettesPage() {
  const { setHeaderAction } = useAppShell();
  const {
    debts,
    debtOperations: historyOperations,
    addDebt,
    recordDebtPayment,
    deleteDebt,
    displayDateText,
    selectedDate,
    isDateMatching,
    formatAmount,
    storeProfile,
    products,
  } = useCommerce();
  const { t } = useI18n();

  const currencySymbol = getCurrency(storeProfile.currency)?.symbol ?? '';

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DebtStatus>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [filterByActiveDate, setFilterByActiveDate] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [debtToSettle, setDebtToSettle] = useState<Debt | null>(null);
  const [debtToView, setDebtToView] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);

  // Formulaire Nouvelle Dette
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState<number>(200);
  const [debtDate, setDebtDate] = useState(todayFr);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [formError, setFormError] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);

  // Formulaire Régler la Dette
  const [settleMode, setSettleMode] = useState<'partiel' | 'total'>('partiel');
  const [partialAmount, setPartialAmount] = useState<number>(50);
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayFr);

  // Menu contextuel ouvert (id de la dette)
  const [activeMenuDebtId, setActiveMenuDebtId] = useState<string | null>(null);

  // ==========================================
  // CALCULS GLOBAUX
  // ==========================================
  const nonPayees = debts.filter((d) => d.paidAmount === 0 && d.status === 'non_payee');
  const partiellementPayees = debts.filter(
    (d) => d.paidAmount > 0 && d.remainingAmount > 0 && d.status === 'partiellement_payee'
  );
  const payees = debts.filter((d) => d.remainingAmount === 0 && d.status === 'payee');

  const activeDebtsCount = nonPayees.length + partiellementPayees.length;
  const totalRemainingAmount = debts.reduce((acc, d) => acc + d.remainingAmount, 0);
  const totalRecoveredAmount = debts.reduce((acc, d) => acc + d.paidAmount, 0);
  const totalInitialAmount = debts.reduce((acc, d) => acc + d.initialAmount, 0);
  const recoveryRate = totalInitialAmount > 0 ? Math.round((totalRecoveredAmount / totalInitialAmount) * 100) : 0;

  // Filtrage des dettes
  const matchesFilter = (d: Debt) => {
    const matchesSearch =
      d.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(d.email && d.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesDate = !dateFilter || d.date.includes(dateFilter);
    const matchesGlobalDate = !filterByActiveDate || isDateMatching(d.date);
    return matchesSearch && matchesStatus && matchesDate && matchesGlobalDate;
  };

  const filteredNonPayees = nonPayees.filter(matchesFilter);
  const filteredPartiellementPayees = partiellementPayees.filter(matchesFilter);
  const filteredPayees = payees.filter(matchesFilter);

  // Filtrage de l'historique
  const filteredHistory = historyOperations.filter((op) => {
    const matchesSearch =
      op.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      op.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(op.email && op.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || op.status === statusFilter;
    const matchesDate = !dateFilter || op.date.includes(dateFilter);
    const matchesGlobalDate = !filterByActiveDate || isDateMatching(op.date);
    return matchesSearch && matchesStatus && matchesDate && matchesGlobalDate;
  });

  // ==========================================
  // HANDLERS (Connectés à la source unique CommerceContext)
  // ==========================================

  // 1. Enregistrer une nouvelle dette (la vente liée est créée automatiquement)
  const handleProductChange = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setAmount(Math.round(p.sellingPrice * quantity * 100) / 100);
  };

  const handleQuantityChange = (raw: number) => {
    const next = Math.max(1, Math.floor(raw) || 1);
    setQuantity(next);
    const p = products.find((x) => x.id === productId);
    if (p) setAmount(Math.round(p.sellingPrice * next * 100) / 100);
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!personName.trim() || amount <= 0) return;

    // Contrôle de stock avant enregistrement (le RPC revérifie)
    if (selectedProduct && quantity > selectedProduct.quantity) {
      setFormError(
        t('Stock insuffisant pour "{n}". Disponible : {a} (demandé : {b}).', 'Insufficient stock for "{n}". Available: {a} (requested: {b}).', {
          n: selectedProduct.name,
          a: selectedProduct.quantity,
          b: quantity,
        })
      );
      return;
    }

    const res = await addDebt({
      personName: personName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      initialAmount: Number(amount),
      date: debtDate || (selectedDate && selectedDate !== 'today' ? displayDateText : todayFr()),
      productId: selectedProduct?.id,
      productName: selectedProduct?.name,
      quantity,
    });

    if (!res.success) {
      setFormError(res.error || t("Échec de l'enregistrement de la dette", 'Failed to save the debt'));
      return;
    }

    // Reset & close
    setIsAddModalOpen(false);
    setPersonName('');
    setPhone('');
    setEmail('');
    setAmount(200);
    setProductId('');
    setQuantity(1);
    setFormError('');
  };

  // 2. Régler une dette (partiel ou total)
  const handleSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtToSettle) return;

    let paymentVal = 0;
    if (settleMode === 'total') {
      paymentVal = debtToSettle.remainingAmount;
    } else {
      paymentVal = Math.min(Number(partialAmount), debtToSettle.remainingAmount);
      if (paymentVal <= 0) return;
    }

    recordDebtPayment(
      debtToSettle.id,
      paymentVal,
      paymentNote.trim() ||
        (settleMode === 'total'
          ? t('Règlement total de la dette', 'Full debt settlement')
          : t('Paiement partiel', 'Partial payment')),
      paymentDate
    );

    // Close modal
    setDebtToSettle(null);
    setPaymentNote('');
    setActiveMenuDebtId(null);
  };

  // 3. Supprimer une dette après confirmation (Rule 19)
  const handleConfirmDelete = () => {
    if (!debtToDelete) return;
    deleteDebt(debtToDelete.id);
    setDebtToDelete(null);
    setActiveMenuDebtId(null);
  };

  // Helper statut badge
  const renderStatusBadge = (status: DebtStatus) => {
    switch (status) {
      case 'non_payee':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {t('Non payée', 'Unpaid')}
          </span>
        );
      case 'partiellement_payee':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('Payée en partie', 'Partially paid')}
          </span>
        );
      case 'payee':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t('Payée', 'Paid')}
          </span>
        );
    }
  };

  useEffect(() => {
    setHeaderAction({
      label: t('Nouvelle Dette', 'New Debt'),
      onClick: () => setIsAddModalOpen(true),
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction, t]);

  return (
    <div className="space-y-7">
          {/* Top Actions & KPI Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {t('Registre des Créances Clients', 'Customer Receivables Register')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {t('Toutes les opérations sont strictement enregistrées dans la devise du commerce', 'All operations are strictly recorded in the business currency')}
              </p>
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t('+ Nouvelle dette', '+ New debt')}</span>
            </button>
          </div>

          {/* 4 Cartes KPI COMAXE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('Dettes en Cours', 'Open Debts')}
                </span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {activeDebtsCount}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {t(
                  '{n} non payée(s) • {m} partielle(s)',
                  '{n} unpaid • {m} partial',
                  { n: nonPayees.length, m: partiellementPayees.length }
                )}
              </p>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('Reste à Récupérer', 'Left to Recover')}
                </span>
              </div>
              <p className="text-3xl font-extrabold text-rose-600 tracking-tight">
                {formatAmount(totalRemainingAmount)}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {t('Créances actives non soldées', 'Active unsettled receivables')}
              </p>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('Montant Recouvré', 'Amount Recovered')}
                </span>
              </div>
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                {formatAmount(totalRecoveredAmount)}
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {t('{n} dette(s) entièrement payée(s)', '{n} fully paid debt(s)', { n: payees.length })}
              </p>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('Taux de Recouvrement', 'Recovery Rate')}
                </span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {recoveryRate} %
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#1E5BF8] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, recoveryRate)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Recherche & Filtres Multi-sections */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Rechercher par nom, téléphone, e-mail...', 'Search by name, phone, email...')}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#1E5BF8] focus:ring-2 focus:ring-[#1E5BF8]/15 transition-all text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('Tous statuts', 'All statuses')}
                </button>
                <button
                  onClick={() => setStatusFilter('non_payee')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'non_payee'
                      ? 'bg-white text-rose-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('Non payées', 'Unpaid')}
                </button>
                <button
                  onClick={() => setStatusFilter('partiellement_payee')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'partiellement_payee'
                      ? 'bg-white text-amber-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('Partielles', 'Partial')}
                </button>
                <button
                  onClick={() => setStatusFilter('payee')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    statusFilter === 'payee'
                      ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {t('Payées', 'Paid')}
                </button>
              </div>

              <button
                onClick={() => setFilterByActiveDate(!filterByActiveDate)}
                aria-pressed={filterByActiveDate}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterByActiveDate
                    ? 'bg-blue-50 text-[#1E5BF8] border border-blue-200 shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={t('Filtrer les opérations selon la date active', 'Filter operations by active date')}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {filterByActiveDate
                    ? t('Filtre: 📅 {d}', 'Filter: 📅 {d}', { d: displayDateText })
                    : t('Filtrer par date ({d})', 'Filter by date ({d})', { d: displayDateText })}
                </span>
              </button>

              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold"
                >
                  {t('Effacer filtre date', 'Clear date filter')}
                </button>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 1. EN HAUT : HISTORIQUE DES DETTES (EXIGENCE 1 & 11)     */}
          {/* ========================================================= */}
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {t('Historique des Dettes', 'Debt History')}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {t("Conserve l'ensemble des opérations et règlements, même lorsque la dette est entièrement soldée", 'Keeps all operations and settlements, even when the debt is fully settled')}
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {t('{n} opération(s) enregistrée(s)', '{n} recorded operation(s)', { n: filteredHistory.length })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-4">{t('Opération', 'Operation')}</th>
                    <th className="py-3 px-4">{t('Personne', 'Person')}</th>
                    <th className="py-3 px-4 text-right">{t('Dette Initiale', 'Initial Debt')}</th>
                    <th className="py-3 px-4 text-right">{t('Paiement', 'Payment')}</th>
                    <th className="py-3 px-4 text-right">{t('Total Payé', 'Total Paid')}</th>
                    <th className="py-3 px-4 text-right">{t('Montant Restant', 'Remaining Amount')}</th>
                    <th className="py-3 px-4 text-center">{t('Statut', 'Status')}</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredHistory.length > 0 ? (
                    filteredHistory.map((op) => (
                      <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-slate-600">
                          {op.date}
                        </td>
                        <td className="py-3.5 px-4">
                          {/* Type d'événement : création, paiement partiel ou paiement total */}
                          {op.type === 'creation' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1E5BF8] border border-blue-200/80">
                              <Plus className="w-3 h-3" />
                              {t('Création', 'Creation')}
                            </span>
                          ) : op.status === 'payee' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('Paiement total', 'Full payment')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                              <Clock className="w-3 h-3" />
                              {t('Paiement partiel', 'Partial payment')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>
                            <p>{op.personName}</p>
                            <p className="text-[11px] text-slate-400 font-normal">{op.phone}</p>
                            {op.productName && (
                              <p className="text-[11px] text-[#1E5BF8] font-semibold">
                                {op.productName}
                                {(op.quantity ?? 1) > 1 ? ` × ${op.quantity}` : ''}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                          {formatAmount(op.initialAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          {op.paymentAmount > 0 ? `+ ${formatAmount(op.paymentAmount)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                          {formatAmount(op.totalPaid)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">
                          {formatAmount(op.remainingAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderStatusBadge(op.status)}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => {
                              const found = debts.find((d) => d.id === op.debtId);
                              if (found) setDebtToView(found);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-[#1E5BF8] hover:bg-blue-50 font-semibold text-xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('Voir détails', 'View details')}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                        {t("Aucune opération dans l'historique correspondant aux filtres.", 'No operation in history matching the filters.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 2. BLOC « DETTES NON PAYÉES » (EXIGENCE 1 & 3)             */}
          {/* ========================================================= */}
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {t('Dettes non payées', 'Unpaid debts')}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {t("Personnes n'ayant encore effectué aucun versement (Montant payé = {a})", 'People who have not made any payment yet (Amount paid = {a})', { a: formatAmount(0) })}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">
                {t('{n} dossier(s)', '{n} record(s)', { n: filteredNonPayees.length })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">{t('Nom', 'Name')}</th>
                    <th className="py-3 px-4">{t('Téléphone', 'Phone')}</th>
                    <th className="py-3 px-4">{t('E-mail', 'Email')}</th>
                    <th className="py-3 px-4">{t('Produit', 'Product')}</th>
                    <th className="py-3 px-4 text-right">{t('Montant à payer', 'Amount due')}</th>
                    <th className="py-3 px-4 text-center">{t('Statut', 'Status')}</th>
                    <th className="py-3 px-5 text-right">⋮</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredNonPayees.length > 0 ? (
                    filteredNonPayees.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {d.personName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {d.phone || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {d.email || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {d.productName ? `${d.productName}${(d.quantity ?? 1) > 1 ? ` × ${d.quantity}` : ''}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                          {formatAmount(d.remainingAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderStatusBadge(d.status)}
                        </td>
                        <td className="py-3.5 px-5 text-right relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() =>
                                setActiveMenuDebtId(activeMenuDebtId === d.id ? null : d.id)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuDebtId === d.id && (
                              <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-20 text-left">
                                <button
                                  onClick={() => {
                                    setDebtToSettle(d);
                                    setSettleMode('partiel');
                                    setPartialAmount(Math.min(50, d.remainingAmount));
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1E5BF8] flex items-center gap-2 transition-colors"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>{t('Régler la dette', 'Settle the debt')}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDebtToDelete(d);
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{t('Supprimer', 'Delete')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        {t('Aucune dette non payée en cours.', 'No unpaid debt currently.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 3. BLOC « DETTES PARTIELLEMENT PAYÉES » (EXIGENCE 1 & 7)   */}
          {/* ========================================================= */}
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {t('Dettes partiellement payées', 'Partially paid debts')}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {t('Personnes ayant versé un ou plusieurs acomptes avec solde restant', 'People who made one or more deposits with a remaining balance')}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                {t('{n} dossier(s)', '{n} record(s)', { n: filteredPartiellementPayees.length })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">{t('Nom', 'Name')}</th>
                    <th className="py-3 px-4">{t('Téléphone', 'Phone')}</th>
                    <th className="py-3 px-4">{t('E-mail', 'Email')}</th>
                    <th className="py-3 px-4">{t('Produit', 'Product')}</th>
                    <th className="py-3 px-4 text-right">{t('Dette Initiale', 'Initial Debt')}</th>
                    <th className="py-3 px-4 text-right">{t('Montant Payé', 'Amount Paid')}</th>
                    <th className="py-3 px-4 text-right">{t('Montant Restant', 'Remaining Amount')}</th>
                    <th className="py-3 px-4 text-center">{t('Statut', 'Status')}</th>
                    <th className="py-3 px-5 text-right">⋮</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPartiellementPayees.length > 0 ? (
                    filteredPartiellementPayees.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {d.personName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {d.phone || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {d.email || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {d.productName ? `${d.productName}${(d.quantity ?? 1) > 1 ? ` × ${d.quantity}` : ''}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                          {formatAmount(d.initialAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          {formatAmount(d.paidAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-rose-600">
                          {formatAmount(d.remainingAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderStatusBadge(d.status)}
                        </td>
                        <td className="py-3.5 px-5 text-right relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() =>
                                setActiveMenuDebtId(activeMenuDebtId === d.id ? null : d.id)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuDebtId === d.id && (
                              <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-20 text-left">
                                <button
                                  onClick={() => {
                                    setDebtToSettle(d);
                                    setSettleMode('partiel');
                                    setPartialAmount(Math.min(50, d.remainingAmount));
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#1E5BF8] flex items-center gap-2 transition-colors"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>{t('Régler la dette', 'Settle the debt')}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDebtToView(d);
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{t('Voir les détails', 'View details')}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDebtToDelete(d);
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{t('Supprimer', 'Delete')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                        {t('Aucune dette partiellement payée.', 'No partially paid debt.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 4. BLOC « DETTES PAYÉES » (EXIGENCE 1 & 10)                 */}
          {/* ========================================================= */}
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {t('Dettes payées', 'Paid debts')}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {t('Créances entièrement réglées par les personnes (Montant restant = {a})', 'Receivables fully settled by the people (Remaining amount = {a})', { a: formatAmount(0) })}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                {t('{n} dossier(s) réglé(s)', '{n} settled record(s)', { n: filteredPayees.length })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">{t('Nom', 'Name')}</th>
                    <th className="py-3 px-4">{t('Téléphone', 'Phone')}</th>
                    <th className="py-3 px-4">{t('E-mail', 'Email')}</th>
                    <th className="py-3 px-4">{t('Produit', 'Product')}</th>
                    <th className="py-3 px-4 text-right">{t('Dette Initiale', 'Initial Debt')}</th>
                    <th className="py-3 px-4 text-right">{t('Montant Payé', 'Amount Paid')}</th>
                    <th className="py-3 px-4">{t('Date de Paiement', 'Payment Date')}</th>
                    <th className="py-3 px-4 text-center">{t('Statut', 'Status')}</th>
                    <th className="py-3 px-5 text-right">⋮</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPayees.length > 0 ? (
                    filteredPayees.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {d.personName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {d.phone || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {d.email || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {d.productName ? `${d.productName}${(d.quantity ?? 1) > 1 ? ` × ${d.quantity}` : ''}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                          {formatAmount(d.initialAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                          {formatAmount(d.paidAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {d.lastPaymentDate || d.date}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {renderStatusBadge(d.status)}
                        </td>
                        <td className="py-3.5 px-5 text-right relative">
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() =>
                                setActiveMenuDebtId(activeMenuDebtId === d.id ? null : d.id)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuDebtId === d.id && (
                              <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-20 text-left">
                                <button
                                  onClick={() => {
                                    setDebtToView(d);
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{t('Voir les détails', 'View details')}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setDebtToDelete(d);
                                    setActiveMenuDebtId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{t('Supprimer', 'Delete')}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                        {t('Aucune dette payée archivée.', 'No paid debt archived.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

      {/* ========================================================= */}
      {/* MODAL 1 : + NOUVELLE DETTE (EXIGENCE 2)                   */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-[#1E5BF8] uppercase tracking-wider">
                  {t('Nouveau Dossier Créance', 'New Receivable Record')}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {t('Enregistrer une nouvelle dette', 'Record a new debt')}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('Nom de la personne', 'Person name')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={t('Ex : Jean Mukendi', 'E.g.: John Mukendi')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Numéro de téléphone', 'Phone number')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex : +243 81 777 6655"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Adresse e-mail', 'Email address')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('Ex : client@gmail.com', 'E.g.: client@gmail.com')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Montant de la dette ({s})', 'Debt amount ({s})', { s: currencySymbol })} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Date de la dette', 'Debt date')}
                  </label>
                  <input
                    type="text"
                    value={debtDate}
                    onChange={(e) => setDebtDate(e.target.value)}
                    placeholder={t('JJ/MM/AAAA', 'DD/MM/YYYY')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
              </div>

              {/* Produit endetté + quantité (vente automatique liée) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Produit endetté', 'Product on credit')}
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  >
                    <option value="">{t('— Aucun produit (créance libre) —', '— No product (free credit) —')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {formatAmount(p.sellingPrice)} · {p.quantity}
                      </option>
                    ))}
                  </select>
                  {products.length === 0 && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t('Aucun produit dans le catalogue — ajoutez-en dans Produits & Stock.', 'No product in the catalogue — add one in Products & Stock.')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Quantité', 'Quantity')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-[#1E5BF8]">{t("Règles d'initialisation :", 'Initialization rules:')}</p>
                <p>{t('• Montant payé initial : ', '• Initial amount paid: ')}<strong>{formatAmount(0)}</strong></p>
                <p>{t('• Montant restant initial : ', '• Initial remaining amount: ')}<strong>{formatAmount(amount)}</strong></p>
                <p>
                  {t('• Statut de départ : ', '• Starting status: ')}
                  <strong>{t('Non payée', 'Unpaid')}</strong>
                  {t(' (Classée dans le bloc correspondant)', ' (Filed in the matching section)')}
                </p>
                <p>
                  {t('• Vente automatique liée : ', '• Linked automatic sale: ')}
                  <strong>
                    {selectedProduct
                      ? `${formatAmount(amount)} — ${selectedProduct.name} × ${quantity}`
                      : formatAmount(amount)}
                  </strong>
                </p>
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                >
                  {t('Annuler', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all"
                >
                  {t('Enregistrer la dette', 'Save the debt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2 : RÉGLER LA DETTE (EXIGENCES 4, 5, 8, 9)          */}
      {/* ========================================================= */}
      {debtToSettle && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-[#1E5BF8] uppercase tracking-wider">
                  {t('Règlement de Créance', 'Receivable Settlement')}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {t('Régler la dette — {n}', 'Settle debt — {n}', { n: debtToSettle.personName })}
                </h3>
              </div>
              <button
                onClick={() => setDebtToSettle(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Récapitulatif clair de la dette */}
            <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t('Dette Initiale', 'Initial Debt')}
                </span>
                <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatAmount(debtToSettle.initialAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t('Déjà Payé', 'Already Paid')}
                </span>
                <span className="text-base font-extrabold text-emerald-600 mt-0.5 block">
                  {formatAmount(debtToSettle.paidAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {t('Montant Restant', 'Remaining Amount')}
                </span>
                <span className="text-base font-black text-rose-600 mt-0.5 block">
                  {formatAmount(debtToSettle.remainingAmount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSettleDebt} className="space-y-4">
              {/* Choix : Payer une partie ou Payer en totalité */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {t('Mode de règlement', 'Settlement mode')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      settleMode === 'partiel'
                        ? 'border-[#1E5BF8] bg-blue-50/50 ring-2 ring-[#1E5BF8]/15'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="settleMode"
                      checked={settleMode === 'partiel'}
                      onChange={() => setSettleMode('partiel')}
                      className="w-4 h-4 text-[#1E5BF8] focus:ring-[#1E5BF8]"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{t('○ Payer une partie', '○ Pay a part')}</p>
                      <p className="text-[11px] text-slate-500">{t('Acompte intermédiaire', 'Intermediate deposit')}</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      settleMode === 'total'
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/15'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="settleMode"
                      checked={settleMode === 'total'}
                      onChange={() => setSettleMode('total')}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{t('○ Payer en totalité', '○ Pay in full')}</p>
                      <p className="text-[11px] text-slate-500">
                        {t('Solde {a}', 'Balance {a}', { a: formatAmount(debtToSettle.remainingAmount) })}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Champ conditionnel : SI PARTIEL -> champ montant affiché, SI TOTAL -> DISPARAÎT AUTOMATIQUEMENT (Exigence 9) */}
              {settleMode === 'partiel' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {t('Montant à payer ({s})', 'Amount to pay ({s})', { s: currencySymbol })} <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {t('Max : {a}', 'Max: {a}', { a: formatAmount(debtToSettle.remainingAmount) })}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={debtToSettle.remainingAmount}
                    required
                    value={partialAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPartialAmount(Math.min(val, debtToSettle.remainingAmount));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                  {/* Prévisualisation dynamique du calcul (Exigence 6 & 8) */}
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {t('Calcul du restant après ce paiement :', 'Remaining calculation after this payment:')}
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatAmount(debtToSettle.remainingAmount)} − {formatAmount(partialAmount)} ={' '}
                      <strong className="text-rose-600">
                        {formatAmount(Math.max(0, debtToSettle.remainingAmount - partialAmount))}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {t('Règlement intégral automatique : ', 'Automatic full settlement: ')}
                    <strong>{formatAmount(debtToSettle.remainingAmount)}</strong>
                    {t('. Le solde restant passera à ', '. The remaining balance will become ')}
                    <strong>{formatAmount(0)}</strong>
                    {t(' et le dossier sera classé dans ', ' and the record will be filed under ')}
                    <strong>{t('Dettes payées', 'Paid debts')}</strong>.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Date du paiement', 'Payment date')}
                  </label>
                  <input
                    type="text"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('Note / Mode de règlement', 'Note / Settlement mode')}
                  </label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder={t('Ex : Espèces, Mobile Money...', 'E.g.: Cash, Mobile Money...')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/15 focus:border-[#1E5BF8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDebtToSettle(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
                >
                  {t('Annuler', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all"
                >
                  {t('Enregistrer le paiement', 'Save the payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3 : VOIR LES DÉTAILS / HISTORIQUE (EXIGENCE 10 & 12) */}
      {/* ========================================================= */}
      {debtToView && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-[#1E5BF8] uppercase tracking-wider">
                  {t('Détail & Historique des Versements', 'Details & Payment History')}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {debtToView.personName}
                </h3>
              </div>
              <button
                onClick={() => setDebtToView(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fiche coordonnées & soldes */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Téléphone :', 'Phone:')}</span>
                <span className="font-bold text-slate-800">
                  {debtToView.phone || t('Non renseigné', 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('E-mail :', 'Email:')}</span>
                <span className="font-semibold text-slate-800">
                  {debtToView.email || t('Non renseigné', 'Not provided')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("Date d'enregistrement :", 'Registration date:')}</span>
                <span className="font-semibold text-slate-800">{debtToView.date}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">{t('Dette initiale :', 'Initial debt:')}</span>
                <span className="font-extrabold text-slate-900">{formatAmount(debtToView.initialAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Total payé :', 'Total paid:')}</span>
                <span className="font-extrabold text-emerald-600">{formatAmount(debtToView.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('Montant restant :', 'Remaining amount:')}</span>
                <span className="font-black text-rose-600">{formatAmount(debtToView.remainingAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">{t('Statut actuel :', 'Current status:')}</span>
                <div>{renderStatusBadge(debtToView.status)}</div>
              </div>
            </div>

            {/* Timeline des paiements (Exigence 12) */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                {t('Historique des paiements ({n})', 'Payment history ({n})', { n: debtToView.payments.length })}
              </h4>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {debtToView.payments.length > 0 ? (
                  debtToView.payments.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.date}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {p.note || t('Versement', 'Payment')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-emerald-600 block">
                          + {formatAmount(p.amount)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {t('restant : {a}', 'remaining: {a}', { a: formatAmount(p.remainingAfter) })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    {t("Aucun paiement n'a encore été enregistré pour cette dette.", 'No payment has been recorded for this debt yet.')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDebtToView(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                {t('Fermer', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4 : CONFIRMATION SUPPRESSION (EXIGENCE 13)          */}
      {/* ========================================================= */}
      {debtToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl relative space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                {t('Supprimer cette dette ?', 'Delete this debt?')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('Voulez-vous vraiment supprimer cette dette ?', 'Do you really want to delete this debt?')}
                <br />
                {t('Dossier de ', 'Record of ')}
                <strong className="text-slate-800">{debtToDelete.personName}</strong>
                {t(' (Montant restant : {a}).', ' (Remaining amount: {a}).', {
                  a: formatAmount(debtToDelete.remainingAmount),
                })}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setDebtToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-700 shadow-xs transition-colors"
              >
                {t('Annuler', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/25 transition-colors"
              >
                {t('Oui, supprimer', 'Yes, delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
