import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCurrency } from './currencies';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant commercial dans la devise du commerce.
 * - groupement de milliers à la française : « 1 234 »
 * - suffixe = symbole de la devise (code ISO 4217 résolu, ancien format 'USD ($)' accepté)
 * - repli « $ » si la devise est inconnue (compatibilité historique)
 *
 * Ex : formatMoney(1500, 'XOF') → « 1 500 FCFA »
 *      formatMoney(2500, 'USD')  → « 2 500 $ »
 */
export function formatMoney(amount: number, currency?: string | null): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount);
  const cur = getCurrency(currency);
  return `${formatted} ${cur ? cur.symbol : '$'}`;
}
