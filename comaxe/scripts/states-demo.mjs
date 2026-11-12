// COMAXE — Démonstration des 3 ÉTATS d'abonnement (périmètre Essential/Pro/Max).
//
//   État 1 : compte créé sans paiement → Essential + limites appliquées
//   État 2 : clic « Pro » (seul) ≠ droits → puis webhook Stripe SIGNÉ → Pro
//   État 3 : webhook Stripe SIGNÉ avec le vrai Price ID Max → Max
//
// Preuves produites à chaque état :
//   • ligne subscriptions lue en base (plan_id, status, champs Stripe)
//   • plan résolu par l'API /api/billing/subscription (ce que l'UI affiche)
//   • plan actif + limites lus dans la BASE (billing_active_plan / billing_plan_limit)
//   • refus/réel des triggers DB aux frontières (11e produit)
//   • sécurité : UPDATE client impossible, webhook sans/fausse signature → 400
//
// Usage : node scripts/states-demo.mjs   (serveur :3000 requis)
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// .env comaxe d'abord, puis .env racine (repli)
const env = {};
for (const rel of [['.env'], ['..', '.env']]) {
  try {
    readFileSync(join(ROOT, ...rel), 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    });
  } catch { /* absent */ }
}

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const WHSEC = env.STRIPE_WEBHOOK_SECRET;
const MAX_PRICE = env.STRIPE_MAX_PRICE_ID_MONTHLY;
const APP = 'http://localhost:3000';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const RUN = Date.now();
const EMAIL = `states-demo-${RUN}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

let pass = 0; let fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, cookies } = {}) {
  const res = await fetch(APP + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}

/** POST /api/stripe/webhook signé HMAC SHA-256 (même algorithme que Stripe) */
async function postSignedWebhook(payload, { secret = WHSEC, t } = {}) {
  const body = JSON.stringify(payload);
  const ts = t ?? Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` },
    body,
  });
  let json = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}

async function postWebhookRaw(payload, headers = {}) {
  const res = await fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  let json = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}

