/**
 * COMAXE — Handler partagé des événements Stripe (webhook).
 *
 * SOURCE UNIQUE de la traduction Stripe → domaine : chaque événement est
 * converti en événement du domaine puis confié à `applySubscriptionEvent`
 * (events.ts) qui gère l'idempotence par `event_id` et l'application sur
 * `subscriptions`. Le webhook est la SOURCE DE VÉRITÉ de l'abonnement :
 * le frontend ne confirme jamais un statut.
 *
 * Plans : jamais de prix en dur — le plan ET la période de facturation
 * sont déduits DU PRICE PAYÉ : `planIdForPrice` + `billingPeriodFromPrice`
 * (Price IDs Stripe en variables d'environnement, test → live = changement
 * de valeurs d'env uniquement). Un Payment Link ne portant aucun metadata
 * dynamique, le webhook RELIT la session Checkout
 * (`line_items → price`) pour connaître le prix ; repli sur le metadata
 * (ancien flux / tests signés) si la session est injoignable.
 *
 * Module serveur uniquement (aucun secret exposé au navigateur).
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { applySubscriptionEvent, type BillingEventType } from './events';
import { isPlanId } from './plans.config';
import { billingPeriodFromPrice, stripeGet, planIdForPrice } from './stripe';
import type { BillingPeriod, PlanId, SubscriptionStatus } from './types';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, any> };
}

export interface WebhookHandled {
  applied?: boolean;
  duplicate?: boolean;
  ignored?: string;
}

/** Événements Stripe effectivement pris en charge (documenté + testé). */
export const SUPPORTED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
] as const;

/**
 * Statut d'abonnement Stripe (API actuelle) → statut domaine COMAXE.
 * Statut non mappé = événement accusé réception sans effet (jamais d'erreur
 * blocante : Stripe renvoie sinon indéfiniment).
 */
const STATUS_FROM_STRIPE: Record<string, SubscriptionStatus> = {
  active: 'active',
  trialing: 'active',
  incomplete: 'pending',
  past_due: 'past_due',
  unpaid: 'unpaid',
  paused: 'unpaid',
  canceled: 'canceled',
  incomplete_expired: 'expired',
};

/* ── Helpers ───────────────────────────────────────────────────────── */

/** Secondes UNIX → ISO (null si absent/invalid). */
const unixIso = (v: unknown): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null;

/** Price ID depuis un objet Stripe (chaîne `price_…` ou objet `{id}`). */
const priceIdOf = (v: unknown): string | null => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') {
    return (v as { id: string }).id;
  }
  return null;
};

/**
 * Fin de période d'un abonnement Stripe → ISO.
 * La version d'API actuelle porte les dates sur l'ITEM
 * (`items.data[0].current_period_end`) ; l'ancienne en haut d'objet :
 * on lit les deux pour rester compatible quel que soit l'événement.
 */
function periodEndOf(obj: Record<string, any> | null | undefined): string | null {
  return unixIso(obj?.current_period_end ?? obj?.items?.data?.[0]?.current_period_end ?? null);
}

/**
 * Price ID porté par une ligne de facture : l'API actuelle le place dans
 * `pricing.price_details.price`, l'ancienne dans `price`.
 */
function invoiceLinePriceId(obj: Record<string, any> | undefined): string | null {
  const line = obj?.lines?.data?.[0];
  return priceIdOf(line?.price) ?? priceIdOf(line?.pricing?.price_details?.price);
}

/**
 * Plan d'un objet Stripe : Price ID → plan (env), puis metadata serveur.
 * null = non résolu (applySubscriptionEvent applique alors sa règle :
 * demande en cours, sinon plan actif, sinon gratuit).
 */
function planFromObject(obj: Record<string, any> | undefined): PlanId | null {
  const price =
    priceIdOf(obj?.items?.data?.[0]?.price) ?? invoiceLinePriceId(obj);
  const byPrice = planIdForPrice(price);
  if (byPrice) return byPrice;
  return isPlanId(obj?.metadata?.plan_id) ? obj.metadata.plan_id : null;
}

