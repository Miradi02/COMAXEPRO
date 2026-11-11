'use client';

import React from 'react';
import { Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';

export function RecentCustomers() {
  const { customers, formatAmount } = useCommerce();
  const { t } = useI18n();

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {t('Clients Récents', 'Recent Customers')}
            </h3>
            <p className="text-[11px] text-slate-400">
              {t("Fidélité et volume d'achat réels", 'Actual loyalty and purchase volume')}
            </p>
          </div>
        </div>
        <Link
          href="/clients"
          className="text-xs font-bold text-slate-500 hover:text-[#1E5BF8] transition-colors flex items-center gap-1"
        >
          <span>{t('Voir Tout', 'View All')}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {customers.slice(0, 5).map((cust) => {
          return (
            <div
              key={cust.id}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar with fallback initials */}
                <div className="relative w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center font-bold text-xs text-slate-600">
                  {cust.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>

                <div className="truncate">
                  <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                    {cust.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t('{n} achats enregistrés', '{n} recorded purchases', { n: cust.purchasesCount })}
                  </p>
                </div>
              </div>

              {/* Total spent in USD */}
              <div className="text-right shrink-0 ml-2">
                <span className="text-xs font-extrabold text-slate-900 block">
                  {formatAmount(cust.totalSpent)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {cust.lastPurchaseDate}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
