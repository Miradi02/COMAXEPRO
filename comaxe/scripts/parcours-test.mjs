// COMAXE — Tâche 7 : tests des 4 PARCOURS de paiement (A–D) + abandon +
// échec + 2 comptes distincts + doublons (idempotence).
//
// Parcours (identité du lien conservée jusqu'au bon Checkout) :
//   A : Pro  mensuel → test_4gMfZagh… ($5)   → webhook → actif pro/monthly
//   B : Pro  annuel  → test_5kQcMY8O… ($49)  → webhook → actif pro/yearly
//   C : Max  mensuel → test_00weV68O… ($14)  → webhook → actif max/monthly
//   D : Max  annuel  → test_6oUeV6c1… ($149) → webhook → actif max/yearly
//
// Chaque parcours : page /paiement (bon prix) → POST /checkout (bon lien +
// client_reference_id) → VRAIE session Stripe (Price de l'offre) → webhook
// signé SANS metadata (le webhook RELIT la session : jamais de confiance au
// frontend) → GET /subscription : plan + périodicité + statuts + Price.
//
// Puis : abandon (aucun webhook → reste Essential), échec de paiement (pas
// d'activation), 2 comptes distincts (croisement sans contamination) et
// doublons (rejeu du même event_id → no-op DB).
//
// Usage : node scripts/parcours-test.mjs  (build + serveur :3000 requis)
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const env = {};
readFileSync(join(ROOT, '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
});

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'http://localhost:3000';
const WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;

const RUN = Date.now();
const PASSWORD = 'ComaxeTest!2026';
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${label}${detail ? ` — ${detail}` : ''}`);
};
/** Information sans incidence sur le résultat (tests non réalisables). */
const note = (label) => console.log(`  NOTE ${label}`);

/** 4 parcours : une identité de lien ET de prix par couple plan×période. */
const PARCOURS = [
  { id: 'A', plan: 'pro', interval: 'month', price: env.STRIPE_PRO_PRICE_ID_MONTHLY, token: 'test_4gMfZagh', amount: '5 $', fr: 'Pro mensuel' },
  { id: 'B', plan: 'pro', interval: 'year', price: env.STRIPE_PRO_PRICE_ID_ANNUAL, token: 'test_5kQcMY8O', amount: '49 $', fr: 'Pro annuel' },
  { id: 'C', plan: 'max', interval: 'month', price: env.STRIPE_MAX_PRICE_ID_MONTHLY, token: 'test_00weV68O', amount: '14 $', fr: 'Max mensuel' },
  { id: 'D', plan: 'max', interval: 'year', price: env.STRIPE_MAX_PRICE_ID_ANNUAL, token: 'test_6oUeV6c1', amount: '149 $', fr: 'Max annuel' },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

async function api(path, { method = 'GET', body, cookies } = {}) {
  const res = await withRetry(() => fetch(APP + path, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }));
  let json = null;
  try { json = await res.json(); } catch { /* corps vide */ }
  return { status: res.status, json };
}
const post = (path, body, cookies) => api(path, { method: 'POST', body, cookies });

async function getText(path, cookies) {
  const res = await withRetry(() => fetch(APP + path, {
    headers: cookies ? { Cookie: cookies } : {},
    signal: AbortSignal.timeout(20000),
  }));
  return { status: res.status, html: await res.text() };
}

/** En-tête Stripe-Signature signé avec HMAC SHA-256 (même algo que le serveur) */
function postWebhook(payload) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', WEBHOOK_SECRET).update(`${ts}.${body}`).digest('hex');
  return withRetry(() => fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` },
    body,
    signal: AbortSignal.timeout(20000),
  }).then(async (res) => {
    let json = null;
    try { json = await res.json(); } catch { /* vide */ }
    return { status: res.status, json };
  }));
}

/** VRAIE session Checkout (prix existants, aucun produit/prix créé) — avec reprise réseau. */
async function createSession(price, userId) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'subscription',
          'line_items[0][price]': price,
          'line_items[0][quantity]': '1',
          success_url: `${APP}/parametres/abonnement?checkout=success`,
          cancel_url: `${APP}/tarifs`,
          client_reference_id: userId,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 200 && typeof json.id === 'string') return json.id;
      if (attempt === 3) return null;
    } catch { /* réseau — on retente */ }
    await sleep(1200);
  }
  return null;
}

