/**
 * COMAXE — Configuration des offres d'abonnement.
 *
 * SOURCE UNIQUE DES RÈGLES MÉTIER (limites, fonctionnalités, prix, Stripe).
 * Les pages et composants interrogent le moteur (entitlements), jamais ce
 * fichier directement avec des conditions « plan === … ».
 *
 * Ajouter un futur plan (Ultime, Business Max, Business Ultime) :
 *   1. ajouter son id dans `PlanId` (src/lib/billing/types.ts) ;
 *   2. ajouter son entrée ci-dessous (prix, limites, features, Price IDs) ;
 *   3. le reste de l'application suit automatiquement.
 *
 * Cohérence avec le marketing (src/components/marketing/plans.ts — textes
 * des cartes) : contrôlée par `node scripts/billing-verify.mjs`.
 */

import type { PlanDefinition, PlanId } from './types';

export const PLANS_CONFIG: Record<PlanId, PlanDefinition> = {
  /* ── ESSENTIAL — 0 $ ── */
  essential: {
    id: 'essential',
    name: 'Essential',
    priceMonthly: 0,
    priceAnnual: 0,
    limits: {
      salesPerMonth: 15,
      products: 10,
      customers: 15,
      activeDebts: 5,
      expensesHistoryDays: 3,
      profitsHistoryDays: 3,
    },
    features: {
      goals: false,
      analytics: false,
      ads: true,
    },
    stripe: {
      priceIdEnvMonthly: null, // offre gratuite : pas de Price ID Stripe
      priceIdEnvAnnual: null,
    },
  },

  /* ── PRO — 5 $/mois ── */
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 5,
    priceAnnual: 49,
    limits: {
      salesPerMonth: 200,
      products: 70,
      customers: 200,
      activeDebts: 50,
      expensesHistoryDays: null, // illimité
      profitsHistoryDays: null, // illimité
    },
    features: {
      goals: true,
      analytics: true,
      ads: false,
    },
    stripe: {
      priceIdEnvMonthly: 'STRIPE_PRO_PRICE_ID_MONTHLY',
      priceIdEnvAnnual: 'STRIPE_PRO_PRICE_ID_ANNUAL',
    },
  },

  /* ── MAX — 14 $/mois · 149 $/an ── */
  max: {
    id: 'max',
    name: 'Max',
    priceMonthly: 14,
    priceAnnual: 149,
    limits: {
      salesPerMonth: 1000,
      products: 600,
      customers: 1000,
      activeDebts: 400,
      expensesHistoryDays: null, // illimité
      profitsHistoryDays: null, // illimité
    },
    features: {
      goals: true,
      analytics: true,
      ads: false,
    },
    stripe: {
      priceIdEnvMonthly: 'STRIPE_MAX_PRICE_ID_MONTHLY',
      priceIdEnvAnnual: 'STRIPE_MAX_PRICE_ID_ANNUAL',
    },
  },
};

/** Offre appliquée par défaut (nouveaux comptes, état initial) */
export const DEFAULT_PLAN_ID: PlanId = 'essential';

/** Liste des offres implémentées (ordre d'affichage) */
export const PLAN_IDS: PlanId[] = ['essential', 'pro', 'max'];

/** Accès à la définition d'une offre */
export const getPlan = (id: PlanId): PlanDefinition => PLANS_CONFIG[id];

/** Garde-fou : valeur inconnue → ce n'est pas un plan du moteur */
export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS_CONFIG, value);

/** Offres payables via Stripe (Essential = gratuit, jamais de checkout) */
export const PAYABLE_PLAN_IDS: PlanId[] = ['pro', 'max'];

/** Garde-fou checkout : la valeur est-elle une offre PAYABLE ? */
export const isPayablePlan = (value: unknown): value is PlanId =>
  isPlanId(value) && (PAYABLE_PLAN_IDS as string[]).includes(value);
