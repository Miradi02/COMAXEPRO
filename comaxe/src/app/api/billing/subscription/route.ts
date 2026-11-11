/**
 * COMAXE — /api/billing/subscription
 * GET  : abonnement réel de l'utilisateur connecté (jamais le « demandé »
 *        présenté comme actif : le plan rendu est le plan RÉSOLU).
 * POST : enregistrer une DEMANDE de plan { plan: 'pro' | 'max' }.
 *        Une demande ne change JAMAIS plan_id (voir markPlanRequested).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, markPlanRequested, readSubscription, unauthorized } from '@/lib/billing/api';
import { resolveActivePlan } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const subscription = await readSubscription(user.id);
    return NextResponse.json({
      subscription,
      planId: resolveActivePlan(subscription),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lecture abonnement.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
    const plan = body.plan;
    if (plan !== 'pro' && plan !== 'max') {
      return NextResponse.json(
        { error: 'Offre invalide : « pro » ou « max » attendu. L’offre gratuite ne se demande pas.' },
        { status: 400 }
      );
    }

    await markPlanRequested(user.id, plan);
    const subscription = await readSubscription(user.id);
    return NextResponse.json({
      success: true,
      requestedPlanId: plan,
      planId: resolveActivePlan(subscription),
      subscription,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur demande de plan.' },
      { status: 500 }
    );
  }
}