/** Compte de test → { id, cookie } */
async function makeAccount(tag) {
  const email = `parcours-${tag}-${RUN}@comaxe.test`;
  const { data: created, error } = await withTimeout(admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  }), 30000, 'createUser');
  if (error || !created?.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  const userId = created.user.id;
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: {
      get: (n) => jar.get(n),
      set: (n, v) => { jar.set(n, v); },
      remove: (n) => { jar.delete(n); },
    },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: loginErr } = await withTimeout(
    ssr.auth.signInWithPassword({ email, password: PASSWORD }), 30000, 'login');
  if (loginErr) throw new Error(`login ${tag}: ${loginErr.message}`);
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
  return { id: userId, cookie };
}

const reset = async (userId) => {
  for (let i = 1; i <= 3; i++) {
    try {
      return await withTimeout(admin.from('subscriptions').update({
        plan_id: 'essential', status: 'active', requested_plan_id: null,
        billing_period: null,
        current_period_end: null, ends_at: null,
        stripe_customer_id: null, stripe_subscription_id: null, stripe_price_id: null,
      }).eq('user_id', userId), 30000, 'reset');
    } catch (e) { if (i === 3) throw e; await sleep(1000); }
  }
};

/** Reprise réseau (fetch failed intermittent dans cet environnement). */
async function withRetry(fn, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { if (i === tries) throw e; await sleep(1000); }
  }
}

