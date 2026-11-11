/**
 * COMAXE — Entitlements : droits effectifs d'un utilisateur selon son plan.
 *
 * Point d'entrée unique de toute décision « ai-je le droit ? » :
 *   • plan RÉELLEMENT actif (vs plan demandé) ;
 *   • fonctionnalités déverrouillées (Objectifs, Analytique, Publicité) ;
 *   • limites de ressources (création autorisée ?) ;
 *   • fenêtre d'historique (7 jours pour Essential, illimité sinon).
 *
 * Les pages interrogent ce moteur — jamais de `if plan === 'essential'`.
 */

import type {
  FeatureKey,
  PlanDefinition,
  PlanFeatures,
  PlanId,
  PlanLimits,
  ResourceKey,
  Subscription,
  SubscriptionStatus,
} from './types';
import { DEFAULT_PLAN_ID, PLAN_IDS, getPlan, isPlanId } from './plans.config';
import { getResourceUsage, type ResourceUsage, type UsageCounts } from './usage';

/* ── Résolution du plan actif ─────────────────────────────────────── */

/**
 * Statuts qui accordent EFFECTIVEMENT leur plan :
 *  • active   → à jour ;
 *  • past_due → impayé transitoire (grâce, type Stripe avant blocage) ;
 *  • pending  → plan DEMANDÉ mais non confirmé : on conserve le plan déjà
 *               actif (un clic n'est jamais une preuve de paiement).
 * canceled / expired / unpaid → retour à l'offre gratuite.
 */
const GRANTING_STATUSES: SubscriptionStatus[] = ['active', 'past_due', 'pending'];

/** Plan réellement accordé (null/état non accordant → offre gratuite) */
export function resolveActivePlan(sub: Subscription | null | undefined): PlanId {
  if (!sub) return DEFAULT_PLAN_ID;
  if (!GRANTING_STATUSES.includes(sub.status)) return DEFAULT_PLAN_ID;
  return isPlanId(sub.planId) ? sub.planId : DEFAULT_PLAN_ID;
}

/* ── Entitlements ─────────────────────────────────────────────────── */

export interface Entitlements {
  /** Plan RÉELLEMENT actif */
  planId: PlanId;
  plan: PlanDefinition;
  /** Plan DEMANDÉ (bouton « S'abonner »), null = aucune demande */
  requestedPlanId: PlanId | null;
  /** Statut d'abonnement ; 'none' = aucun abonnement enregistré */
  status: SubscriptionStatus | 'none';
  features: PlanFeatures;
  limits: PlanLimits;
}

/** Calcule les droits à partir de l'état d'abonnement (null = gratuit) */
export function getEntitlements(sub: Subscription | null | undefined): Entitlements {
  const planId = resolveActivePlan(sub);
  const plan = getPlan(planId);
  return {
    planId,
    plan,
    requestedPlanId: sub && isPlanId(sub.requestedPlanId) ? sub.requestedPlanId : null,
    status: sub ? sub.status : 'none',
    features: plan.features,
    limits: plan.limits,
  };
}

/* ── Fonctionnalités ──────────────────────────────────────────────── */

/** La fonctionnalité est-elle déverrouillée pour ce plan ? */
export function isFeatureUnlocked(plan: PlanId | Entitlements, feature: FeatureKey): boolean {
  const planId = typeof plan === 'string' ? plan : plan.planId;
  return getPlan(planId).features[feature] === true;
}

/** Idem à partir de l'abonnement (résout le plan actif) */
export function canUseFeature(
  sub: Subscription | null | undefined,
  feature: FeatureKey
): boolean {
  return isFeatureUnlocked(resolveActivePlan(sub), feature);
}

/* ── Historique (fenêtre glissante) ───────────────────────────────── */

export type HistoryKey = 'expense' | 'profit';

/** Jour de coupure de l'historique ; null = illimité */
export function historyCutoff(
  plan: PlanId | Entitlements,
  key: HistoryKey,
  now: Date = new Date()
): Date | null {
  const planId = typeof plan === 'string' ? plan : plan.planId;
  const days =
    key === 'expense'
      ? getPlan(planId).limits.expensesHistoryDays
      : getPlan(planId).limits.profitsHistoryDays;
  if (days == null) return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/**
 * Un enregistrement (horodatage ISO — created_at_ts) est-il dans la
 * fenêtre d'historique du plan ? Sans horodatage lisible et avec une
 * fenêtre active, la règle est stricte : hors fenêtre.
 */
export function isWithinHistory(
  plan: PlanId | Entitlements,
  key: HistoryKey,
  isoTs: string | undefined | null,
  now: Date = new Date()
): boolean {
  const cutoff = historyCutoff(plan, key, now);
  if (!cutoff) return true;
  if (!isoTs) return false;
  const t = Date.parse(isoTs);
  if (Number.isNaN(t)) return false;
  return t >= cutoff.getTime();
}

/* ── Limites de création ──────────────────────────────────────────── */

export type CreateCheck =
  | { ok: true; usage: ResourceUsage }
  | {
      ok: false;
      planId: PlanId;
      resource: ResourceKey;
      used: number;
      limit: number;
      usage: ResourceUsage;
    };

/** Peut-on créer ENCORE une ressource de ce type ? */
export function checkCanCreate(
  plan: PlanId | Entitlements,
  resource: ResourceKey,
  counts: UsageCounts
): CreateCheck {
  const planId = typeof plan === 'string' ? plan : plan.planId;
  const usage = getResourceUsage(planId, resource, counts);
  return usage.canCreate
    ? { ok: true, usage }
    : { ok: false, planId, resource, used: usage.used, limit: usage.limit, usage };
}

/** Version booléenne (gardes rapides) */
export function canCreate(
  plan: PlanId | Entitlements,
  resource: ResourceKey,
  counts: UsageCounts
): boolean {
  const planId = typeof plan === 'string' ? plan : plan.planId;
  return getResourceUsage(planId, resource, counts).canCreate;
}

/* ── Offre supérieure (progression) ───────────────────────────────── */

/**
 * Offre supérieure implémentée (null = aucune au-dessus).
 * Basé sur l'ordre de PLAN_IDS : ajouter Ultime +1 dans types.ts/plans.config
 * fait automatiquement passer Max → Ultime.
 */
export function nextPlanId(planId: PlanId): PlanId | null {
  const i = PLAN_IDS.indexOf(planId);
  return i >= 0 && i + 1 < PLAN_IDS.length ? PLAN_IDS[i + 1] : null;
}
