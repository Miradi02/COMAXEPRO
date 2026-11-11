'use client';

import React from 'react';
import { NotebookPen, PackageX, HandCoins, ReceiptText, TrendingDown, Ban } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

const PROBLEMS = [
  {
    icon: NotebookPen,
    fr: 'Carnets papier égarés',
    en: 'Lost paper notes',
    subFr: 'Les ventes notées se perdent et l’historique devient illisible.',
    subEn: 'Recorded sales get lost and history becomes unreadable.',
  },
  {
    icon: PackageX,
    fr: 'Stock inconnu',
    en: 'Unknown stock',
    subFr: 'Ruptures surprises et invendus que personne ne suit.',
    subEn: 'Surprise stock-outs and dead stock nobody tracks.',
  },
  {
    icon: HandCoins,
    fr: 'Dettes oubliées',
    en: 'Forgotten debts',
    subFr: 'Les crédits clients s’accumulent sans suivi clair.',
    subEn: 'Customer credit piles up with no clear follow-up.',
  },
  {
    icon: ReceiptText,
    fr: 'Dépenses floues',
    en: 'Blurry expenses',
    subFr: 'Achats, charges, transport : impossible de savoir ce qui sort.',
    subEn: 'Purchases, bills, transport: impossible to know what goes out.',
  },
  {
    icon: TrendingDown,
    fr: 'Bénéfices incertains',
    en: 'Uncertain profits',
    subFr: 'Sans visibilité, on travaille sans savoir si l’on gagne.',
    subEn: 'Without visibility, you work without knowing if you earn.',
  },
  {
    icon: Ban,
    fr: 'Aucun objectif',
    en: 'No goals',
    subFr: 'Rien pour mesurer les progrès jour après jour.',
    subEn: 'Nothing to measure progress day after day.',
  },
];

/**
 * Section « Problèmes des commerçants » — la douleur que COMAXE résout.
 */
export function LandingProblems() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/60 border-y border-slate-200/60">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['Les défis du quotidien', 'Daily challenges']}
          title={['Ce qui freine les commerçants,', 'What holds merchants back']}
          accent={['chaque jour', 'every single day']}
          accentClass="text-rose-600"
          eyebrowClass="bg-rose-50 text-rose-600 border-rose-200/80"
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PROBLEMS.map(({ icon: Icon, fr, en, subFr, subEn }) => (
            <div
              key={en}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 w-fit">
                <Icon className="w-4 h-4" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">{t(fr, en)}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{t(subFr, subEn)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
