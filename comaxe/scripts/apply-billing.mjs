// COMAXE — Applique scripts/billing.sql (système d'abonnement) sur la base Supabase.
// Usage : node scripts/apply-billing.mjs
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
const SQL = readFileSync(join(__dirname, 'billing.sql'), 'utf8');

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

function rows(r) { return Array.isArray(r.data) ? r.data : []; }

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Application de billing.sql (abonnement + limites serveur)');
  console.log('════════════════════════════════════════════════════════\n');

  if (!TOKEN) { console.log('🔴 SUPABASE_ACCESS_TOKEN introuvable (.env).'); process.exit(1); }

  const r = await sql(SQL);
  const ok = r.status === 200 || r.status === 201;
  if (!ok) {
    console.log(`🔴 HTTP ${r.status}`);
    console.log(typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
    process.exit(1);
  }
  console.log('✅ Script appliqué sans erreur.\n');

  let pass = 0; let fail = 0;
  const check = (label, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`); }
    else { fail++; console.log(`  🔴 ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  // --- Tables ---
  const tbl = await sql(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('subscriptions','subscription_events');`);
  const names = rows(tbl).map((x) => x.table_name).sort();
  check('Table subscriptions créée', names.includes('subscriptions'));
  check('Table subscription_events créée', names.includes('subscription_events'));

  // --- Colonnes subscriptions ---
  const cols = await sql(`SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' ORDER BY ordinal_position;`);
  const colNames = rows(cols).map((c) => c.column_name);
  const expected = ['user_id','plan_id','requested_plan_id','status','started_at','current_period_start','current_period_end','ends_at','stripe_customer_id','stripe_subscription_id','stripe_price_id','created_at','updated_at'];
  check('Colonnes subscriptions (13)', colNames.length === 13 && expected.every((e) => colNames.includes(e)), colNames.join(','));
  const evCols = await sql(`SELECT column_name FROM information_schema.columns WHERE table_name='subscription_events' ORDER BY ordinal_position;`);
  const evNames = rows(evCols).map((c) => c.column_name);
  check('Colonnes subscription_events (id, user_id, event_id, event_type, payload, processed_at, created_at)',
    ['id','user_id','event_id','event_type','payload','processed_at','created_at'].every((e) => evNames.includes(e)), evNames.join(','));

  // --- RLS + policies ---
  const rls = await sql(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('subscriptions','subscription_events');`);
  const rlsMap = Object.fromEntries(rows(rls).map((x) => [x.relname, x.relrowsecurity]));
  check('RLS activé sur subscriptions', rlsMap.subscriptions === true);
  check('RLS activé sur subscription_events', rlsMap.subscription_events === true);

  const pol = await sql(`SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('subscriptions','subscription_events') ORDER BY tablename, policyname;`);
  const pols = rows(pol);
  check('Policy SELECT own subscription', pols.some((p) => p.tablename === 'subscriptions' && p.cmd === 'SELECT'));
  check('Policy SELECT own subscription_events', pols.some((p) => p.tablename === 'subscription_events' && p.cmd === 'SELECT'));
  check('Aucune policy INSERT/UPDATE/DELETE (écriture réservée au service)',
    !pols.some((p) => p.cmd !== 'SELECT'), pols.map((p) => `${p.tablename}:${p.cmd}`).join(' '));

  // --- Triggers ---
  const trg = await sql(`SELECT tgname, relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace AND tgname LIKE 'billing_%';`);
  const trgNames = rows(trg).map((t) => t.tgname).sort();
  const expectedTrg = ['billing_limits_customers','billing_limits_debts','billing_limits_products','billing_limits_sales','billing_feature_goals'];
  check('5 triggers billing (4 limites + goals)', expectedTrg.every((e) => trgNames.includes(e)), trgNames.join(', '));

  const trgAuth = await sql(`SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname='auth' AND tgname='on_auth_user_created_billing';`);
  check('Trigger d\'inscription (auth.users → abonnement Essential)', rows(trgAuth).length === 1);

  // --- Fonctions ---
  const fn = await sql(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN ('billing_active_plan','billing_plan_limit','billing_feature_enabled','billing_enforce_limit','billing_enforce_feature','billing_handle_new_user','billing_touch_subscription');`);
  const fnNames = rows(fn).map((f) => f.proname).sort();
  check('7 fonctions billing', fnNames.length === 7, fnNames.join(', '));

  // --- Seed : chaque utilisateur existant a un abonnement ---
  // Les comptes de TEST (@comaxe.test, créés par billing-api-test) sont
  // exclus du contrôle « tous en Essential » : ils servent justement à
  // simuler des plans payants.
  const seed = await sql(`SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM subscriptions) AS subs, (SELECT count(*) FROM subscriptions s JOIN auth.users u ON u.id=s.user_id WHERE u.email NOT LIKE '%@comaxe.test' AND s.plan_id='essential') AS essentials, (SELECT count(*) FROM subscriptions s JOIN auth.users u ON u.id=s.user_id WHERE u.email NOT LIKE '%@comaxe.test') AS real_subs;`);
  const s = rows(seed)[0] || {};
  check('Seed : 1 abonnement par utilisateur', Number(s.users) === Number(s.subs), `users=${s.users} subs=${s.subs}`);
  check('Seed : tous les comptes réels en Essential (hors comptes de test)',
    Number(s.real_subs) === Number(s.essentials), `réels=${s.real_subs} essentiels=${s.essentials}`);

  // --- Limites SQL miroir de la config (extrait) ---
  const lim = await sql(`SELECT billing_plan_limit('essential','products') AS e_p, billing_plan_limit('pro','products') AS p_p, billing_plan_limit('max','sales') AS m_s, billing_plan_limit('essential','debts') AS e_d;`);
  const l = rows(lim)[0] || {};
  check('billing_plan_limit miroir (ess/pro produits=30/300, max ventes=1000, ess dettes=20)',
    Number(l.e_p) === 30 && Number(l.p_p) === 300 && Number(l.m_s) === 1000 && Number(l.e_d) === 20,
    JSON.stringify(l));

  const feat = await sql(`SELECT billing_feature_enabled('essential','goals') AS e_g, billing_feature_enabled('pro','goals') AS p_g, billing_feature_enabled('essential','analytics') AS e_a;`);
  const f = rows(feat)[0] || {};
  check('billing_feature_enabled (ess goals=false, pro goals=true, ess analytics=false)',
    f.e_g === false && f.p_g === true && f.e_a === false, JSON.stringify(f));

  // --- Anonyme bloqué ---
  const anon = await sql(`SET ROLE anon; SELECT count(*) AS anon_subs FROM subscriptions; RESET ROLE;`);
  const anonVal = rows(anon)[0];
  check('Accès anonyme subscriptions bloqué (0)', Number(anonVal?.anon_subs ?? -1) === 0, JSON.stringify(anonVal));

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  RÉSULTAT : ${pass} OK / ${fail} ÉCHEC`);
  console.log(`════════════════════════════════════════════════════════`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
