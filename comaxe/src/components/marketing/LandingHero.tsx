'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { AppMockup } from './AppMockup';

const CHIPS: { fr: string; en: string }[] = [
  { fr: 'Gratuit pour commencer', en: 'Free to start' },
  { fr: 'Aucune carte bancaire requise', en: 'No credit card required' },
  { fr: 'Sans installation', en: 'No installation' },
];

/**
 * Hero de la landing — répond immédiatement à « Qu'est-ce que COMAXE ? »
 * et « Pourquoi l'utiliser ? », avec la maquette d'application.
 */
export function LandingHero() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden">
      {/* Halos d'ambiance (identité COMAXE) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-32 w-[440px] h-[440px] rounded-full bg-blue-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-32 w-[400px] h-[400px] rounded-full bg-violet-500/10 blur-3xl"
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-14 sm:pt-20 pb-10 sm:pb-16">
        <div className="text-center max-w-3xl mx-auto">
          {/* Eyebrow */}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-200/80 text-xs font-bold">
            {t('Outil de gestion de commerce', 'Business management tool')}
          </span>

          {/* Titre */}
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
            {t('Tout votre commerce, ', 'Your whole business, ')}
            <span className="text-[#1E5BF8]">{t('au même endroit', 'in one place')}</span>
          </h1>

          {/* Sous-titre : définition de COMAXE */}
          <p className="mt-5 text-slate-500 text-sm sm:text-lg leading-relaxed max-w-2xl mx-auto">
            {t(
              'COMAXE est un outil de gestion de commerce qui aide les commerçants à mieux gérer leurs ventes, leur stock, leurs clients, leurs dépenses, leurs dettes et leurs bénéfices.',
              'COMAXE is a business management tool that helps merchants better handle their sales, inventory, customers, expenses, debts and profits.'
            )}
          </p>

          {/* Points de confiance */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {CHIPS.map((chip) => (
              <span
                key={chip.en}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500"
              >
                <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />
                {t(chip.fr, chip.en)}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="#tarifs"
              className="group inline-flex items-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-full bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95 transition-all"
            >
              {t('Commencer gratuitement', 'Start for free')}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="#fonctionnalites"
              className="inline-flex items-center gap-2 px-6 sm:px-7 py-3.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-[#1E5BF8] text-sm font-bold transition-all"
            >
              {t('Découvrir les fonctionnalités', 'Discover the features')}
            </Link>
          </div>
        </div>

        {/* Maquette de l'application */}
        <div className="mt-12 sm:mt-16">
          <AppMockup />
        </div>
      </div>
    </section>
  );
}
