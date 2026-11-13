/**
 * COMAXE — /api/billing/checkout
 * Renvoie l'URL du Payment Link Stripe correspondant à l'offre ET à
 * l'intervalle demandés (table PAYMENT_LINKS de stripe.ts — source
 * unique), enrichie de `client_reference_id=<user_id>` : le webhook
 * retrouvera l'utilisateur sur `checkout.session.completed`. Aucune
 * session n'est créée ici — le paiement se passe sur la page hébergée
 * Stripe (Checkout). Si Stripe n'est pas configuré pour cet intervalle
 * → 503 explicite : le client bascule alors sur le simulateur (même
 * logique métier, events.ts).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, markPlanRequested, unauthorized } from '@/lib/billing/api';
import { isCheckoutConfigured, paymentLinkFor, type PaidPlanId } from '@/lib/billing/stripe';
import type { BillingInterval } from '@/lib/billing/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as {
      plan?: unknown;
      interval?: unknown;
    };
    const plan = body.plan;
    if (plan !== 'pro' && plan !== 'max') {
      return NextResponse.json({ error: 'Offre invalide : « pro » ou « max » attendu.' }, { status: 400 });
    }

    // Intervalle : mensuel par défaut, annuel explicite — jamais autre chose.
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

    if (!isCheckoutConfigured(plan as PaidPlanId, interval)) {
      return NextResponse.json(
        {
          error: 'Paiement en ligne non configuré — utilisez le simulateur d’abonnement.',
          configured: false,
        },
        { status: 503 }
      );
    }

    // Demande de plan d'abord (clic ≠ paiement), puis lien de paiement.
    await markPlanRequested(user.id, plan as PaidPlanId);

    // Lien + Price dédiés à CETTE combinaison (jamais de lien générique) :
    // le Price emballé dans le lien identifie l'offre au webhook.
    const link = paymentLinkFor(plan as PaidPlanId, interval);
    if (!link?.url || !link.priceId) {
      return NextResponse.json(
        {
          error: 'Paiement en ligne non configuré — utilisez le simulateur d’abonnement.',
          configured: false,
        },
        { status: 503 }
      );
    }

    // client_reference_id = user_id : transmis par Stripe dans
    // checkout.session.completed — le seul pont utilisateur ↔ paiement
    // (aucun metadata dynamique sur un Payment Link).
    const sep = link.url.includes('?') ? '&' : '?';
    const url = `${link.url}${sep}client_reference_id=${encodeURIComponent(user.id)}`;
    return NextResponse.json({ success: true, url, planId: plan, interval });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur préparation du paiement.' },
      { status: 502 }
    );
  }
}
