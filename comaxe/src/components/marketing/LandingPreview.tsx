'use client';

import React from 'react';
import { Check, ShoppingBag, TrendingUp, Wallet, Sparkles } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

/**
 * Section « Aperçu de l'application » — deux écrans illustrés
 * (ventes du jour + décomposition du bénéfice) avec les points clés.
 */
export function LandingPreview() {
  const { t } = useI18n();

  const points: { fr: string; en: string }[] = [
    { fr: 'Un tableau de bord qui résume votre journée', en: 'A dashboard that summarizes your day' },
    { fr: 'Les ventes du jour, avec recherche et filtres', en: "Today's sales, with search and filters" },
    { fr: 'Le bénéfice décomposé, vente par vente', en: 'Profit broken down, sale by sale' },
    { fr: 'Des graphiques lisibles, sans jargon', en: 'Readable charts, no jargon' },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['Aperçu', 'Preview']}
          title={['Vos données,', 'Your data']}
          accent={['en un coup d’œil', 'at a glance']}
          subtitle={[
            'Voici à quoi ressemble COMAXE au quotidien : des chiffres clairs, des couleurs qui parlent, rien de superflu.',
            'This is what COMAXE looks like day to day: clear numbers, meaningful colors, nothing extra.',
          ]}
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Points clés */}
          <ul className="space-y-4 order-2 lg:order-1">
            {points.map((p) => (
              <li key={p.en} className="flex items-start gap-3">
                <span className="p-1 rounded-lg bg-blue-50 text-[#1E5BF8] shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
                <span className="text-sm sm:text-base font-semibold text-slate-700">
                  {t(p.fr, p.en)}
                </span>
              </li>
            ))}
          </ul>

          {/* Écrans illustrés */}
          <div className="relative order-1 lg:order-2" aria-hidden="true">
            {/* Carte : ventes du jour */}
            <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-blue-500/10 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                    <ShoppingBag className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {t('Ventes du jour', "Today's sales")}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-200">
                  {t('3 ventes', '3 sales')}
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  { name: 'Amina K.', amount: '35 $' },
                  { name: 'Josué M.', amount: '120 $' },
                  { name: 'Sarah L.', amount: '75 $' },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-xl bg-slate-50/70 px-3.5 py-2.5"
                  >
                    <span className="text-xs font-bold text-slate-700">{row.name}</span>
                    <span className="text-xs font-extrabold text-slate-900">{row.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Carte : bénéfice (décalée) */}
            <div className="mt-4 sm:-mt-6 sm:mr-8 sm:ml-12 rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-emerald-500/10 p-5 sm:p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {t('Décomposition du bénéfice', 'Profit breakdown')}
                  </span>
                </div>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  { label: t('Chiffre d’affaires', 'Revenue'), value: '230 $', cls: 'text-[#1E5BF8]' },
                  { label: t('Dépenses', 'Expenses'), value: '− 65 $', cls: 'text-rose-600' },
                  { label: t('Bénéfice net', 'Net profit'), value: '165 $', cls: 'text-emerald-600' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">{row.label}</span>
                    <span className={`font-extrabold ${row.cls}`}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Barre de progression */}
              <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#1E5BF8] to-emerald-400" />
              </div>
            </div>

            {/* Badge flottant */}
            <div className="hidden sm:flex absolute -top-4 right-4 items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-violet-200 shadow-lg shadow-violet-500/10 text-xs font-bold text-violet-600">
              <Sparkles className="w-3.5 h-3.5" />
              {t('Objectif du jour', "Day's goal")} : 87 %
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
