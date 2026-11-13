// COMAXE — Test RÉEL des refus serveur du système d'abonnement (phase 1).
// Vérifie que la base REFUSE réellement les opérations interdites (triggers),
// même sans frontend : Essential limite, déblocage après upgrade, verrou
// Objectifs, plan demandé ≠ plan actif, écriture client impossible.
// Usage : node scripts/billing-db-test.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env comaxe d'abord (clés NEXT_PUBLIC propres), puis .env racine (service role).
const env = {};
for (const rel of [['..', '.env'], ['..', '..', '.env']]) {
  try {
    readFileSync(join(__dirname, ...rel), 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    });
  } catch { /* absent */ }
}

const URL = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^(https:\/\/[^/]+\.supabase\.co).*$/, '$1');
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const EMAIL = `billing-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

let pass = 0; let fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.log(`  🔴 ${label}${detail ? ` — ${detail}` : ''}`); }
};

async function tryInsert(table, row) {
  const { error } = await anon.from(table).insert(row);
  return { ok: !error, error };
}

// Remplit une table jusqu'à la limite (renvoie nb insérés + 1er refus éventuel)
async function fill(table, makeRow, times) {
  let ok = 0; let firstErr = null;
  for (let i = 0; i < times; i++) {
    const r = await tryInsert(table, makeRow(i));
    if (r.ok) ok++;
    else { firstErr = r.error; break; }
  }
  return { ok, firstErr };
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  TEST RÉEL — Refus serveur des limites d\'abonnement');
  console.log(`  Compte : ${EMAIL}`);
  console.log('════════════════════════════════════════════════════════\n');

  let userId = null;
  try {
    // ── 1. Création du compte (admin, email_confirm) + session réelle ──
    // Le signup public refuse désormais les domaines de test (.test) — le
    // chemin admin évite aussi le rate-limit signup serré. Les triggers
    // d'inscription (handle_new_user + billing) restent testés : ils sont
    // déclenchés par l'INSERT sur auth.users, quelle que soit la voie.
    console.log('1️⃣  Création du compte de test');
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    check('createUser sans erreur', !createErr, createErr?.message);
    userId = created?.user?.id ?? null;
    const { error: signErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Session utilisateur établie', !signErr, signErr?.message);

    // ── 2. Abonnement par défaut + objectifs seedés ──
    console.log('\n2️⃣  Abonnement par défaut et seed');
    const { data: sub } = await admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    check('Trigger d\'inscription : abonnement Essential créé', sub?.plan_id === 'essential' && sub?.status === 'active',
      `plan=${sub?.plan_id} status=${sub?.status}`);
    check('billing_period NULL par défaut (offre gratuite sans Stripe)',
      sub?.billing_period === null || sub?.billing_period === undefined, `billing_period=${sub?.billing_period}`);
    const { count: goalCount } = await admin.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    check('Seed handle_new_user : 4 objectifs créés (non impacté par le verrou)', goalCount === 4, `count=${goalCount}`);

    // ── 3. L'utilisateur ne peut PAS se promouvoir lui-même ──
    console.log('\n3️⃣  Écriture client sur l\'abonnement (doit être impossible)');
    await anon.from('subscriptions').update({ plan_id: 'max' }).eq('user_id', userId);
    const { data: afterHack } = await anon.from('subscriptions').select('plan_id').eq('user_id', userId).maybeSingle();
    check('UPDATE client ignoré (plan toujours essential)', afterHack?.plan_id === 'essential', `plan=${afterHack?.plan_id}`);
    await anon.from('subscriptions').update({ billing_period: 'yearly' }).eq('user_id', userId);
    const { data: afterPeriodHack } = await anon.from('subscriptions').select('billing_period').eq('user_id', userId).maybeSingle();
    check('UPDATE client billing_period ignoré (RLS, reste NULL)',
      afterPeriodHack?.billing_period == null, `billing_period=${afterPeriodHack?.billing_period}`);
    const { error: evErr } = await anon.from('subscription_events').insert({ user_id: userId, event_id: 'forged-1', event_type: 'test' });
    check('INSERT client sur subscription_events refusé (RLS)', !!evErr, evErr?.message ?? 'aucune erreur');

    // Contrainte CHECK de la colonne (valeurs autorisées uniquement)
    const { error: badPeriod } = await admin.from('subscriptions')
      .update({ billing_period: 'weekly' }).eq('user_id', userId);
    check('CHECK billing_period : « weekly » REFUSÉ par la base', !!badPeriod, badPeriod?.message ?? 'accepté (KO)');
    const { error: okPeriod } = await admin.from('subscriptions')
      .update({ billing_period: 'monthly' }).eq('user_id', userId);
    check('CHECK billing_period : « monthly » accepté', !okPeriod, okPeriod?.message ?? '');
    const { error: okPeriod2 } = await admin.from('subscriptions')
      .update({ billing_period: 'yearly' }).eq('user_id', userId);
    check('CHECK billing_period : « yearly » accepté', !okPeriod2, okPeriod2?.message ?? '');
    await admin.from('subscriptions').update({ billing_period: null }).eq('user_id', userId);

    // ── 4. ESSENTIAL : refus à la limite (produits, clients, ventes, dettes) ──
    console.log('\n4️⃣  ESSENTIAL — refus aux limites');

    const prod = await fill('products', (i) => ({ name: `Produit ${i}` }), 40);
    check('Produits : 10 créés puis refus', prod.ok === 10 && !!prod.firstErr, `ok=${prod.ok} refus=${prod.firstErr?.message ?? '(aucun)'}`);
    check('Message refus produit (10 produits / Essential)',
      !!prod.firstErr && prod.firstErr.message.includes('limite de 10 produits'), prod.firstErr?.message ?? '');
    const { count: prodCount } = await admin.from('products').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    check('Compteur produits = 10', prodCount === 10, `count=${prodCount}`);

    const cust = await fill('customers', (i) => ({ name: `Client ${i}` }), 40);
    check('Clients : 15 créés puis refus', cust.ok === 15 && !!cust.firstErr, `ok=${cust.ok} refus=${cust.firstErr?.message ?? '(aucun)'}`);
    check('Message refus client (15 clients)',
      !!cust.firstErr && cust.firstErr.message.includes('limite de 15 clients'), cust.firstErr?.message ?? '');

    // Une vente de l'AVANT-MOIS ne doit pas compter : preuve du comptage par mois civil.
    const oldSale = await tryInsert('sales', {
      code: 'OLD-1', date: '2026/10/05, 09:00', client_name: 'Client',
      total_amount: 5, created_at_ts: '2026-10-05T09:00:00+00:00',
    });
    check('Vente du mois précédent insérée (hors comptage)', oldSale.ok, oldSale.error?.message);
    const sale = await fill('sales', (i) => ({
      code: `BLG-${i}`, date: '2026/11/07, 10:00', client_name: 'Client test', total_amount: 10,
    }), 60);
    check('Ventes : 15 créées ce mois-ci puis refus (l\'ancienne n\'a pas compté)', sale.ok === 15 && !!sale.firstErr,
      `ok=${sale.ok} refus=${sale.firstErr?.message ?? '(aucun)'}`);
    check('Message refus vente (15 ventes par mois)',
      !!sale.firstErr && sale.firstErr.message.includes('limite de 15 ventes par mois'), sale.firstErr?.message ?? '');

    // Une dette DÉJÀ SOLDÉE ne doit pas compter : preuve du filtre solde > 0.
    const paidDebt = await tryInsert('debts', {
      person_name: 'Débiteur soldé', date: '2026/11/01', initial_amount: 10, paid_amount: 10,
      remaining_amount: 0, status: 'payee',
    });
    check('Dette soldée insérée (hors comptage actif)', paidDebt.ok, paidDebt.error?.message);
    const debt = await fill('debts', (i) => ({
      person_name: `Débiteur ${i}`, date: '2026/11/07', initial_amount: 20, remaining_amount: 20,
    }), 30);
    check('Dettes : 5 actives créées puis refus (la soldée n\'a pas compté)', debt.ok === 5 && !!debt.firstErr,
      `ok=${debt.ok} refus=${debt.firstErr?.message ?? '(aucun)'}`);
    check('Message refus dette (5 dettes actives)',
      !!debt.firstErr && debt.firstErr.message.includes('limite de 5 dettes actives'), debt.firstErr?.message ?? '');

    // ── 5. Verrou fonctionnel « Objectifs » ──
    console.log('\n5️⃣  ESSENTIAL — fonctionnalité Objectifs verrouillée');
    const goal = await tryInsert('goals', { metric: 'sales', title: 'Objectif test', target: 500 });
    check('INSERT goal refusé en Essential', !goal.ok, goal.error?.message ?? 'inséré !');
    check('Message verrou Objectifs', !!goal.error && goal.error.message.includes('Objectifs'), goal.error?.message ?? '');

    // ── 6. Plan DEMANDÉ ≠ plan ACTIF ──
    console.log('\n6️⃣  Plan demandé ≠ plan actif');
    await admin.from('subscriptions').update({ requested_plan_id: 'max' }).eq('user_id', userId);
    const afterReq = await tryInsert('products', { name: 'Produit après demande' });
    check('Clic « S\'abonner Max » sans paiement : toujours refusé (plan actif = essential)', !afterReq.ok,
      afterReq.error?.message ?? 'inséré !');
    const { data: subReq } = await admin.from('subscriptions').select('plan_id, requested_plan_id').eq('user_id', userId).maybeSingle();
    check('requested_plan_id=max conservé, plan_id=essential', subReq?.requested_plan_id === 'max' && subReq?.plan_id === 'essential',
      JSON.stringify(subReq));

    // ── 7. Upgrade PRO (paiement confirmé côté serveur) → tout débloqué ──
    console.log('\n7️⃣  Upgrade PRO — tout devient possible');
    await admin.from('subscriptions').update({ plan_id: 'pro', requested_plan_id: null, status: 'active' }).eq('user_id', userId);
    const p31 = await tryInsert('products', { name: 'Produit 11 (Pro)' });
    const c31 = await tryInsert('customers', { name: 'Client 16 (Pro)' });
    const s51 = await tryInsert('sales', { code: 'PRO-16', date: '2026/11/07, 11:00', client_name: 'Client', total_amount: 10 });
    const d21 = await tryInsert('debts', { person_name: 'Débiteur 6 (Pro)', date: '2026/11/07', initial_amount: 10, remaining_amount: 10 });
    const gOk = await tryInsert('goals', { metric: 'profit', title: 'Objectif Pro', target: 1000 });
    check('Produit 11 accepté en Pro', p31.ok, p31.error?.message);
    check('Client 16 accepté en Pro', c31.ok, c31.error?.message);
    check('Vente 16 acceptée en Pro', s51.ok, s51.error?.message);
    check('Dette 6 acceptée en Pro', d21.ok, d21.error?.message);
    check('Goal accepté en Pro', gOk.ok, gOk.error?.message);

    // ── 8. Statuts d'abonnement ──
    console.log('\n8️⃣  Statuts : pending conserve le plan, canceled retour au gratuit');
    await admin.from('subscriptions').update({ status: 'pending' }).eq('user_id', userId);
    const pend = await tryInsert('products', { name: 'Produit pending' });
    check('pending conserve le plan Pro', pend.ok, pend.error?.message);

    await admin.from('subscriptions').update({ status: 'canceled' }).eq('user_id', userId);
    const canc = await tryInsert('products', { name: 'Produit canceled' });
    check('canceled → retour Essential (produit suivant de nouveau refusé)', !canc.ok, canc.error?.message ?? 'inséré !');
    check('Message après cancellation (offre Essential)', !!canc.error && canc.error.message.includes('Essential'), canc.error?.message ?? '');

    const { data: subFinal } = await admin.from('subscriptions').select('plan_id, status').eq('user_id', userId).maybeSingle();
    check('Ligne conservée (plan_id pro historique, status canceled)', subFinal?.plan_id === 'pro' && subFinal?.status === 'canceled',
      JSON.stringify(subFinal));
  } finally {
    // ── Nettoyage (suppression en cascade) ──
    if (userId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      console.log(`\n🧹 Nettoyage : ${delErr ? '⚠️ ' + delErr.message : 'compte supprimé (cascade)'}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${pass} OK / ${fail} ÉCHEC`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
