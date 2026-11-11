'use client';

import React from 'react';
import {
  ShoppingBag,
  Package,
  Users,
  HandCoins,
  ReceiptText,
  TrendingUp,
  Target,
  BarChart3,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

type Tone = 'blue' | 'amber' | 'violet' | 'rose' | 'emerald' | 'orange';

const TONES: Record<Tone, { box: string; bar: string }> = {
  blue: { box: 'bg-blue-50 text-[#1E5BF8]', bar: 'bg-[#1E5BF8]' },
  amber: { box: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' },
  violet: { box: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
  rose: { box: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500' },
  emerald: { box: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  orange: { box: 'bg-orange-50 text-orange-600', bar: 'bg-orange-500' },
};

const FEATURES = [
  {
    icon: ShoppingBag,
    tone: 'blue' as Tone,
    fr: 'Ventes',
    en: 'Sales',
    descFr: 'Enregistrez chaque vente en quelques secondes : client, articles, quantités et mode de paiement.',
    descEn: 'Record every sale in seconds: customer, items, quantities and payment method.',
    bars: [40, 62, 48, 86],
  },
  {
    icon: Package,
    tone: 'amber' as Tone,
    fr: 'Stock',
    en: 'Inventory',
    descFr: 'Les quantités se mettent à jour automatiquement à chaque vente enregistrée.',
    descEn: 'Quantities update automatically with every recorded sale.',
    bars: [70, 55, 82, 60],
  },
  {
    icon: Users,
    tone: 'violet' as Tone,
    fr: 'Clients',
    en: 'Customers',
    descFr: 'Retrouvez vos clients, leurs coordonnées et leurs achats, sans fouiller dans un carnet.',
    descEn: 'Find your customers, details and purchases without digging through a notebook.',
    bars: [35, 58, 74, 66],
  },
  {
    icon: HandCoins,
    tone: 'rose' as Tone,
    fr: 'Dettes',
    en: 'Debts',
    descFr: 'Suivez les crédits clients, les paiements reçus et les soldes restants.',
    descEn: 'Track customer credit, payments received and remaining balances.',
    bars: [80, 64, 46, 30],
  },
  {
    icon: ReceiptText,
    tone: 'orange' as Tone,
    fr: 'Dépenses',
    en: 'Expenses',
    descFr: 'Notez toutes les dépenses du commerce : achats, charges, transport.',
    descEn: 'Log every business expense: purchases, bills, transport.',
    bars: [30, 45, 38, 55],
  },
  {
    icon: TrendingUp,
    tone: 'emerald' as Tone,
    fr: 'Bénéfices',
    en: 'Profits',
    descFr: 'Ventes moins dépenses : votre bénéfice est calculé et décomposé automatiquement.',
    descEn: 'Sales minus expenses: your profit is calculated and broken down automatically.',
    bars: [42, 58, 66, 92],
  },
  {
    icon: Target,
    tone: 'blue' as Tone,
    fr: 'Objectifs',
    en: 'Goals',
    descFr: 'Fixez des objectifs de ventes et de bénéfices, puis suivez votre progression.',
    descEn: 'Set sales and profit goals, then track your progress.',
    bars: [25, 45, 65, 88],
  },
  {
    icon: BarChart3,
    tone: 'violet' as Tone,
    fr: 'Analytique',
    en: 'Analytics',
    descFr: 'Graphiques et indicateurs pour comprendre vos performances et décider.',
    descEn: 'Charts and indicators to understand performance and decide.',
    bars: [55, 40, 75, 68],
  },
];

/**
 * Section « Fonctionnalités » (ancre #fonctionnalites) — les 8 piliers
 * de l'application, en cartes avec mini-visualisation.
 */
export function LandingFeatures() {
  const { t } = useI18n();

  return (
    <section id="fonctionnalites" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/60 border-y border-slate-200/60">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['Fonctionnalités', 'Features']}
          title={['Tout ce qu’il faut pour', 'Everything you need to']}
          accent={['gérer votre commerce', 'run your business']}
          subtitle={[
            'Huit espaces complémentaires qui travaillent ensemble, avec les mêmes données réelles.',
            'Eight complementary spaces working together, with the same real data.',
          ]}
        />

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, tone, fr, en, descFr, descEn, bars }) => {
            const toneStyle = TONES[tone];
            return (
              <div
                key={en}
                className="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className={`p-1.5 rounded-lg w-fit ${toneStyle.box}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{t(fr, en)}</h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{t(descFr, descEn)}</p>

                {/* Mini-visualisation décorative */}
                <div className="mt-4 flex items-end gap-1.5 h-10" aria-hidden="true">
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t-md ${toneStyle.bar} opacity-80`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
