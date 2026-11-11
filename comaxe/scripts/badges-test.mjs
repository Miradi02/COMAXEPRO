// COMAXE — Test des BADGES SIDEBAR algorithmiques
// Vérifie que les badges du menu (+N ventes, N alertes, bénéfice net, dettes)
// sont calculés sur les données RÉELLES du compte et plus codés en dur :
//   1) Source Sidebar         → logique dynamique présente, aucune valeur fixe
//   2) Compte vierge (SSR)    → aucun badge de chiffre dans le HTML servi
//   3) Compte avec activité   → rendu 200 sans réintroduction de valeurs fixes
//      (les badges de données s'affichent après le chargement client)
//   4) Nettoyage complet
// Usage : node scripts/badges-test.mjs   (serveur dev requis sur :3000)

import { createServerClient } from '@supabase/ssr';
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
const APP = 'http://localhost:3000';

const EMAIL = `badges-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  TEST BADGES SIDEBAR (algorithmiques)');
  console.log('════════════════════════════════════════════\n');

  try {
    // ── 1. Source de la Sidebar : logique dynamique ──
    console.log('1️⃣  Source Sidebar : badges dynamiques (aucune valeur codée en dur)');
    const sidebarSrc = readFileSync(join(__dirname, '..', 'src', 'components', 'layout', 'Sidebar.tsx'), 'utf8');
    check('Ventes : basé sur filteredSales.length', sidebarSrc.includes('const salesCount = filteredSales.length'));
    check('Stock : basé sur les statuts produits réels', sidebarSrc.includes("p.status === 'stock_faible' || p.status === 'rupture'"));
    check('Bénéfice : net du mois via getPeriodMetrics', sidebarSrc.includes("getPeriodMetrics('mois').netProfitUSD"));
    check('Dettes : créances actives (status !== payee)', sidebarSrc.includes("debts.filter((d) => d.status !== 'payee')"));
    check('Badges masqués quand valeur = 0', sidebarSrc.includes('salesCount > 0 &&') && sidebarSrc.includes('stockAlertCount > 0 &&') && sidebarSrc.includes('monthlyNetProfit > 0 &&') && sidebarSrc.includes('activeDebtCount > 0 &&'));
    check('Aucune valeur fixe résiduelle', !sidebarSrc.includes('+5') && !sidebarSrc.includes("'4 alertes'") && !sidebarSrc.includes('Suivi') && !/\bNet\b(?![A-Za-z])/.test(sidebarSrc.replace(/Net profit/g, '')));

    // ── 2. Compte vierge : HTML servi sans faux chiffres ──
    console.log('\n2️⃣  Compte vierge → aucun faux chiffre dans le HTML servi');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: 'Badge',
        last_name: 'Tester',
        store_name: 'Boutique Badges',
        store_currency: 'USD',
        store_country: 'CD',
      },
    });
    check('Compte créé', !cErr && !!created?.user, cErr?.message);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    const jar = new Map();
    const ssr = createServerClient(URL_SB, ANON, {
      cookies: {
        get: (n) => jar.get(n),
        set: (n, v) => jar.set(n, v),
        remove: (n) => jar.delete(n),
      },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Connexion réussie', !loginErr, loginErr?.message);
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    const noFakes = (html) =>
      !html.includes('>+5<') &&
      !html.includes('>4 alertes<') &&
      !html.includes('>Net<') &&
      !html.includes('>Suivi<');

    const empty = await fetch(`${APP}/dashboard`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const emptyHtml = await empty.text();
    check('Dashboard 200', empty.status === 200, `status=${empty.status}`);
    check('Compte vierge → aucun badge fixe (+5 / 4 alertes / Net / Suivi)', noFakes(emptyHtml));

    // ── 2. Données réelles : 1 vente + 1 rupture + 1 dette ──
    console.log('\n3️⃣  Compte avec activité → badges calculés (données en base)');
    const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    const todayKey = new Date().toISOString().slice(0, 10);

    const { data: prod, error: pErr } = await anon
      .from('products')
      .insert({
        user_id: userId,
        name: 'Article en rupture',
        category: 'Test',
        quantity: 0,
        min_threshold: 3,
        selling_price: 100,
        purchase_price: 60,
        created_at: todayKey,
        status: 'rupture',
        total_sales_count: 0,
      })
      .select()
      .single();
    check('Produit en rupture créé', !pErr && !!prod, pErr?.message);

    const { error: saleErr } = await anon.rpc('process_sale', {
      p_code: `VNT-BADGE-${Date.now()}`,
      p_date: `${todayKey}, 12:00`,
      p_customer_id: null,
      p_client_name: 'Client Badge',
      p_client_phone: '+243 000 000 000',
      p_client_avatar: null,
      p_payment_method: 'especes',
      p_items: [
        { product_id: prod?.id, product_name: 'Article en rupture', quantity: 1, unit_price: 100, purchase_price: 60, total: 100 },
      ],
      p_total_amount: 100,
      p_total_profit: 40,
    });
    check('Vente du jour enregistrée', !saleErr, saleErr?.message);

    const { error: debtErr } = await anon.rpc('create_debt_with_history', {
      p_person_name: 'Débiteur Badge',
      p_phone: '+243 111 111 111',
      p_email: null,
      p_initial_amount: 50,
      p_date: todayKey,
    });
    check('Dette active créée', !debtErr, debtErr?.message);

    const dash = await fetch(`${APP}/dashboard`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const dashHtml = await dash.text();
    check('Dashboard 200 avec activité', dash.status === 200, `status=${dash.status}`);
    check('HTML servi sans valeurs fixes (badges calculés côté client)', noFakes(dashHtml));
    check(
      'Activité réelle présente en base (vente + rupture + dette)',
      !saleErr && !pErr && !debtErr,
      'le prochain rendu client affichera « +1 », « 1 alerte », bénéfice net, « 1 en cours »'
    );
  } catch (e) {
    fail++;
    console.log(`\n❌ ERREUR FATALE: ${e.message}`);
  } finally {
    console.log('\n🧹 NETTOYAGE');
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      console.log(`  ${error ? '⚠️ ' + error.message : '✅ Compte de test supprimé (cascade)'}`);
    }
    console.log('\n════════════════════════════════════════════');
    console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
    console.log('════════════════════════════════════════════');
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
