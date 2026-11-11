// COMAXE — Vérifie le chem exact de LECTURE utilisé par loadAllData :
//   supabase.from('stock_movements').select('*').order('created_at_ts', desc)
// Effectué avec la clé ANON + une vraie session (donc RLS auth.uid()).
import { createServerClient } from '@supabase/ssr';
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
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^(https:\/\/[^/]+\.supabase\.co).*$/, '$1');
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = `stock-read-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
const check = (l, ok, d = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`); };

async function main() {
  console.log("════════════════════════════════════════════════════════");
  console.log("  LECTURE RLS — chemin exact de loadAllData");
  console.log("════════════════════════════════════════════════════════\n");

  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Read', last_name: 'Tester', store_name: 'Boutique Read', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }

  try {
    // Client ANON avec session — exactement comme l'application
    const jar = new Map();
    const ssr = createServerClient(URL_SB, ANON, {
      cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Session ouverte (clé anon)', !loginErr, loginErr?.message);
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
    // On passe aussi la session au client JS (comme le navigateur)
    const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

    const today = new Date().toISOString().slice(0, 10);

    // 1. Créer un produit + mouvement comme le ferait l'app
    const { data: prod, error: pErr } = await anon.from('products').insert({
      user_id: uid, name: 'Article Preuve', category: 'Test', quantity: 4,
      min_threshold: 1, selling_price: 50, purchase_price: 30,
      created_at: today, status: 'en_stock', total_sales_count: 0,
    }).select('id').maybeSingle();
    check('Produit inséré', !pErr && !!prod, pErr?.message);

    const { error: mErr } = await anon.from('stock_movements').insert({
      user_id: uid, product_id: prod?.id ?? null, product_name: 'Article Preuve',
      movement_type: 'entree', quantity: 4, note: 'Réapprovisionnement', date: today,
    });
    check('Mouvement inséré (RLS INSERT)', !mErr, mErr?.message);

    // 2. LECTURE EXACTE de loadAllData
    const r = await anon.from('stock_movements').select('*').order('created_at_ts', { ascending: false });
    check('Requête de lecture sans erreur', !r.error, r.error?.message);
    check('Au moins 1 mouvement lu', (r.data?.length ?? 0) >= 1, `lu=${r.data?.length}`);

    const row = r.data?.[0];
    if (row) {
      console.log(`\n  Ligne lue : ${JSON.stringify(row).substring(0, 240)}`);
      check('Colonnes attendues présentes (movement_type/date/product_name)',
        'movement_type' in row && 'date' in row && 'product_name' in row);
      // Le mapper mapStockMovement lit r.movement_type (via r.type ?? r.movement_type)
      check('Le mapper trouve un type exploitable', Boolean(row.type ?? row.movement_type));
    }

    // 3. Cloisonnement : un autre compte ne doit rien voir
    const EMAIL2 = `stock-other-${Date.now()}@example.com`;
    const { data: other } = await admin.auth.admin.createUser({
      email: EMAIL2, password: PASSWORD, email_confirm: true,
      user_metadata: { first_name: 'Other', last_name: 'Tester', store_name: 'Autre', store_currency: 'USD', store_country: 'CD' },
    });
    if (other?.user?.id) {
      const anon2 = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      await anon2.auth.signInWithPassword({ email: EMAIL2, password: PASSWORD });
      const r2 = await anon2.from('stock_movements').select('*');
      check('Cloisonnement RLS : autre compte voit 0 mouvement', (r2.data?.length ?? 0) === 0, `vu=${r2.data?.length}`);
      await admin.auth.admin.deleteUser(other.user.id);
    }

    // 4. Le reste de loadAllData ne doit pas être cassé non plus
    const tables = ['products', 'customers', 'sales', 'sale_items', 'expenses', 'debts', 'debt_payments', 'debt_history'];
    const all = await Promise.all(tables.map((t) => anon.from(t).select('*')));
    const broken = all.map((x, i) => (x.error ? `${tables[i]}: ${x.error.message}` : null)).filter(Boolean);
    check('Les 8 autres tables de loadAllData restent lisibles', broken.length === 0, broken.join(' | '));
  } finally {
    await admin.auth.admin.deleteUser(uid);
    console.log('\n  🧹 comptes de test supprimés');
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  ${fail === 0 ? "✅ LECTURE OK — le tableau s'alimentera" : '❌ PROBLÈME'} — ${pass} ok / ${fail} ko`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
