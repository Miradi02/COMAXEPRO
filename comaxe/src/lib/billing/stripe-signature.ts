/**
 * COMAXE — Vérification de signature Stripe (utilitaire serveur).
 * Séparé de la route webhook pour éviter l'erreur Next.js sur les exports
 * non standard (GET/POST/DELETE/HEAD/OPTIONS/PATCH/PUT uniquement).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie l'en-tête `Stripe-Signature` : `t=<ts>,v1=<hex>,…`.
 * Payload signé = `${t}.${rawBody}` en HMAC SHA-256 avec le secret.
 *
 * @param rawBody Corps brut de la requête (string)
 * @param header  Valeur de l'en-tête `Stripe-Signature`
 * @param secret  Secret de signature (whsec_…) depuis STRIPE_WEBHOOK_SECRET
 * @param toleranceSec Fenêtre d'acceptation (défaut 300 s = 5 min)
 * @param nowSec  Timestamp actuel (défaut `Math.floor(Date.now()/1000)`)
 * @returns true si la signature est valide et dans la fenêtre temporelle
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000)
): boolean {
  const entries = header.split(',').map((pair) => {
    const i = pair.indexOf('=');
    return [pair.slice(0, i), pair.slice(i + 1)] as const;
  });
  const t = Number(entries.find(([k]) => k === 't')?.[1]);
  const v1s = entries.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(t) || v1s.length === 0) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  return v1s.some((v1) => {
    const b = Buffer.from(v1, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}