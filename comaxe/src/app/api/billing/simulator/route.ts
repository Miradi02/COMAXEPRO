/**
 * COMAXE — /api/billing/simulator
 * Simule le cycle de vie d'un abonnement avec la MÊME logique métier que
 * le vrai webhook Stripe : les deux passent par `applySubscriptionEvent`
 * (events.ts) → idempotence par event_id, plan demandé ≠ plan actif.
 *
 * Sécurité : réservé à l'utilisateur connecté ; l'événement s'applique
 * TOUJOURS sur SON abonnement (jamais d'identifiant venant du corps).
 */

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, readSubscription, unauthorized } from '@/lib/billing/api';
import { supabaseAdmin } from '@/lib/supabase/server';
import { applySubscriptionEvent, type BillingEventType } from '@/lib/billing/events';
import { isPlanId } from '@/lib/billing/plans.config';
import { priceIdForPlan, type PaidPlanId } from '@/lib/billing/stripe';
import type { BillingInterval, PlanId, SubscriptionStatus } from '@/lib/billing/types';

export const dynamic = 'force-dynamic';

/** Type → statut résultant (source unique du simulateur) */
const STATUS_BY_TYPE: Record<BillingEventType, SubscriptionStatus> = {
  'checkout.completed': 'active',
  'invoice.paid': 'active',
  'invoice.payment_failed': 'past_due',
  'invoice.payment_action_required': 'past_due',
  'subscription.updated': 'pending',
  'subscription.canceled': 'canceled',
  'subscription.expired': 'expired',
  'subscription.unpaid': 'unpaid',
};

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as {
      type?: unknown;
      planId?: unknown;
      eventId?: unknown;
      interval?: unknown;
    };

    const type = body.type as BillingEventType;
    if (!type || !(type in STATUS_BY_TYPE)) {
      return NextResponse.json(
        {
          error: `Type d'événement inconnu : ${String(body.type)}.`,
          types: Object.keys(STATUS_BY_TYPE),
        },
        { status: 400 }
      );
    }

    // Intervalle du Price à journaliser : mensuel par défaut (l'UI n'en
    // expose pas encore), annuel si demandé explicitement.
    let interval: BillingInterval = 'month';
    if (body.interval !== undefined && body.interval !== null) {
      if (body.interval !== 'month' && body.interval !== 'year') {
        return NextResponse.json(
          { error: 'Intervalle invalide : « month » ou « year » attendu.' },
          { status: 400 }
        );
      }
      interval = body.interval;
    }

    // Clé d'idempotence calculée AVANT la validation du plan : un rejeu
    // d'un `checkout.completed` déjà traité arrive SANS planId (la demande
    // a été soldée par la 1re exécution) — il doit atteindre la détection
    // de doublon, pas renvoyer 400.
    const eventId =
      typeof body.eventId === 'string' && body.eventId.trim()
        ? body.eventId.trim()
        : `sim_${randomUUID()}`;

    // ── Plan concerné ────────────────────────────────────────────────
    const current = await readSubscription(user.id);
    let planId: PlanId | null = null;

    if (type === 'checkout.completed') {
      // Priorité au plan fourni, sinon la demande en cours — jamais gratuit
      // par défaut : un « paiement confirmé » doit viser une offre payante.
      planId = isPlanId(body.planId) ? body.planId : current?.requestedPlanId ?? null;
      if (!planId || planId === 'essential') {
        // Rejeu idempotent ? Si l'événement est déjà journalisé, on laisse
        // applySubscriptionEvent renvoyer duplicate=true (no-op garanti).
        const { data: seen } = await supabaseAdmin
          .from('subscription_events')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!seen) {
          return NextResponse.json(
            { error: 'planId requis (« pro » ou « max ») pour un paiement confirmé.' },
            { status: 400 }
          );
        }
        planId = null; // déjà traité : aucune application possible
      }
    } else if (isPlanId(body.planId)) {
      planId = body.planId;
    } else if (type === 'invoice.paid') {
      planId = current?.requestedPlanId ?? current?.planId ?? null;
    }

    const status = STATUS_BY_TYPE[type];
    const isSuccess = status === 'active';

    const result = await applySubscriptionEvent({
      eventId,
      userId: user.id,
      type,
      status,
      planId: isSuccess ? planId : null,
      currentPeriodEnd: isSuccess ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
      stripeSubscriptionId:
        type === 'checkout.completed' ? `sim_sub_${randomUUID().slice(0, 18)}` : null,
      stripePriceId:
        type === 'checkout.completed' && planId && planId !== 'essential'
          ? priceIdForPlan(planId as PaidPlanId, interval)
          : null,
      payload: { simulated: true, type, planId, interval },
    });

    return NextResponse.json({
      success: true,
      applied: result.applied,
      duplicate: result.duplicate,
      subscription: result.subscription,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur simulateur.' },
      { status: 500 }
    );
  }
}