/** Garde-fou anti-blocage pour les appels Supabase (pas de timeout natif). */
function withTimeout(p, ms = 30000, label = 'opération') {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${label}`)), ms)),
  ]);
}

/** Activation complète : webhook signé puis état relu via l'API. */
async function activate(user, evtId, sessionId, subTag) {
  const wh = await postWebhook({
    id: evtId,
    type: 'checkout.session.completed',
    data: { object: {
      id: sessionId,
      client_reference_id: user.id,
      subscription: `sub_${subTag}`,
      customer: `cus_${subTag}`,
      // SANS metadata : plan + périodicité viennent DU PRICE relu.
    } },
  });
  const sub = await api('/api/billing/subscription', { cookies: user.cookie });
  return { wh, sub };
}

const journalCount = (userId) => withRetry(() => withTimeout(admin
  .from('subscription_events')
  .select('event_id', { count: 'exact', head: true })
  .eq('user_id', userId), 30000, 'journal'));

/* ── Scénarios ─────────────────────────────────────────────────────── */

async function main() {
  let alive = false;
  try { alive = (await fetch(`${APP}/tarifs`, { signal: AbortSignal.timeout(8000) })).status === 200; } catch { /* hors ligne */ }
  if (!alive) {
    console.error('ECHEC : serveur requis sur http://localhost:3000 (npx next start)');
    process.exit(1);
  }
  if (!WEBHOOK_SECRET) {
    console.error('ECHEC : STRIPE_WEBHOOK_SECRET absent de .env');
    process.exit(1);
  }

  const user1 = await makeAccount('u1');

  /* ── 1️⃣ Parcours A–D ── */
  for (const p of PARCOURS) {
    console.log(`\n${p.id}️⃣  Parcours ${p.id} : ${p.fr} (${p.amount})`);
    await reset(user1.id);

    // (a) Page /paiement : bonne offre, bon prix.
    // (React SSR sépare texte statique et expression par <!-- -->)
    const pay = await getText(`/paiement?plan=${p.plan}&interval=${p.interval}`, user1.cookie);
    const nameRe = p.plan === 'pro' ? /COMAXE\s*(?:<!--\s*-->)?\s*Pro\b/ : /COMAXE\s*(?:<!--\s*-->)?\s*Max\b/;
    check(`${p.id} : /paiement ${p.plan}/${p.interval} → 200 + COMAXE ${p.plan === 'pro' ? 'Pro' : 'Max'} + ${p.amount}`,
      pay.status === 200 && nameRe.test(pay.html) && pay.html.includes(p.amount),
      `status=${pay.status} nom=${nameRe.test(pay.html)} prix=${pay.html.includes(p.amount)}`);

    // (b) POST /checkout → SON lien (identité conservée) + pont user.
    const co = await post('/api/billing/checkout', { plan: p.plan, interval: p.interval }, user1.cookie);
    check(`${p.id} : checkout → SON lien (${p.token}…) + client_reference_id=user`,
      co.status === 200 && typeof co.json?.url === 'string' &&
      co.json.url.includes(p.token) &&
      co.json.url.includes(`client_reference_id=${user1.id}`),
      `status=${co.status} url=${(co.json?.url || '').slice(0, 60)}…`);

    // (c) VRAIE session Stripe (Price de l'offre) + webhook SANS metadata.
    const cs = await createSession(p.price, user1.id);
    check(`${p.id} : session Checkout réelle créée (cs_…)`, !!cs, `id=${cs || 'ÉCHEC API STRIPE'}`);
    if (cs) {
      const { wh, sub } = await activate(user1, `par_evt_${RUN}_${p.id}`, cs, `${p.id}`);
      check(`${p.id} : webhook signé → applied`,
        wh.status === 200 && wh.json?.applied === true,
        `status=${wh.status} applied=${wh.json?.applied} err=${wh.json?.error || ''}`);

      const s = sub.json?.subscription;
      const period = p.interval === 'year' ? 'yearly' : 'monthly';
      check(`${p.id} : abonnement ACTIF ${p.plan}/${period} + Price + statut actif`,
        sub.json?.planId === p.plan &&
        s?.billingPeriod === period &&
        s?.status === 'active' &&
        s?.stripePriceId === p.price &&
        typeof s?.stripeSubscriptionId === 'string',
        `planId=${sub.json?.planId} period=${s?.billingPeriod} status=${s?.status} price=${(s?.stripePriceId || '').slice(0, 16)}`);
    }
  }

  /* ── 2️⃣ Abandon : clic sur « Payer » puis retour sans paiement ── */
  console.log('\n2️⃣  Abandon (aucun webhook)');
  await reset(user1.id);
  const abCo = await post('/api/billing/checkout', { plan: 'pro', interval: 'month' }, user1.cookie);
  const abSub = await api('/api/billing/subscription', { cookies: user1.cookie });
  check('Abandon : lien renvoyé puis AUCUNE activation sans webhook',
    abCo.status === 200 && abSub.json?.planId === 'essential',
    `checkout=${abCo.status} planId=${abSub.json?.planId}`);

  /* ── 3️⃣ Échec de paiement : pas d'activation ── */
  console.log('\n3️⃣  Échec de paiement (pas d’activation)');
  await reset(user1.id);
  await post('/api/billing/checkout', { plan: 'max', interval: 'month' }, user1.cookie);
  const csFail = await createSession(env.STRIPE_MAX_PRICE_ID_MONTHLY, user1.id);
  let failDetail = 'session non créée';
  let failStatus = 0, failApplied = '';
  if (csFail) {
    const whFail = await postWebhook({
      id: `par_fail_${RUN}`,
      type: 'checkout.session.async_payment_failed',
      data: { object: {
        id: csFail, client_reference_id: user1.id,
        subscription: 'sub_fail', customer: 'cus_fail',
      } },
    });
    failStatus = whFail.status; failApplied = String(whFail.json?.applied);
  }
  const failSub = await api('/api/billing/subscription', { cookies: user1.cookie });
  check('Échec : checkout.session.async_payment_failed → SANS activation (reste Essential)',
    failSub.json?.planId === 'essential' && failStatus === 200,
    `planId=${failSub.json?.planId} wh=${failStatus} applied=${failApplied} status=${failSub.json?.subscription?.status}`);

  /* ── 4️⃣ 2 comptes distincts : croisement sans contamination ── */
  console.log('\n4️⃣  Deux comptes distincts (croisement)');
  const user2 = await makeAccount('u2');
  await reset(user1.id);
  await reset(user2.id);

  const csU1 = await createSession(env.STRIPE_PRO_PRICE_ID_MONTHLY, user1.id);
  const { sub: subU1 } = await activate(user1, `par_cross1_${RUN}`, csU1, 'cross1');
  const csU2 = await createSession(env.STRIPE_MAX_PRICE_ID_ANNUAL, user2.id);
  const { sub: subU2 } = await activate(user2, `par_cross2_${RUN}`, csU2, 'cross2');

  check('Croisement : compte 1 → pro/monthly actif',
    subU1.json?.planId === 'pro' && subU1.json?.subscription?.billingPeriod === 'monthly',
    `planId=${subU1.json?.planId} period=${subU1.json?.subscription?.billingPeriod}`);
  check('Croisement : compte 2 → max/yearly actif (session distincte)',
    subU2.json?.planId === 'max' && subU2.json?.subscription?.billingPeriod === 'yearly',
    `planId=${subU2.json?.planId} period=${subU2.json?.subscription?.billingPeriod}`);
  check('Croisement : identifiants Stripe DISTINCTS entre les 2 comptes',
    !!subU1.json?.subscription?.stripeSubscriptionId &&
    !!subU2.json?.subscription?.stripeSubscriptionId &&
    subU1.json.subscription.stripeSubscriptionId !== subU2.json.subscription.stripeSubscriptionId,
    `u1=${subU1.json?.subscription?.stripeSubscriptionId} u2=${subU2.json?.subscription?.stripeSubscriptionId}`);
  // Relecture du compte 1 : inchangé par l'activation du compte 2.
  const subU1After = await api('/api/billing/subscription', { cookies: user1.cookie });
  check('Croisement : compte 1 INCHANGÉ après activation du compte 2',
    subU1After.json?.planId === 'pro' && subU1After.json?.subscription?.billingPeriod === 'monthly',
    `planId=${subU1After.json?.planId}`);

  /* ── 5️⃣ Doublons : rejeu du même event_id → no-op ── */
  console.log('\n5️⃣  Doublons (idempotence du webhook)');
  const beforeCount = await journalCount(user1.id);
  const replay = await postWebhook({
    id: `par_cross1_${RUN}`, // MÊME id que l'activation du compte 1
    type: 'checkout.session.completed',
    data: { object: {
      id: csU1, client_reference_id: user1.id,
      subscription: 'sub_cross1', customer: 'cus_cross1',
    } },
  });
  const afterReplay = await api('/api/billing/subscription', { cookies: user1.cookie });
  const afterCount = await journalCount(user1.id);
  check('Doublon : rejeu → 200 et AUCUNE ré-appliquation',
    replay.status === 200 && replay.json?.applied !== true,
    `status=${replay.status} applied=${replay.json?.applied}`);
  check('Doublon : état inchangé (pro/monthly/actif)',
    afterReplay.json?.planId === 'pro' &&
    afterReplay.json?.subscription?.billingPeriod === 'monthly' &&
    afterReplay.json?.subscription?.status === 'active',
    `planId=${afterReplay.json?.planId} period=${afterReplay.json?.subscription?.billingPeriod}`);
  check('Doublon : journal subscription_events SANS ligne en plus',
    (beforeCount.count ?? -1) >= 0 && beforeCount.count === afterCount.count,
    `avant=${beforeCount.count} après=${afterCount.count}`);

  /* ── 6️⃣ Google Pay / Apple Pay : page hébergée Stripe ── */
  console.log('\n6️⃣  Google Pay / Apple Pay (via Stripe Checkout)');
  try {
    const p = PARCOURS[0];
    const co = await post('/api/billing/checkout', { plan: p.plan, interval: p.interval }, user1.cookie);
    const res = await fetch(co.json.url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    const html = await res.text().catch(() => '');
    if (res.status === 200 && html.length > 500) {
      note(`Page Checkout Stripe hébergée joignable (${res.status}) — les moyens (Carte/Google/Apple Pay) y sont hébergés`);
      note('Google/Apple Pay : Non testable dans l’environnement actuel (aucun appareil/porte-monnaie headless)');
    } else {
      note(`Google/Apple Pay : Non testable dans l’environnement actuel (page hébergée → ${res.status})`);
    }
  } catch {
    note('Google/Apple Pay : Non testable dans l’environnement actuel (réseau vers buy.stripe.com indisponible)');
  }

  console.log(`\n==================================================`);
  console.log(`  RESULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
  console.log(`==================================================`);
  process.exitCode = fail ? 1 : 0;
}

main().catch((err) => {
  console.error('\nERREUR FATALE :', err.message);
  process.exit(1);
});
