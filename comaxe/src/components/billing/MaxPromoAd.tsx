'use client';

/**
 * COMAXE — Mini-publicité de l'offre Max.
 *
 * Règles métier (demande utilisateur) :
 *   • affichée UNIQUEMENT aux comptes sur l'offre gratuite Essential ;
 *   • croix × → la pub disparaît puis RÉAPPARAÎT après 1 minute ;
 *   • clic sur la pub → /tarifs?offres=payer (grille SANS Essential) ;
 *   • jamais affichée aux offres payantes (Pro / Max / …).
 *
 * Design system : carte blanche rounded-2xl border-slate-200/80 shadow-xs,
 * icône lucide dans p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8],
 * accent #1E5BF8 (hover #1548CF), prix en USD via formatUSD().
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useBilling } from '@/context/BillingContext';
import { getPlan } from '@/lib/billing/plans.config';
import { formatUSD } from '@/lib/utils';

/** Horodatage de fermeture — la pub réapparaît 60 s après */
const DISMISS_KEY = 'comaxe:max-promo-dismissed-at';
const REAPPEAR_MS = 60_000;

export function MaxPromoAd() {
  const { t } = useI18n();
  const { planId, loading } = useBilling();
  const [dismissedAt, setDismissedAt] = useState(0);
  /** Battement 1 s : gère la réapparition après fermeture */
  const [, setTick] = useState(0);

  // Horodatage de fermeture déjà enregistré (navigation précédente)
  useEffect(() => {
    try {
      setDismissedAt(Number(localStorage.getItem(DISMISS_KEY)) || 0);
    } catch {
      /* stockage indisponible : la pub suit son cours */
    }
  }, []);

  // Boucle de vie : réapparition 60 s après la fermeture
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const closedFor = Date.now() - dismissedAt;
  const show = !loading && planId === 'essential' && closedFor >= REAPPEAR_MS;

  const dismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const at = Date.now();
    setDismissedAt(at);
    try {
      localStorage.setItem(DISMISS_KEY, String(at));
    } catch {
      /* stockage indisponible : fermeture valable pour la session */
    }
  };

  if (!show) return null;

  const max = getPlan('max');

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-2rem)] max-w-[320px]">
      <Link
        href="/tarifs?offres=payer"
        className="group relative block bg-white rounded-2xl border border-slate-200/80 shadow-lg p-4 pr-9 transition-all hover:shadow-xl hover:border-blue-300 hover:-translate-y-0.5"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('Fermer la publicité', 'Close the advertisement')}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8] shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {t('Passez à COMAXE Max', 'Upgrade to COMAXE Max')}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t(
                `Analytique, Objectifs, ${max.limits.salesPerMonth} ventes/mois et sans publicité — dès ${formatUSD(max.priceMonthly)} /mois.`,
                `Analytics, Goals, ${max.limits.salesPerMonth} sales/month and ad-free — from ${formatUSD(max.priceMonthly)}/month.`
              )}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#1E5BF8] group-hover:text-[#1548CF] transition-colors">
              {t('Voir l’offre', 'See the plan')}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
