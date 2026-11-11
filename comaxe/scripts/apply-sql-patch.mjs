// COMAXE — Applique un fichier SQL patch sur la base Supabase.
// Usage : node scripts/apply-sql-patch.mjs scripts/patch-new-user-prefs.sql
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

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

const target = process.argv[2];
if (!target) {
  console.error('Usage : node scripts/apply-sql-patch.mjs <fichier.sql>');
  process.exit(1);
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = 'mfqhhvzpwoepsjjhpbwz';
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const SQL = readFileSync(resolve(process.cwd(), target), 'utf8');

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
  console.log(`Application de ${target}\n`);
  const r = await sql(SQL);
  if (r.status !== 200 && r.status !== 201) {
    console.log(`🔴 HTTP ${r.status}`);
    console.log(typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
    process.exit(1);
  }
  console.log('✅ Patch appliqué.');

  const chk = await sql(`SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='handle_new_user';`);
  const def = Array.isArray(chk.data) && chk.data[0] ? chk.data[0].def : '';
  console.log(`\nhandle_new_user contient user_preferences : ${def.includes('user_preferences') ? '✅' : '🔴 NON'}`);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
