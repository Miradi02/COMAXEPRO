// COMAXE — Crée un compte de test, vérifie la suppression réelle du compte
// via le RPC `delete_my_account` (appelé depuis la session utilisateur),
// puis confirme que tout a disparu en cascade.
// Usage : node scripts/test-account-deletion.mjs
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

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = `del-account-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  TEST SUPPRESSION DE COMPTE (RPC)');
  console.log('════════════════════════════════════════════\n');

  // ── 1. Création du compte ──
  console.log('1️⃣  Création du compte de test');
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Delete' },
  });
  check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
  const userId = created?.user?.id;
  if (!userId) throw new Error('Abort');

  const rows = async (table) => {
    const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
    return count ?? 0;
  };
  check('user_preferences initialisé par le trigger', (await rows('user_preferences')) === 1);
  check('store_profiles initialisé par le trigger', (await rows('store_profiles')) === 1);
  check('goals initialisés par le trigger', (await rows('goals')) === 4);

  // ── 2. Connexion puis suppression via le RPC ──
  console.log('\n2️⃣  Connexion + appel RPC delete_my_account()');
  const { error: loginErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  check('Connexion possible', !loginErr, loginErr?.message || 'session active');

  const { error: rpcErr } = await anon.rpc('delete_my_account');
  check('RPC exécuté sans erreur', !rpcErr, rpcErr?.message || 'ok');

  // ── 3. Vérifications ──
  console.log('\n3️⃣  Vérifications après suppression');
  const { data: after } = await admin.auth.admin.getUserById(userId);
  check('Utilisateur supprimé de auth.users', !after?.user, after?.user ? 'toujours présent' : 'absent');

  const tables = ['user_preferences', 'store_profiles', 'goals', 'goal_targets', 'reports', 'sales', 'products', 'customers'];
  let cascadeOk = true;
  for (const t of tables) {
    const n = await rows(t);
    if (n !== 0) { cascadeOk = false; console.log(`     ⚠️ ${t}: ${n} ligne(s) restante(s)`); }
  }
  check('Toutes les données du compte supprimées en cascade', cascadeOk);

  const { error: reloginErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  check('Plus de connexion possible', !!reloginErr, reloginErr?.message || 'refusé');

  console.log('\n════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
  console.log('════════════════════════════════════════════');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
