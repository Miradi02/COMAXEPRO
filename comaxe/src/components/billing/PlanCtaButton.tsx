'use client';

/**
 * COMAXE — Bouton d'offre CONNECTÉ au moteur d'abonnement.
 *
 * Source unique de la logique des CTA (landing + /tarifs) — les pages ne
 * fournissent que le libellé et les classes (design inchangé) :
 *   • non connecté → /login?next=… (reprise du flux après connexion) ;
 *   • Essential (connecté) → /dashboard : le plan gratuit est déjà actif,
 *     aucun paiement ;
 *   • Pro/Max (connecté) → DEMANDE de plan via requestPlan() — un clic
 *     n'est jamais un paiement — puis CTA vers la page Abonnement
 *     (simulateur) pour finaliser.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBilling } from '@/context/BillingContext';
import { useI18n } from '@/context/I18nContext';
import { BillingApiError, requestPlan } from '@/lib/billing/client';
import type { PlanId } from '@/lib/billing/types';

interface PlanCtaButtonProps {
  planId: PlanId;
  /** Libellé marketing déjà traduit (CTA_LABELS) */
  label: string;
  /** Classes de style fournies par la carte (design conservé) */
  className: string;
}

export function PlanCtaButton({ planId, label, className }: PlanCtaButtonProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { planId: activePlan, requestedPlanId, refresh } = useBilling();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Non connecté : authentification avec reprise du flux ── */
  if (!user) {
    const next = planId === 'essential' ? '/dashboard' : `/tarifs?plan=${planId}`;
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

  /* ── Demande déjà enregistrée : finalisation (simulateur) ── */
  if (requestedPlanId === planId) {
    return (
      <Link
        href="/parametres/abonnement"
        className={className}
        title={t('Finaliser l’activation', 'Complete activation')}
      >
        <Check className="w-4 h-4" />
        {t('Demande enregistrée', 'Request recorded')}
      </Link>
    );
  }

  /* ── Clic « S'abonner » → DEMANDE de plan (≠ paiement) ── */
  const handleClick = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestPlan(planId);
      await refresh();
    } catch (e) {
      setError(
        e instanceof BillingApiError && e.status === 401
          ? t('Connectez-vous pour continuer.', 'Sign in to continue.')
          : t(
              'Impossible d’enregistrer votre demande. Réessayez.',
              'Could not save your request. Please try again.'
            )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" onClick={handleClick} disabled={submitting} className={className}>
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('Envoi…', 'Sending…')}
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-rose-600 text-center leading-snug">{error}</p>
      )}
    </>
  );
}
