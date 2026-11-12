/**
 * COMAXE — Messages CENTRALISÉS d'abonnement (limites atteintes,
 * fonctionnalités verrouillées).
 *
 * Dynamiques : plan, ressource, limite et utilisation réelle sont injectés.
 * Aucune page ne doit fabriquer son propre message « limite atteinte ».
 *
 * Format retourné : couple { fr, en } compatible avec `t(msg.fr, msg.en)`
 * du système i18n de l'application.
 */

import type { FeatureKey, PlanId, ResourceKey } from './types';
import { getPlan } from './plans.config';
import { nextPlanId } from './entitlements';

export interface LocalizedMessage {
  fr: string;
  en: string;
}

/** Unités lisibles par ressource */
const RESOURCE_UNITS: Record<ResourceKey, LocalizedMessage> = {
  sale: { fr: 'ventes par mois', en: 'sales per month' },
  product: { fr: 'produits', en: 'products' },
  customer: { fr: 'clients', en: 'customers' },
  debt: { fr: 'dettes actives', en: 'active debts' },
};

/** Libellés des fonctionnalités verrouillables */
const FEATURE_LABELS: Record<FeatureKey, LocalizedMessage> = {
  goals: { fr: 'Objectifs', en: 'Goals' },
  analytics: { fr: 'Analytique', en: 'Analytics' },
  ads: { fr: 'Publicité', en: 'Ads' },
};

const formatNum = (n: number, locale: 'fr' | 'en'): string =>
  n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');

export interface LimitMessageParams {
  planId: PlanId;
  resource: ResourceKey;
  used: number;
  limit: number;
}

/**
 * « Vous avez atteint la limite de 10 produits de votre offre Essential.
 *   Passez à Pro pour continue. »
 * Dynamique : plan + ressource + limite ; mention de l'offre supérieure
 * lorsqu'elle existe (aucune au-dessus de Max pour l'instant).
 */
export function limitReachedMessage(p: LimitMessageParams): LocalizedMessage {
  const plan = getPlan(p.planId);
  const unit = RESOURCE_UNITS[p.resource];
  const next = nextPlanId(p.planId);
  const frLimit = formatNum(p.limit, 'fr');
  const enLimit = formatNum(p.limit, 'en');
  return {
    fr: next
      ? `Vous avez atteint la limite de ${frLimit} ${unit.fr} de votre offre ${plan.name}. Passez à ${getPlan(next).name} pour continuer.`
      : `Vous avez atteint la limite de ${frLimit} ${unit.fr} de votre offre ${plan.name}.`,
    en: next
      ? `You have reached the ${enLimit} ${unit.en} limit on your ${plan.name} plan. Upgrade to ${getPlan(next).name} to continue.`
      : `You have reached the ${enLimit} ${unit.en} limit on your ${plan.name} plan.`,
  };
}

/**
 * « La fonctionnalité « Analytique » est verrouillée avec votre offre
 *   Essential. Passez à Pro pour l’activer. »
 */
export function featureLockedMessage(
  planId: PlanId,
  feature: FeatureKey
): LocalizedMessage {
  const plan = getPlan(planId);
  const label = FEATURE_LABELS[feature];
  const next = nextPlanId(planId);
  return {
    fr: next
      ? `La fonctionnalité « ${label.fr} » est verrouillée avec votre offre ${plan.name}. Passez à ${getPlan(next).name} pour l’activer.`
      : `La fonctionnalité « ${label.fr} » est verrouillée avec votre offre ${plan.name}.`,
    en: next
      ? `The “${label.en}” feature is locked on your ${plan.name} plan. Upgrade to ${getPlan(next).name} to unlock it.`
      : `The “${label.en}” feature is locked on your ${plan.name} plan.`,
  };
}

/** Sélection de la locale à partir du couple { fr, en } */
export function formatMessage(m: LocalizedMessage, locale: 'fr' | 'en'): string {
  return locale === 'en' ? m.en : m.fr;
}
