// COMAXE — Dernière vérification : les 2 ventes existantes viennent-elles du RPC dettes ?
// Affiche code/montant/profit/debt_id + les lignes de vente, pour trancher.
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

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Les ventes viennent-elles du RPC de création de dette ?');
  console.log('════════════════════════════════════════════════════════\n');

  const { data: sales, error: e1 } = await db.from('sales').select('*').order('created_at_ts');
  const { data: items, error: e2 } = await db.from('sale_items').select('*');
  const { data: debts, error: e3 } = await db.from('debts').select('*').order('created_at_ts');
  const { data: custs, error: e4 } = await db.from('customers').select('*').order('created_at_ts');

  if (e1 || e2 || e3 || e4) console.log('ERREURS:', e1?.message, e2?.message, e3?.message, e4?.message);

  console.log('VENTES (toutes) :');
  (sales ?? []).forEach((s, i) => {
    console.log(`  [${i + 1}] code=${s.code} total=${s.total_amount} profit=${s.total_profit} status=${s.status} debt_id=${s.debt_id ?? 'NULL'}`);
    console.log(`       client="${s.client_name}" date=${s.date} user=${String(s.user_id).slice(0, 8)}`);
  });

  console.log('\nLIGNES DE VENTE (sale_items) :');
  (items ?? []).forEach((it, i) => {
    console.log(`  [${i + 1}] produit="${it.product_name}" qty=${it.quantity} pu=${it.unit_price} pa=${it.purchase_price} total=${it.total} sale_id=${String(it.sale_id).slice(0, 8)} product_id=${it.product_id ?? 'NULL'}`);
  });

  console.log('\nDETTES :');
  (debts ?? []).forEach((d, i) => {
    console.log(`  [${i + 1}] ${d.person_name} init=${d.initial_amount} produit="${d.product_name ?? 'NULL'}" product_id=${d.product_id ?? 'NULL'} user=${String(d.user_id).slice(0, 8)} date=${d.date}`);
  });

  console.log('\nCLIENTS :');
  (custs ?? []).forEach((c, i) => {
    console.log(`  [${i + 1}] ${c.name} achats=${c.purchases_count} total=${c.total_spent} user=${String(c.user_id).slice(0, 8)}`);
  });

  // ── Diagnostic ──
  console.log('\n════════════════════════════════════════════════════════');
  const debtNames = new Set((debts ?? []).map((d) => (d.person_name || '').toLowerCase()));
  const salesFromDebt = (sales ?? []).filter((s) => debtNames.has((s.client_name || '').toLowerCase()));
  console.log(`  Ventes dont le client est aussi un débiteur : ${salesFromDebt.length} / ${(sales ?? []).length}`);
  salesFromDebt.forEach((s) => console.log(`    → ${s.code} total=${s.total_amount} debt_id=${s.debt_id ?? 'NULL'}`));

  const generic = (items ?? []).filter((it) => /cr.dit|crédit/i.test(it.product_name || ''));
  console.log(`  Lignes de vente "Vente à crédit" (signe du RPC dettes) : ${generic.length}`);

  const custWithDebt = (custs ?? []).filter((c) => debtNames.has((c.name || '').toLowerCase()));
  console.log(`  Clients créés/maj par une dette : ${custWithDebt.length}`);
  custWithDebt.forEach((c) => console.log(`    → ${c.name} achats=${c.purchases_count} total=${c.total_spent}`));

  console.log('\n  INTERPRÉTATION :');
  if ((debts ?? []).length > 0 && salesFromDebt.length === 0) {
    console.log('    🔴 Aucune vente ne correspond aux débitters → le RPC n\'a PAS créé de vente.');
  } else if (salesFromDebt.length > 0 && salesFromDebt.every((s) => !s.debt_id)) {
    console.log('    🟠 Une vente correspond au débiteur MAIS debt_id est NULL →');
    console.log('       la version du RPC en base est ANCIENNE (avant l\'ajout de debt_id).');
  } else if (salesFromDebt.some((s) => s.debt_id)) {
    console.log('    🟢 La vente liée existe avec debt_id → le RPC est à jour.');
  }
  console.log('════════════════════════════════════════════════════════');
}
main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
