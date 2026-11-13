/**
 * COMAXE — Routeur d'événements d'abonnement (SOURCE UNIQUE).
 *
 * Le vrai webhook Stripe ET le simulateur passent PAR ICI, avec la même
 * logique métier :
 *   1. journalisation idempotente dans `subscription_events`
 *      (event_id UNIQUE → un événement rejoué est un no-op garanti) ;
 *   2. application sur `subscriptions` : plan_id (réellement actif) n'est
 *      modifié QUE par un paiement confirmé ; requested_plan_id est la
 *      simple demande de l'utilisateur (un clic n'est jamais un paiement).
 *
 * En cas d'échec d'application, l'entrée de journal est retirée
 * (compensation) pour permettre un retraitement propre.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { isPlanId } from './plans.config';
import { mapSubscriptionRow, type SubscriptionRow } from './subscription';
import type { BillingPeriod, PlanId, Subscription, SubscriptionStatus } from './types';

/** Types d'événements du domaine (webhook Stripe mappé + simulateur) */
export type BillingEventType =
  | 'checkout.completed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  /** Action du client requise (3-D Secure, SEPA…) — statut past_due */
  | 'invoice.payment_action_required'
  /** Création / modification d'abonnement côté Stripe */
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.expired'
  | 'subscription.unpaid';

export interface SubscriptionEventData {
  /** ID unique de l'événement — clé d'idempotence (Stripe evt_… ou sim_…) */
  eventId: string;
  /** Bénéficiaire (toujours le propriétaire de l'abonnement) */
  userId: string;
  type: BillingEventType;
  /** Statut résultant */
  status: SubscriptionStatus;
  /** Plan à accorder (uniquement sur événement de paiement réussi) */
  planId?: PlanId | null;
  /**
   * Période du paiement confirmé (monthly/yearly), dérivée côté serveur
   * du Price ID. null/absent = sans effet sur `billing_period`.
   */
  billingPeriod?: BillingPeriod | null;
  /** Fin de période ISO (null = sans effet / défaut +30 j sur succès) */
  currentPeriodEnd?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeCustomerId?: string | null;
  /** Données brutes journalisées */
  payload?: unknown;
}

export interface ApplyResult {
  /** L'événement a-t-il modifié l'abonnement ? */
  applied: boolean;
  /** Déjà traité auparavant (event_id en double) ? */
  duplicate: boolean;
  /** Abonnement résultant (état courant dans les deux cas) */
  subscription: Subscription | null;
}

/** Mois simulé/composé : fin de période par défaut à +30 jours */
function defaultPeriodEnd(): string {
  return new Date(Date.now() + 30 * 86400000).toISOString();
}

/**
 * Applique un événement d'abonnement de façon idempotente.
 * @throws si la lecture/écriture échoue (l'événement reste retraitable).
 */
export async function applySubscriptionEvent(ev: SubscriptionEventData): Promise<ApplyResult> {
  // ── 1. Réclamer l'événement dans le journal (idempotence) ──────────
  const { error: journalErr } = await supabaseAdmin.from('subscription_events').insert({
    user_id: ev.userId,
    event_id: ev.eventId,
    event_type: ev.type,
    payload: (ev.payload ?? null) as never,
  });

  if (journalErr) {
    console.log('[events] journalErr:', { code: journalErr.code, message: journalErr.message, eventId: ev.eventId });
    if (journalErr.code === '23505') {
      // Déjà traité → no-op garanti, on renvoie juste l'état courant
      const { data } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', ev.userId)
        .maybeSingle();
      return {
        applied: false,
        duplicate: true,
        subscription: mapSubscriptionRow(data as SubscriptionRow | null),
      };
    }
    throw new Error(`subscription_events : ${journalErr.message}`);
  }

  try {
    // ── 2. État courant ──────────────────────────────────────────────
    const { data: current, error: readErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', ev.userId)
      .maybeSingle();
    if (readErr) throw new Error(`subscriptions (lecture) : ${readErr.message}`);
    const row = current as SubscriptionRow | null;

    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { status: ev.status, updated_at: nowIso };

    if (ev.status === 'active') {
      // Paiement confirmé → le plan devient réellement actif ;
      // la demande est soldée (requested_plan_id → null).
      const fallback: PlanId | null = isPlanId(row?.requested_plan_id)
        ? row?.requested_plan_id
        : isPlanId(row?.plan_id)
          ? row?.plan_id
          : null;
      const granted = ev.planId && isPlanId(ev.planId) ? ev.planId : fallback;
      const finalPlan = granted ?? 'essential';
      update.plan_id = finalPlan;
      update.requested_plan_id = null;
      update.current_period_start = nowIso;
      update.current_period_end = ev.currentPeriodEnd ?? defaultPeriodEnd();
      // Période de facturation : renseignée par l'événement (webhook la
      // déduit du Price ID, simulateur de l'intervalle choisi). Un plan
      // gratuit n'en a jamais ; sans information on conserve la période
      // connue (renouvellement invoice.paid sans Price).
      if (finalPlan === 'essential') update.billing_period = null;
      else if (ev.billingPeriod !== undefined) update.billing_period = ev.billingPeriod;
      if (ev.type === 'checkout.completed') update.started_at = nowIso;
    } else if (ev.status === 'canceled' || ev.status === 'expired' || ev.status === 'unpaid') {
      // Retour à l'offre gratuite : plan_id est remis à zéro (l'historique
      // complet reste dans subscription_events). Sans cette remise, une
      // simple demande ultérieure (pending conserve le plan) ferait
      // revivre un plan annulé SANS paiement.
      update.plan_id = 'essential';
      update.requested_plan_id = null;
      update.billing_period = null;
      if (ev.status === 'canceled' && ev.currentPeriodEnd) update.ends_at = ev.currentPeriodEnd;
    }
    // past_due / pending : ni plan ni demande touchés (grâce transitoire).

    if (ev.stripeSubscriptionId) update.stripe_subscription_id = ev.stripeSubscriptionId;
    if (ev.stripePriceId) update.stripe_price_id = ev.stripePriceId;
    if (ev.stripeCustomerId) update.stripe_customer_id = ev.stripeCustomerId;

    // ── 3. Appliquer : upsert robuste (la ligne existe via trigger d'inscription,
    //      mais on couvre aussi l'absence) ──────────────────────────────
    // On construit l'objet complet pour l'upsert (toutes les colonnes non-null).
    const upsertPayload = { user_id: ev.userId, ...update };
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('subscriptions')
      .upsert(upsertPayload, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (updErr) throw new Error(`subscriptions (upsert) : ${updErr.message}`);

    return { applied: true, duplicate: false, subscription: mapSubscriptionRow(updated as SubscriptionRow) };
  } catch (e) {
    console.log('[events] ERROR in applySubscriptionEvent:', e);
    // Compensation : l'événement n'a pas été appliqué → on le retire du
    // journal pour qu'un retraitement (rejeu Stripe) reste possible.
    await supabaseAdmin.from('subscription_events').delete().eq('event_id', ev.eventId);
    throw e;
  }
}
