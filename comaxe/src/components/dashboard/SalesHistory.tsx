'use client';

import React, { useState } from 'react';
import {
  Search,
  History,
  Smartphone,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { getCurrency } from '@/lib/currencies';

/**
 * Historique des ventes — TOUTES les ventes du compte, toutes dates confondues.
 * Le tableau « Ventes Enregistrées » reste limité à la date active (aujourd'hui
 * par défaut) : ce composant ne touche à aucune logique de calendrier.
 */
export function SalesHistory() {
  const { sales, formatAmount, storeProfile } = useCommerce();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const currencySymbol = getCurrency(storeProfile.currency)?.symbol ?? '';

  const filtered = sales.filter((sale) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      sale.code.toLowerCase().includes(q) ||
      sale.client.name.toLowerCase().includes(q) ||
      sale.date.toLowerCase().includes(q) ||
      sale.items.some((item) => item.productName.toLowerCase().includes(q))
    );
  });

  const paymentBadge = (method: string) => {
    switch (method) {
      case 'especes':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <Banknote className="w-3 h-3" />
            {t('Espèces', 'Cash')}
          </span>
        );
      case 'mobile_money':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
            <Smartphone className="w-3 h-3" />
            Mobile Money
          </span>
        );
      case 'carte':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#1E5BF8] border border-blue-200/80">
            <CreditCard className="w-3 h-3" />
            {t('Carte', 'Card')}
          </span>
        );
      default:
        return null;
    }
  };

  const totalHistory = filtered.reduce((acc, s) => acc + s.totalAmount, 0);

  return (
    <section
      id="sales-history"
      className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs"
    >
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <History className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {t('Historique des Ventes', 'Sales History')}
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-200">
              {t('{n} ventes', '{n} sales', { n: sales.length })}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t(
              'Toutes les ventes enregistrées dans COMAXE, toutes dates confondues.',
              'All sales recorded in COMAXE, across every date.'
            )}
          </p>
        </div>

        {/* Recherche */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Rechercher client, article, code, date…', 'Search customer, product, code, date…')}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
          />
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="py-10 flex flex-col items-center text-center">
          <div className="p-3 rounded-2xl bg-blue-50 text-[#1E5BF8] mb-3">
            <History className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {query
              ? t('Aucune vente ne correspond à votre recherche.', 'No sale matches your search.')
              : t('Aucune vente enregistrée pour le moment.', 'No sales recorded yet.')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-4 rounded-l-xl">{t('Réf. Vente', 'Sale Ref.')}</th>
                <th className="py-3 px-4">{t('Client', 'Customer')}</th>
                <th className="py-3 px-4">{t('Articles & Quantités', 'Items & Quantities')}</th>
                <th className="py-3 px-4">{t('Date & Heure', 'Date & Time')}</th>
                <th className="py-3 px-4">{t('Paiement', 'Payment')}</th>
                <th className="py-3 px-4 text-right rounded-r-xl">{t('Total', 'Total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filtered.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-extrabold text-slate-900">{sale.code}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{sale.client.name}</div>
                    <div className="text-[11px] text-slate-400">{sale.client.phone}</div>
                  </td>
                  <td className="py-3.5 px-4 max-w-[280px]">
                    <div className="truncate text-slate-600">
                      {sale.items
                        .map((item) => `${item.productName} ×${item.quantity}`)
                        .join(', ')}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-500 whitespace-nowrap">
                    {sale.date}
                  </td>
                  <td className="py-3.5 px-4">{paymentBadge(sale.paymentMethod)}</td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                    {formatAmount(sale.totalAmount)}
                    {currencySymbol && (
                      <span className="ml-1 text-[10px] font-bold text-slate-400">
                        {currencySymbol}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Récapitulatif */}
          <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-slate-400 font-medium">
              {t(
                '{n} vente affichée sur {total}',
                '{n} sales shown of {total}',
                { n: filtered.length, total: sales.length }
              )}
            </span>
            <span className="font-extrabold text-slate-900">
              {t('Total affiché : {a}', 'Displayed total: {a}', { a: formatAmount(totalHistory) })}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
