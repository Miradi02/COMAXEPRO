'use client';

/**
 * COMAXE — Simulateur de cycle de vie d'abonnement (phase de préparation
 * Stripe).
 *
 * Appelle POST /api/billing/simulator : MÊME routeur d'événements que le
 * vrai webhook Stripe (events.ts) → idempotence par event_id, plan
 * demandé ≠ plan actif. Aucun paiement réel n'est effectué.
 *
 * Les boutons déclenchent un événement sur le SEUL abonnement de
 * l'utilisateur connecté (le serveur ignore tout identifiant venu d'ici
 * qui ne lui appartient pas).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FlaskConical,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useBilling } from '@/context/BillingContext';
import { BillingApiError, simulateEvent } from '@/lib/billing/client';
import { getPlan } from '@/lib/billing/plans.config';
import type { PlanId } from '@/lib/billing/types';

type PaidPlan = 'pro' | 'max';

interface Scenario {
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  fr: string;
  en: string;
  /** Nécessite une offre visée (paiement confirmé) */
  needsPlan?: boolean;
}

/** Scénarios du simulateur (miroirs des types acceptés par la route) */
const SCENARIOS: Scenario[] = [
  { type: 'checkout.completed', icon: CheckCircle2, fr: 'Paiement réussi', en: 'Payment succeeded', needsPlan: true },
  { type: 'invoice.payment_failed', icon: XCircle, fr: 'Paiement échoué', en: 'Payment failed' },
  { type: 'invoice.paid', icon: RefreshCw, fr: 'Renouvellement', en: 'Renewal' },
  { type: 'subscription.canceled', icon: Ban, fr: 'Annulation', en: 'Canceled' },
  { type: 'subscription.expired', icon: Clock, fr: 'Expiration', en: 'Expired' },
  { type: 'subscription.unpaid', icon: AlertTriangle, fr: 'Impayé', en: 'Unpaid' },
];

const PLAN_CHIPS: PaidPlan[] = ['pro', 'max'];

export function SubscriptionSimulator({ onApplied }: { onApplied?: () => void }) {
  const { t } = useI18n();
  const { planId, requestedPlanId, refresh } = useBilling();

  /** Offre visée par un « paiement réussi » */
  const [target, setTarget] = useState<PaidPlan>('pro');
  const targetTouched = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Cible par défaut : la demande en cours, sinon l'offre payante active.
  useEffect(() => {
    if (targetTouched.current) return;
    const current: PlanId | null = requestedPlanId ?? planId;
    if (current === 'pro' || current === 'max') setTarget(current);
  }, [requestedPlanId, planId]);

  const run = async (s: Scenario) => {
    setBusy(s.type);
    setResult(null);
    try {
      const res = await simulateEvent({
        type: s.type,
        planId: s.needsPlan ? target : undefined,
      });
      await refresh();
      onApplied?.();
      setResult({
        ok: true,
        text: res.duplicate
          ? t(
              'Événement déjà traité (idempotence) — aucun changement.',
              'Event already processed (idempotent) — no change.'
            )
          : t(
              'Événement appliqué à votre abonnement.',
              'Event applied to your subscription.'
            ),
      });
    } catch (e) {
      setResult({
        ok: false,
        text:
          e instanceof BillingApiError
            ? e.message
            : t('Erreur du simulateur.', 'Simulator error.'),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
          <FlaskConical className="w-4 h-4 text-[#1E5BF8]" />
          {t('Scénarios simulés', 'Simulated scenarios')}
        </div>

        {/* Offre visée par « Paiement réussi » */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">
            {t('Offre visée :', 'Target plan:')}
          </span>
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {PLAN_CHIPS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  targetTouched.current = true;
                  setTarget(p);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                  target === p
                    ? 'bg-[#1E5BF8] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#1E5BF8]'
                }`}
              >
                {getPlan(p).name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const isBusy = busy === s.type;
          return (
            <button
              key={s.type}
              type="button"
              onClick={() => run(s)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-[#1E5BF8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#1E5BF8]" />
              ) : (
                <Icon className="w-4 h-4 text-[#1E5BF8]" />
              )}
              {t(s.fr, s.en)}
            </button>
          );
        })}
      </div>

      {result && (
        <div
          role="status"
          className={`mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium ${
            result.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p>{result.text}</p>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 leading-relaxed">
        {t(
          'Ces événements suivent la même logique métier que le webhook Stripe réel (journalisation idempotente, plan demandé ≠ plan actif). Aucun paiement réel n’est effectué.',
          'These events follow the same business logic as the real Stripe webhook (idempotent logging, requested plan ≠ active plan). No real payment is made.'
        )}
      </p>
    </div>
  );
}
