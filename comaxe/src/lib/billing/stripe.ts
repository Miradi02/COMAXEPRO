/**
 * COMAXE — Configuration Stripe côté SERVEUR uniquement.
 *
 * Aucune clé ni identifiant Price en dur : tout vient de l'environnement
 * (.env, voir .env.example). Sans configuration, l'application fonctionne
 * intégralement en SIMULATEUR (les routes réelles répondent « non
 * configuré » au lieu de planter).
 */

import type { BillingInterval } from './types';

// Ce module n'est jamais importé par un composant client.
if (typeof window !== 'undefined') {
  throw new Error('[billing] src/lib/billing/stripe.ts est réservé au serveur');
}

export type PaidPlanId = 'pro' | 'max';

export interface StripeConfig {
  /** Clé publique (navigateur) — null si absente */
  publishableKey: string | null;
  /** Clé secrète (serveur) — null si absente */
  secretKey: string | null;
  /** Secret de signature webhook — null si absent */
  webhookSecret: string | null;
  /**
   * Price IDs des offres payantes PAR INTERVALLE (mensuel + annuel) —
   * null = non configurée. Un Price Stripe porte déjà son intervalle :
   * on ne choisit que le bon identifiant.
   */
  priceIds: Record<PaidPlanId, Record<BillingInterval, string | null>>;
}

const nonEmpty = (v: string | undefined): string | (null) => (v && v.trim() ? v.trim() : null);

/** Configuration actuelle (lecture vivante de l'environnement). */
export function getStripeConfig(): StripeConfig {
  return {
    publishableKey: nonEmpty(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    secretKey: nonEmpty(process.env.STRIPE_SECRET_KEY),
    webhookSecret: nonEmpty(process.env.STRIPE_WEBHOOK_SECRET),
    priceIds: {
      pro: {
        month: nonEmpty(process.env.STRIPE_PRO_PRICE_ID_MONTHLY),
        year: nonEmpty(process.env.STRIPE_PRO_PRICE_ID_ANNUAL),
      },
      max: {
        month: nonEmpty(process.env.STRIPE_MAX_PRICE_ID_MONTHLY),
        year: nonEmpty(process.env.STRIPE_MAX_PRICE_ID_ANNUAL),
      },
    },
  };
}

/** Price ID d'une offre payante pour un intervalle (défaut : mensuel). */
export function priceIdForPlan(
  plan: PaidPlanId,
  interval: BillingInterval = 'month'
): string | null {
  return getStripeConfig().priceIds[plan][interval] ?? null;
}

/**
 * Résolution INVERSE : Price ID Stripe → offre COMAXE.
 * Utilisé par le webhook pour accorder un plan sans prix en dur : seules
 * les variables d'environnement (STRIPE_*_PRICE_ID_MONTHLY/ANNUAL) font
 * foi — en LIVE, on remplace leurs valeurs, jamais le code.
 * @returns l'offre correspondante, ou null si le Price ID est inconnu
 */
export function planIdForPrice(priceId: string | null | undefined): PaidPlanId | null {
  if (!priceId) return null;
  const ids = getStripeConfig().priceIds;
  for (const plan of Object.keys(ids) as PaidPlanId[]) {
    if (ids[plan].month === priceId || ids[plan].year === priceId) return plan;
  }
  return null;
}

/** Paiement réel possible pour cette offre + cet intervalle ? */
export function isCheckoutConfigured(
  plan: PaidPlanId,
  interval: BillingInterval = 'month'
): boolean {
  const cfg = getStripeConfig();
  return Boolean(cfg.secretKey && cfg.priceIds[plan][interval]);
}

/**
 * Appel REST Stripe (sans SDK) — formulaire encodé comme exigé par l'API.
 * Lève une erreur lisible si Stripe répond en échec.
 */
export async function stripeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const secret = getStripeConfig().secretKey;
  if (!secret) throw new Error('Stripe non configuré (STRIPE_SECRET_KEY absent).');

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    url?: string;
  };
  if (!res.ok) throw new Error(json.error?.message || `Stripe a répondu ${res.status}.`);
  return json as T;
}
