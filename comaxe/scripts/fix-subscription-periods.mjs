// COMAXE — Tâche 2 : resynchronisation des périodes d'abonnement depuis Stripe.
//
// Bug corrigé côté webhook (fin de période réelle au lieu de +30 j) : les
// lignes ÉCRITES AVANT la correction gardent une fin de période erronée
// (annuel affiché « dans 1 mois »). Ce script, exécuté UNE fois, remet
// `current_period_end` (et `billing_period` s'il manque) à la valeur réelle
// de l'abonnement Stripe.
//
//   • seules les lignes avec un VRAI abonnement Stripe (sub_…) sont touchées ;
//   • les abonnements du simulateur (sub_demo_*, sub_cross*…) ne sont pas
//     des objets Stripe : ils restent tels quels (données de démonstration) ;
//   • aucun plan, aucun statut, aucun prix n'est modifié — dates seulement.
//
// Usage : node scripts/fix-subscription-periods.mjs   (DRY RUN par défaut)
//         node scripts/fix-subscription-periods.mjs --apply
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const env = {};
readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
});

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRICE_PERIOD = {};
for (const [plan, interval] of [
  ['pro', 'month'], ['pro', 'year'], ['max', 'month'], ['max', 'year'],
]) {
  const key = env[`STRIPE_${plan.toUpperCase()}_PRICE_ID_${interval === 'year' ? 'ANNUAL' : 'MONTHLY'}`];
  if (key) PRICE_PERIOD[key] = interval === 'year' ? 'yearly' : 'monthly';
}

const iso = (unix) => (typeof unix === 'number' && Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null);

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json?.error?.message || `HTTP ${res.status}` };
  return { data: json };
}

const { data: rows, error } = await admin
  .from('subscriptions')
  .select('user_id, plan_id, status, billing_period, current_period_end, stripe_subscription_id')
  .neq('plan_id', 'essential');
if (error) { console.error('ERREUR lecture:', error.message); process.exit(1); }

console.log(`Mode: ${APPLY ? 'APPLIQUÉ' : 'DRY RUN (ajouter --apply pour écrire)'} — ${rows.length} ligne(s) non-Essential\n`);

let repaired = 0, unchanged = 0, simulated = 0, failed = 0;
for (const r of rows) {
  const subId = r.stripe_subscription_id;
  const tag = `user=${r.user_id.slice(0, 8)} plan=${r.plan_id} sub=${subId ? subId.slice(0, 14) : '—'}`;

  if (!subId) {
    console.log(`  SANS SUB  ${tag} — aucune donnée Stripe à resynchroniser`);
    simulated++;
    continue;
  }

  const { data: sub, error: err } = await stripeGet(`/subscriptions/${encodeURIComponent(subId)}`);
  if (err) {
    // Objet inexistant chez Stripe = abonnement du simulateur (démo/tests).
    console.log(`  SIMULÉ   ${tag} — absent de Stripe (${err}) — inchangé`);
    simulated++;
    continue;
  }

  const endIso = iso(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end);
  const price = typeof sub.items?.data?.[0]?.price === 'object'
    ? sub.items.data[0].price.id
    : sub.items?.data?.[0]?.price;
  const period = PRICE_PERIOD[price] ?? undefined;

  const patch = {};
  if (endIso && endIso !== r.current_period_end) patch.current_period_end = endIso;
  if (period && r.billing_period !== period) patch.billing_period = period;

  if (Object.keys(patch).length === 0) {
    console.log(`  OK        ${tag} — déjà à jour (${r.current_period_end?.slice(0, 10) ?? '—'} → ${endIso?.slice(0, 10) ?? '—'})`);
    unchanged++;
    continue;
  }

  const from = r.current_period_end?.slice(0, 10) ?? '—';
  const to = endIso?.slice(0, 10) ?? '—';
  const jours = endIso ? Math.round((new Date(endIso) - new Date(r.current_period_end || Date.now())) / 86400000) : 0;
  console.log(`  ${APPLY ? 'CORRIGÉ' : 'À CORRIGER'} ${tag} — ${from} → ${to} (${jours > 0 ? '+' : ''}${jours} j)${patch.billing_period ? ` period=${r.billing_period ?? 'null'}→${patch.billing_period}` : ''}`);

  if (APPLY) {
    const { error: updErr } = await admin
      .from('subscriptions')
      .update(patch)
      .eq('user_id', r.user_id);
    if (updErr) { console.log(`    ÉCHEC écriture: ${updErr.message}`); failed++; continue; }
  }
  repaired++;
}

console.log(`\n==================================================`);
console.log(`  ${APPLY ? 'CORRIGÉ' : 'À corriger'}: ${repaired} | déjà OK: ${unchanged} | simulé/sans sub: ${simulated} | échec: ${failed}`);
console.log(`==================================================`);
process.exitCode = failed ? 1 : 0;
