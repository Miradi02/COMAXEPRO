'use client';

import React from 'react';
import { UserPlus, Store, PlusCircle, LineChart } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

const STEPS = [
  {
    icon: UserPlus,
    fr: 'Créez votre compte',
    en: 'Create your account',
    subFr: 'Gratuit, en quelques clics, puis vous choisissez votre offre.',
    subEn: 'Free, in a few clicks, then you pick your plan.',
  },
  {
    icon: Store,
    fr: 'Renseignez votre commerce',
    en: 'Set up your business',
    subFr: 'Nom, pays et devise : COMAXE s’adapte à votre boutique.',
    subEn: 'Name, country and currency: COMAXE fits your store.',
  },
  {
    icon: PlusCircle,
    fr: 'Enregistrez vos opérations',
    en: 'Record your operations',
    subFr: 'Ventes, stock, dépenses et dettes, au fil de l’eau.',
    subEn: 'Sales, stock, expenses and debts, as they happen.',
  },
  {
    icon: LineChart,
    fr: 'Analysez et progressez',
    en: 'Analyze and improve',
    subFr: 'Bénéfice, objectifs et analytique pour prendre les bonnes décisions.',
    subEn: 'Profit, goals and analytics to make the right calls.',
  },
];

/**
 * Section « Fonctionnement » — 4 étapes, la première en dégradé bleu
 * (calé sur la première carte colorée de la référence).
 */
export function LandingSteps() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['Fonctionnement', 'How it works']}
          title={['Comment ça marche,', 'How it works']}
          accent={['en 4 étapes', 'in 4 steps']}
          subtitle={[
            'De la création du compte à l’analyse de vos performances, tout est simple.',
            'From creating your account to analyzing performance, everything is simple.',
          ]}
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map(({ icon: Icon, fr, en, subFr, subEn }, index) => {
            const first = index === 0;
            return (
              <div
                key={en}
                className={`relative rounded-3xl p-6 border transition-all ${
                  first
                    ? 'bg-gradient-to-b from-[#1E5BF8] to-[#1548CF] border-[#1E5BF8] text-white shadow-xl shadow-blue-500/25 sm:-rotate-1'
                    : 'bg-white border-slate-200/80 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Numéro */}
                <span
                  className={`absolute top-4 right-5 text-3xl font-extrabold tracking-tight ${
                    first ? 'text-white/25' : 'text-slate-200'
                  }`}
                >
                  0{index + 1}
                </span>

                <span
                  className={`inline-flex p-2 rounded-xl ${
                    first ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#1E5BF8]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>

                <h3
                  className={`mt-4 text-base font-bold ${first ? 'text-white' : 'text-slate-900'}`}
                >
                  {t(fr, en)}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    first ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {t(subFr, subEn)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
