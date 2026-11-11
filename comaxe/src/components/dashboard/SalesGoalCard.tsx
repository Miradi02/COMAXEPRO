'use client';

import React from 'react';
import { Target } from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';

export function SalesGoalCard() {
  const { todaySalesTotal, goalTargets, displayDateText, formatAmount } = useCommerce();
  const { t } = useI18n();

  const targetUSD = goalTargets.dailySalesTarget || 1000;
  const currentUSD = todaySalesTotal;
  const percentage = Math.min(100, Math.round((currentUSD / targetUSD) * 100));

  // Arceau SVG dynamique (circonférence semi-cercle rayon 64 = π * 64 ≈ 201.06)
  const semiCircumference = 201.06;
  const activeStrokeLength = ((percentage / 100) * semiCircumference).toFixed(1);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <Target className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {t('Objectif de Ventes', 'Sales Target')}
          </h3>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {displayDateText}
        </span>
      </div>

      {/* Semi-circular Ring Gauge */}
      <div className="flex flex-col items-center justify-center py-2 relative">
        <div className="relative w-44 h-24 flex items-end justify-center overflow-hidden">
          <svg className="w-44 h-44 absolute -top-0" viewBox="0 0 160 160">
            {/* Background Arch */}
            <circle
              cx="80"
              cy="80"
              r="64"
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth="16"
              strokeDasharray="201.06 402.12"
              strokeDashoffset="0"
              transform="rotate(180 80 80)"
              strokeLinecap="round"
            />
            {/* Active Filled Arch */}
            <circle
              cx="80"
              cy="80"
              r="64"
              fill="transparent"
              stroke="#1E5BF8"
              strokeWidth="16"
              strokeDasharray={`${activeStrokeLength} 402.12`}
              strokeDashoffset="0"
              transform="rotate(180 80 80)"
              strokeLinecap="round"
            />
          </svg>

          {/* Centered Percentage */}
          <div className="relative z-10 text-center -mb-1">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {percentage}%
            </span>
          </div>
        </div>

        {/* Progression Numbers */}
        <div className="text-center mt-3">
          <p className="text-sm font-extrabold text-slate-900">
            {formatAmount(currentUSD)} <span className="text-slate-400 font-semibold">/ {formatAmount(targetUSD)}</span>
          </p>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            {t('Progression calculée en direct', 'Live progress')} ({displayDateText})
          </p>
        </div>
      </div>
    </div>
  );
}
