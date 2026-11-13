// COMAXE — Test RÉEL de l'API billing (tâche 6)
//
// Phase 1 (serveur principal :3000, config Stripe optionnelle) :
//   • 401 sans session sur les routes
//   • clic « S'abonner » ≠ paiement (requested vs actif)
//   • checkout → 503 tant que Stripe n'est pas configuré (sinon appel réel)
//   • simulateur : cycle de vie complet (payé → échec → renouvellement →
//     annulation), idempotence par eventId, PAS de résurrection d'un plan
//     annulé après une nouvelle demande (pending conserve le plan)
//   • journal subscription_events alimenté
// Phase 2 (serveur temporaire :3001 AVEC STRIPE_WEBHOOK_SECRET) :
//   • webhook /api/stripe/webhook : POST uniquement (GET → 405),
//     sans signature / fausse signature / signature périmée → 400
//   • signature valide → handler partagé → applySubscriptionEvent
//   • rejeu du même event.id → no-op (idempotence DB)
//   • les 10 événements Stripe pris en charge, signés un à un
//
// Usage : node scripts/billing-api-test.mjs  (build + serveur :3000 requis)
import { spawn, execSync } from 'child_process';
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
const APP2 = 'http://localhost:3001';
const WEBHOOK_SECRET = 'whsec_test_billing_api_98765';

