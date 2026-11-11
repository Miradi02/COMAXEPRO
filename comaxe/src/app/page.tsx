import React from 'react';
import { LandingHeader } from '@/components/marketing/LandingHeader';
import { LandingHero } from '@/components/marketing/LandingHero';
import { LandingIntro } from '@/components/marketing/LandingIntro';
import { LandingProblems } from '@/components/marketing/LandingProblems';
import { LandingSolution } from '@/components/marketing/LandingSolution';
import { LandingFeatures } from '@/components/marketing/LandingFeatures';
import { LandingPreview } from '@/components/marketing/LandingPreview';
import { LandingBenefits } from '@/components/marketing/LandingBenefits';
import { LandingSteps } from '@/components/marketing/LandingSteps';
import { LandingPricing } from '@/components/marketing/LandingPricing';
import { LandingFaq } from '@/components/marketing/LandingFaq';
import { LandingContact } from '@/components/marketing/LandingContact';
import { LandingCta } from '@/components/marketing/LandingCta';
import { LandingFooter } from '@/components/marketing/LandingFooter';

/**
 * RACINE PUBLIQUE — Landing page COMAXE.
 * Référence visuelle : `photo/acceuil.webp` (ambiance, hiérarchie, proportions).
 *
 * Construction du plan (tâches 4 → 6) :
 *  ✓ Tâche 4 : header sticky, hero + maquette, présentation, problèmes, solution
 *  ✓ Tâche 5 : fonctionnalités, aperçu de l'app, avantages, fonctionnement
 *  ✓ Tâche 6 : tarifs, FAQ, contact, CTA final, footer
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FD] relative overflow-x-hidden">
      <LandingHeader />
      <main>
        {/* Tâche 4 */}
        <LandingHero />
        <LandingIntro />
        <LandingProblems />
        <LandingSolution />

        {/* Tâche 5 */}
        <LandingFeatures />
        <LandingPreview />
        <LandingBenefits />
        <LandingSteps />

        {/* Tâche 6 : tarifs, FAQ, contact, CTA final, footer */}
        <LandingPricing />
        <LandingFaq />
        <LandingContact />
        <LandingCta />
      </main>

      <LandingFooter />
    </div>
  );
}