/** Limites d'un plan lues dans la BASE (miroir serveur de billing.sql) */
async function dbLimits(plan) {
  const out = {};
  for (const res of ['sales', 'products', 'customers', 'debts']) {
    const { data } = await admin.rpc('billing_plan_limit', { p_plan: plan, p_resource: res });
    out[res] = data;
  }
  return out;
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  DÉMONSTRATION — État 1 (Essential) → 2 (Pro) → 3 (Max)');
  console.log(`  Compte : ${EMAIL}`);
  console.log('════════════════════════════════════════════════════════\n');

  let userId = null;
  try {
    // Serveur requis
    try { if ((await fetch(`${APP}/tarifs`)).status !== 200) throw new Error(); }
    catch { console.error('ECHEC : serveur requis sur http://localhost:3000'); process.exit(1); }

    // ────────────────────────────────────────────────────────────────
    console.log('1️⃣  Création du compte (aucun paiement, aucune info Stripe)');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created.user.id.slice(0, 8)}…`);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    // Session cookies (même mécanique que l'application)
    const jar = new Map();
    const ssr = createServerClient(URL_SB, ANON, {
      cookies: {
        get: (n) => jar.get(n),
        set: (n, v) => { jar.set(n, v); },
        remove: (n) => { jar.delete(n); },
      },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Session établie', !loginErr, loginErr?.message);
    const cookies = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
    // Le client anon doit aussi être connecté : ses INSERT portent alors le
    // jeton utilisateur (les triggers DB s'exécutent avec auth.uid()).
    const { error: anonErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Client anon connecté (insertions authentifiées)', !anonErr, anonErr?.message);

    // ══════════════════════════════════════════════════════════════
    console.log('\n── ÉTAT 1 — Compte nouveau, sans abonnement ──');
    const { data: sub1 } = await admin.from('subscriptions')
      .select('plan_id,status,requested_plan_id,stripe_customer_id,stripe_subscription_id,stripe_price_id')
      .eq('user_id', userId).maybeSingle();
    check('Ligne abonnement créée par le trigger d\'inscription',
      sub1?.plan_id === 'essential' && sub1?.status === 'active', JSON.stringify(sub1));
    check('Aucune donnée Stripe (gratuit, sans passe par Stripe)',
      !sub1?.stripe_customer_id && !sub1?.stripe_subscription_id && !sub1?.stripe_price_id);

    const { data: active1 } = await admin.rpc('billing_active_plan', { p_user: userId });
    check('Base : billing_active_plan = essential', active1 === 'essential', `plan=${active1}`);

    const api1 = await api('/api/billing/subscription', { cookies });
    check('API/UI : planId rendu = essential', api1.json?.planId === 'essential', `planId=${api1.json?.planId}`);

    const l1 = await dbLimits('essential');
    check('Limites Essential en base : 15 ventes / 10 produits / 15 clients / 5 dettes',
      l1.sales === 15 && l1.products === 10 && l1.customers === 15 && l1.debts === 5, JSON.stringify(l1));

    // Frontière DB réelle : 10 produits acceptés, le 11e REFUSÉ par le trigger
    let okCount = 0; let refused = null;
    for (let i = 0; i < 11; i++) {
      const { error } = await anon.from('products').insert({ name: `Demo ${i + 1}` });
      if (!error) okCount++; else refused = error.message;
    }
    check('Trigger DB : 10 produits créés puis 11e refusé',
      okCount === 10 && !!refused, `créés=${okCount} refus=${refused ?? '(aucun)'}`);
    check('Message de limite exact (« 10 produits … Essential … Pro »)',
      !!refused && refused.includes('limite de 10 produits') && refused.includes('Essential') && refused.includes('Pro'),
      refused ?? '');

    // Sécurité : l'utilisateur ne peut pas s'auto-promouvoir
    await anon.from('subscriptions').update({ plan_id: 'max' }).eq('user_id', userId);
    const { data: hacked } = await admin.from('subscriptions').select('plan_id').eq('user_id', userId).maybeSingle();
    check('Sécurité : UPDATE client plan_id=max IGNORÉ (RLS sans écriture)', hacked?.plan_id === 'essential',
      `plan=${hacked?.plan_id}`);

    // ══════════════════════════════════════════════════════════════
    console.log('\n── ÉTAT 2 — Clic « Pro » seul, puis paiement confirmé par webhook signé ──');
    const req = await api('/api/billing/subscription', { method: 'POST', body: { plan: 'pro' }, cookies });
    check('POST {plan:pro} accepté comme DEMANDE', req.status === 200 && req.json?.requestedPlanId === 'pro',
      `status=${req.status}`);
    const { data: subReq } = await admin.from('subscriptions')
      .select('plan_id,requested_plan_id').eq('user_id', userId).maybeSingle();
    check('Le clic seul ne donne PAS les droits Pro (plan_id toujours essential)',
      subReq?.plan_id === 'essential' && subReq?.requested_plan_id === 'pro', JSON.stringify(subReq));
    const { data: activeReq } = await admin.rpc('billing_active_plan', { p_user: userId });
    check('Base : plan actif toujours essential après le clic', activeReq === 'essential', `plan=${activeReq}`);

    // Signature invalide d'abord → refusé
    const forged = await postWebhookRaw(
      { id: `evt_demo_forged_${RUN}`, type: 'checkout.session.completed',
        data: { object: { client_reference_id: userId, metadata: { plan_id: 'max' } } } },
      { 'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=${'a'.repeat(64)}` }
    );
    check('Sécurité : webhook FAUSSE signature → 400', forged.status === 400, `status=${forged.status}`);
    const noSig = await postWebhookRaw({ id: `evt_demo_nosig_${RUN}`, type: 'checkout.session.completed', data: { object: {} } });
    check('Sécurité : webhook SANS signature → 400', noSig.status === 400, `status=${noSig.status}`);
    const { data: stillEss } = await admin.from('subscriptions').select('plan_id').eq('user_id', userId).maybeSingle();
    check('Toujours essential après les tentatives forgées', stillEss?.plan_id === 'essential', `plan=${stillEss?.plan_id}`);

    // VRAI événement signé : paiement Pro confirmé (shape exact de notre route checkout)
    const whPro = await postSignedWebhook({
      id: `evt_demo_pro_${RUN}`,
      type: 'checkout.session.completed',
      data: { object: {
        id: `cs_demo_${RUN}`,
        client_reference_id: userId,
        metadata: { user_id: userId, plan_id: 'pro', interval: 'month' },
        subscription: `sub_demo_pro_${RUN}`,
        customer: `cus_demo_${RUN}`,
      } },
    });
    check('Webhook signé (Pro) → 200 + appliqué', whPro.status === 200 && whPro.json?.applied === true,
      `status=${whPro.status} applied=${whPro.json?.applied}`);

    const api2 = await api('/api/billing/subscription', { cookies });
    check('API/UI : planId rendu = pro', api2.json?.planId === 'pro', `planId=${api2.json?.planId}`);
    const { data: sub2 } = await admin.from('subscriptions')
      .select('plan_id,status,stripe_subscription_id,requested_plan_id').eq('user_id', userId).maybeSingle();
    check('Base : plan_id=pro actif (paiement confirmé par Stripe)',
      sub2?.plan_id === 'pro' && sub2?.status === 'active' && sub2?.stripe_subscription_id === `sub_demo_pro_${RUN}`,
      JSON.stringify(sub2));
    const { data: active2 } = await admin.rpc('billing_active_plan', { p_user: userId });
    check('Base : billing_active_plan = pro', active2 === 'pro', `plan=${active2}`);

    const l2 = await dbLimits('pro');
    check('Limites Pro en base : 200 ventes / 70 produits / 200 clients / 50 dettes',
      l2.sales === 200 && l2.products === 70 && l2.customers === 200 && l2.debts === 50, JSON.stringify(l2));

    const { error: p11 } = await anon.from('products').insert({ name: 'Demo 11 (Pro)' });
    check('Porte levée : le 11e produit est maintenant ACCEPTÉ en Pro', !p11, p11?.message);

    // ══════════════════════════════════════════════════════════════
    console.log('\n── ÉTAT 3 — Paiement Max confirmé par webhook signé (vrai Price ID) ──');
    check('Price ID Max utilisé = valeur env (price_…, jamais de prod_…)',
      typeof MAX_PRICE === 'string' && MAX_PRICE.startsWith('price_'), MAX_PRICE ?? 'absent');

    const whMax = await postSignedWebhook({
      id: `evt_demo_max_${RUN}`,
      type: 'customer.subscription.created',
      data: { object: {
        id: `sub_demo_max_${RUN}`,
        customer: `cus_demo_${RUN}`,
        status: 'active',
        metadata: { user_id: userId, plan_id: 'max' },
        items: { data: [{ price: MAX_PRICE }] },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
      } },
    });
    check('Webhook signé (Max, Price ID réel) → 200 + appliqué',
      whMax.status === 200 && whMax.json?.applied === true,
      `status=${whMax.status} applied=${whMax.json?.applied}`);

    const api3 = await api('/api/billing/subscription', { cookies });
    check('API/UI : planId rendu = max', api3.json?.planId === 'max', `planId=${api3.json?.planId}`);
    const { data: sub3 } = await admin.from('subscriptions')
      .select('plan_id,status,stripe_price_id').eq('user_id', userId).maybeSingle();
    check('Base : plan_id=max actif + Price ID Max journalisé',
      sub3?.plan_id === 'max' && sub3?.status === 'active' && sub3?.stripe_price_id === MAX_PRICE,
      JSON.stringify(sub3));
    const { data: active3 } = await admin.rpc('billing_active_plan', { p_user: userId });
    check('Base : billing_active_plan = max', active3 === 'max', `plan=${active3}`);

    const l3 = await dbLimits('max');
    check('Limites Max en base : 1000 ventes / 600 produits / 1000 clients / 400 dettes',
      l3.sales === 1000 && l3.products === 600 && l3.customers === 1000 && l3.debts === 400, JSON.stringify(l3));

    // Idempotence : rejeu du même event → sans effet
    const replay = await postSignedWebhook({
      id: `evt_demo_max_${RUN}`,
      type: 'customer.subscription.created',
      data: { object: { id: `sub_demo_max_${RUN}`, status: 'active', metadata: { user_id: userId } } },
    });
    check('Rejeu du même event.id → duplicate, aucun effet',
      replay.status === 200 && replay.json?.duplicate === true, JSON.stringify(replay.json));

    console.log('\n════════════════════════════════════════════════════════');
    console.log(`  RÉSULTAT : ${pass} OK / ${fail} ÉCHEC`);
    console.log('════════════════════════════════════════════════════════');
    process.exit(fail === 0 ? 0 : 1);
  } finally {
    if (userId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      console.log(`\n🧹 Nettoyage : ${delErr ? '⚠️ ' + delErr.message : 'compte supprimé (cascade)'}`);
    }
  }
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