/** Ligne d'abonnement locale par identifiants Stripe (subscription puis customer). */
async function findRowByStripe(subId?: string | null, customerId?: string | null) {
  if (subId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subId)
      .maybeSingle();
    if (data) return data;
  }
  if (customerId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Utilisateur porteur d'un objet abonnement Stripe (metadata serveur, sinon ligne). */
async function findUserIdForSubscription(
  obj: Record<string, any> | undefined
): Promise<string | null> {
  const meta = obj?.metadata?.user_id;
  if (typeof meta === 'string' && meta) return meta;
  const row = await findRowByStripe(
    typeof obj?.id === 'string' ? obj.id : null,
    typeof obj?.customer === 'string' ? obj.customer : null
  );
  return row?.user_id ?? null;
}

/* ── Handlers par famille ──────────────────────────────────────────── */

/** Checkout : confirmation de paiement (réel ou asynchrone). */
async function handleCheckoutSession(
  eventId: string,
  event: StripeEvent,
  obj: Record<string, any> | undefined
): Promise<WebhookHandled> {
  const userId = obj?.client_reference_id || obj?.metadata?.user_id;
  if (!userId) return { ignored: 'sans utilisateur (client_reference_id)' };

  // Plan + période : d'abord le metadata serveur (ancien flux / tests
  // signés — aucun appel réseau). Un Payment Link ne portant aucun
  // metadata dynamique, on RELIT alors la session Checkout chez Stripe
  // (line_items étendu → Price) pour déduire plan ET période DU PRIX
  // PAYÉ. Échec de lecture → repli metadata, sinon null.
  let planId: PlanId | null = isPlanId(obj?.metadata?.plan_id) ? obj.metadata.plan_id : null;
  let billingPeriod: BillingPeriod | null =
    obj?.metadata?.interval === 'month'
      ? 'monthly'
      : obj?.metadata?.interval === 'year'
        ? 'yearly'
        : null;
  let stripePriceId: string | null = null;

  // Abonnement créé par la session : il porte la fin de période RÉELLE
  // (≈ 30 j pour un mensuel, ≈ 1 an pour un annuel). Sans cette lecture,
  // events.ts appliquerait son repli par défaut et un abonnement annuel
  // s'afficherait comme se terminant dans un mois.
  type StripeSubLite = {
    current_period_end?: number | null;
    items?: { data?: Array<{ price?: { id?: string } | string | null }> };
  };
  const subId = typeof obj?.subscription === 'string' ? obj.subscription : null;
  let subObj: StripeSubLite | null = null;
  if (subId) {
    try {
      subObj = await stripeGet<StripeSubLite>(
        `/subscriptions/${encodeURIComponent(subId)}`
      );
    } catch {
      // Repli propre : fin de période par défaut (événement suivant corrige).
    }
  }

  if (planId === null) {
    const sessionId = typeof obj?.id === 'string' ? obj.id : null;
    if (sessionId) {
      try {
        const session = await stripeGet<{ line_items?: { data?: Array<{ price?: { id?: string } | string | null }> } }>(
          `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price`
        );
        stripePriceId = priceIdOf(session?.line_items?.data?.[0]?.price);
        planId = planIdForPrice(stripePriceId);
        billingPeriod = billingPeriodFromPrice(stripePriceId);
      } catch {
        // Repli 1 : metadata ci-dessus déjà lu. Repli 2 : le Price porté
        // par l'abonnement lui-même (session injoignable).
        const priceFromSub = priceIdOf(subObj?.items?.data?.[0]?.price);
        if (priceFromSub) {
          stripePriceId = priceFromSub;
          planId = planIdForPrice(priceFromSub);
          billingPeriod = billingPeriodFromPrice(priceFromSub);
        }
      }
    }
  }

  const res = await applySubscriptionEvent({
    eventId,
    userId,
    type: 'checkout.completed',
    status: 'active',
    planId,
    billingPeriod: billingPeriod ?? undefined,
    // Fin de période réelle de l'abonnement Stripe (null → repli géré events.ts)
    currentPeriodEnd: periodEndOf(subObj),
    stripeSubscriptionId: typeof obj?.subscription === 'string' ? obj.subscription : null,
    stripeCustomerId: typeof obj?.customer === 'string' ? obj.customer : null,
    stripePriceId,
    payload: {
      stripe: event.type,
      checkout_session_id: typeof obj?.id === 'string' ? obj.id : null,
    },
  });
  return { applied: res.applied, duplicate: res.duplicate };
}

/** Abonnement : création / modification / suppression (statut = vérité Stripe). */
async function handleSubscriptionChange(
  eventId: string,
  event: StripeEvent,
  obj: Record<string, any> | undefined
): Promise<WebhookHandled> {
  const userId = await findUserIdForSubscription(obj);
  if (!userId) return { ignored: 'utilisateur inconnu pour cet abonnement' };

  const stripeStatus = typeof obj?.status === 'string' ? obj.status : '';
  const status = STATUS_FROM_STRIPE[stripeStatus];
  if (!status) return { ignored: `statut Stripe non mappé : ${stripeStatus || 'absent'}` };

  const terminal = status === 'canceled' || status === 'expired' || status === 'unpaid';
  const domainType: BillingEventType = terminal
    ? status === 'canceled'
      ? 'subscription.canceled'
      : status === 'expired'
        ? 'subscription.expired'
        : 'subscription.unpaid'
    : 'subscription.updated';

  const res = await applySubscriptionEvent({
    eventId,
    userId,
    type: domainType,
    status,
    // Le plan n'est accordé QUE sur statut actif (paiement confirmé).
    planId: status === 'active' ? planFromObject(obj) : null,
    currentPeriodEnd:
      status === 'active'
        ? periodEndOf(obj)
        : status === 'canceled'
          ? unixIso(obj?.cancel_at) ??
            unixIso(obj?.ended_at) ??
            periodEndOf(obj)
          : null,
    stripeSubscriptionId: typeof obj?.id === 'string' ? obj.id : null,
    stripeCustomerId: typeof obj?.customer === 'string' ? obj.customer : null,
    stripePriceId: priceIdOf(obj?.items?.data?.[0]?.price),
    billingPeriod:
      billingPeriodFromPrice(priceIdOf(obj?.items?.data?.[0]?.price)) ?? undefined,
    payload: { stripe: event.type, stripe_status: stripeStatus },
  });
  return { applied: res.applied, duplicate: res.duplicate };
}

/** Facturation : payé / échoué / action requise du client. */
async function handleInvoice(
  eventId: string,
  event: StripeEvent,
  obj: Record<string, any> | undefined
): Promise<WebhookHandled> {
  const row = await findRowByStripe(
    typeof obj?.subscription === 'string' ? obj.subscription : null,
    typeof obj?.customer === 'string' ? obj.customer : null
  );
  if (!row) return { ignored: 'abonnement Stripe inconnu' };

  const paid = event.type === 'invoice.paid';
  const actionRequired = event.type === 'invoice.payment_action_required';
  const domainType: BillingEventType = paid
    ? 'invoice.paid'
    : actionRequired
      ? 'invoice.payment_action_required'
      : 'invoice.payment_failed';

  // Fin de période : la ligne de facture porte la PÉRIODE RÉELLE
  // (`lines[0].period.end` ≈ fin de cycle) — `invoice.period_end` de
  // l'API actuelle vaut la date d'émission, jamais utilisée en priorité.
  const linePeriodEnd = unixIso(obj?.lines?.data?.[0]?.period?.end);
  const linePriceId = invoiceLinePriceId(obj);

  const res = await applySubscriptionEvent({
    eventId,
    userId: row.user_id,
    type: domainType,
    // Échec / action requise : grâce (plan conservé), aucun plan accordé.
    status: paid ? 'active' : 'past_due',
    planId: paid
      ? planFromObject(obj) ??
        (isPlanId(row.requested_plan_id)
          ? row.requested_plan_id
          : isPlanId(row.plan_id)
            ? row.plan_id
            : null)
      : null,
    currentPeriodEnd: paid ? linePeriodEnd ?? unixIso(obj?.period_end) : null,
    stripePriceId: linePriceId,
    // Période : uniquement si facture payée ET Price connu (sinon on
    // conserve la période courante — renouvellement sans Price).
    billingPeriod:
      paid ? billingPeriodFromPrice(linePriceId) ?? undefined : undefined,
    payload: { stripe: event.type },
  });
  return { applied: res.applied, duplicate: res.duplicate };
}

/* ── Dispatcher ────────────────────────────────────────────────────── */

/**
 * Applique un événement Stripe signé. Idempotent : l'`event.id` Stripe
 * sert de clé d'idempotence (rejeu = duplicate, aucun effet).
 * Les types non métier sont accusés réception sans effet (200).
 */
export async function handleStripeEvent(event: StripeEvent): Promise<WebhookHandled> {
  const obj = event.data?.object;
  const eventId = typeof event.id === 'string' && event.id ? event.id : null;
  if (!eventId || !event.type) return { ignored: 'événement incomplet' };

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return handleCheckoutSession(eventId, event, obj);

    case 'checkout.session.async_payment_failed': {
      const row = await findRowByStripe(
        typeof obj?.subscription === 'string' ? obj.subscription : null,
        typeof obj?.customer === 'string' ? obj.customer : null
      );
      if (!row) return { ignored: 'abonnement Stripe inconnu' };
      const res = await applySubscriptionEvent({
        eventId,
        userId: row.user_id,
        type: 'invoice.payment_failed',
        status: 'past_due',
        planId: null,
        payload: { stripe: event.type },
      });
      return { applied: res.applied, duplicate: res.duplicate };
    }

    case 'checkout.session.expired':
      // Checkout expiré : aucun abonnement Stripe créé, aucun effet.
      // La demande éventuelle reste en attente (l'utilisateur peut réessayer).
      return { ignored: 'checkout expiré (aucun effet)' };

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return handleSubscriptionChange(eventId, event, obj);

    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.payment_action_required':
      return handleInvoice(eventId, event, obj);

    default:
      // Types non métier (ex : événements de compte) : accusé réception sans effet.
      return { ignored: event.type };
  }
}
