'use client';

import React from 'react';
import { PlusCircle, Archive, LayoutGrid, BarChart3 } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

const PILLARS = [
  {
    icon: PlusCircle,
    fr: 'Enregistrer',
    en: 'Record',
    subFr: 'Chaque vente en quelques secondes, sans paperasse.',
    subEn: 'Every sale in seconds, no paperwork.',
  },
  {
    icon: Archive,
    fr: 'Conserver',
    en: 'Keep',
    subFr: 'Vos données restent là, du jour au mois suivant.',
    subEn: 'Your data stays there, from one day to the next.',
  },
  {
    icon: LayoutGrid,
    fr: 'Organiser',
    en: 'Organize',
    subFr: 'Ventes, stock, clients, dettes et dépenses au même endroit.',
    subEn: 'Sales, stock, customers, debts and expenses together.',
  },
  {
    icon: BarChart3,
    fr: 'Analyser',
    en: 'Analyze',
    subFr: 'Bénéfices, objectifs et tendances en un coup d’œil.',
    subEn: 'Profits, goals and trends at a glance.',
  },
];

/**
 * Présentation de COMAXE — ce qu'est l'outil et les 4 verbes du concept
 * (Enregistrer · Conserver · Organiser · Analyser).
 */
export function LandingIntro() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={[ 'Présentation', 'Overview' ]}
          title={['Le gestionnaire de commerce,', 'The business management tool']}
          accent={['pensé pour les commerçants', 'built for merchants']}
          subtitle={[
            'COMAXE enregistre, conserve, organise et analyse les données réelles de votre commerce — pour que vous preniez les bonnes décisions, avec des chiffres.',
            'COMAXE records, keeps, organizes and analyzes your real business data — so you can make the right decisions with real numbers.',
          ]}
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PILLARS.map(({ icon: Icon, fr, en, subFr, subEn }) => (
            <div
              key={en}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8] w-fit">
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
