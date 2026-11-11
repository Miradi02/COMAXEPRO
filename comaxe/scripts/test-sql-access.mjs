// COMAXE — Test d'accès au moteur SQL via l'API de gestion Supabase.
// Si ça marche, on peut LIRE et RÉÉDÉPLOYER les fonctions directement.
// Usage : node scripts/test-sql-access.mjs
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

async function run(label, query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas JSON */ }
  const good = res.status === 200 || res.status === 201;
  console.log(`\n── ${label} ── HTTP ${res.status}`);
  if (!good) console.log(`   ${text.substring(0, 400)}`);
  return { status: res.status, json, text, good };
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  TEST — accès moteur SQL (API de gestion Supabase)');
  console.log('════════════════════════════════════════════════════════');

  const ping = await run('1. Requête inoffensive', 'SELECT 1 AS ok');
  if (!ping.good) {
    console.log('\n🔴 PAS D\'ACCÈS SQL avec ce token.');
    console.log('   → La réparation devra se faire dans le SQL Editor du Dashboard Supabase.');
    return;
  }
  console.log('   ✅ ACCÈS SQL AUTORISÉ — on peut diagnostiquer et réparer.');

  // ── 2. Existe-t-il la fonction ? Quel corps ? ──
  const fn = await run('2. Corps déployé de create_debt_with_history', `
    SELECT p.proname AS nom,
           pg_get_function_identity_arguments(p.oid) AS args,
           l.lanname AS lang,
           p.prosecdef AS security_definer,
           length(p.prosrc) AS taille_corps
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_debt_with_history','record_debt_payment_rpc','process_sale','delete_sale_data')
    ORDER BY p.proname;
  `);
  if (fn.json) console.log(JSON.stringify(fn.json, null, 2).substring(0, 2500));

  // ── 3. Le corps contient-il l'insertion dans sales avec debt_id ? ──
  const hasSale = await run('3. Le corps contient-il "INSERT INTO sales" et "debt_id" ?', `
    SELECT proname,
           (prosrc ILIKE '%INSERT INTO sales%') AS cree_une_vente,
           (prosrc ILIKE '%debt_id%')            AS ecrit_debt_id,
           (prosrc ILIKE '%INSERT INTO customers%') AS cree_client,
           (prosrc ILIKE '%INSERT INTO debt_history%') AS ecrit_historique
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_debt_with_history','record_debt_payment_rpc');
  `);
  if (hasSale.json) console.log(JSON.stringify(hasSale.json, null, 2).substring(0, 2500));
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