const RUN = Date.now();
const EMAIL = `billing-api-${RUN}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

// IDs d'événements UNIQUES par exécution : `event_id` est UNIQUE globalement
// en base — des IDs fixes feraient échouer tout REJEU du test (doublon
// permanent avec le run précédent). Le rejeu d'idempotence reste testé :
// on rejoue le MÊME id dans le même run.
const EV = {
  pay: `sim_api_pay_${RUN}`,
  payYear: `sim_api_pay_year_${RUN}`,
  fail: `sim_api_fail_${RUN}`,
  renew: `sim_api_renew_${RUN}`,
  cancel: `sim_api_cancel_${RUN}`,
  whPaid: `evt_api_${RUN}_1`,
  whFail: `evt_api_${RUN}_2`,
  whUnknown: `evt_api_${RUN}_3`,
  whNoUser: `evt_api_${RUN}_4`,
  whCreated: `evt_api_${RUN}_5`,
  whUpdated: `evt_api_${RUN}_6`,
  whAction: `evt_api_${RUN}_7`,
  whRenew: `evt_api_${RUN}_8`,
  whAsyncOk: `evt_api_${RUN}_9`,
  whAsyncFail: `evt_api_${RUN}_10`,
  whExpired: `evt_api_${RUN}_11`,
  whDeleted: `evt_api_${RUN}_12`,
  whDeduce: `evt_api_${RUN}_13`,
  whFake: `evt_api_${RUN}_14`,
};

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0, userId = null, cookieHeader = '';
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function api(base, path, { method = 'GET', body, cookies, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* corps vide */ }
  return { status: res.status, json };
}

const post = (base, path, body, cookies) => api(base, path, { method: 'POST', body, cookies });
const get = (base, path, cookies) => api(base, path, { cookies });

/** En-tête Stripe-Signature signé avec HMAC SHA-256 (même algo que le serveur) */
function signedHeaders(payload, { t, secret } = {}) {
  const body = JSON.stringify(payload);
  const ts = t ?? Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret ?? WEBHOOK_SECRET).update(`${ts}.${body}`).digest('hex');
  return { body, headers: { 'Stripe-Signature': `t=${ts},v1=${sig}` } };
}

async function postWebhook(base, payload, opts) {
  const { body, headers } = signedHeaders(payload, opts);
  const res = await fetch(base + '/api/stripe/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
  let json = null;
  try { json = await res.json(); } catch { /* vide */ }
  return { status: res.status, json };
}

function killPort(port) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore' }
    );
  } catch { /* déjà arrêté */ }
}

async function startExtraServer() {
  const child = spawn('npx next start -p 3001', {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
    stdio: 'ignore',
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    try {
      const r = await fetch(`${APP2}/tarifs`);
      if (r.status === 200) return child;
    } catch { /* pas prêt */ }
    await sleep(700);
  }
  child.kill();
  throw new Error('Serveur temporaire :3001 non prêt (build à refaire ?)');
}

async function main() {
  // ── 0. Serveur principal requis ──
  let alive = false;
  try { alive = (await fetch(`${APP}/tarifs`)).status === 200; } catch { /* hors ligne */ }
  if (!alive) {
    console.error('ECHEC : serveur requis sur http://localhost:3000 (npx next start -p 3000)');
    process.exit(1);
  }

  let extra = null;

  try {
    // ══ Phase 1 : sans clé Stripe ══
    console.log('════════════════════════════════════════════');
    console.log('  PHASE 1 — API billing sans clé Stripe (:3000)');
    console.log('════════════════════════════════════════════\n');
    console.log('1️⃣  Authentification obligatoire');

    const anonSub = await post(APP, '/api/billing/subscription', { plan: 'pro' });
    check('POST /subscription sans session → 401', anonSub.status === 401, `status=${anonSub.status}`);
    const anonGet = await get(APP, '/api/billing/subscription');
    check('GET /subscription sans session → 401', anonGet.status === 401, `status=${anonGet.status}`);
    const anonSim = await post(APP, '/api/billing/simulator', { type: 'invoice.paid' });
    check('POST /simulator sans session → 401', anonSim.status === 401, `status=${anonSim.status}`);
    const anonCo = await post(APP, '/api/billing/checkout', { plan: 'pro' });
    check('POST /checkout sans session → 401', anonCo.status === 401, `status=${anonCo.status}`);

    console.log('\n2️⃣  Compte de test + session cookies');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    const jar = new Map();
    const supabaseSSR = createServerClient(URL_SB, ANON, {
      cookies: {
        get: (name) => jar.get(name),
        set: (name, value) => { jar.set(name, value); },
        remove: (name) => { jar.delete(name); },
      },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await supabaseSSR.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('signInWithPassword réussi', !loginErr, loginErr?.message || `${jar.size} cookie(s)`);
    cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    const reset = () => admin.from('subscriptions').update({
      plan_id: 'essential', status: 'active', requested_plan_id: null,
      billing_period: null,
      current_period_end: null, ends_at: null,
      stripe_customer_id: null, stripe_subscription_id: null, stripe_price_id: null,
    }).eq('user_id', userId);
    await reset();

    console.log('\n2️⃣bis  Page /paiement (Tâche 5)');
    // Sans session : le middleware redirige (route protégée).
    const payAnon = await fetch(`${APP}/paiement?plan=pro&interval=month`, { redirect: 'manual' });
    check('/paiement SANS session → redirection (protégée)',
      payAnon.status === 307 || payAnon.status === 308 || payAnon.status === 302,
      `status=${payAnon.status}`);
    // Avec session : page servie + libellés attendus.
    const payAuth = await fetch(`${APP}/paiement?plan=pro&interval=month`, {
      headers: { cookie: cookieHeader },
    });
    const payHtml = await payAuth.text();
    check('/paiement avec session → 200',
      payAuth.status === 200, `status=${payAuth.status}`);
    check('/paiement : les 3 moyens Stripe + Mobile Money « Bientôt disponible »',
      payHtml.includes('Google Pay') && payHtml.includes('Apple Pay') &&
      payHtml.includes('Mobile Money') && payHtml.includes('Bientôt disponible'),
      `len=${payHtml.length}`);
    check('/paiement : prix de l’offre affiché en USD (5 $)',
      payHtml.includes('5 $'), `contient_5$=${payHtml.includes('5 $')}`);
    // Plan hors périmètre → la page renvoie aux offres (contrôle client,
    // vérifié ici côté serveur : la route ne doit pas être une page morte).
    const payBad = await fetch(`${APP}/paiement?plan=ultimate`, {
      headers: { cookie: cookieHeader },
    });
    check('/paiement?plan=ultimate → page servie (redirection client vers /tarifs)',
      payBad.status === 200, `status=${payBad.status}`);

    console.log('\n2️⃣ter  CTA tarifs → /paiement + page Abonnement (Tâche 6)');
    // Connecté : les boutons Pro/Max pointent DIRECTEMENT vers /paiement
    // avec la période du sélecteur (défaut : month).
    const tarifsAuth = await fetch(`${APP}/tarifs`, { headers: { cookie: cookieHeader } });
    const tarifsHtml = await tarifsAuth.text();
    const proHref = tarifsHtml.match(/href="\/paiement\?plan=pro[^"]*"/)?.[0] ?? 'ABSENT';
    const maxHref = tarifsHtml.match(/href="\/paiement\?plan=max[^"]*"/)?.[0] ?? 'ABSENT';
    check('/tarifs (connecté) : CTA Pro → /paiement?plan=pro&interval=month',
      proHref.includes('plan=pro') && proHref.includes('interval=month'), proHref);
    check('/tarifs (connecté) : CTA Max → /paiement?plan=max&interval=month',
      maxHref.includes('plan=max') && maxHref.includes('interval=month'), maxHref);
    check('/tarifs (connecté) : Essential reste vers /dashboard',
      tarifsHtml.includes('href="/dashboard"'));
    // Page Abonnement simplifiée : offre actuelle + limites + CTA → /tarifs,
    // sans simulateur ni journal (supprimés en Tâche 6).
    const aboAuth = await fetch(`${APP}/parametres/abonnement`, {
      headers: { cookie: cookieHeader },
    });
    const aboHtml = await aboAuth.text();
    check('/parametres/abonnement → 200',
      aboAuth.status === 200, `status=${aboAuth.status}`);
    check('/parametres/abonnement : CTA « S’abonner » (Essential) présent',
      aboHtml.includes('S’abonner'), `len=${aboHtml.length}`);
    check('/parametres/abonnement : sections offre actuelle + consommation',
      aboHtml.includes('Offre actuelle') && aboHtml.includes('Consommation de l’offre'));
    check('/parametres/abonnement : simulateur et journal SUPPRIMÉS',
      !aboHtml.includes('Simulateur') && !aboHtml.includes('Journal des événements'));

    console.log('\n3️⃣  Demande de plan ≠ paiement');
    const req1 = await post(APP, '/api/billing/subscription', { plan: 'pro' }, cookieHeader);
    check('POST {plan:pro} → 200 + requestedPlanId=pro',
      req1.status === 200 && req1.json?.requestedPlanId === 'pro',
      `status=${req1.status} requested=${req1.json?.requestedPlanId}`);
    check('plan_id intouché → planId rendu = essential (clic ≠ paiement)',
      req1.json?.planId === 'essential', `planId=${req1.json?.planId}`);
    const afterReq = await get(APP, '/api/billing/subscription', cookieHeader);
    check('GET : statut pending + demande conservée + actif toujours gratuit',
      afterReq.json?.subscription?.status === 'pending' &&
      afterReq.json?.subscription?.requestedPlanId === 'pro' &&
      afterReq.json?.planId === 'essential',
      `status=${afterReq.json?.subscription?.status} planId=${afterReq.json?.planId}`);
    const reqBad = await post(APP, '/api/billing/subscription', { plan: 'gratuit' }, cookieHeader);
    check('POST {plan:gratuit} → 400 (offre gratuite non demandable)',
      reqBad.status === 400, `status=${reqBad.status}`);

    console.log('\n4️⃣  Checkout / webhook : selon la configuration Stripe de l’env');
    const stripeOn = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRO_PRICE_ID_MONTHLY);
    const co = await post(APP, '/api/billing/checkout', { plan: 'pro' }, cookieHeader);
    check(stripeOn
      ? 'POST /checkout : Stripe configuré → lien réel renvoyé (jamais de faux 503)'
      : 'POST /checkout {plan:pro} sans clés → 503 + message simulateur',
    stripeOn
      ? co.status !== 503
      : co.status === 503 && (co.json?.error || '').includes('simulateur'),
      `status=${co.status} ${co.json?.error || ''}`);

    // Identité du lien renvoyé : LE lien de la combinaison demandée,
    // avec client_reference_id = user_id (pont vers le webhook).
    if (stripeOn && co.status === 200) {
      const stripeSrc = readFileSync(join(ROOT, 'src/lib/billing/stripe.ts'), 'utf8');
      const plBlock = (stripeSrc.match(/const PAYMENT_LINKS[^=]*=\s*\{([\s\S]*?)\n\};/) || [])[1] || '';
      const plUrls = [...plBlock.matchAll(/'(https:\/\/buy\.stripe\.com\/[^']+)'/g)].map((m) => m[1]);
      const combos = [
        { plan: 'pro', interval: 'month', label: 'pro/mensuel' },
        { plan: 'pro', interval: 'year', label: 'pro/annuel' },
        { plan: 'max', interval: 'month', label: 'max/mensuel' },
        { plan: 'max', interval: 'year', label: 'max/annuel' },
      ];
      // Index dans la table : pro{month,year}, max{month,year} → ordre de lecture.
      const tableOrder = [plUrls[0], plUrls[1], plUrls[2], plUrls[3]];
      for (let i = 0; i < combos.length; i++) {
        const c = combos[i];
        const r = c.plan === 'pro' && c.interval === 'month'
          ? co
          : await post(APP, '/api/billing/checkout', { plan: c.plan, interval: c.interval }, cookieHeader);
        const sent = r.json?.url || '';
        const okIdentity = r.status === 200 &&
          sent.startsWith(tableOrder[i]) &&
          sent.includes(`client_reference_id=${userId}`) &&
          r.json?.interval === c.interval;
        check(`POST /checkout ${c.label} → SON lien + SON client_reference_id`, okIdentity,
          `status=${r.status} url=${sent.slice(0, 64)}…`);
      }
      // La dernière requête (max/annuel) a laissé requested=max : on remet
      // pro/mensuel pour que la suite (demande → paiement) reste cohérente.
      const back = await post(APP, '/api/billing/checkout', { plan: 'pro', interval: 'month' }, cookieHeader);
      check('retour à pro/mensuel pour la suite du test', back.status === 200,
        `status=${back.status}`);
      // Intervalle invalide refusé (route checkout)
      const badInt = await post(APP, '/api/billing/checkout', { plan: 'pro', interval: 'decade' }, cookieHeader);
      check('POST /checkout intervalle invalide → 400', badInt.status === 400,
        `status=${badInt.status}`);
    }
    const whMain = await post(APP, '/api/stripe/webhook', { id: 'evt_x', type: 'x' });
    const secretSet = Boolean(env.STRIPE_WEBHOOK_SECRET);
    check(secretSet
      ? 'POST /webhook sans en-tête signature (secret configuré) → 400'
      : 'POST /webhook sans STRIPE_WEBHOOK_SECRET → 503',
      secretSet ? whMain.status === 400 : whMain.status === 503,
      `status=${whMain.status} secret=${secretSet}`);

    console.log('\n5️⃣  Simulateur : cycle de vie complet (même routeur)');
    const badType = await post(APP, '/api/billing/simulator', { type: 'abonnement.inconnu' }, cookieHeader);
    check('type inconnu → 400 + liste des types', badType.status === 400 && Array.isArray(badType.json?.types),
      `status=${badType.status}`);

    const pay = await post(APP, '/api/billing/simulator',
      { type: 'checkout.completed', eventId: EV.pay }, cookieHeader);
    check('checkout.completed (sans planId → plan demandé pro) appliqué',
      pay.status === 200 && pay.json?.applied === true,
      `status=${pay.status} applied=${pay.json?.applied}`);
    const afterPay = await get(APP, '/api/billing/subscription', cookieHeader);
    check('GET : planId=pro, actif, demande soldée',
      afterPay.json?.planId === 'pro' &&
      afterPay.json?.subscription?.status === 'active' &&
      afterPay.json?.subscription?.requestedPlanId === null,
      `planId=${afterPay.json?.planId} status=${afterPay.json?.subscription?.status}`);
    check('identifiant abonnement simulé généré à la volée (sim_sub_…)',
      (afterPay.json?.subscription?.stripeSubscriptionId || '').startsWith('sim_sub_'),
      afterPay.json?.subscription?.stripeSubscriptionId || 'null');
    const expectedPriceId = env.STRIPE_PRO_PRICE_ID_MONTHLY || null;
    check('Price ID journalisé = valeur env uniquement (jamais inventé)',
      (afterPay.json?.subscription?.stripePriceId ?? null) === expectedPriceId,
      `stocké=${afterPay.json?.subscription?.stripePriceId} env=${expectedPriceId}`);
    check('billing_period = monthly (paiement mensuel confirmé)',
      afterPay.json?.subscription?.billingPeriod === 'monthly',
      `billingPeriod=${afterPay.json?.subscription?.billingPeriod}`);

    // Paiement ANNUEL : même plan, période différente (Pro mensuel ≠ Pro annuel)
    const payYear = await post(APP, '/api/billing/simulator',
      { type: 'checkout.completed', eventId: EV.payYear, interval: 'year', planId: 'pro' }, cookieHeader);
    check('checkout.completed annuel → applied', payYear.status === 200 && payYear.json?.applied === true,
      `status=${payYear.status}`);
    const afterYear = await get(APP, '/api/billing/subscription', cookieHeader);
    check('billing_period = yearly après paiement annuel (même plan pro)',
      afterYear.json?.planId === 'pro' && afterYear.json?.subscription?.billingPeriod === 'yearly',
      `planId=${afterYear.json?.planId} billingPeriod=${afterYear.json?.subscription?.billingPeriod}`);

    const replay = await post(APP, '/api/billing/simulator',
      { type: 'checkout.completed', eventId: EV.pay }, cookieHeader);
    check('rejeu même eventId → applied=false, duplicate=true',
      replay.status === 200 && replay.json?.applied === false && replay.json?.duplicate === true,
      `applied=${replay.json?.applied} duplicate=${replay.json?.duplicate}`);
    const afterReplay = await get(APP, '/api/billing/subscription', cookieHeader);
    check('état inchangé après rejeu (pro/actif)',
      afterReplay.json?.planId === 'pro' && afterReplay.json?.subscription?.status === 'active',
      `planId=${afterReplay.json?.planId} status=${afterReplay.json?.subscription?.status}`);

    const failPay = await post(APP, '/api/billing/simulator',
      { type: 'invoice.payment_failed', eventId: EV.fail }, cookieHeader);
    check('invoice.payment_failed → applied (statut retard)',
      failPay.status === 200 && failPay.json?.applied === true, `status=${failPay.status}`);
    const afterFail = await get(APP, '/api/billing/subscription', cookieHeader);
    check('échec transitoire : past_due MAIS plan pro conservé (grâce)',
      afterFail.json?.subscription?.status === 'past_due' && afterFail.json?.planId === 'pro',
      `status=${afterFail.json?.subscription?.status} planId=${afterFail.json?.planId}`);

    const renew = await post(APP, '/api/billing/simulator',
      { type: 'invoice.paid', eventId: EV.renew }, cookieHeader);
    check('invoice.paid → réactivation', renew.status === 200 && renew.json?.applied === true);
    const afterRenew = await get(APP, '/api/billing/subscription', cookieHeader);
    check('renouvellement : actif + période courante renouvelée',
      afterRenew.json?.subscription?.status === 'active' &&
      afterRenew.json?.planId === 'pro' &&
      !!afterRenew.json?.subscription?.currentPeriodEnd,
      `periodEnd=${afterRenew.json?.subscription?.currentPeriodEnd}`);

    const cancel = await post(APP, '/api/billing/simulator',
      { type: 'subscription.canceled', eventId: EV.cancel }, cookieHeader);
    check('subscription.canceled → applied', cancel.status === 200 && cancel.json?.applied === true);
    const afterCancel = await get(APP, '/api/billing/subscription', cookieHeader);
    check('annulation → retour gratuit immédiat (planId résolu essential)',
      afterCancel.json?.planId === 'essential' && afterCancel.json?.subscription?.status === 'canceled',
      `planId=${afterCancel.json?.planId} status=${afterCancel.json?.subscription?.status}`);
    check('plan_id remis à zéro côté ligne (pas de fantôme annulé)',
      afterCancel.json?.subscription?.planId === 'essential',
      `ligne plan_id=${afterCancel.json?.subscription?.planId}`);
    check('billing_period remis à NULL après annulation (plus de plan payant)',
      afterCancel.json?.subscription?.billingPeriod === null,
      `billingPeriod=${afterCancel.json?.subscription?.billingPeriod}`);

    console.log('\n6️⃣  Pas de résurrection d’un plan annulé');
    const reReq = await post(APP, '/api/billing/subscription', { plan: 'max' }, cookieHeader);
    check('nouvelle demande après annulation → requested=max, actif = gratuit',
      reReq.status === 200 && reReq.json?.requestedPlanId === 'max' && reReq.json?.planId === 'essential',
      `requested=${reReq.json?.requestedPlanId} planId=${reReq.json?.planId}`);
    const reReqGet = await get(APP, '/api/billing/subscription', cookieHeader);
    check('GET : pending conserve le plan ESSENTIAL (bug de résurrection absent)',
      reReqGet.json?.subscription?.status === 'pending' &&
      reReqGet.json?.subscription?.requestedPlanId === 'max' &&
      reReqGet.json?.planId === 'essential',
      `status=${reReqGet.json?.subscription?.status} planId=${reReqGet.json?.planId}`);

    console.log('\n7️⃣  Journal subscription_events');
    const { count: evtCount, error: cntErr } = await admin
      .from('subscription_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    check('événements journalisés (≥ 4 : pay/fail/renew/cancel)',
      !cntErr && evtCount >= 4, `count=${evtCount}`);

    // ══ Phase 2 : webhook signé (serveur temporaire) ══
    console.log('\n════════════════════════════════════════════');
    console.log('  PHASE 2 — Webhook Stripe signé (:3001, secret injecté)');
    console.log('════════════════════════════════════════════\n');
    console.log('8️⃣  Démarrage du serveur avec STRIPE_WEBHOOK_SECRET');
    extra = await startExtraServer();
    check('serveur :3001 prêt (webhook configuré)', true, WEBHOOK_SECRET.slice(0, 12) + '…');

    const noSig = await fetch(`${APP2}/api/stripe/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'evt_nosig', type: 'x' }),
    });
    check('sans en-tête Stripe-Signature → 400', noSig.status === 400, `status=${noSig.status}`);

    const badSig = await fetch(`${APP2}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=${'a'.repeat(64)}`,
      },
      body: JSON.stringify({ id: 'evt_badsig', type: 'x' }),
    });
    check('signature invalide → 400', badSig.status === 400, `status=${badSig.status}`);

    const stale = await postWebhook(APP2,
      { id: 'evt_stale', type: 'x' }, { t: Math.floor(Date.now() / 1000) - 600 });
    check('signature périmée (−10 min, tolérance 5 min) → 400',
      stale.status === 400, `status=${stale.status}`);

    console.log('\n9️⃣  Événement valide signé → même routeur que le simulateur');
    await reset();
    const evtPaid = {
      id: EV.whPaid,
      type: 'checkout.session.completed',
      data: { object: {
        client_reference_id: userId,
        metadata: { user_id: userId, plan_id: 'max' },
        subscription: 'sub_api_test_1',
        customer: 'cus_api_test_1',
      } },
    };
    const whPaid = await postWebhook(APP2, evtPaid);
    check('checkout.session.completed signé → 200 + applied',
      whPaid.status === 200 && whPaid.json?.applied === true,
      `status=${whPaid.status} applied=${whPaid.json?.applied} err=${whPaid.json?.error || ''}`);
    const afterWh = await get(APP, '/api/billing/subscription', cookieHeader);
    check('GET : plan max actif + id Stripe stocké',
      afterWh.json?.planId === 'max' &&
      afterWh.json?.subscription?.status === 'active' &&
      afterWh.json?.subscription?.stripeSubscriptionId === 'sub_api_test_1',
      `planId=${afterWh.json?.planId} sub=${afterWh.json?.subscription?.stripeSubscriptionId}`);

    const whReplay = await postWebhook(APP2, evtPaid);
    check('rejeu même event.id Stripe → applied=false, duplicate=true',
      whReplay.status === 200 && whReplay.json?.applied === false && whReplay.json?.duplicate === true,
      `applied=${whReplay.json?.applied} duplicate=${whReplay.json?.duplicate}`);

    const evtFail = {
      id: EV.whFail,
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_api_test_1', customer: 'cus_api_test_1' } },
    };
    const whFail = await postWebhook(APP2, evtFail);
    check('invoice.payment_failed signé → applied (retrouvé via sub stocké)',
      whFail.status === 200 && whFail.json?.applied === true,
      `applied=${whFail.json?.applied} ignored=${whFail.json?.ignored || ''}`);
    const afterWhFail = await get(APP, '/api/billing/subscription', cookieHeader);
    check('webhook échec : past_due + plan max conservé',
      afterWhFail.json?.subscription?.status === 'past_due' && afterWhFail.json?.planId === 'max',
      `status=${afterWhFail.json?.subscription?.status} planId=${afterWhFail.json?.planId}`);

    const evtUnknown = { id: EV.whUnknown, type: 'customer.created', data: { object: {} } };
    const whUnknown = await postWebhook(APP2, evtUnknown);
    check('type non métier → 200 accusé réception sans effet',
      whUnknown.status === 200 && whUnknown.json?.ignored === 'customer.created',
      `ignored=${whUnknown.json?.ignored}`);

    const evtNoUser = {
      id: EV.whNoUser,
      type: 'checkout.session.completed',
      data: { object: { metadata: { plan_id: 'pro' } } },
    };
    const whNoUser = await postWebhook(APP2, evtNoUser);
    check('checkout sans client_reference_id → ignoré proprement',
      whNoUser.status === 200 && typeof whNoUser.json?.ignored === 'string',
      `ignored=${whNoUser.json?.ignored}`);

    console.log('\n🔟  POST uniquement + les 10 événements Stripe (signés)');

    const getWh = await fetch(`${APP2}/api/stripe/webhook`, { method: 'GET' });
    check('GET /api/stripe/webhook → 405 (POST uniquement)',
      getWh.status === 405, `status=${getWh.status}`);

    // Ligne connue : sub_api_test_1 / cus_api_test_1 (checkout du bloc 9️⃣).
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;

    const evtCreated = {
      id: EV.whCreated,
      type: 'customer.subscription.created',
      data: { object: {
        id: 'sub_api_test_1', customer: 'cus_api_test_1', status: 'active',
        current_period_end: periodEnd,
        metadata: { user_id: userId },
        items: { data: [{ price: { id: 'price_inconnu_env' } }] },
      } },
    };
    const whCreated = await postWebhook(APP2, evtCreated);
    const afterCreated = await get(APP, '/api/billing/subscription', cookieHeader);
    check('customer.subscription.created signé → 200 + applied',
      whCreated.status === 200 && whCreated.json?.applied === true,
      `status=${whCreated.status} applied=${whCreated.json?.applied} ignored=${whCreated.json?.ignored || ''}`);
    check('abonnement créé : actif + plan max conservé + période future',
      afterCreated.json?.subscription?.status === 'active' &&
      afterCreated.json?.planId === 'max' &&
      new Date(afterCreated.json?.subscription?.currentPeriodEnd) > new Date(),
      `status=${afterCreated.json?.subscription?.status} planId=${afterCreated.json?.planId}`);

    const evtUpdated = {
      id: EV.whUpdated,
      type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_api_test_1', customer: 'cus_api_test_1', status: 'past_due',
        metadata: { user_id: userId },
      } },
    };
    const whUpdated = await postWebhook(APP2, evtUpdated);
    const afterUpdated = await get(APP, '/api/billing/subscription', cookieHeader);
    check('customer.subscription.updated (past_due) → applied',
      whUpdated.status === 200 && whUpdated.json?.applied === true,
      `applied=${whUpdated.json?.applied} ignored=${whUpdated.json?.ignored || ''}`);
    check('retard abonnement : past_due + plan max conservé (grâce)',
      afterUpdated.json?.subscription?.status === 'past_due' && afterUpdated.json?.planId === 'max',
      `status=${afterUpdated.json?.subscription?.status} planId=${afterUpdated.json?.planId}`);

    const evtAction = {
      id: EV.whAction,
      type: 'invoice.payment_action_required',
      data: { object: { subscription: 'sub_api_test_1', customer: 'cus_api_test_1' } },
    };
    const whAction = await postWebhook(APP2, evtAction);
    const afterAction = await get(APP, '/api/billing/subscription', cookieHeader);
    check('invoice.payment_action_required signé → applied (action client requise)',
      whAction.status === 200 && whAction.json?.applied === true,
      `applied=${whAction.json?.applied} ignored=${whAction.json?.ignored || ''}`);
    check('action requise : past_due sans perte de plan',
      afterAction.json?.subscription?.status === 'past_due' && afterAction.json?.planId === 'max',
      `status=${afterAction.json?.subscription?.status} planId=${afterAction.json?.planId}`);

    const evtRenew = {
      id: EV.whRenew,
      type: 'invoice.paid',
      data: { object: {
        subscription: 'sub_api_test_1', customer: 'cus_api_test_1', period_end: periodEnd,
      } },
    };
    const whRenew = await postWebhook(APP2, evtRenew);
    const afterRenewWh = await get(APP, '/api/billing/subscription', cookieHeader);
    check('invoice.paid signé → réactivation + période renouvelée',
      whRenew.status === 200 && whRenew.json?.applied === true &&
      afterRenewWh.json?.subscription?.status === 'active' &&
      afterRenewWh.json?.planId === 'max',
      `applied=${whRenew.json?.applied} status=${afterRenewWh.json?.subscription?.status}`);

    const evtAsyncOk = {
      id: EV.whAsyncOk,
      type: 'checkout.session.async_payment_succeeded',
      data: { object: {
        id: 'cs_api_async_1',
        client_reference_id: userId,
        metadata: { user_id: userId, plan_id: 'pro' },
        subscription: 'sub_api_test_1',
        customer: 'cus_api_test_1',
      } },
    };
    const whAsyncOk = await postWebhook(APP2, evtAsyncOk);
    const afterAsyncOk = await get(APP, '/api/billing/subscription', cookieHeader);
    check('checkout.session.async_payment_succeeded signé → plan pro actif',
      whAsyncOk.status === 200 && whAsyncOk.json?.applied === true &&
      afterAsyncOk.json?.planId === 'pro' &&
      afterAsyncOk.json?.subscription?.status === 'active',
      `applied=${whAsyncOk.json?.applied} planId=${afterAsyncOk.json?.planId}`);

    const evtAsyncFail = {
      id: EV.whAsyncFail,
      type: 'checkout.session.async_payment_failed',
      data: { object: { subscription: 'sub_api_test_1', customer: 'cus_api_test_1' } },
    };
    const whAsyncFail = await postWebhook(APP2, evtAsyncFail);
    const afterAsyncFail = await get(APP, '/api/billing/subscription', cookieHeader);
    check('checkout.session.async_payment_failed signé → past_due + plan conservé',
      whAsyncFail.status === 200 && whAsyncFail.json?.applied === true &&
      afterAsyncFail.json?.subscription?.status === 'past_due' &&
      afterAsyncFail.json?.planId === 'pro',
      `applied=${whAsyncFail.json?.applied} status=${afterAsyncFail.json?.subscription?.status}`);

    const evtExpired = {
      id: EV.whExpired,
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_api_expired_1', metadata: { user_id: userId } } },
    };
    const whExpired = await postWebhook(APP2, evtExpired);
    const afterExpired = await get(APP, '/api/billing/subscription', cookieHeader);
    check('checkout.session.expired → 200 accusé réception SANS effet',
      whExpired.status === 200 && typeof whExpired.json?.ignored === 'string' &&
      afterExpired.json?.subscription?.status === 'past_due' &&
      afterExpired.json?.planId === 'pro',
      `ignored=${whExpired.json?.ignored || ''}`);

    const evtDeleted = {
      id: EV.whDeleted,
      type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_api_test_1', customer: 'cus_api_test_1', status: 'canceled',
        cancel_at: periodEnd,
      } },
    };
    const whDeleted = await postWebhook(APP2, evtDeleted);
    const afterDeleted = await get(APP, '/api/billing/subscription', cookieHeader);
    check('customer.subscription.deleted signé → retour gratuit immédiat',
      whDeleted.status === 200 && whDeleted.json?.applied === true &&
      afterDeleted.json?.planId === 'essential' &&
      afterDeleted.json?.subscription?.status === 'canceled',
      `applied=${whDeleted.json?.applied} planId=${afterDeleted.json?.planId} status=${afterDeleted.json?.subscription?.status}`);

    console.log('\n1️⃣1️⃣  Tâche 4 : plan + période DÉDUITS du Price (sans metadata)');

    // (a) VRAIE session Checkout créée via l'API Stripe (prix existants,
    //     aucun nouveau produit/prix) → événement SANS metadata → le
    //     webhook RELIT la session et déduit plan + période du Price.
    await reset();
    const priceMonthly = env.STRIPE_PRO_PRICE_ID_MONTHLY;
    const csRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price]': priceMonthly,
        'line_items[0][quantity]': '1',
        success_url: `${APP}/parametres/abonnement?checkout=success`,
        cancel_url: `${APP}/tarifs`,
        client_reference_id: userId,
      }),
    });
    const csJson = await csRes.json().catch(() => ({}));
    check('session Checkout réelle créée pour le test (cs_…)',
      csRes.status === 200 && typeof csJson.id === 'string' && csJson.id.startsWith('cs_'),
      `status=${csRes.status} id=${csJson.id || csJson.error?.message || ''}`);

    if (csJson.id) {
      const evtDed = {
        id: EV.whDeduce,
        type: 'checkout.session.completed',
        data: { object: {
          id: csJson.id,
          client_reference_id: userId,
          subscription: 'sub_api_t4_1',
          customer: 'cus_api_t4_1',
          // SANS metadata : plan + période viennent DU PRICE relu.
        } },
      };
      const whDed = await postWebhook(APP2, evtDed);
      const afterDed = await get(APP, '/api/billing/subscription', cookieHeader);
      check('webhook SANS metadata → 200 + plan DÉDUIT du Price (pro)',
        whDed.status === 200 && whDed.json?.applied === true && afterDed.json?.planId === 'pro',
        `status=${whDed.status} applied=${whDed.json?.applied} planId=${afterDed.json?.planId} err=${whDed.json?.error || ''}`);
      check('billing_period = monthly DÉDUIT du Price relu dans la session',
        afterDed.json?.subscription?.billingPeriod === 'monthly',
        `billingPeriod=${afterDed.json?.subscription?.billingPeriod}`);
      check('stripe_price_id = Price env stocké (jamais inventé)',
        afterDed.json?.subscription?.stripePriceId === priceMonthly,
        `stored=${afterDed.json?.subscription?.stripePriceId} env=${priceMonthly}`);
    }

    // (b) Session INEXISTANTE (id cs_ inventé, pas de metadata) → repli
    //     PROPRE : 200, aucun plan inventé, période et prix inchangés.
    const beforeFake = await get(APP, '/api/billing/subscription', cookieHeader);
    const evtFake = {
      id: EV.whFake,
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_test_inexistant_404',
        client_reference_id: userId,
        subscription: 'sub_api_t4_2',
        customer: 'cus_api_t4_2',
      } },
    };
    const whFake = await postWebhook(APP2, evtFake);
    const afterFake = await get(APP, '/api/billing/subscription', cookieHeader);
    check('session injoignable → repli PROPRE (200, état strictement inchangé)',
      whFake.status === 200 && whFake.json?.applied === true &&
      afterFake.json?.planId === beforeFake.json?.planId &&
      afterFake.json?.subscription?.billingPeriod === beforeFake.json?.subscription?.billingPeriod &&
      afterFake.json?.subscription?.stripePriceId === beforeFake.json?.subscription?.stripePriceId,
      `status=${whFake.status} applied=${whFake.json?.applied} planId=${afterFake.json?.planId} err=${whFake.json?.error || ''}`);
  } catch (e) {
    console.error('\nERREUR FATALE :', e.message);
    fail++;
  } finally {
    if (extra) { try { extra.kill(); } catch { /* déjà mort */ } }
    await sleep(500);
    killPort(3001);
    // Nettoyage : compte de test supprimé (cascade abonnement + journal)
    // pour que la base reste propre d'un run à l'autre.
    if (userId) {
      try { await admin.auth.admin.deleteUser(userId); } catch { /* déjà supprimé */ }
    }
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
  console.log('════════════════════════════════════════════');
  process.exitCode = fail === 0 ? 0 : 1;
}

main();
