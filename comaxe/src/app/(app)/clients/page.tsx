'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  ShoppingBag,
  Trash2,
  X,
  UserCheck,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useAppShell } from '@/context/AppShellContext';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';

export default function ClientsPage() {
  const { setHeaderAction } = useAppShell();
  const {
    customers,
    addCustomer,
    deleteCustomer,
    requestConfirmation,
    formatAmount,
  } = useCommerce();
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // New customer form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalSpentAllCustomers = customers.reduce((acc, c) => acc + c.totalSpent, 0);
  const totalPurchasesCount = customers.reduce((acc, c) => acc + c.purchasesCount, 0);
  const averageCustomerBasket =
    totalPurchasesCount > 0 ? Math.round(totalSpentAllCustomers / totalPurchasesCount) : 0;

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setAddError(null);
    const res = await addCustomer({
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
    });

    // Limite d'abonnement atteinte → modale ouverte + message centralisé
    if (!res.success) {
      setAddError(res.error || t("Échec de l'enregistrement du client", 'Failed to save the customer'));
      return;
    }

    setIsAddModalOpen(false);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
  };

  const handleDeleteCustomer = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Rule 19 & 22: Confirm deletion of customer; preserve historical sales
    requestConfirmation({
      title: t('Suppression de client', 'Delete customer'),
      message: t('Voulez-vous vraiment supprimer ce client ?', 'Do you really want to delete this customer?'),
      onConfirm: () => {
        deleteCustomer(id);
      },
    });
  };

  useEffect(() => {
    setHeaderAction({
      label: t('Nouveau Client', 'New Customer'),
      onClick: () => { setAddError(null); setIsAddModalOpen(true); },
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction, t]);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Clients Enregistrés', 'Registered Customers')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {customers.length} contacts
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('Base client locale sécurisée', 'Secure local customer database')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t("Volume d'Achats Cumulé", 'Cumulative Purchase Volume')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(totalSpentAllCustomers)}
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            {t('{n} achats enregistrés au total', '{n} recorded purchases in total', { n: totalPurchasesCount })}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <UserCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Panier Moyen Client', 'Average Customer Basket')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(averageCustomerBasket)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('Dépense moyenne par passage en caisse', 'Average spend per checkout')}
          </p>
        </div>
      </div>

      {/* Customers List Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        {/* Header controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t('Répertoire des Clients', 'Customer Directory')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Historique des clients réels ayant effectué des achats', 'History of real customers who made purchases')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('Rechercher client ou tél...', 'Search customer or phone...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
              />
            </div>

            <button
              onClick={() => { setAddError(null); setIsAddModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('Nouveau Client', 'New Customer')}</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 rounded-l-xl">Client</th>
                <th className="py-3 px-4">{t('Téléphone', 'Phone')}</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">{t('Achats', 'Purchases')}</th>
                <th className="py-3 px-4 text-right">{t('Dépenses Cumulées', 'Cumulative Spend')}</th>
                <th className="py-3 px-4">{t('Dernier Achat', 'Last Purchase')}</th>
                <th className="py-3 px-4 text-center rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t('Aucun client trouvé dans le répertoire.', 'No customer found in the directory.')}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/clients/${c.id}`}
                        className="flex items-center gap-3 group-hover:text-[#1E5BF8] transition-colors"
                      >
                        <img
                          src={c.avatar}
                          alt={c.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-[#1E5BF8] transition-colors flex items-center gap-1">
                            {c.name}
                            <ChevronRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                          <span className="text-[10px] text-slate-400">ID: {c.id}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {c.email ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">{t('Non renseigné', 'Not provided')}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8]">
                        {t('{n} achats', '{n} purchases', { n: c.purchasesCount })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                      {formatAmount(c.totalSpent)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {c.lastPurchaseDate}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/clients/${c.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1E5BF8] hover:bg-blue-50 transition-colors"
                          title={t('Voir la fiche détaillée', 'View detailed profile')}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={(e) => handleDeleteCustomer(c.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title={t('Supprimer la fiche client', 'Delete customer record')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Ajouter un Client */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {t('Enregistrer un Nouveau Client', 'Record a New Customer')}
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Nom Complet *', 'Full Name *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('ex: Jean Mukendi', 'e.g. John Mukendi')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Numéro de Téléphone *', 'Phone Number *')}
                </label>
                <input
                  type="tel"
                  required
                  placeholder="ex: +243 81 234 5678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Adresse Email (optionnelle)', 'Email Address (optional)')}
                </label>
                <input
                  type="email"
                  placeholder={t('ex: client@gmail.com', 'e.g. customer@gmail.com')}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              {addError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-rose-700 leading-relaxed">{addError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all mt-2"
              >
                {t('Enregistrer le Client dans COMAXE', 'Save Customer in COMAXE')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
