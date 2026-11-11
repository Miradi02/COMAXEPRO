'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Trash2,
  Edit2,
  AlertTriangle,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { Customer, Sale } from '@/types';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getCurrency } from '@/lib/currencies';

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { customers, sales, deleteCustomer, updateCustomer, requestConfirmation, formatAmount, storeProfile } = useCommerce();
  const { t } = useI18n();

  const currencySymbol = getCurrency(storeProfile.currency)?.symbol ?? '';

  const clientId = (params?.id as string) || '';
  const customer = customers.find((c) => c.id === clientId) || customers[0];

  // Ventes associées à ce client (historique toujours préservé même si modifié)
  const customerSales = sales.filter(
    (s) =>
      customer &&
      (s.client.name.toLowerCase() === customer.name.toLowerCase() ||
        (s.client.phone && s.client.phone === customer.phone))
  );

  const [showEditModal, setShowEditModal] = useState(false);

  // Formulaire d'édition
  const [editName, setEditName] = useState(customer?.name || '');
  const [editPhone, setEditPhone] = useState(customer?.phone || '');
  const [editEmail, setEditEmail] = useState(customer?.email || '');

  if (!customer) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs max-w-xl mx-auto my-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {t('Client introuvable', 'Customer not found')}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {t("Cette fiche client n'existe pas ou a été supprimée de la liste active.", 'This customer record does not exist or has been removed from the active list.')}
        </p>
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E5BF8] text-white font-bold text-sm shadow-md shadow-blue-500/25"
        >
          {t('Retourner au répertoire clients', 'Back to customer directory')}
        </Link>
      </div>
    );
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomer(customer.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim() || undefined,
    });
    setShowEditModal(false);
  };

  const handleDelete = () => {
    // Rule 19 & 22: Confirm deletion of customer; preserve historical sales
    requestConfirmation({
      title: t('Suppression de client', 'Delete customer'),
      message: t('Voulez-vous vraiment supprimer ce client ?', 'Do you really want to delete this customer?'),
      onConfirm: () => {
        deleteCustomer(customer.id);
        router.push('/clients');
      },
    });
  };

  const averageBasket =
    customer.purchasesCount > 0
      ? Math.round(customer.totalSpent / customer.purchasesCount)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Actions Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('Retour au Répertoire', 'Back to Directory')}</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditName(customer.name);
              setEditPhone(customer.phone);
              setEditEmail(customer.email || '');
              setShowEditModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{t('Modifier', 'Edit')}</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('Supprimer', 'Delete')}</span>
          </button>
        </div>
      </div>

      {/* Customer Header Profile Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <img
              src={customer.avatar}
              alt={customer.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl object-cover border-2 border-white shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {customer.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1E5BF8]">
                  {t('Client Actif', 'Active Customer')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {t('Fiche créée pour le commerce COMAXE', 'Record created for the COMAXE business')}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-600 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">{customer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('Dernier achat: {d}', 'Last purchase: {d}', { d: customer.lastPurchaseDate })}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">
              {t('Total Dépensé', 'Total Spent')}
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatAmount(customer.totalSpent)}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Achats Effectués', 'Purchases Made')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {customer.purchasesCount}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('Nombre total de transactions', 'Total number of transactions')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Panier Moyen', 'Average Basket')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(averageBasket)}
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            {t('Par passage en boutique', 'Per store visit')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Fidélité Client', 'Customer Loyalty')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {customer.purchasesCount >= 5
              ? t('Très Fidèle', 'Very Loyal')
              : customer.purchasesCount > 1
                ? t('Régulier', 'Regular')
                : t('Nouveau', 'New')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('Indice de réachat commercial', 'Commercial repurchase index')}
          </p>
        </div>
      </div>

      {/* Sales History for this customer */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t('Historique des Ventes du Client', 'Customer Sales History')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Toutes les transactions réelles associées à ce client (préservées pour la comptabilité)', 'All real transactions linked to this customer (preserved for accounting)')}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {t('{n} transaction', '{n} transaction', { n: customerSales.length })}
            {customerSales.length !== 1 ? t('s', 's') : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 rounded-l-xl">{t('ID Vente', 'Sale ID')}</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">{t('Articles Achetés', 'Purchased Items')}</th>
                <th className="py-3 px-4">{t('Mode Règlement', 'Payment Method')}</th>
                <th className="py-3 px-4 text-right rounded-r-xl">{t('Total ({s})', 'Total ({s})', { s: currencySymbol })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {customerSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {t('Aucune vente enregistrée pour ce client.', 'No sales recorded for this customer.')}
                  </td>
                </tr>
              ) : (
                customerSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {sale.id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-semibold">
                      {sale.date}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        {sale.items.map((it, idx) => (
                          <div key={idx} className="font-medium text-slate-800">
                            {it.quantity}× {it.productName}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600">
                      {sale.paymentMethod === 'especes'
                        ? t('Espèces', 'Cash')
                        : sale.paymentMethod === 'carte'
                          ? t('Carte', 'Card')
                          : 'Mobile Money'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                      {formatAmount(sale.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Modification */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {t('Modifier la Fiche Client', 'Edit Customer Record')}
            </h3>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Nom Complet *', 'Full Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Téléphone *', 'Phone *')}
                </label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  {t('Annuler', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all"
                >
                  {t('Sauvegarder', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
