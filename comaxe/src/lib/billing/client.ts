/**
 * COMAXE — Client HTTP des routes API billing (côté navigateur).
 *
 * SOURCE UNIQUE des appels `/api/billing/*` : les boutons des offres, la
 * page Abonnement et le simulateur passent par CE module — jamais de
 * `fetch` dispersé dans les composants.
 *
 * Règles métier respectées ici :
 *   • une demande de plan (requestPlan) n'écrit JAMAIS `plan_id` : un clic
 *     n'est jamais une preuve de paiement ;
 *   • checkout répond 503 { configured:false } tant que Stripe n'est pas
 *     configuré → l'appelant bascule sur le simulateur (même routeur
 *     d'événements que le vrai webhook) ;
 *   • les erreurs 401/4xx/5xx sont typées pour que l'UI affiche un message
 *     clair sans jamais afficher le texte brut du serveur.
 */

import type { BillingInterval, PlanId, Subscription } from './types';

/* ── Erreurs typées ───────────────────────────────────────────────── */

export class BillingApiError extends Error {
  readonly status: number;
  /** 503 + configured:false = Stripe non configuré (phase simulateur) */
  readonly configured: boolean;
  /** Types d'événement acceptés par le simulateur (erreur 400) */
  readonly eventTypes?: string[];

  constructor(status: number, message: string, opts?: { configured?: boolean; eventTypes?: string[] }) {
    super(message);
    this.name = 'BillingApiError';
    this.status = status;
    this.configured = opts?.configured ?? false;
    this.eventTypes = opts?.eventTypes;
  }
}

/* ── Types de réponse (miroirs des routes API) ────────────────────── */

export interface SubscriptionResponse {
  subscription: Subscription | null;
  /** Plan RÉELLEMENT actif (résolu) — jamais le plan demandé */
  planId: PlanId;
}

export interface PlanRequestResponse {
  success: true;
  requestedPlanId: PlanId;
  planId: PlanId;
  subscription: Subscription | null;
}

export interface CheckoutResponse {
  success: true;
  /** URL de paiement Stripe (mode test) */
  url: string;
  planId: PlanId;
}

export interface SimulateResponse {
  success: true;
  applied: boolean;
  /** Événement déjà traité auparavant (idempotence) */
  duplicate: boolean;
  subscription: Subscription | null;
}

/* ── Appel réseau commun ──────────────────────────────────────────── */

async function billingFetch<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/billing${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new BillingApiError(0, 'Connexion impossible au serveur.');
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new BillingApiError(res.status, String(json.error ?? 'Erreur du service abonnement.'), {
      configured: json.configured === false,
      eventTypes: Array.isArray(json.types) ? (json.types as string[]) : undefined,
    });
  }
  return json as T;
}

/* ── Opérations ───────────────────────────────────────────────────── */

/** Abonnement réel de l'utilisateur connecté (plan résolu). */
export function getSubscription(): Promise<SubscriptionResponse> {
  return billingFetch<SubscriptionResponse>('/subscription');
}

/**
 * Enregistrer une DEMANDE de plan (clic « S'abonner »).
 * N'active JAMAIS le plan : `requestedPlanId` seulement, statut pending.
 */
export function requestPlan(plan: PlanId): Promise<PlanRequestResponse> {
  return billingFetch<PlanRequestResponse>('/subscription', {
    method: 'POST',
    body: { plan },
  });
}

/**
 * Créer la session de paiement Stripe de l'offre demandée, sur
 * l'intervalle choisi (mensuel par défaut, annuel).
 * @throws BillingApiError(503, configured:true) si Stripe n'est pas
 * configuré → l'appelant utilise le simulateur.
 */
export function startCheckout(
  plan: PlanId,
  interval: BillingInterval = 'month'
): Promise<CheckoutResponse> {
  return billingFetch<CheckoutResponse>('/checkout', {
    method: 'POST',
    body: { plan, interval },
  });
}

/**
 * Simuler un événement d'abonnement (même routeur métier que le webhook
 * Stripe réel). Réservé à l'utilisateur connecté, sur SON abonnement.
 */
export function simulateEvent(input: {
  type: string;
  planId?: PlanId;
  eventId?: string;
  interval?: BillingInterval;
}): Promise<SimulateResponse> {
  return billingFetch<SimulateResponse>('/simulator', { method: 'POST', body: input });
}
