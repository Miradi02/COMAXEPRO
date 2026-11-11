'use client';

/**
 * COMAXE — État « fonctionnalité verrouillée » partagé.
 * Affiché quand l'abonnement actif ne débloque pas la fonctionnalité
 * (repli client si le middleware a laissé passer, et état visuel des
 * pages Objectifs / Analytique). Le message vient du moteur centralisé
 * (`messages.ts`) — jamais fabriqué dans la page.
 */

import React from 'react';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { featureLockedMessage } from '@/lib/billing/messages';
import type { FeatureKey } from '@/lib/billing/types';

export function FeatureLocked({ feature }: { feature: FeatureKey }) {
  const { planId } = useBilling();
  const { t, locale } = useI18n();

  const message = featureLockedMessage(planId ?? 'essential', feature);
  const text = locale === 'en' ? message.en : message.fr;

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-8 sm:p-12 flex flex-col items-center text-center">
      <div className="p-3 rounded-xl bg-blue-50 text-[#1E5BF8] mb-4">
        <Lock className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-900 tracking-tight mb-2">
        {t('Fonctionnalité verrouillée', 'Feature locked')}
      </h2>
      <p className="text-sm text-slate-500 max-w-md mb-6">{text}</p>
      <Link
        href="/tarifs"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-sm font-bold transition-colors"
      >
        {t('Voir les offres', 'See plans')}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
