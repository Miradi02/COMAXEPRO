// COMAXE — Test de bout en bout (fullstack)
// Valide : inscription, trigger profil, connexion, RLS, CRUD, fonctions transactionnelles.
// À la fin : TOUT est supprimé → la base revient à ZÉRO.
// Usage : node scripts/e2e-test.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = {};
readFileSync(join(__dirname, '..', '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_EMAIL = `e2e-test-${Date.now()}@comaxe.test`;
const TEST_PASSWORD = 'ComaxeTest!2026';

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0;
let fail = 0;
let testUserId = null;

function check(label, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function cleanup() {
  console.log('\n🧹 NETTOYAGE FINAL (retour à zéro)...');
  try {
    if (testUserId) {
      const { error } = await admin.auth.admin.deleteUser(testUserId);
      console.log(`  ${error ? '⚠️ ' + error.message : '✅ Utilisateur de test supprimé (cascade sur toutes ses données)'}`);
    }
    // Double vérification : les 3 tables principales doivent être vides
    for (const t of ['products', 'sales', 'customers', 'expenses', 'debts', 'store_profiles', 'goal_targets']) {
      const { count } = await admin.from(t).select('*', { count: 'exact', head: true });
      console.log(`  ${count === 0 ? '✅' : '⚠️'} ${t}: ${count} ligne(s)`);
    }
  } catch (e) {
    console.log('  ⚠️ Erreur nettoyage:', e.message);
  }
}

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  COMAXE — TEST DE BOUT EN BOUT (FULLSTACK)');
  console.log('════════════════════════════════════════════\n');

  try {
    // ── 1. INSCRIPTION (admin, email confirmé) ──
    console.log('1️⃣  Inscription / création de compte');
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    check('Création du compte', !createErr && !!created?.user, createErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
    testUserId = created?.user?.id;
    if (!testUserId) throw new Error('Impossible de poursuivre sans utilisateur');

    // ── 2. TRIGGER : profil boutique + objectifs créés automatiquement ──
    console.log('\n2️⃣  Trigger automatique à l\'inscription');
    const { data: profiles } = await admin.from('store_profiles').select('*').eq('user_id', testUserId);
    check('store_profiles créé automatiquement', (profiles?.length ?? 0) === 1, `store_name="${profiles?.[0]?.store_name}"`);
    const { data: goals } = await admin.from('goal_targets').select('*').eq('user_id', testUserId);
    check('goal_targets créé automatiquement', (goals?.length ?? 0) === 1, `ventes cible=${goals?.[0]?.monthly_sales_target}`);

    // ── 3. CONNEXION (clé anon, comme dans l'app) ──
    console.log('\n3️⃣  Connexion email/mot de passe (clé anon)');
    const { error: loginErr } = await anon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    check('Connexion réussie', !loginErr, loginErr?.message || 'session active');
    const { data: sess } = await anon.auth.getSession();
    check('Session utilisateur disponible', !!sess.session, `uid=${sess.session?.user?.id?.slice(0, 8)}…`);

    // ── 4. CRUD PRODUIT avec RLS ──
    console.log('\n4️⃣  CRUD Produits (RLS activé)');
    const { data: prod, error: pErr } = await anon
      .from('products')
      .insert({ user_id: testUserId, name: 'Test Galaxy A15', category: 'Électronique', quantity: 10, min_threshold: 3, selling_price: 180, purchase_price: 130, created_at: new Date().toISOString().slice(0, 10), status: 'en_stock', total_sales_count: 0 })
      .select()
      .single();
    check('Insertion produit', !pErr && !!prod, pErr?.message || `id=${prod?.id?.slice(0, 8)}…`);

    const { data: readBack } = await anon.from('products').select('*').eq('id', prod?.id ?? '');
    check('Lecture du produit (RLS OK)', (readBack?.length ?? 0) === 1);

    const { error: upErr } = await anon.from('products').update({ quantity: 7, status: 'stock_faible' }).eq('id', prod?.id ?? '');
    check('Mise à jour (stock 7 → faible)', !upErr, upErr?.message || 'quantity=7, status=stock_faible');

    // ── 5. CLIENT ──
    console.log('\n5️⃣  Client');
    const { data: cust, error: cErr } = await anon
      .from('customers')
      .insert({ user_id: testUserId, name: 'Test Client', phone: '+243 000 000 000', avatar: '' })
      .select()
      .single();
    check('Insertion client', !cErr && !!cust, cErr?.message || `id=${cust?.id?.slice(0, 8)}…`);

    // ── 6. VENTE TRANSACTIONNELLE (process_sale) ──
    console.log('\n6️⃣  Vente transactionnelle (fonction process_sale)');
    const saleDate = new Date().toISOString().slice(0, 10);
    const { data: saleRes, error: saleErr } = await anon.rpc('process_sale', {
      p_code: 'VNT-E2E-001',
      p_date: `${saleDate}, 12:00`,
      p_customer_id: cust?.id ?? null,
      p_client_name: 'Test Client',
      p_client_phone: '+243 000 000 000',
      p_client_avatar: null,
      p_payment_method: 'especes',
      p_items: [{ product_id: prod?.id, product_name: 'Test Galaxy A15', quantity: 2, unit_price: 180, purchase_price: 130, total: 360 }],
      p_total_amount: 360,
      p_total_profit: 100,
    });
    check('Vente enregistrée (sale + items + stock + client)', !saleErr && !!saleRes?.sale_id, saleErr?.message || `sale_id=${saleRes?.sale_id?.slice(0, 8)}…`);

    const { data: afterSale } = await anon.from('products').select('quantity, status, total_sales_count').eq('id', prod?.id ?? '').single();
    check('Stock décrémenté (7 − 2 = 5)', afterSale?.quantity === 5, `quantity=${afterSale?.quantity}`);

    const { data: saleItems } = await anon.from('sale_items').select('*').eq('sale_id', saleRes?.sale_id ?? '');
    check('Ligne de vente créée', (saleItems?.length ?? 0) === 1, `total=${saleItems?.[0]?.total}`);

    const { data: custAfter } = await anon.from('customers').select('purchases_count, total_spent').eq('id', cust?.id ?? '').single();
    check('Statistiques client mises à jour', custAfter?.purchases_count === 1 && Number(custAfter?.total_spent) === 360, `achats=${custAfter?.purchases_count}, total=${custAfter?.total_spent}`);

    // ── 7. DETTE + PAIEMENT (fonctions) ──
    console.log('\n7️⃣  Dette et règlement (fonctions transactionnelles)');
    const { data: debtRes, error: dErr } = await anon.rpc('create_debt_with_history', {
      p_person_name: 'Test Débiteur',
      p_phone: '+243 111 111 111',
      p_email: null,
      p_initial_amount: 200,
      p_date: saleDate,
    });
    check('Dette créée avec historique', !dErr && !!debtRes?.debt_id, dErr?.message || `det_id=${debtRes?.debt_id?.slice(0, 8)}…`);

    const { data: payRes, error: payErr } = await anon.rpc('record_debt_payment_rpc', {
      p_debt_id: debtRes?.debt_id ?? null,
      p_amount: 50,
      p_note: 'Paiement partiel test',
      p_date: `${saleDate}, 13:00`,
    });
    check('Paiement partiel de 50 $', !payErr && payRes?.success === true, payErr?.message || `restant=${payRes?.remaining_amount}, statut=${payRes?.status}`);

    const { data: debtFinal } = await anon.from('debts').select('status, paid_amount, remaining_amount').eq('id', debtRes?.debt_id ?? '').single();
    check('État dette cohérent (partiellement_payee)', debtFinal?.status === 'partiellement_payee' && Number(debtFinal?.remaining_amount) === 150, `payé=${debtFinal?.paid_amount}, reste=${debtFinal?.remaining_amount}`);

    // ── 8. SUPPRESSION VENTE (restauration du stock) ──
    console.log('\n8️⃣  Suppression de vente (fonction delete_sale_data)');
    const { error: delErr } = await anon.rpc('delete_sale_data', { p_sale_id: saleRes?.sale_id ?? null });
    check('Vente supprimée', !delErr, delErr?.message || 'OK');
    const { data: afterDel } = await anon.from('products').select('quantity, status').eq('id', prod?.id ?? '').single();
    check('Stock restauré (5 + 2 = 7)', afterDel?.quantity === 7, `quantity=${afterDel?.quantity}, status=${afterDel?.status}`);

    // ── 9. ISOLATION RLS ──
    console.log('\n9️⃣  Isolation entre utilisateurs (RLS)');
    const { count: countAnon } = await anon.from('products').select('*', { count: 'exact', head: true });
    const { count: countAdmin } = await admin.from('products').select('*', { count: 'exact', head: true });
    check('L\'utilisateur ne voit que SES données', (countAnon ?? 0) === 1, `utilisateur=${countAnon}, total base=${countAdmin}`);

    // ── 10. PROFIL / OBJECTIFS ──
    console.log('\n🔟  Profil boutique et objectifs');
    const { error: profErr } = await anon
      .from('store_profiles')
      .upsert({ user_id: testUserId, store_name: 'Boutique Test', phone: '+243', email: TEST_EMAIL, address: 'Kinshasa', category: 'Électronique', currency: 'USD ($)' }, { onConflict: 'user_id' });
    const { data: profRead } = await anon.from('store_profiles').select('store_name').eq('user_id', testUserId).maybeSingle();
    check('Mise à jour du profil boutique', !profErr && profRead?.store_name === 'Boutique Test', profErr?.message || `store_name=${profRead?.store_name}`);

    const { data: goalUpd, error: goalErr } = await anon.from('goal_targets').update({ monthly_sales_target: 5000 }).eq('user_id', testUserId).select('monthly_sales_target').maybeSingle();
    check('Mise à jour des objectifs', !goalErr && Number(goalUpd?.monthly_sales_target) === 5000, goalErr?.message || `cible=${goalUpd?.monthly_sales_target}`);

    await anon.auth.signOut();
  } catch (e) {
    fail++;
    console.log(`\n❌ ERREUR FATALE: ${e.message}`);
  } finally {
    await cleanup();
    console.log('\n════════════════════════════════════════════');
    console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
    console.log('════════════════════════════════════════════');
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
