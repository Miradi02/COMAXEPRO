// COMAXE — Sondage B : le RPC create_debt_with_history crée-t-il RÉELLEMENT
// la vente, le client et l'historique aujourd'hui ?
// Crée un compte via l'API admin (AUCUN email envoyé), obtient une session,
// appelle le RPC, vérifie, puis supprime tout. Usage : node scripts/probe-rpc.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const rel of [['..', '.env'], ['..', '..', '.env']]) {
  try {
    readFileSync(join(__dirname, ...rel), 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    });
  } catch { /* absent */ }
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = 'mfqhhvzpwoepsjjhpbwz';
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const URL = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^(https:\/\/[^/]+\.supabase\.co).*$/, '$1');

async function sql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  TEST RÉEL — le RPC de dette crée-t-il la vente ?');
  console.log('════════════════════════════════════════════════════════\n');

  const stamp = Date.now();
  const EMAIL = `rpc-probe-${stamp}@comaxe-probe.local`;
  const PASS = 'ComaxeProbe!2026';
  let uid = null;

  try {
    // ── 1. Compte via API admin : confirmé d'office, AUCUN email ──
    console.log('1. Création du compte de test (API admin — aucun email envoyé)');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASS,
      email_confirm: true,
      user_metadata: { store_name: 'Probe RPC' },
    });
    if (cErr) { console.log(`   🔴 ${cErr.message}`); return; }
    uid = created.user.id;
    console.log(`   ✅ user_id = ${uid}`);

    // ── 2. Session réelle (pour que auth.uid() fonctionne) ──
    console.log("\n2. Ouverture de session (clé anon, comme le fait l'app)");
    const { data: ses, error: sErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASS });
    if (sErr) { console.log(`   🔴 ${sErr.message}`); return; }
    await anon.auth.setSession({ access_token: ses.session.access_token, refresh_token: ses.session.refresh_token });
    console.log('   ✅ session ouverte');

    // ── 3. Appel du RPC, SANS produit ──
    console.log('\n3. Appel create_debt_with_history (montant 123, AUCUN produit)');
    const rpc = await anon.rpc('create_debt_with_history', {
      p_person_name: 'ZZ Probe RPC',
      p_phone: '+243 000 000 000',
      p_email: null,
      p_initial_amount: 123,
      p_date: '28/10/2026',
      p_product_id: null,
      p_product_name: 'Vente à crédit',
      p_quantity: 1,
      p_code: `VNT-PROBE-${stamp}`,
    });
    if (rpc.error) console.log(`   🔴 ERREUR RPC : ${rpc.error.message}`);
    else console.log(`   ✅ retour = ${JSON.stringify(rpc.data)}`);

    // ── 4. Ce qui a RÉELLEMENT été écrit ──
    console.log('\n4. Vérification de ce qui a été écrit :');
    const q = async (label, query) => {
      const r = await sql(query);
      console.log(`   ${label.padEnd(30)}: ${JSON.stringify(r.data)}`);
    };
    await q('sales (total / liées)', `SELECT count(*) AS total, count(*) FILTER (WHERE debt_id IS NOT NULL) AS liees FROM sales WHERE user_id = '${uid}';`);
    await q('customers', `SELECT count(*) AS nb, string_agg(name, ', ') AS noms FROM customers WHERE user_id = '${uid}';`);
    await q('debts', `SELECT count(*) AS nb, product_name FROM debts WHERE user_id = '${uid}';`);
    await q('debt_history', `SELECT count(*) AS nb, string_agg(type, ', ') AS types FROM debt_history WHERE user_id = '${uid}';`);
    await q('sale_items', `SELECT count(*) AS nb, string_agg(product_name, ', ') AS produits FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.user_id = '${uid}';`);

    // ── 5. Verdict ──
    console.log('\n════════════════════════════════════════════════════════');
    const v = await sql(`SELECT (SELECT count(*) FROM sales WHERE user_id='${uid}' AND debt_id IS NOT NULL) AS ventes_liees, (SELECT count(*) FROM customers WHERE user_id='${uid}') AS clients, (SELECT count(*) FROM debt_history WHERE user_id='${uid}') AS historique;`);
    const row = Array.isArray(v.data) ? v.data[0] : null;
    if (row) {
      console.log(`  Résultat : ventes liées=${row.ventes_liees} | clients=${row.clients} | historique=${row.historique}`);
      if (Number(row.ventes_liees) >= 1) console.log('  🟢 LE RPC FONCTIONNE : la vente liée est bien créée.');
      else console.log('  🔴 LE RPC NE CRÉE PAS LA VENTE (ou échoue silencieusement).');
      if (Number(row.historique) >= 1) console.log("  🟢 L'historique est bien écrit.");
      else console.log('  🔴 Aucune écriture dans debt_history.');
      if (Number(row.clients) >= 1) console.log('  🟢 Le client est bien créé.');
      else console.log('  🔴 Aucun client créé.');
    }
    console.log('════════════════════════════════════════════════════════');
  } finally {
    // ── 6. Nettoyage garanti ──
    if (uid) {
      const del = await sql(`DELETE FROM auth.users WHERE id = '${uid}';`);
      console.log(`\n6. Nettoyage : ${del.status === 200 || del.status === 201 ? '✅ compte supprimé (cascade)' : '⚠️ ' + JSON.stringify(del.data).substring(0, 200)}`);
    }
  }
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
