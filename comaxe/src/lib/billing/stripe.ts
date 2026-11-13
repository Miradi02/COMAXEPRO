/**
 * COMAXE — Configuration Stripe côté SERVEUR uniquement.
 *
 * Clés et identifiants Price : tout vient de l'environnement (.env, voir
 * .env.example). Les 4 Payment Links existants sont définis UNIQUEMENT
 * dans ce fichier (table PAYMENT_LINKS) — jamais dispersés ailleurs.
 * Sans configuration, l'application fonctionne intégralement en
 * SIMULATEUR (les routes réelles répondent « non configuré » au lieu
 * de planter).
 */

import type { BillingInterval, BillingPeriod } from './types';

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
 * Table UNIQUE des 4 Payment Links existants — LE seul endroit où ces
 * URLs sont écrites (jamais dispersées dans les pages ou les routes).
 * Chaque lien Stripe porte déjà son Price : le webhook en déduit le
 * plan et la période (source de vérité), le frontend ne choisit que
 * l'entrée. En LIVE : remplacer ces 4 URLs par leurs équivalents live.
 */
const PAYMENT_LINKS: Record<PaidPlanId, Record<BillingInterval, string>> = {
  pro: {
    month: 'https://buy.stripe.com/test_4gMfZaghmeYCclNf1U7IY01',
    year: 'https://buy.stripe.com/test_5kQcMY8OUg2GgC3cTM7IY03',
  },
  max: {
    month: 'https://buy.stripe.com/test_00weV68OU6s64Tl4ng7IY02',
    year: 'https://buy.stripe.com/test_6oUeV6c162bQ99B2f87IY00',
  },
};

/** Cible de paiement d'une combinaison offre × intervalle. */
export interface PaymentLinkTarget {
  /** URL du Payment Link (Stripe Checkout hébergé) */
  url: string;
  /** Price ID attendu pour cette combinaison (env) — identité du lien */
  priceId: string | null;
}

/**
 * Lien de paiement d'une offre + intervalle (défaut : mensuel).
 * null si le lien n'est pas défini (jamais pour pro/max : table complète).
 * Le Price ID vient de l'environnement — jamais codé en dur.
 */
export function paymentLinkFor(
  plan: PaidPlanId,
  interval: BillingInterval = 'month'
): PaymentLinkTarget | null {
  const url = PAYMENT_LINKS[plan][interval];
  if (!url) return null;
  return { url, priceId: priceIdForPlan(plan, interval) };
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

/**
 * Résolution INVERSE : Price ID Stripe → période de facturation.
 * Le mensuel de l'une des offres → `monthly`, l'annuel → `yearly` ;
 * null = Price inconnu (aucun effet sur `billing_period`).
 * Utilisé par le webhook pour déduire la période DU PRIX PAYÉ.
 */
export function billingPeriodFromPrice(priceId: string | null | undefined): BillingPeriod | null {
  if (!priceId) return null;
  const ids = getStripeConfig().priceIds;
  for (const plan of Object.keys(ids) as PaidPlanId[]) {
    if (ids[plan].month === priceId) return 'monthly';
    if (ids[plan].year === priceId) return 'yearly';
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

/**
 * Appel REST Stripe en GET (lecture seule) — utilisé par le webhook pour
 * relire une session Checkout et en extraire le Price payé
 * (`expand[]=line_items.data.price`). Mêmes garanties que stripeFetch :
 * clé secrète obligatoire, erreur lisible en échec.
 */
export async function stripeGet<T>(path: string): Promise<T> {
  const secret = getStripeConfig().secretKey;
  if (!secret) throw new Error('Stripe non configuré (STRIPE_SECRET_KEY absent).');

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || `Stripe a répondu ${res.status}.`);
  return json as T;
}
