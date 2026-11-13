/**
 * COMAXE — Moteur d'abonnement (billing) : types centraux.
 *
 * Source unique des règles d'accès / limites. Les pages ne doivent JAMAIS
 * contenir de règles du type `if plan === 'essential'` : elles interrogent
 * le moteur (entitlements) qui s'appuie sur ces types et sur plans.config.ts.
 *
 * Évolutivité : ajouter un futur plan (Ultime, Business Max, Business Ultime)
 * = ajouter son id ici (union PlanId) + son entrée dans plans.config.ts.
 * Aucune page à modifier.
 */

/* ── Identifiants ─────────────────────────────────────────────────── */

/**
 * Ids des offres IMPLÉMENTÉES dans le moteur.
 * Phase 1 : Essential, Pro, Max. Les futurs plans s'ajoutent ici.
 */
export type PlanId = 'essential' | 'pro' | 'max';

/**
 * Intervalle de facturation d'un Price Stripe.
 * Chaque offre payante a un Price mensuel ET un Price annuel.
 */
export type BillingInterval = 'month' | 'year';

/**
 * Période d'un abonnement PAYANT telle qu'enregistrée en base
 * (`subscriptions.billing_period`), dérivée du Price ID Stripe par le
 * webhook. `null` = offre gratuite (Essential) ou période inconnue.
 * Valeurs en base : 'monthly' | 'yearly'.
 */
export type BillingPeriod = 'monthly' | 'yearly';

/** Ressources comptées et limitées par plan */
export type ResourceKey = 'sale' | 'product' | 'customer' | 'debt';

/** Fonctionnalités activables / désactivables selon le plan */
export type FeatureKey = 'goals' | 'analytics' | 'ads';

/* ── Définition d'une offre ───────────────────────────────────────── */

export interface PlanLimits {
  /** Ventes autorisées par mois civil (compteur remis à zéro chaque mois) */
  salesPerMonth: number;
  /** Produits au total */
  products: number;
  /** Clients au total */
  customers: number;
  /** Dettes simultanément ouvertes (solde restant > 0) */
  activeDebts: number;
  /** Historique des dépenses en jours ; null = illimité */
  expensesHistoryDays: number | null;
  /** Historique des bénéfices en jours ; null = illimité */
  profitsHistoryDays: number | null;
  /**
   * Limites futures (collaborateurs, générations IA, boutiques…).
   * Une nouvelle limite n'existe que pour les plans qui la déclarent
   * (undefined = non applicable pour ce plan).
   */
  [key: string]: number | null | undefined;
}

/**
 * État des fonctionnalités non numériques.
 * Chaque plan doit déclarer explicitement chaque fonctionnalité (pas de
 * défaut implicite) : c'est ce qui rend l'ajout d'un plan lisible et sûr.
 */
export type PlanFeatures = Record<FeatureKey, boolean>;

export interface PlanStripeConfig {
  /**
   * Noms des VARIABLES D'ENVIRONNEMENT portant les Price IDs Stripe,
   * pour chaque intervalle (mensuel + annuel). null = offre gratuite,
   * sans Price ID. On ne stocke jamais la valeur réelle ici — seulement
   * les noms à lire côté serveur à l'intégration Stripe.
   */
  priceIdEnvMonthly: string | null;
  priceIdEnvAnnual: string | null;
}

export interface PlanDefinition {
  id: PlanId;
  /** Nom d'affichage */
  name: string;
  /** Prix mensuel en USD ; 0 = gratuit */
  priceMonthly: number;
  /** Prix annuel en USD ; 0 = gratuit */
  priceAnnual: number;
  limits: PlanLimits;
  features: PlanFeatures;
  stripe: PlanStripeConfig;
  /**
   * Règles spécifiques extensibles (futurs plans) : IA, multi-boutiques,
   * collaborateurs, permissions… À consommer par le moteur au besoin.
   */
  extra?: Record<string, boolean | number | string>;
}

/* ── Abonnement d'un utilisateur ──────────────────────────────────── */

/**
 * Statuts d'abonnement — conçus pour couvrir les états Stripe classiques
 * tout en restant simples pour la simulation.
 */
export type SubscriptionStatus =
  /** Abonnement en cours, à jour */
  | 'active'
  /** Paiement en retard / échoué (à relancer) */
  | 'past_due'
  /** Impayé confirmé */
  | 'unpaid'
  /** Plan demandé, paiement NON confirmé (plan demandé ≠ plan actif) */
  | 'pending'
  /** Annulé — retour à l'offre gratuite à la fin de période */
  | 'canceled'
  /** Période terminée sans renouvellement */
  | 'expired';

/**
 * État réel de l'abonnement d'un utilisateur.
 *
 * RÈGLE FONDAMENTALE : `requestedPlanId` (ce que l'utilisateur a demandé
 * en cliquant) est DISTINCT de `planId` (ce qui est réellement actif).
 * Un simple clic n'est jamais une preuve de paiement.
 */
export interface Subscription {
  userId: string;
  /** Plan RÉELLEMENT actif */
  planId: PlanId;
  /** Plan DEMANDÉ ; null = aucune demande en cours */
  requestedPlanId: PlanId | null;
  status: SubscriptionStatus;
  /**
   * Période de facturation du plan actif (mensuel/annuel) — renseignée
   * UNIQUEMENT par le serveur à partir du Price ID Stripe confirmé par le
   * webhook. null = offre gratuite ou période non confirmée.
   */
  billingPeriod: BillingPeriod | null;
  /** Début du plan actuel (ISO 8601) */
  startedAt: string;
  /** Début de la période de facturation en cours (ISO 8601) */
  currentPeriodStart: string;
  /** Fin de période (ISO 8601) ; null = illimité (gratuit) */
  currentPeriodEnd: string | null;
  /** Fin programmée après annulation (ISO 8601) ; null = aucune */
  endsAt: string | null;
  /** Identifiants Stripe — renseignés à l'intégration réelle (null sinon) */
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  createdAt: string;
  updatedAt: string;
}
