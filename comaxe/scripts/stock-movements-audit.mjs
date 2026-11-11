// COMAXE — Origine de chaque mouvement de stock (compte + opération).
// Sert à détecter d'éventuelles fuites de données de test dans un compte réel.
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

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  Origine des mouvements de stock');
  console.log('════════════════════════════════════════════════════════\n');

  const r = await sql(`
    SELECT sm.movement_type, sm.product_name, sm.quantity, sm.date, sm.reference, sm.note,
           sm.created_at_ts, u.email
    FROM stock_movements sm
    JOIN auth.users u ON u.id = sm.user_id
    ORDER BY sm.created_at_ts;
  `);
  if (r.status !== 200 && r.status !== 201) {
    console.log(`🔴 HTTP ${r.status}`);
    console.log(typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
    return;
  }
  (Array.isArray(r.data) ? r.data : []).forEach((m) => {
    console.log(`  ${String(m.movement_type).padEnd(11)} ${String(m.product_name).slice(0, 26).padEnd(27)}` +
      `q=${String(m.quantity).padEnd(3)} ${m.date}  ref=${m.reference ?? '—'}`);
    console.log(`               compte=${m.email}`);
    console.log(`               note=${m.note ?? '—'}   créé=${m.created_at_ts}`);
  });

  const users = await sql(`SELECT u.email, u.created_at::date AS cree, count(sm.id) AS mouvements
    FROM auth.users u LEFT JOIN stock_movements sm ON sm.user_id = u.id
    GROUP BY u.email, u.created_at ORDER BY u.created_at;`);
  console.log('\nComptes et leur nombre de mouvements :');
  (Array.isArray(users.data) ? users.data : []).forEach((u) =>
    console.log(`  ${String(u.email).padEnd(42)} créé=${u.cree}  mouvements=${u.mouvements}`));
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
