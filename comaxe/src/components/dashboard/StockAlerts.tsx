'use client';

import React from 'react';
import { AlertTriangle, ChevronRight, PackageCheck } from 'lucide-react';
import Link from 'next/link';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';

export function StockAlerts() {
  const { products } = useCommerce();
  const { t } = useI18n();

  // Find products that are at or below threshold, or lowest stock
  const alertProducts = products
    .filter((p) => p.quantity <= p.minThreshold || p.status === 'rupture' || p.status === 'stock_faible')
    .slice(0, 4);

  // Fallback to lowest 4 products if none below threshold
  const displayProducts =
    alertProducts.length > 0
      ? alertProducts
      : [...products].sort((a, b) => a.quantity - b.quantity).slice(0, 4);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('Alertes Stock', 'Stock Alerts')}
            </h3>
            <p className="text-[11px] text-slate-400">
              {t('Seuils de réapprovisionnement réels', 'Actual restock thresholds')}
            </p>
          </div>
        </div>
        <Link
          href="/stock"
          className="text-xs font-bold text-slate-500 hover:text-[#1E5BF8] transition-colors flex items-center gap-1"
        >
          <span>{t('Gérer', 'Manage')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Stock Items List */}
      <div className="space-y-3.5">
        {displayProducts.map((item) => {
          const isRupture = item.quantity <= 0;
          const isFaible = item.quantity <= item.minThreshold;
          const fillPct = Math.min(100, Math.round((item.quantity / Math.max(1, item.minThreshold * 2)) * 100));

          const barBg = isRupture ? 'bg-rose-100/70' : isFaible ? 'bg-amber-100/70' : 'bg-blue-100/70';
          const barFill = isRupture ? 'bg-rose-500' : isFaible ? 'bg-amber-500' : 'bg-[#1E5BF8]';
          const textColor = isRupture ? 'text-rose-600' : isFaible ? 'text-amber-600' : 'text-[#1E5BF8]';
          const label = isRupture
            ? t('Rupture', 'Out of stock')
            : t('{n} unités', '{n} units', { n: item.quantity });

          return (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 truncate pr-2">
                  {item.name}
                </span>
                <span className={`font-extrabold ${textColor} shrink-0`}>
                  {label}
                </span>
              </div>

              {/* Progress Bar with Unit Label */}
              <div className={`relative h-5 w-full ${barBg} rounded-md overflow-hidden flex items-center p-0.5`}>
                <div
                  className={`h-full ${barFill} rounded-sm transition-all duration-500 flex items-center px-2`}
                  style={{ width: `${Math.max(fillPct, 20)}%` }}
                >
                  <span className="text-[10px] font-extrabold text-white truncate">
                    {label} ({t('seuil: {n}', 'threshold: {n}', { n: item.minThreshold })})
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
