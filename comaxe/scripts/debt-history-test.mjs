// COMAXE — Test de l'historique des dettes (Tâche 4)
// Vérifie que TOUS les événements sont journalisés et lus comme dans l'app :
//   création → paiement partiel (montant + dette concernée) → paiement total
// Flux réel : compte de test → JWT → mêmes RPC et même requête que CommerceContext.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(join(__dirname, '..', '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = `debt-hist-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const PERSON = 'Jean Créancier';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

console.log('══════════════════════════════════════════');
console.log('  TEST HISTORIQUE DES DETTES (création + paiements)');
console.log('══════════════════════════════════════════\n');

try {
  // ── 1. Compte de test ──
  console.log('1️⃣  Compte de test');
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Hist', last_name: 'Testeur' },
  });
  check('Compte créé (sans quota email)', !cErr && !!created?.user, cErr?.message || '');
  userId = created?.user?.id;
  if (!userId) throw new Error('Abort');

  // ── 2. Connexion → JWT réel ──
  console.log('\n2️⃣  Connexion (JWT utilisateur)');
  const user = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: lErr } = await user.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  check('Connexion réussie', !lErr, lErr?.message || 'JWT obtenu');

  // ── 3. Création de dette (RPC identique à l'app) ──
  console.log('\n3️⃣  Événement 1 : CRÉATION');
  const { data: createdDebt, error: e1 } = await user.rpc('create_debt_with_history', {
    p_person_name: PERSON,
    p_phone: '+243 81 000 111 222',
    p_email: null,
    p_initial_amount: 1000,
    p_date: "Aujourd'hui, 10:00",
  });
  check('RPC création OK (authentifié)', !e1 && !!createdDebt?.debt_id, e1?.message || `id=${createdDebt?.debt_id?.slice(0, 8)}…`);
  const debtId = createdDebt?.debt_id;
  if (!debtId) throw new Error('Abort');

  // ── 4. Paiement PARTIEL 400 ──
  console.log('\n4️⃣  Événement 2 : PAIEMENT PARTIEL (400)');
  const { data: pay1, error: e2 } = await user.rpc('record_debt_payment_rpc', {
    p_debt_id: debtId, p_amount: 400, p_note: 'Acompte client', p_date: "Aujourd'hui, 11:00",
  });
  check('RPC partiel OK', !e2 && pay1?.success !== false, e2?.message || pay1?.error || `reste=${pay1?.remaining_amount}`);

  // ── 5. Paiement TOTAL (solde 600) ──
  console.log('\n5️⃣  Événement 3 : PAIEMENT TOTAL (600)');
  const { data: pay2, error: e3 } = await user.rpc('record_debt_payment_rpc', {
    p_debt_id: debtId, p_amount: 600, p_note: 'Solde final', p_date: "Aujourd'hui, 12:00",
  });
  check('RPC total OK', !e3 && pay2?.success !== false, e3?.message || pay2?.error || `statut=${pay2?.status}`);

  // ── 6. Lecture avec la requête EXACTE de CommerceContext ──
  console.log('\n6️⃣  Lecture comme dans CommerceContext');
  const { data: rows, error: e4 } = await user
    .from('debt_history').select('*').order('created_at_ts', { ascending: false });
  check('Requête .order(created_at_ts) sans erreur', !e4, e4?.message || 'colonne disponible');
  const mine = (rows || []).filter((r) => r.debt_id === debtId);
  check('3 événements journalisés (création + 2 paiements)', mine.length === 3, `trouvé(s): ${mine.length}`);

  // Ordre DESC = plus récent en premier : total, partiel, création
  const desc = mine; // déjà en created_at_ts DESC
  const [newest, middle, oldest] = desc;
  check('Le plus récent = paiement total', newest?.type === 'paiement' && Number(newest?.remaining_amount) === 0, `type=${newest?.type} reste=${newest?.remaining_amount}`);
  check('Milieu = paiement partiel', middle?.type === 'paiement' && Number(middle?.payment_amount) === 400 && middle?.status === 'partiellement_payee', `montant=${middle?.payment_amount} statut=${middle?.status}`);
  check('Le plus ancien = création', oldest?.type === 'creation' && Number(oldest?.initial_amount) === 1000 && oldest?.status === 'non_payee', `type=${oldest?.type} init=${oldest?.initial_amount}`);

  // ── 7. Exigence « montant + dette concernée » sur chaque paiement ──
  console.log('\n7️⃣  Montant + dette concernée sur chaque événement');
  const p1 = middle, p2 = newest;
  check('Paiement partiel : montant 400 visible', Number(p1?.payment_amount) === 400, `=${p1?.payment_amount}`);
  check('Paiement partiel : total cumulé 400 / reste 600', Number(p1?.total_paid) === 400 && Number(p1?.remaining_amount) === 600, `total=${p1?.total_paid} reste=${p1?.remaining_amount}`);
  check('Paiement total : montant 600 visible', Number(p2?.payment_amount) === 600, `=${p2?.payment_amount}`);
  check('Paiement total : total cumulé 1000 / reste 0 → payee', Number(p2?.total_paid) === 1000 && Number(p2?.remaining_amount) === 0 && p2?.status === 'payee', `total=${p2?.total_paid} statut=${p2?.status}`);
  check('Chaque événement porte la dette concernée (person_name)', mine.every((r) => r.person_name === PERSON), mine[0]?.person_name);
  check('Chaque événement porte le montant initial de la dette', mine.every((r) => Number(r.initial_amount) === 1000), '');

  // ── 8. Statut de la dette après totalisation ──
  const { data: debtRow } = await user.from('debts').select('status, paid_amount, remaining_amount').eq('id', debtId).single();
  check('Dette soldée automatiquement (payee / payé 1000 / reste 0)', debtRow?.status === 'payee' && Number(debtRow?.paid_amount) === 1000 && Number(debtRow?.remaining_amount) === 0, `statut=${debtRow?.status}`);

  // ── 9. Refus d'une dette inexistante (réponse structurée) ──
  const { data: bogus } = await user.rpc('record_debt_payment_rpc', {
    p_debt_id: '00000000-0000-0000-0000-000000000000', p_amount: 10, p_note: null, p_date: "Aujourd'hui, 13:00",
  });
  check('Dette inexistante → success=false (pas de fausse écriture)', bogus?.success === false, JSON.stringify(bogus));

  // ── 10. VENTE AUTOMATIQUE LIÉE + PRODUIT ENDETTÉ (Tâche 5) ──
  console.log('\n8️⃣  Vente automatique liée au produit endetté');

  const { data: prod, error: pErr } = await user
    .from('products')
    .insert({
      name: 'Produit Dette Test', category: 'Autres', quantity: 10,
      selling_price: 250, purchase_price: 150, status: 'en_stock', total_sales_count: 0,
    })
    .select()
    .single();
  check('Produit de test créé (stock 10, vente 250, achat 150)', !pErr && !!prod, pErr?.message || '');
  if (!prod) throw new Error('Abort : produit introuvable');

  // 10a. La dette SANS produit a quand même créé une vente (libellé générique)
  const { data: saleA } = await user.from('sales').select('id').eq('debt_id', debtId).maybeSingle();
  const { data: itemsA } = await user.from('sale_items').select('*').eq('sale_id', saleA?.id ?? '00000000-0000-0000-0000-000000000000');
  check(
    'Dette simple → vente automatique créée (libellé générique)',
    !!saleA && itemsA?.length === 1 && itemsA[0].product_name === 'Vente à crédit' && Number(itemsA[0].total) === 1000,
    `sale=${saleA ? 'oui' : 'non'} item=${itemsA?.[0]?.product_name} total=${itemsA?.[0]?.total}`
  );

  // 10b. Dette AVEC produit → vente liée + stock + client
  const { data: b, error: eb } = await user.rpc('create_debt_with_history', {
    p_person_name: PERSON, p_phone: '+243 81 000 111 222', p_email: null,
    p_initial_amount: 500, p_date: "Aujourd'hui, 15:00",
    p_product_id: prod.id, p_product_name: 'Produit Dette Test', p_quantity: 2, p_code: 'VNT-TEST5000',
  });
  check('RPC création avec produit OK', !eb && b?.success !== false && !!b?.sale_id, eb?.message || `sale=${b?.sale_id?.slice(0, 8)}…`);
  const debtB = b?.debt_id, saleB = b?.sale_id;

  const { data: dRow } = await user.from('debts').select('*').eq('id', debtB).single();
  check(
    'Dette liée au produit endetté (id + nom + qté 2)',
    dRow?.product_id === prod.id && dRow?.product_name === 'Produit Dette Test' && dRow?.quantity === 2,
    `prod=${dRow?.product_name} qté=${dRow?.quantity}`
  );

  const { data: sRow } = await user.from('sales').select('*').eq('debt_id', debtB).single();
  check(
    'Vente automatique : montant 500 = dette, code transmis, personne endettée',
    !!sRow && Number(sRow.total_amount) === 500 && sRow.code === 'VNT-TEST5000' && sRow.client_name === PERSON,
    `montant=${sRow?.total_amount} code=${sRow?.code}`
  );

  const { data: itemsB } = await user.from('sale_items').select('*').eq('sale_id', saleB);
  check(
    'Ligne de vente = produit endetté × 2 (unit 250, total 500)',
    itemsB?.length === 1 && itemsB[0].product_id === prod.id && itemsB[0].quantity === 2 &&
      Number(itemsB[0].unit_price) === 250 && Number(itemsB[0].total) === 500,
    JSON.stringify(itemsB?.[0] ?? null)
  );

  const { data: pRow } = await user.from('products').select('*').eq('id', prod.id).single();
  check(
    'Stock décrémenté 10 → 8 (statut en_stock, ventes +2)',
    pRow?.quantity === 8 && pRow?.status === 'en_stock' && pRow?.total_sales_count === 2,
    `stock=${pRow?.quantity} statut=${pRow?.status} ventes=${pRow?.total_sales_count}`
  );

  const { data: cRow } = await user.from('customers').select('*').eq('name', PERSON).single();
  check(
    'Client mis à jour (2 achats, 1500 cumulés)',
    cRow?.purchases_count === 2 && Number(cRow?.total_spent) === 1500,
    `achats=${cRow?.purchases_count} total=${cRow?.total_spent}`
  );

  const { data: hB } = await user.from('debt_history').select('*').eq('debt_id', debtB).eq('type', 'creation').single();
  check(
    'Historique : événement création porte le produit + quantité',
    hB?.product_name === 'Produit Dette Test' && hB?.quantity === 2,
    `${hB?.product_name} ×${hB?.quantity}`
  );

  // 10c. Contrôle de stock côté RPC
  const { data: rej } = await user.rpc('create_debt_with_history', {
    p_person_name: PERSON, p_phone: '', p_email: null,
    p_initial_amount: 100, p_date: "Aujourd'hui, 16:00",
    p_product_id: prod.id, p_product_name: 'Produit Dette Test', p_quantity: 100, p_code: 'VNT-TESTREJ',
  });
  check('Stock insuffisant refusé (qté 100 > 8 restants)', rej?.success === false && String(rej?.error).includes('Stock insuffisant'), rej?.error || 'accepté !');
  const { count: dCount } = await user.from('debts').select('id', { count: 'exact', head: true }).eq('person_name', PERSON);
  check('Aucune dette créée lors du refus', dCount === 2, `dettes=${dCount}`);

  // 10d. Suppression de la vente liée restaure stock + client (logique de deleteDebt)
  const { error: dsErr } = await user.rpc('delete_sale_data', { p_sale_id: saleB });
  check('delete_sale_data exécuté', !dsErr, dsErr?.message || 'ok');
  const { data: pRow2 } = await user.from('products').select('*').eq('id', prod.id).single();
  check('Stock restauré 8 → 10 (ventes remises à 0)', pRow2?.quantity === 10 && pRow2?.total_sales_count === 0, `stock=${pRow2?.quantity} ventes=${pRow2?.total_sales_count}`);
  const { data: saleBgone } = await user.from('sales').select('id').eq('id', saleB).maybeSingle();
  check('Vente liée supprimée', !saleBgone);

  await user.from('debts').delete().eq('id', debtB);
  const { data: hLeft } = await user.from('debt_history').select('id').eq('debt_id', debtB);
  check('Historique de la dette supprimé en cascade', (hLeft?.length ?? 0) === 0, `${hLeft?.length} reste(s)`);
  const { data: cRow2 } = await user.from('customers').select('*').eq('name', PERSON).single();
  check('Stats client restaurées (1 achat, 1000)', cRow2?.purchases_count === 1 && Number(cRow2?.total_spent) === 1000, `achats=${cRow2?.purchases_count} total=${cRow2?.total_spent}`);
} catch (err) {
  check('Exception fatale', false, err.message);
} finally {
  // ── Nettoyage : suppression du compte → cascade dettes + historique ──
  if (userId) {
    const { error: dErr } = await admin.auth.admin.deleteUser(userId);
    console.log(`\n8️⃣  Nettoyage : compte ${dErr ? 'ÉCHEC ' + dErr.message : 'supprimé (cascade)'}`);
  }
  const { count } = await admin.from('debt_history').select('id', { count: 'exact', head: true }).eq('person_name', PERSON);
  const { count: cDebts } = await admin.from('debts').select('id', { count: 'exact', head: true }).eq('person_name', PERSON);
  const { count: cProds } = await admin.from('products').select('id', { count: 'exact', head: true }).eq('name', 'Produit Dette Test');
  const { count: cCust } = await admin.from('customers').select('id', { count: 'exact', head: true }).eq('name', PERSON);
  check(
    'Aucune donnée de test restante',
    (count ?? 0) === 0 && (cDebts ?? 0) === 0 && (cProds ?? 0) === 0 && (cCust ?? 0) === 0,
    `hist=${count} dettes=${cDebts} produits=${cProds} clients=${cCust}`
  );
}

console.log(`\n════════════════════════════════════════`);
console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
console.log('════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
