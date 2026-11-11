// COMAXE — Applique scripts/support.sql sur la base Supabase.
// Usage : node scripts/apply-support.mjs
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
const SQL = readFileSync(join(__dirname, 'support.sql'), 'utf8');

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
  console.log('  Création de la table support_requests');
  console.log('════════════════════════════════════════════════════════\n');

  const r = await sql(SQL);
  if (r.status !== 200 && r.status !== 201) {
    console.log(`🔴 HTTP ${r.status}`);
    console.log(typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
    return;
  }
  console.log('✅ Script appliqué sans erreur.\n');

  const rls = await sql(`SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relname='support_requests';`);
  console.log(`RLS activé : ${JSON.stringify(rls.data)}`);

  const pol = await sql(`SELECT policyname, cmd FROM pg_policies WHERE tablename='support_requests';`);
  console.log(`Politiques : ${JSON.stringify(pol.data)}`);

  const anon = await sql(`SET ROLE anon; SELECT count(*) AS anon_rows FROM support_requests; RESET ROLE;`);
  console.log(`Accès anonyme (doit être 0) : ${JSON.stringify(anon.data)}`);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
