// COMAXE — Deux sondes :
//   A) Où Supabase stocke-t-il mailer_autoconfirm ? (réparable en SQL ?)
//   B) Le RPC create_debt_with_history fonctionne-t-il RÉELLEMENT aujourd'hui ?
// Usage : node scripts/probe-auth-and-rpc.mjs
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

const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  SONDAGE A — où vit la config Auth ?');
  console.log('════════════════════════════════════════════════════════\n');

  const tables = await sql(`
    SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_schema IN ('auth','public')
      AND (table_name ILIKE '%config%' OR table_name ILIKE '%instance%' OR table_name ILIKE '%setting%')
    ORDER BY table_schema, table_name;
  `);
  console.log('Tables de config potentielles :');
  console.log(JSON.stringify(tables.data, null, 2));

  const inst = await sql(`SELECT * FROM auth.instances LIMIT 1;`);
  console.log('\nauth.instances :');
  console.log(typeof inst.data === 'string' ? inst.data.substring(0, 300) : JSON.stringify(inst.data, null, 2).substring(0, 1200));

  // ── SONDAGE B : test réel du RPC ──
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  SONDAGE B — le RPC crée-t-il vraiment la vente ?');
  console.log('════════════════════════════════════════════════════════\n');

  const stamp = Date.now();
  const EMAIL = `rpc-probe-${stamp}@example.com`;
  console.log(`1. Création d'un compte de test : ${EMAIL}`);

  const { data: su, error: suErr } = await anon.auth.signUp({ email: EMAIL, password: 'ComaxeProbe!2026' });
  if (suErr) { console.log(`   🔴 ${suErr.message}`); return; }
  const uid = su.user?.id;
  console.log(`   user_id = ${uid}`);
  console.log(`   session retournée = ${su.session ? 'OUI (autoconfirm actif)' : 'NON (confirmation requise)'}`);

  // On a besoin d'une session authentifiée pour auth.uid()
  let client = anon;
  if (!su.session) {
    console.log('   ⚠️ pas de session → test impossible en anon');
    return;
  }
  client = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await client.auth.setSession({ access_token: su.session.access_token, refresh_token: su.session.refresh_token });

  console.log('\n2. Appel du RPC create_debt_with_history (SANS produit)…');
  const rpc = await client.rpc('create_debt_with_history', {
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
  if (rpc.error) { console.log(`   🔴 ERREUR RPC : ${rpc.error.message}`); }
  else console.log(`   ✅ retour : ${JSON.stringify(rpc.data)}`);

  const debtId = rpc.data?.debt_id;

  console.log('\n3. Vérification de ce qui a réellement été écrit :');
  const a = await sql(`SELECT count(*) FILTER (WHERE debt_id IS NOT NULL) AS ventes_liees, count(*) AS total FROM sales WHERE user_id = '${uid}';`);
  console.log(`   sales pour ce user      : ${JSON.stringify(a.data)}`);
  const b = await sql(`SELECT count(*) AS nb, string_agg(name, ', ') AS clients FROM customers WHERE user_id = '${uid}';`);
  console.log(`   customers pour ce user  : ${JSON.stringify(b.data)}`);
  const c = await sql(`SELECT count(*) AS nb, string_agg(type, ', ') AS types FROM debt_history WHERE user_id = '${uid}';`);
  console.log(`   debt_history pour user  : ${JSON.stringify(c.data)}`);
  const d = await sql(`SELECT count(*) AS nb FROM debts WHERE user_id = '${uid}';`);
  console.log(`   debts pour ce user      : ${JSON.stringify(d.data)}`);
  const e = await sql(`SELECT count(*) AS nb, string_agg(product_name, ', ') AS produits FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.user_id = '${uid}';`);
  console.log(`   sale_items pour user    : ${JSON.stringify(e.data)}`);

  console.log('\n4. Nettoyage (cascade via suppression du user)…');
  const del = await sql(`DELETE FROM auth.users WHERE id = '${uid}';`);
  console.log(`   ${del.status === 201 || del.status === 200 ? '✅ compte de test supprimé (données en cascade)' : '⚠️ ' + JSON.stringify(del.data).substring(0, 200)}`);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
