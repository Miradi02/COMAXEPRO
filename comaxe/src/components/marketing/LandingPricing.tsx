'use client';

import React from 'react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';
import { PricingPlans, PricingNote } from './PricingPlans';

/**
 * Section « Tarifs » de la landing (ancre #tarifs) — grille partagée
 * avec la page /tarifs : mêmes 6 offres (2 catégories), même sélecteur Mensuel | Annuel.
 */
export function LandingPricing() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/60 border-y border-slate-200/60">
      <div className="max-w-6xl mx-auto">
        <SectionHeading
          eyebrow={['Tarifs', 'Pricing']}
          title={['Une offre adaptée à', 'A plan for']}
          accent={['chaque activité', 'every business']}
          subtitle={[
            'Commencez gratuitement avec votre commerce, ou pilotez toute une entreprise : sans engagement, sans installation.',
            'Start free with your shop, or run a whole company: no commitment, no installation.',
          ]}
        />

        <div className="mt-10">
          <PricingPlans id="tarifs" />
        </div>

        <PricingNote />
      </div>
    </section>
  );
}
