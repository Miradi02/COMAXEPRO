'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  PackagePlus,
  Plus,
  Search,
  AlertTriangle,
  AlertCircle,
  PackageCheck,
  PackageX,
  Trash2,
  X,
  History,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
} from 'lucide-react';
import { Product, StockMovement, StockMovementType } from '@/types';
import { useAppShell } from '@/context/AppShellContext';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getCurrency } from '@/lib/currencies';

export default function StockPage() {
  const { setHeaderAction } = useAppShell();
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    stockMovements,
    totalStockValue,
    totalStockCount,
    requestConfirmation,
    formatAmount,
    storeProfile,
    isDateMatching,
    displayDateText,
  } = useCommerce();
  const { t } = useI18n();

  const currencySymbol = getCurrency(storeProfile.currency)?.symbol ?? '';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_stock' | 'stock_faible' | 'rupture'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Deux onglets dans la modale : nouveau catalogue / réappro d'un produit existant
  const [modalTab, setModalTab] = useState<'nouveau' | 'restock'>('nouveau');

  // New product form
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Smartphones');
  const [newQuantity, setNewQuantity] = useState(10);
  const [newMinThreshold, setNewMinThreshold] = useState(5);
  const [newSellingPrice, setNewSellingPrice] = useState(50);
  const [newPurchasePrice, setNewPurchasePrice] = useState(35);

  // Restock form (produit existant)
  const [restockProductId, setRestockProductId] = useState('');
  const [restockQuantity, setRestockQuantity] = useState(1);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Historique du stock
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyType, setHistoryType] = useState<'all' | StockMovementType>('all');
  const [historyActiveDateOnly, setHistoryActiveDateOnly] = useState(false);

  const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.minThreshold).length;
  const outOfStockCount = products.filter((p) => p.quantity <= 0).length;

  // Duplication de nom : on compare sans tenir compte de la casse ni des espaces
  const trimmedNewName = newName.trim();
  const duplicateProduct = trimmedNewName
    ? products.find((p) => p.name.trim().toLowerCase() === trimmedNewName.toLowerCase())
    : undefined;
  const DUPLICATE_MESSAGE = t(
    'Produit existant, veuillez réapprovisionner dans l’onglet produit existant.',
    'Existing product, please replenish in the existing product tab.'
  );

  const restockProduct = products.find((p) => p.id === restockProductId);

  const filteredProducts = products.filter((p) => {
    const matchesFilter = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Historique du stock, filtré (recherche + type + date active)
  const visibleMovements = stockMovements.filter((m) => {
    const matchesType = historyType === 'all' || m.type === historyType;
    const q = historyQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.productName.toLowerCase().includes(q) ||
      (m.reference ?? '').toLowerCase().includes(q) ||
      (m.note ?? '').toLowerCase().includes(q);
    const matchesDate = !historyActiveDateOnly || isDateMatching(m.date);
    return matchesType && matchesSearch && matchesDate;
  });

  const resetAddForm = () => {
    setNewName('');
    setNewQuantity(10);
    setNewMinThreshold(5);
    setNewSellingPrice(50);
    setNewPurchasePrice(35);
    setNewCategory('Smartphones');
    setRestockProductId('');
    setRestockQuantity(1);
    setRestockError(null);
    setAddError(null);
    setModalTab('nouveau');
  };

  const openAddModal = (tab: 'nouveau' | 'restock' = 'nouveau') => {
    resetAddForm();
    setModalTab(tab);
    setIsAddModalOpen(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedNewName) return;
    // Nom déjà présent au catalogue → on bloque et on renvoie vers l'onglet
    // « Produit existant » (le message est déjà visible sous le champ).
    if (duplicateProduct) return;

    setAddError(null);
    const res = await addProduct({
      name: trimmedNewName,
      category: newCategory,
      quantity: Number(newQuantity),
      minThreshold: Number(newMinThreshold),
      sellingPrice: Number(newSellingPrice),
      purchasePrice: Number(newPurchasePrice),
    });

    // Limite d'abonnement atteinte → modale ouverte + message centralisé
    if (!res.success) {
      setAddError(res.error || t("Échec de l'enregistrement du produit", 'Failed to save the product'));
      return;
    }

    setIsAddModalOpen(false);
    resetAddForm();
  };

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === restockProductId);
    const qty = Math.floor(Number(restockQuantity));

    if (!prod) {
      setRestockError(t('Sélectionnez un produit existant.', 'Select an existing product.'));
      return;
    }
    if (!qty || qty < 1) {
      setRestockError(t('Indiquez au moins 1 article à ajouter.', 'Enter at least 1 item to add.'));
      return;
    }

    // updateProduct recalcule seul le statut (en_stock / stock_faible / rupture)
    updateProduct(prod.id, { quantity: prod.quantity + qty });

    setIsAddModalOpen(false);
    resetAddForm();
  };

  const handleDeleteProduct = (p: Product) => {
    // Rule 19 & 21: Confirm deletion of product
    requestConfirmation({
      title: t('Suppression de produit', 'Delete product'),
      message: t('Voulez-vous vraiment supprimer ce produit ?', 'Do you really want to delete this product?'),
      onConfirm: () => {
        deleteProduct(p.id);
      },
    });
  };

  const getStatusBadge = (status: Product['status']) => {
    switch (status) {
      case 'en_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t('En Stock', 'In Stock')}
          </span>
        );
      case 'stock_faible':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('Stock Faible', 'Low Stock')}
          </span>
        );
      case 'rupture':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {t('Rupture', 'Out of Stock')}
          </span>
        );
    }
  };

  const getMovementMeta = (type: StockMovementType) => {
    switch (type) {
      case 'creation':
        return {
          label: t('Création', 'Creation'),
          icon: <Package className="w-3 h-3" />,
          cls: 'bg-blue-50 text-[#1E5BF8] border-blue-200/80',
        };
      case 'entree':
        return {
          label: t('Entrée', 'Stock in'),
          icon: <ArrowDownToLine className="w-3 h-3" />,
          cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        };
      case 'sortie':
        return {
          label: t('Sortie', 'Stock out'),
          icon: <ArrowUpFromLine className="w-3 h-3" />,
          cls: 'bg-rose-50 text-rose-700 border-rose-200/80',
        };
      case 'annulation':
        return {
          label: t('Annulation', 'Reversal'),
          icon: <RotateCcw className="w-3 h-3" />,
          cls: 'bg-amber-50 text-amber-700 border-amber-200/80',
        };
    }
  };

  useEffect(() => {
    setHeaderAction({
      label: t('Ajouter un Produit', 'Add a Product'),
      onClick: () => openAddModal('nouveau'),
    });
    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderAction, t]);

  return (
    <div className="space-y-6">
      {/* Stock KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <PackageCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Valeur du Stock', 'Stock Value')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatAmount(totalStockValue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t("Prix d'achat total immobilisé", 'Total purchase cost tied up')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Articles en Stock', 'Items in Stock')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {totalStockCount}
          </p>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            {t('Disponibles à la vente', 'Available for sale')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Stock Faible', 'Low Stock')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {lowStockCount}
          </p>
          <p className="text-xs text-amber-600 font-semibold mt-1">
            {t('Approvisionnement requis', 'Restocking required')}
          </p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <PackageX className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('Rupture de Stock', 'Out of Stock')}
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {outOfStockCount}
          </p>
          <p className="text-xs text-rose-600 font-semibold mt-1">
            {t('Commandes urgentes', 'Urgent orders')}
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t('Catalogue & Niveaux de Stock', 'Catalog & Stock Levels')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Suivi en temps réel des unités disponibles en boutique', 'Real-time tracking of units available in store')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={t('Rechercher un article...', 'Search an item...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                {t('Tous ({n})', 'All ({n})', { n: products.length })}
              </button>
              <button
                onClick={() => setStatusFilter('en_stock')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'en_stock' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                {t('En Stock', 'In Stock')}
              </button>
              <button
                onClick={() => setStatusFilter('stock_faible')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'stock_faible' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                {t('Faible ({n})', 'Low ({n})', { n: lowStockCount })}
              </button>
              <button
                onClick={() => setStatusFilter('rupture')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'rupture' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                {t('Rupture ({n})', 'Out of stock ({n})', { n: outOfStockCount })}
              </button>
            </div>

            {/* Add Product Button */}
            <button
              onClick={() => openAddModal('nouveau')}
              data-add-product-btn
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('Ajouter Produit', 'Add Product')}</span>
            </button>
          </div>
        </div>

        {/* Table — min-w : le tableau défile horizontalement au lieu de comprimer
            les colonnes (chevauchement Désignation / Catégorie sur petit écran) */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 rounded-l-xl w-[30%] whitespace-nowrap">
                  {t('Produit', 'Product')}
                </th>
                <th className="py-3 px-4 w-[16%] whitespace-nowrap">
                  {t('Catégorie', 'Category')}
                </th>
                <th className="py-3 px-4 text-center w-[13%] whitespace-nowrap">
                  {t('Quantité', 'Quantity')}
                </th>
                <th className="py-3 px-4 w-[14%] whitespace-nowrap">
                  {t('Prix de Vente', 'Selling Price')}
                </th>
                <th className="py-3 px-4 w-[14%] whitespace-nowrap">
                  {t("Prix d'Achat", 'Purchase Price')}
                </th>
                <th className="py-3 px-4 w-[13%] whitespace-nowrap">{t('Statut', 'Status')}</th>
                <th className="py-3 px-4 text-center rounded-r-xl w-[9%] whitespace-nowrap">
                  {t('Actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                    {t(
                      'Aucun produit ne correspond à votre recherche.',
                      'No product matches your search.'
                    )}
                  </td>
                </tr>
              )}
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Produit : référence courte + nom tronqué (plus de chevauchement) */}
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="font-mono text-[10px] font-extrabold text-[#1E5BF8] bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 shrink-0 uppercase"
                        title={p.id}
                      >
                        {`#${p.id.slice(0, 6)}`}
                      </span>
                      <span className="truncate" title={p.name}>
                        {p.name}
                      </span>
                    </div>
                  </td>
                  {/* Catégorie : pastille isolée, jamais collée au produit */}
                  <td className="py-3.5 px-4">
                    <span
                      className="inline-block max-w-full truncate px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 text-[11px] font-bold"
                      title={p.category}
                    >
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-extrabold text-sm whitespace-nowrap">
                    <span className={p.quantity <= p.minThreshold ? 'text-amber-600' : 'text-slate-900'}>
                      {t('{n} u.', '{n} pcs', { n: p.quantity })}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                    {formatAmount(p.sellingPrice)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {formatAmount(p.purchasePrice)}
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(p.status)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title={t('Supprimer ce produit', 'Delete this product')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historique du stock */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('Historique du Stock', 'Stock History')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('Créations, réapprovisionnements, ventes et annulations', 'Creations, restocks, sales and reversals')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={t('Produit, référence...', 'Product, reference...')}
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1E5BF8]"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              {(['all', 'creation', 'entree', 'sortie', 'annulation'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setHistoryType(type)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    historyType === type ? 'bg-white text-[#1E5BF8] shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  {type === 'all'
                    ? t('Tous ({n})', 'All ({n})', { n: stockMovements.length })
                    : type === 'creation'
                      ? t('Créations', 'Creations')
                      : type === 'entree'
                        ? t('Entrées', 'Stock in')
                        : type === 'sortie'
                          ? t('Sorties', 'Stock out')
                          : t('Annulations', 'Reversals')}
                </button>
              ))}
            </div>

            <button
              onClick={() => setHistoryActiveDateOnly((v) => !v)}
              aria-pressed={historyActiveDateOnly}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                historyActiveDateOnly
                  ? 'bg-blue-50 text-[#1E5BF8] border-blue-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {historyActiveDateOnly
                ? t('Date active : {d}', 'Active date: {d}', { d: displayDateText })
                : t('Filtrer par date active', 'Filter by active date')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 rounded-l-xl">{t('Date', 'Date')}</th>
                <th className="py-3 px-4">{t('Produit', 'Product')}</th>
                <th className="py-3 px-4">{t('Mouvement', 'Movement')}</th>
                <th className="py-3 px-4 text-center">{t('Quantité', 'Quantity')}</th>
                <th className="py-3 px-4">{t('Référence', 'Reference')}</th>
                <th className="py-3 px-4 rounded-r-xl">{t('Détail', 'Detail')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {visibleMovements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-400">
                        <History className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {stockMovements.length === 0
                          ? t('Aucun mouvement de stock enregistré.', 'No stock movement recorded yet.')
                          : t('Aucun mouvement ne correspond à ce filtre.', 'No movement matches this filter.')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t(
                          'Les créations de produit, réappro, ventes et dettes apparaîtront ici.',
                          'Product creations, restocks, sales and debts will appear here.'
                        )}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleMovements.map((m) => {
                  const meta = getMovementMeta(m.type);
                  const isIncoming = m.type !== 'sortie';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{m.date}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{m.productName}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.cls}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold">
                        <span className={isIncoming ? 'text-emerald-600' : 'text-rose-600'}>
                          {isIncoming ? '+' : '−'}
                          {m.quantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {m.reference ? (
                          <span className="font-mono text-[11px] font-extrabold text-[#1E5BF8] bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                            {m.reference}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{m.note ?? '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {visibleMovements.length > 0 && (
          <p className="mt-4 text-[11px] text-slate-400 font-semibold">
            {t('{n} mouvement(s) affiché(s)', '{n} movement(s) shown', { n: visibleMovements.length })}
            {' · '}
            {t('Stock actuel', 'Current stock')} : {totalStockCount} {t('unités', 'units')}
          </p>
        )}
      </div>

      {/* Modal: Ajouter un Produit */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <Package className="w-4 h-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {modalTab === 'nouveau'
                    ? t('Nouveau Produit au Catalogue', 'New Catalog Product')
                    : t('Réapprovisionner un Produit', 'Restock a Product')}
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deux points d'entrée : nouveau produit OU articles d'un produit existant */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 mb-5">
              <button
                type="button"
                onClick={() => setModalTab('nouveau')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  modalTab === 'nouveau' ? 'bg-white text-[#1E5BF8] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('Nouveau produit', 'New product')}
              </button>
              <button
                type="button"
                onClick={() => setModalTab('restock')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  modalTab === 'restock' ? 'bg-white text-[#1E5BF8] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                <PackagePlus className="w-3.5 h-3.5" />
                {t('Produit existant', 'Existing product')}
              </button>
            </div>

            {modalTab === 'nouveau' ? (
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Nom du Produit', 'Product Name')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('ex: Coque iPhone 15 Silicone', 'e.g. iPhone 15 Silicone Case')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  aria-invalid={Boolean(duplicateProduct)}
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                    duplicateProduct
                      ? 'border-rose-400 focus:ring-rose-200 focus:border-rose-500 bg-rose-50/40'
                      : 'border-slate-200 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]'
                  }`}
                />
                {duplicateProduct && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-700 leading-relaxed">
                      <p className="font-extrabold">{DUPLICATE_MESSAGE}</p>
                      <p className="mt-1 text-rose-600/90">
                        {t(
                          '« {n} » est déjà au catalogue ({q} unité(s)).',
                          '“{n}” is already in the catalogue ({q} unit(s)).',
                          { n: duplicateProduct.name, q: duplicateProduct.quantity }
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Catégorie', 'Category')}
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                >
                  <option value="Smartphones">Smartphones</option>
                  <option value="Accessoires Audio">{t('Accessoires Audio', 'Audio Accessories')}</option>
                  <option value="Chargeurs">{t('Chargeurs', 'Chargers')}</option>
                  <option value="Batteries Externes">{t('Batteries Externes', 'Power Banks')}</option>
                  <option value="Protections">{t('Protections', 'Cases')}</option>
                  <option value="Montres Connectées">{t('Montres Connectées', 'Smart Watches')}</option>
                  <option value="Autre">{t('Autre', 'Other')}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('Quantité Initiale', 'Initial Quantity')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t("Seuil d'Alerte (Min)", 'Alert Threshold (Min)')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newMinThreshold}
                    onChange={(e) => setNewMinThreshold(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('Prix de Vente ({s})', 'Selling Price ({s})', { s: currencySymbol })}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t("Prix d'Achat ({s})", 'Purchase Price ({s})', { s: currencySymbol })}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>
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
                disabled={Boolean(duplicateProduct)}
                className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-md transition-all mt-2 ${
                  duplicateProduct
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-[#1E5BF8] hover:bg-[#1548CF] text-white shadow-blue-500/25 active:scale-95'
                }`}
              >
                {duplicateProduct
                  ? t('Réapprovisionner ce produit', 'Restock this product')
                  : t("Enregistrer l'Article dans COMAXE", 'Save Item in COMAXE')}
              </button>
            </form>
            ) : (
            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Produit existant', 'Existing product')}
                </label>
                <select
                  value={restockProductId}
                  onChange={(e) => {
                    setRestockProductId(e.target.value);
                    setRestockError(null);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                >
                  <option value="">
                    {products.length === 0
                      ? t('— Aucun produit au catalogue —', '— No product in catalogue —')
                      : t('— Sélectionner un produit —', '— Select a product —')}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {t('stock', 'stock')} {p.quantity} · {formatAmount(p.sellingPrice)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('Articles à ajouter', 'Items to add')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={restockQuantity}
                  onChange={(e) => {
                    setRestockQuantity(Math.max(1, Math.floor(Number(e.target.value)) || 1));
                    setRestockError(null);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
              </div>

              {restockProduct && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <PackagePlus className="w-3.5 h-3.5 text-[#1E5BF8]" />
                    <span className="text-[11px] font-bold text-[#1E5BF8] uppercase tracking-wider">
                      {t('Aperçu du réapprovisionnement', 'Restock preview')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {t('Stock actuel', 'Current stock')} :{' '}
                    <strong className="text-slate-900">{restockProduct.quantity}</strong> →{' '}
                    {t('après', 'after')}{' '}
                    <strong className="text-[#1E5BF8]">
                      {restockProduct.quantity + Math.max(1, Math.floor(Number(restockQuantity)) || 1)}
                    </strong>{' '}
                    {t('unité(s)', 'unit(s)')}
                  </p>
                </div>
              )}

              {restockError && (
                <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-semibold text-rose-700">{restockError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={products.length === 0}
                className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-md transition-all mt-2 ${
                  products.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-[#1E5BF8] hover:bg-[#1548CF] text-white shadow-blue-500/25 active:scale-95'
                }`}
              >
                {t('Ajouter les articles au stock', 'Add items to stock')}
              </button>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
