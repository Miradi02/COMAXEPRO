'use client';

import React from 'react';
import { Flame, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';

export function TopSellingProducts() {
  const { products, sales, formatAmount } = useCommerce();
  const { t } = useI18n();

  // Aggregate sales count and revenue per product
  const productStats = products.map((prod) => {
    let salesCount = 0;
    let revenue = 0;

    sales.forEach((s) => {
      s.items.forEach((it) => {
        if ((it.productId && it.productId === prod.id) || it.productName.toLowerCase() === prod.name.toLowerCase()) {
          salesCount += it.quantity;
          revenue += it.total;
        }
      });
    });

    // Fallback to totalSalesCount on product if sales list has fewer historical items
    const count = Math.max(salesCount, prod.totalSalesCount);
    const rev = revenue > 0 ? revenue : count * prod.sellingPrice;

    return {
      id: prod.id,
      name: prod.name,
      category: prod.category,
      salesCount: count,
      revenueUSD: rev,
    };
  });

  const sortedTop = [...productStats]
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 4);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('Produits les Plus Vendus', 'Best Selling Products')}
            </h3>
            <p className="text-[11px] text-slate-400">
              {t("Volumes d'écoulement commercial", 'Sales volume')}
            </p>
          </div>
        </div>
        <Link
          href="/stock"
          className="text-xs font-bold text-slate-500 hover:text-[#1E5BF8] transition-colors flex items-center gap-1"
        >
          <span>{t('Détails', 'Details')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Top Products List */}
      <div className="space-y-3">
        {sortedTop.map((prod, index) => {
          return (
            <div
              key={prod.id}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Ranking Pill */}
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                    index === 0
                      ? 'bg-blue-50 text-[#1E5BF8]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  #{index + 1}
                </span>

                <div className="truncate">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                    {prod.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {prod.category}
                  </p>
                </div>
              </div>

              {/* Sales Count & Volume */}
              <div className="text-right shrink-0 ml-2">
                <span className="text-xs font-extrabold text-slate-900 block">
                  {t('{n} ventes', '{n} sales', { n: prod.salesCount })}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">
                  {formatAmount(prod.revenueUSD)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
