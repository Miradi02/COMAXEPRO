import type { BillingPeriod, PlanId, Subscription, SubscriptionStatus } from './types';
import { DEFAULT_PLAN_ID, isPlanId } from './plans.config';

/**
 * COMAXE — Ligne brute de la table `subscriptions` (colonnes snake_case)
 * et conversion vers le type métier `Subscription`.
 *
 * Source unique de mappage : middleware, contexte billing et routes API
 * (webhook/simulateur) partagent CE mapper — jamais de recopie.
 */

export interface SubscriptionRow {
  user_id?: string | null;
  plan_id?: string | null;
  requested_plan_id?: string | null;
  status?: string | null;
  billing_period?: string | null;
  started_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  ends_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const VALID_STATUSES: readonly SubscriptionStatus[] = [
  'active', 'past_due', 'unpaid', 'pending', 'canceled', 'expired',
];

function asStatus(value: unknown): SubscriptionStatus {
  return VALID_STATUSES.includes(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : 'active';
}

function asPlan(value: unknown): PlanId | null {
  return isPlanId(value) ? (value as PlanId) : null;
}

/** Période de facturation : 'monthly'/'yearly' seuls ; sinon null (gratuit). */
export function asBillingPeriod(value: unknown): BillingPeriod | null {
  return value === 'monthly' || value === 'yearly' ? value : null;
}

/**
 * Convertit une ligne de `subscriptions` en `Subscription`.
 * Retourne `null` si la ligne est absente (aucun abonnement → gratuit).
 * Une valeur inconnue (plan ou statut hors config) dégrade proprement
 * vers le plan par défaut / statut `active` au lieu de planter.
 */
export function mapSubscriptionRow(
  row: SubscriptionRow | null | undefined
): Subscription | null {
  if (!row) return null;
  const now = new Date().toISOString();
  const planId = asPlan(row.plan_id) ?? DEFAULT_PLAN_ID;
  return {
    userId: row.user_id ?? '',
    planId,
    requestedPlanId: asPlan(row.requested_plan_id),
    status: asStatus(row.status),
    // Période pertinente uniquement pour un plan payant actif : l'offre
    // gratuite n'a pas de période de facturation.
    billingPeriod: planId === 'essential' ? null : asBillingPeriod(row.billing_period),
    startedAt: row.started_at ?? now,
    currentPeriodStart: row.current_period_start ?? now,
    currentPeriodEnd: row.current_period_end ?? null,
    endsAt: row.ends_at ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    stripePriceId: row.stripe_price_id ?? null,
    createdAt: row.created_at ?? now,
    updatedAt: row.updated_at ?? now,
  };
}
