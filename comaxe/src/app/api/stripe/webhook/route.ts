/**
 * COMAXE — /api/stripe/webhook (POINT D'ENTRÉE UNIQUE des événements Stripe)
 *
 * Sécurité :
 *   - POST uniquement (405 pour toute autre méthode) ;
 *   - 503 si STRIPE_WEBHOOK_SECRET absent (jamais de secret exposé) ;
 *   - corps BRUT lu AVANT tout JSON.parse (obligatoire pour la signature) ;
 *   - signature `Stripe-Signature` vérifiée (HMAC SHA-256 timing-safe,
 *     tolérance 5 min) → 400 si invalide, aucun effet en base ;
 *   - 200 une fois la signature validée (idempotence par event_id gérée
 *     par le handler partagé), 500 sur erreur interne (Stripe rejoue).
 *
 * La logique métier vit dans `@/lib/billing/webhook` (handler partagé) qui
 * délègue à `applySubscriptionEvent` (events.ts) : SOURCE UNIQUE.
 * Le webhook est la source de vérité de l'abonnement — jamais le frontend.
 * En mode TEST → LIVE : seules les variables d'environnement changent.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStripeConfig } from '@/lib/billing/stripe';
import { verifyStripeSignature } from '@/lib/billing/stripe-signature';
import { handleStripeEvent, type StripeEvent } from '@/lib/billing/webhook';

export const dynamic = 'force-dynamic';

/** POST uniquement — toute autre méthode est refusée. */
export async function GET() {
  return NextResponse.json(
    { error: 'Méthode non autorisée. Utilisez POST.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(req: NextRequest) {
  const { webhookSecret } = getStripeConfig();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook non configuré (STRIPE_WEBHOOK_SECRET absent).' },
      { status: 503 }
    );
  }

  // Corps brut OBLIGATOIRE pour la signature (avant tout JSON.parse).
  const raw = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature || !verifyStripeSignature(raw, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Signature Stripe invalide.' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  try {
    const handled = await handleStripeEvent(event);
    // 200 toujours après vérification (sinon Stripe renvoie en boucle) :
    // l'idempotence par event_id protège déjà contre les rejeux.
    return NextResponse.json({ received: true, ...handled });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur traitement événement.' },
      { status: 500 }
    );
  }
}
