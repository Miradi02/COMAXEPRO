'use client';

import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  CheckCircle2,
  Smartphone,
  CreditCard,
  Banknote,
  Receipt,
  X,
  Eye,
  Trash2,
  Edit2,
  Calendar,
  Filter,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Sale, PaymentMethod } from '@/types';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getCurrency } from '@/lib/currencies';
import { getNowOperationDate, formatOperationDate } from '@/lib/dateUtils';

export function RecentSalesTable({
  showAddButton = true,
}: {
  /** false = masque le bouton d'enregistrement (Dashboard : consultation seule) */
  showAddButton?: boolean;
}) {
  const {
    filteredSales,
    products,
    addSale,
    updateSale,
    deleteSale,
    requestConfirmation,
    selectedDate,
    setSelectedDate,
    displayDateText,
    formatAmount,
    storeProfile,
  } = useCommerce();
  const { t } = useI18n();

  // Symbole de la devise du commerce (libellés « Prix Unitaire (…) »)
  const currencySymbol = getCurrency(storeProfile.currency)?.symbol ?? '';

  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Formulaire d'enregistrement
  const [newClient, setNewClient] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || 'P-001');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newPrice, setNewPrice] = useState(products[0]?.sellingPrice || 180);
  const [newPayment, setNewPayment] = useState<PaymentMethod>('especes');

  // When changing product in form, auto-update price & clear error
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    setFormError(null);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      setNewPrice(prod.sellingPrice);
    }
  };

  // Table « Ventes Enregistrées » : strictement la date active
  // (aujourd'hui par défaut) — le calendrier reste la seule source de filtre.
  const currentDisplaySales = filteredSales;

  const visibleSales = currentDisplaySales.filter((sale) => {
    const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;
    const matchesSearch =
      sale.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.items.some((item) =>
        item.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesPayment && matchesSearch;
  });

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newClient.trim()) {
      setFormError(t('Le nom du client est obligatoire.', 'Customer name is required.'));
      return;
    }

    const chosenProduct = products.find((p) => p.id === selectedProductId) || products[0];
    if (!chosenProduct) {
      setFormError(t('Veuillez sélectionner un produit valide.', 'Please select a valid product.'));
      return;
    }

    if (Number(newQuantity) > chosenProduct.quantity) {
      setFormError(
        t('Stock insuffisant. Stock disponible : {n}', 'Insufficient stock. Available stock: {n}', {
          n: chosenProduct.quantity,
        })
      );
      return;
    }

    const prodName = chosenProduct.name;
    const saleDate =
      selectedDate && selectedDate !== 'today'
        ? `${selectedDate.replace(/-/g, '/')}, 14:00`
        : t("Aujourd'hui, ", 'Today, ') + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const result = await addSale({
      date: saleDate,
      client: {
        name: newClient.trim(),
        phone: newPhone.trim() || '+243 -- --- ----',
      },
      items: [
        {
          productId: chosenProduct.id,
          productName: prodName,
          quantity: Number(newQuantity),
          unitPrice: Number(newPrice),
          purchasePrice: chosenProduct.purchasePrice,
          total: Number(newQuantity) * Number(newPrice),
        },
      ],
      totalAmount: Number(newQuantity) * Number(newPrice),
      paymentMethod: newPayment,
    });

    if (!result.success) {
      setFormError(result.error || t('Stock insuffisant.', 'Insufficient stock.'));
      return;
    }

    setIsModalOpen(false);
    setNewClient('');
    setNewPhone('');
    setNewQuantity(1);
    setFormError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToEdit) return;
    setEditError(null);

    const oldTotal = saleToEdit.totalAmount;
    const currentItem = saleToEdit.items[0];
    const newTotal = currentItem ? currentItem.quantity * currentItem.unitPrice : oldTotal;

    const result = await updateSale(saleToEdit, {
      ...saleToEdit,
      totalAmount: newTotal,
    });

    if (!result.success) {
      setEditError(result.error || t('Stock insuffisant pour cette modification.', 'Insufficient stock for this change.'));
      return;
    }

    setEditError(null);
    setSaleToEdit(null);
  };

  const handleDeleteClick = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation();
    // Rule 19: All important deletions must request confirmation
    requestConfirmation({
      title: t('Suppression de vente', 'Delete sale'),
      message: t('Voulez-vous vraiment supprimer cette vente ?', 'Do you really want to delete this sale?'),
      onConfirm: () => {
        deleteSale(sale.id);
      },
    });
  };

  const getPaymentBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'especes':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <Banknote className="w-3 h-3 text-emerald-600" />
            {t('Espèces', 'Cash')}
          </span>
        );
      case 'mobile_money':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Smartphone className="w-3 h-3 text-amber-600" />
            Mobile Money
          </span>
        );
      case 'carte':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1E5BF8] border border-blue-200/80">
            <CreditCard className="w-3 h-3 text-[#1E5BF8]" />
            {t('Carte', 'Card')}
          </span>
        );
    }
  };

  return (
    <div id="recent-sales-table" className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
      {/* Header with Title and Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {t('Ventes Enregistrées', 'Recorded Sales')}
            </h3>
            {selectedDate && selectedDate !== 'today' && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-200">
                {t('📅 Filtré par date : ', '📅 Filtered by date: ')}{displayDateText}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t('Opérations réelles enregistrées par le commerçant dans COMAXE', 'Real operations recorded by the merchant in COMAXE')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Bouton Nouvel Enregistrement (masqué sur le Dashboard) */}
          {showAddButton && (
            <button
              onClick={() => setIsModalOpen(true)}
              data-add-sale-btn
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('Enregistrer une Vente', 'Record a Sale')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={t('Rechercher par client, article, code...', 'Search by customer, product, code...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
          />
        </div>

        {/* Payment Filters */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 flex-wrap">
          <button
            onClick={() => setPaymentFilter('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              paymentFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            {t('Tous ({n})', 'All ({n})', { n: visibleSales.length })}
          </button>
          <button
            onClick={() => setPaymentFilter('especes')}
            className={`px-3 py-1 rounded-lg transition-all ${
              paymentFilter === 'especes'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            {t('Espèces', 'Cash')}
          </button>
          <button
            onClick={() => setPaymentFilter('mobile_money')}
            className={`px-3 py-1 rounded-lg transition-all ${
              paymentFilter === 'mobile_money'
                ? 'bg-white text-amber-700 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            Mobile Money
          </button>
          <button
            onClick={() => setPaymentFilter('carte')}
            className={`px-3 py-1 rounded-lg transition-all ${
              paymentFilter === 'carte'
                ? 'bg-white text-[#1E5BF8] shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            {t('Carte', 'Card')}
          </button>
        </div>
      </div>

      {/* Sales Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
              <th className="py-3 px-4 rounded-l-xl">{t('Réf. Vente', 'Sale Ref.')}</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">{t('Articles & Quantités', 'Items & Quantities')}</th>
              <th className="py-3 px-4">{t('Date & Heure', 'Date & Time')}</th>
              <th className="py-3 px-4">{t('Paiement', 'Payment')}</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center rounded-r-xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {visibleSales.length > 0 ? (
              visibleSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                  onClick={() => setSelectedSale(sale)}
                >
                  {/* Reference */}
                  <td className="py-3.5 px-4 font-bold text-[#1E5BF8] whitespace-nowrap">
                    {sale.code}
                  </td>

                  {/* Client */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">
                      {sale.client.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {sale.client.phone}
                    </div>
                  </td>

                  {/* Items & Quantity */}
                  <td className="py-3.5 px-4">
                    {sale.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">
                          {item.productName}
                        </span>
                        <span className="text-slate-400 font-medium">
                          ({item.quantity} × {formatAmount(item.unitPrice)})
                        </span>
                      </div>
                    ))}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {sale.date}
                  </td>

                  {/* Payment Method */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getPaymentBadge(sale.paymentMethod)}
                  </td>

                  {/* Total */}
                  <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm whitespace-nowrap">
                    {formatAmount(sale.totalAmount)}
                  </td>

                  {/* Actions buttons */}
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {/* View Ticket */}
                      <button
                        onClick={() => setSelectedSale(sale)}
                        title={t('Voir le ticket', 'View receipt')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1E5BF8] hover:bg-blue-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Sale */}
                      <button
                        onClick={() => setSaleToEdit(sale)}
                        title={t('Modifier la vente', 'Edit sale')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Sale with Rule 19 Confirmation */}
                      <button
                        onClick={(e) => handleDeleteClick(sale, e)}
                        title={t('Supprimer la vente', 'Delete sale')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600">
                    {t('Aucune vente enregistrée pour cette sélection', 'No sales recorded for this selection')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedDate && selectedDate !== 'today'
                      ? t('Aucune vente trouvée à la date du {d}', 'No sales found on {d}', { d: displayDateText })
                      : t('Enregistrez votre première vente avec le bouton ci-dessus', 'Record your first sale with the button above')}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal 1: Enregistrer une Vente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <Receipt className="w-4 h-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {t('Nouvelle Opération de Vente', 'New Sale Operation')}
                </h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSale} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Nom du Client *', 'Customer Name *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('ex: Jean Mukendi', 'e.g. John Mukendi')}
                  value={newClient}
                  onChange={(e) => {
                    setFormError(null);
                    setNewClient(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Numéro de Téléphone (optionnel)', 'Phone Number (optional)')}
                </label>
                <input
                  type="text"
                  placeholder="ex: +243 81 234 5678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Article Vendu (Stock réel disponible)', 'Product Sold (Actual stock available)')}
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t('{name} — Stock disponible : {qty} ({amount})', '{name} — Stock available: {qty} ({amount})', {
                        name: p.name,
                        qty: p.quantity,
                        amount: formatAmount(p.sellingPrice),
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t('Quantité *', 'Quantity *')}
                    </label>
                    {(() => {
                      const prod = products.find((p) => p.id === selectedProductId);
                      const isOver = prod && newQuantity > prod.quantity;
                      return (
                        <span className={`text-[11px] font-bold ${isOver ? 'text-rose-600' : 'text-slate-400'}`}>
                          {t('En stock : {n}', 'In stock: {n}', { n: prod ? prod.quantity : 0 })}
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => {
                      setFormError(null);
                      setNewQuantity(Math.max(1, Number(e.target.value)));
                    }}
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                      (() => {
                        const prod = products.find((p) => p.id === selectedProductId);
                        return prod && newQuantity > prod.quantity
                          ? 'border-rose-400 text-rose-700 bg-rose-50/50 focus:ring-rose-200'
                          : 'border-slate-200 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]';
                      })()
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('Prix Unitaire ({s})', 'Unit Price ({s})', { s: currencySymbol })}
                  </label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Mode de Paiement Réel', 'Actual Payment Method')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['especes', 'mobile_money', 'carte'] as PaymentMethod[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setNewPayment(mode)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                        newPayment === mode
                          ? 'border-[#1E5BF8] bg-blue-50 text-[#1E5BF8]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode === 'mobile_money'
                        ? 'Mobile Money'
                        : mode === 'especes'
                          ? t('Espèces', 'Cash')
                          : t('Carte', 'Card')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Résumé du total */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">{t('Total Encaissé :', 'Total Collected:')}</span>
                <span className="text-base font-extrabold text-[#1E5BF8]">
                  {formatAmount(newQuantity * newPrice)}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-all mt-2"
              >
                {t('Valider et Déduire du Stock', 'Confirm & Deduct from Stock')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Modifier la Vente */}
      {saleToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {t('Modifier la Vente ({c})', 'Edit Sale ({c})', { c: saleToEdit.code })}
                </h4>
              </div>
              <button
                onClick={() => setSaleToEdit(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Nom du Client', 'Customer Name')}
                </label>
                <input
                  type="text"
                  value={saleToEdit.client.name}
                  onChange={(e) =>
                    setSaleToEdit({
                      ...saleToEdit,
                      client: { ...saleToEdit.client, name: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              {saleToEdit.items[0] && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('Quantité Vendue', 'Quantity Sold')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={saleToEdit.items[0].quantity}
                      onChange={(e) => {
                        const newQ = Math.max(1, Number(e.target.value));
                        const currentIt = saleToEdit.items[0];
                        const updatedItems = [
                          {
                            ...currentIt,
                            quantity: newQ,
                            total: newQ * currentIt.unitPrice,
                          },
                        ];
                        setSaleToEdit({
                          ...saleToEdit,
                          items: updatedItems,
                          totalAmount: newQ * currentIt.unitPrice,
                        });
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Prix Unitaire ($)
                    </label>
                    <input
                      type="number"
                      value={saleToEdit.items[0].unitPrice}
                      onChange={(e) => {
                        const newP = Number(e.target.value);
                        const currentIt = saleToEdit.items[0];
                        const updatedItems = [
                          {
                            ...currentIt,
                            unitPrice: newP,
                            total: currentIt.quantity * newP,
                          },
                        ];
                        setSaleToEdit({
                          ...saleToEdit,
                          items: updatedItems,
                          totalAmount: currentIt.quantity * newP,
                        });
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">{t('Nouveau Total :', 'New Total:')}</span>
                <span className="text-base font-extrabold text-[#1E5BF8]">
                  {formatAmount(saleToEdit.totalAmount)}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleToEdit(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50"
                >
                  {t('Annuler', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-xs"
                >
                  {t('Sauvegarder & Recalculer', 'Save & Recalculate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Reçu / Détail d'une vente */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  {t('Ticket de Vente Enregistré', 'Recorded Sale Receipt')}
                </h4>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-t border-b border-dashed border-slate-200 py-4 my-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('Réf. Vente :', 'Sale Ref.:')}</span>
                <span className="font-bold text-slate-900">{selectedSale.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('Date & Heure :', 'Date & Time:')}</span>
                <span className="font-semibold text-slate-800">{selectedSale.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Client :</span>
                <span className="font-semibold text-slate-800">{selectedSale.client.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('Paiement :', 'Payment:')}</span>
                <span>{getPaymentBadge(selectedSale.paymentMethod)}</span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="font-bold text-slate-700 mb-1">{t('Détail des articles :', 'Item details:')}</p>
                {selectedSale.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-slate-600">
                    <span>
                      {it.quantity} × {it.productName}
                    </span>
                    <span className="font-bold text-slate-900">{formatAmount(it.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 mb-4">
              <span className="text-sm font-bold text-slate-900">{t('Total Encaissé :', 'Total Collected:')}</span>
              <span className="text-lg font-extrabold text-[#1E5BF8]">
                {formatAmount(selectedSale.totalAmount)}
              </span>
            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
            >
              {t('Fermer', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
