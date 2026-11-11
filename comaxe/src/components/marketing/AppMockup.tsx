'use client';

import React from 'react';
import { LayoutDashboard, ShoppingBag, Package, TrendingUp, Plus, Check, Target, Sparkles } from 'lucide-react';

/**
 * Maquette d'interface COMAXE (Hero) — purement décorative, codée en HTML/CSS
 * pour coller à la direction artistique de `photo/acceuil.webp` :
 * carte blanche arrondie, mini-sidebar, KPI, graphique, lignes de vente,
 * avec badges flottants autour.
 */
export function AppMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl" aria-hidden="true">
      {/* Carte principale */}
      <div className="rounded-3xl bg-white border border-slate-200/80 shadow-2xl shadow-blue-500/10 overflow-hidden">
        <div className="flex">
          {/* Mini-sidebar */}
          <aside className="hidden sm:block w-40 lg:w-48 border-r border-slate-100 p-4 space-y-2.5 bg-slate-50/50">
            <div className="flex items-center gap-2 px-2 pb-2">
              <span className="w-6 h-6 rounded-lg bg-[#1E5BF8]" />
              <span className="text-sm font-extrabold text-slate-900">comaxe</span>
            </div>
            {[
              { icon: LayoutDashboard, label: 'Dashboard', active: true },
              { icon: ShoppingBag, label: 'Ventes', active: false },
              { icon: Package, label: 'Stock', active: false },
              { icon: TrendingUp, label: 'Bénéfice', active: false },
            ].map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold ${
                  active ? 'bg-blue-50 text-[#1E5BF8]' : 'text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </aside>

          {/* Contenu principal */}
          <div className="flex-1 p-4 sm:p-6 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tableau de bord
                </p>
                <p className="text-base sm:text-lg font-extrabold text-slate-900">
                  Aperçu du jour
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1E5BF8] text-white text-xs font-bold">
                <Plus className="w-3.5 h-3.5" />
                Vente
              </span>
            </div>

            {/* KPI */}
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              {[
                { label: 'Ventes', value: '1 240 $', tone: 'text-[#1E5BF8]' },
                { label: 'Bénéfice', value: '480 $', tone: 'text-emerald-600' },
                { label: 'Stock', value: '42', tone: 'text-amber-600' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-slate-100 bg-white p-2.5 sm:p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {kpi.label}
                  </p>
                  <p className={`mt-1 text-sm sm:text-lg font-extrabold ${kpi.tone}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Graphique */}
            <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3 sm:p-4">
              <div className="flex items-end gap-1.5 sm:gap-2 h-20 sm:h-24">
                {[38, 55, 42, 70, 52, 84, 62, 96].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-md ${
                      i === 7 ? 'bg-[#1E5BF8]' : 'bg-blue-100'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Lignes de vente */}
            <div className="mt-3 space-y-2">
              {[
                { name: 'Client Amina', amount: '35 $', paid: 'Espèces' },
                { name: 'Client Josué', amount: '120 $', paid: 'Mobile Money' },
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#1E5BF8]" strokeWidth={3} />
                    </span>
                    <span className="text-xs font-bold text-slate-700 truncate">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-slate-50 text-[10px] font-bold text-slate-400">
                      {row.paid}
                    </span>
                    <span className="text-xs font-extrabold text-slate-900">{row.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Badges flottants */}
      <div className="hidden sm:flex absolute -left-3 lg:-left-8 top-24 items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 shadow-lg shadow-emerald-500/10 text-xs font-bold text-emerald-700">
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
        Stock à jour
      </div>
      <div className="hidden sm:flex absolute -right-3 lg:-right-8 top-1/3 items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-blue-200 shadow-lg shadow-blue-500/10 text-xs font-bold text-[#1E5BF8]">
        <Target className="w-3.5 h-3.5" />
        Objectif 87 %
      </div>
      <div className="hidden lg:flex absolute -right-4 bottom-16 items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-amber-200 shadow-lg shadow-amber-500/10 text-xs font-bold text-amber-700">
        <Sparkles className="w-3.5 h-3.5" />
        Bénéfice +12 %
      </div>
    </div>
  );
}
