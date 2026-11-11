'use client';

import React from 'react';
import { Layers, Gift, Zap, Moon, ShieldCheck, Languages } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

const BENEFITS = [
  {
    icon: Layers,
    fr: 'Tout dans un seul outil',
    en: 'All in one tool',
    subFr: 'Ventes, stock, clients, dettes, dépenses et bénéfices au même endroit.',
    subEn: 'Sales, stock, customers, debts, expenses and profits together.',
  },
  {
    icon: Gift,
    fr: 'Gratuit pour commencer',
    en: 'Free to start',
    subFr: 'L’offre Essential suffit pour démarrer à gérer son commerce.',
    subEn: 'The Essential plan is enough to start managing your business.',
  },
  {
    icon: Zap,
    fr: 'Simple et rapide',
    en: 'Simple and fast',
    subFr: 'Enregistrer une vente prend quelques secondes, pas quelques minutes.',
    subEn: 'Recording a sale takes seconds, not minutes.',
  },
  {
    icon: Moon,
    fr: 'Thème clair ou sombre',
    en: 'Light or dark theme',
    subFr: 'Basculez entre les deux thèmes selon votre envie.',
    subEn: 'Switch between both themes whenever you like.',
  },
  {
    icon: ShieldCheck,
    fr: 'Vous restez maître du compte',
    en: 'You stay in control',
    subFr: 'Suppression complète de votre compte et de vos données à tout moment.',
    subEn: 'Full deletion of your account and data at any time.',
  },
  {
    icon: Languages,
    fr: 'Français & English',
    en: 'French & English',
    subFr: 'L’interface s’adapte à la langue de votre choix.',
    subEn: 'The interface adapts to your chosen language.',
  },
];

/**
 * Section « Avantages » — bande bleue avec 6 raisons de choisir COMAXE.
 */
export function LandingBenefits() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8 bg-blue-50 border-y border-slate-200/60">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['Avantages', 'Benefits']}
          title={['Pourquoi les commerçants', 'Why merchants']}
          accent={['choisissent COMAXE', 'choose COMAXE']}
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map(({ icon: Icon, fr, en, subFr, subEn }) => (
            <div
              key={en}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <Icon className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">{t(fr, en)}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">{t(subFr, subEn)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
