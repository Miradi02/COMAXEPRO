'use client';

/**
 * COMAXE — Bouton d'offre CONNECTÉ au moteur d'abonnement.
 *
 * Source unique de la logique des CTA (landing + /tarifs) — les pages ne
 * fournissent que le libellé, la période et les classes (design inchangé) :
 *   • non connecté → /login?next=… (reprise du flux vers /paiement) ;
 *   • Essential (connecté) → /dashboard : le plan gratuit est déjà actif,
 *     aucun paiement ;
 *   • offre déjà active → /parametres/abonnement (gestion, jamais de
 *     re-paiement) ;
 *   • demande déjà enregistrée → /paiement pour finaliser le paiement ;
 *   • Pro/Max → /paiement?plan=…&interval=… : choix du moyen de paiement
 *     puis Checkout Stripe — le webhook reste la seule source de vérité.
 */

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import type { BillingInterval, PlanId } from '@/lib/billing/types';

interface PlanCtaButtonProps {
  planId: PlanId;
  /** Période choisie sur la grille tarifaire (Mensuel / Annuel) */
  interval?: BillingInterval;
  /** Libellé marketing déjà traduit (CTA_LABELS) */
  label: string;
  /** Classes de style fournies par la carte (design conservé) */
  className: string;
}

export function PlanCtaButton({
  planId,
  interval = 'month',
  label,
  className,
}: PlanCtaButtonProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { planId: activePlan, requestedPlanId } = useBilling();

  /** Page de paiement : choix du moyen → Checkout Stripe hébergé */
  const payHref = `/paiement?plan=${planId}&interval=${interval}`;

  /* ── Non connecté : authentification avec reprise du flux ── */
  if (!user) {
    const next = planId === 'essential' ? '/dashboard' : payHref;
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={className}>
        {label}
        <ArrowRight className="w-4 h-4" />
      </Link>
    );
  }

  /* ── Essential : plan gratuit déjà actif → tableau de bord ── */
  if (planId === 'essential') {
    return (
      <Link href="/dashboard" className={className}>
        {label}
        <ArrowRight className="w-4 h-4" />
      </Link>
    );
  }

  /* ── Offre déjà ACTIVE : gestion (jamais de re-paiement) ── */
  if (activePlan === planId) {
    return (
      <Link
        href="/parametres/abonnement"
        className={className}
        title={t('Gérer mon offre', 'Manage my plan')}
      >
        <Check className="w-4 h-4" />
        {t('Offre active', 'Active plan')}
      </Link>
    );
  }

  /* ── Demande déjà enregistrée : finalisation du paiement ── */
  if (requestedPlanId === planId) {
    return (
      <Link
        href={payHref}
        className={className}
        title={t('Finaliser le paiement', 'Complete the payment')}
      >
        {t('Finaliser le paiement', 'Complete the payment')}
        <ArrowRight className="w-4 h-4" />
      </Link>
    );
  }

  /* ── Clic « S'abonner » → /paiement (moyen de paiement → Stripe) ── */
  return (
    <Link href={payHref} className={className}>
      {label}
      <ArrowRight className="w-4 h-4" />
    </Link>
  );
}
