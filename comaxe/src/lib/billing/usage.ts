/**
 * COMAXE — Calcul d'utilisation des ressources (compteurs, restes, %).
 *
 * Fonctions PURES : aucune accès base ni UI — testables par billing-verify.
 * Les pages n'appellent pas ces fonctions directement avec leurs propres
 * règles : elles passent par le moteur d'entitlements.
 *
 * Comptage mensuel des ventes : basé sur l'horodatage d'enregistrement
 * (`created_at_ts`, fiable) et NON sur la colonne `date` qui stocke une
 * chaîne d'affichage locale (« Aujourd'hui, 14:32 »…).
 */

import type { PlanDefinition, PlanId, ResourceKey } from './types';
import { getPlan } from './plans.config';

/* ── Compteurs bruts ──────────────────────────────────────────────── */

export interface UsageCounts {
  /** Ventes enregistrées pendant le mois civil en cours */
  salesCurrentMonth: number;
  /** Produits au total */
  products: number;
  /** Clients au total */
  customers: number;
  /** Dettes encore ouvertes (solde restant > 0) */
  activeDebts: number;
}

/** État d'une ressource pour un plan donné */
export interface ResourceUsage {
  resource: ResourceKey;
  /** Limite absolue du plan */
  limit: number;
  /** Utilisation actuelle */
  used: number;
  /** Ce qu'il reste (0 si atteint) */
  remaining: number;
  /** Pourcentage utilisé (0–100+, arrondi) */
  percent: number;
  /** Prochaine création autorisée ? */
  canCreate: boolean;
}

const COUNT_OF: Record<ResourceKey, keyof UsageCounts> = {
  sale: 'salesCurrentMonth',
  product: 'products',
  customer: 'customers',
  debt: 'activeDebts',
};

const LIMIT_OF: Record<ResourceKey, 'salesPerMonth' | 'products' | 'customers' | 'activeDebts'> = {
  sale: 'salesPerMonth',
  product: 'products',
  customer: 'customers',
  debt: 'activeDebts',
};

export const ALL_RESOURCES: ResourceKey[] = ['sale', 'product', 'customer', 'debt'];

/* ── Utilitaires de comptage ──────────────────────────────────────── */

/** Le timestamp ISO tombe-t-il dans le mois civil de `now` ? */
export function isSameMonth(isoTs: string | undefined | null, now: Date = new Date()): boolean {
  if (!isoTs) return false;
  const t = Date.parse(isoTs);
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Nombre de ventes créées pendant le mois en cours */
export function countSalesThisMonth(
  sales: { createdAt?: string }[],
  now: Date = new Date()
): number {
  return sales.filter((s) => isSameMonth(s.createdAt, now)).length;
}

/** Dettes actives = solde restant > 0 */
export function countActiveDebts(debts: { remainingAmount: number }[]): number {
  return debts.filter((d) => Number(d.remainingAmount) > 0).length;
}

/** Construit les compteurs à partir des listes chargées par l'application */
export function buildUsageCounts(
  input: {
    sales?: { createdAt?: string }[];
    products?: unknown[];
    customers?: unknown[];
    debts?: { remainingAmount: number }[];
  },
  now: Date = new Date()
): UsageCounts {
  return {
    salesCurrentMonth: countSalesThisMonth(input.sales ?? [], now),
    products: (input.products ?? []).length,
    customers: (input.customers ?? []).length,
    activeDebts: countActiveDebts(input.debts ?? []),
  };
}

/* ── État d'utilisation ───────────────────────────────────────────── */

/** État (limite / utilisé / reste / %) d'une ressource pour un plan */
export function getResourceUsage(
  plan: PlanId | PlanDefinition,
  resource: ResourceKey,
  counts: UsageCounts
): ResourceUsage {
  const def = typeof plan === 'string' ? getPlan(plan) : plan;
  const used = Math.max(0, counts[COUNT_OF[resource]] ?? 0);
  const rawLimit = def.limits[LIMIT_OF[resource]];
  const limit = typeof rawLimit === 'number' ? rawLimit : 0;
  const remaining = Math.max(0, limit - used);
  const percent = limit > 0 ? Math.round((used / limit) * 100) : used > 0 ? 100 : 0;
  return { resource, limit, used, remaining, percent, canCreate: used < limit };
}

/** État de toutes les ressources pour un plan (affichage consommation) */
export function getAllUsage(
  plan: PlanId | PlanDefinition,
  counts: UsageCounts
): Record<ResourceKey, ResourceUsage> {
  const out = {} as Record<ResourceKey, ResourceUsage>;
  for (const r of ALL_RESOURCES) out[r] = getResourceUsage(plan, r, counts);
  return out;
}
