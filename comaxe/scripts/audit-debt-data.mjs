// COMAXE — Audit v2 : gère les erreurs PostgREST et affiche le vrai schéma.
// Usage : node scripts/audit-debt-data.mjs
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^(https:\/\/[^/]+\.supabase\.co).*$/, '$1');
const db = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const ok = (label, r) => {
  if (r.error) { console.log(`    🔴 ${label} : ${r.error.message}`); return null; }
  return r.data;
};

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  AUDIT v2 — avec gestion des erreurs');
  console.log('════════════════════════════════════════════════════════\n');

  // ── 1. Schéma réel (1 ligne de chaque table pertinente) ──
  console.log('1️⃣  Colonnes réelles (via 1 ligne)\n');
  for (const t of ['debts', 'debt_history', 'debt_payments', 'sales']) {
    const r = await db.from(t).select('*').limit(1);
    if (r.error) { console.log(`    ${t}: 🔴 ${r.error.message}`); continue; }
    console.log(`    ${t}: ${r.data && r.data[0] ? Object.keys(r.data[0]).join(', ') : '(table vide)'}`);
  }

  // ── 2. Comptages ──
  console.log('\n2️⃣  Comptages exacts\n');
  const counts = {};
  for (const t of ['debts', 'debt_payments', 'debt_history', 'sales', 'sale_items']) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    counts[t] = error ? null : count;
    console.log(`    ${t.padEnd(16)}: ${error ? '🔴 ' + error.message : count}`);
  }

  // ── 3. Données dettes + ventes (colonnes sûres) ──
  console.log('\n3️⃣  Dettes & ventes liées\n');
  const debts = ok('debts', await db.from('debts').select('*'));
  const sales = ok('sales', await db.from('sales').select('*'));
  const dArr = debts ?? [];
  const sArr = sales ?? [];

  console.log(`    debts = ${dArr.length}, sales = ${sArr.length}`);
  if (dArr[0]) console.log(`    champs dette : ${Object.keys(dArr[0]).join(', ')}`);

  const salesWithDebt = sArr.filter((s) => s.debt_id);
  console.log(`    sales.debt_id NON NUL : ${salesWithDebt.length} / ${sArr.length}`);
  if (sArr[0]) console.log(`    champs vente : ${Object.keys(sArr[0]).join(', ')}`);

  dArr.forEach((d, i) => {
    console.log(`\n    [${i + 1}] status=${d.status} init=${d.initial_amount} payé=${d.paid_amount} restant=${d.remaining_amount}`);
    console.log(`         produit="${d.product_name ?? 'NULL'}" qty=${d.quantity ?? 'NULL'} date=${d.date}`);
    console.log(`         debt_id utilisateurs : ${sArr.filter((s) => s.debt_id === d.id).length} vente(s) trouvée(s)`);
  });

  // ── 4. Historique (avec erreur explicite) ──
  console.log('\n4️⃣  debt_history (détail)\n');
  const h = await db.from('debt_history').select('*').order('created_at_ts', { ascending: false });
  if (h.error) console.log(`    🔴 ERREUR : ${h.error.message}`);
  else {
    console.log(`    ${h.data.length} opération(s) :`);
    h.data.forEach((o, i) => {
      console.log(`    [${i + 1}] ${JSON.stringify(o)}`.substring(0, 260));
    });
  }

  // ── 5. Paiements ──
  console.log('\n5️⃣  debt_payments (détail)\n');
  const p = await db.from('debt_payments').select('*');
  if (p.error) console.log(`    🔴 ERREUR : ${p.error.message}`);
  else {
    console.log(`    ${p.data.length} paiement(s) :`);
    p.data.forEach((o, i) => console.log(`    [${i + 1}] ${JSON.stringify(o)}`.substring(0, 260)));
  }

  // ── 6. Verdict ──
  console.log('\n════════════════════════════════════════════════════════');
  const hCount = counts.debt_history ?? 0;
  const dCount = counts.debts ?? 0;
  const linked = salesWithDebt.length;
  console.log(`  Dettes : ${dCount} | Ventes liées : ${linked} | Historique : ${hCount} | Paiements : ${counts.debt_payments ?? 0}`);
  if (dCount > 0 && linked === 0) console.log('  🔴 AUCUNE vente créée à partir d\'une dette → create_debt_with_history ne crée pas la vente (ou debt_id non écrit).');
  if (dCount > 0 && hCount === 0) console.log('  🔴 Aucune écriture dans debt_history.');
  if (hCount > 0 && linked === 0) console.log('  🟠 L\'historique existe MAIS la vente liée n\'existe pas.');
  if (dArr.some((d) => !d.product_name)) console.log('  🔴 Au moins une dette N\'a pas de produit associé.');
  console.log('════════════════════════════════════════════════════════');
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
