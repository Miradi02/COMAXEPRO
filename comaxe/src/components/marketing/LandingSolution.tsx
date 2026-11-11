'use client';

import React from 'react';
import { Check, ShoppingBag, PackageCheck, HandCoins, Calculator, Target, History } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

const SOLUTIONS = [
  {
    icon: ShoppingBag,
    fr: 'Tout s’enregistre en quelques secondes',
    en: 'Everything recorded in seconds',
    subFr: 'Vente, dépense ou mouvement de stock : noté au moment où il arrive.',
    subEn: 'Sale, expense or stock movement: noted as it happens.',
  },
  {
    icon: PackageCheck,
    fr: 'Le stock suit chaque opération',
    en: 'Stock follows every operation',
    subFr: 'Les quantités se mettent à jour à chaque vente enregistrée.',
    subEn: 'Quantities update with every recorded sale.',
  },
  {
    icon: HandCoins,
    fr: 'Chaque dette a son suivi',
    en: 'Every debt has its follow-up',
    subFr: 'Créances, paiements et soldes restent toujours visibles.',
    subEn: 'Credit, payments and balances always visible.',
  },
  {
    icon: Calculator,
    fr: 'Dépenses et bénéfices calculés',
    en: 'Expenses and profits calculated',
    subFr: 'Vous savez ce qui entre, ce qui sort et ce qui reste.',
    subEn: 'You know what comes in, what goes out and what remains.',
  },
  {
    icon: Target,
    fr: 'Objectifs et analytique pour piloter',
    en: 'Goals and analytics to steer',
    subFr: 'Des repères clairs pour progresser, jour après jour.',
    subEn: 'Clear benchmarks to improve, day after day.',
  },
  {
    icon: History,
    fr: 'Votre historique reste organisé',
    en: 'Your history stays organized',
    subFr: 'Retrouvez vos données quand vous en avez besoin, sans fouiller.',
    subEn: 'Find your data when you need it, without digging.',
  },
];

/**
 * Section « Solution COMAXE » — réponse point par point aux problèmes,
 * avec une pile de cartes illustratives à droite.
 */
export function LandingSolution() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['La solution', 'The solution']}
          title={['COMAXE remet de l’ordre,', 'COMAXE puts things in order']}
          accent={['simplement', 'simply']}
          accentClass="text-emerald-600"
          eyebrowClass="bg-emerald-50 text-emerald-700 border-emerald-200/80"
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Liste des réponses */}
          <ul className="space-y-5">
            {SOLUTIONS.map(({ icon: Icon, fr, en, subFr, subEn }) => (
              <li key={en} className="flex items-start gap-4">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{t(fr, en)}</h3>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{t(subFr, subEn)}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Pile de cartes illustratives */}
          <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-emerald-500/10 p-6 rotate-[-2deg]">
              <div className="flex items-center justify-between">
                <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <ShoppingBag className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {t('Enregistrée', 'Recorded')}
                </span>
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('Vente du jour', "Today's sale")}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">120 $</p>
              <div className="mt-4 space-y-2">
                {['3 × Savon', '2 × Huile'].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <span className="font-semibold text-slate-600">{item}</span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -bottom-5 -right-3 sm:-right-6 rounded-2xl bg-white border border-slate-200/80 shadow-lg px-4 py-3 flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <PackageCheck className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('Stock', 'Stock')}
                </p>
                <p className="text-xs font-extrabold text-slate-900">
                  {t('Mis à jour', 'Updated')}
                </p>
              </div>
            </div>

            <div className="absolute -top-5 -left-3 sm:-left-6 rounded-2xl bg-white border border-slate-200/80 shadow-lg px-4 py-3 flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                <Calculator className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('Bénéfice', 'Profit')}
                </p>
                <p className="text-xs font-extrabold text-slate-900">
                  {t('Calculé', 'Calculated')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
