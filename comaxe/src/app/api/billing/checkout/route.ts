/**
 * COMAXE — /api/billing/checkout
 * Crée une VRAIE session de paiement Stripe (mode test) pour l'offre
 * demandée, sur l'intervalle choisi (mensuel par défaut, annuel) — le
 * Price Stripe sélectionné porte déjà son intervalle. Si Stripe n'est
 * pas configuré pour cet intervalle → 503 explicite : le client bascule
 * alors sur le simulateur (même logique métier, events.ts).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, markPlanRequested, unauthorized } from '@/lib/billing/api';
import { isCheckoutConfigured, priceIdForPlan, stripeFetch, type PaidPlanId } from '@/lib/billing/stripe';
import type { BillingInterval } from '@/lib/billing/types';

export const dynamic = 'force-dynamic';

interface CheckoutSession {
  url: string;
}

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

    // Demande de plan d'abord (clic ≠ paiement), puis session Stripe réelle.
    await markPlanRequested(user.id, plan as PaidPlanId);

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const session = await stripeFetch<CheckoutSession>('/checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': priceIdForPlan(plan as PaidPlanId, interval)!,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/parametres/abonnement?checkout=success`,
      cancel_url: `${origin}/tarifs?checkout=canceled`,
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'metadata[plan_id]': plan,
      'metadata[interval]': interval,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan_id]': plan,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe n’a pas renvoyé d’URL de paiement.' }, { status: 502 });
    }
    return NextResponse.json({ success: true, url: session.url, planId: plan });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur création du paiement.' },
      { status: 502 }
    );
  }
}
