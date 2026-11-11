// COMAXE — Applique scripts/user_preferences.sql sur la base Supabase.
// Usage : node scripts/apply-user-preferences.mjs
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
const SQL = readFileSync(join(__dirname, 'user_preferences.sql'), 'utf8');

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
  console.log('  Création de la table user_preferences');
  console.log('════════════════════════════════════════════════════════\n');

  const r = await sql(SQL);
  const ok = r.status === 200 || r.status === 201;
  if (!ok) {
    console.log(`🔴 HTTP ${r.status}`);
    console.log(typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2));
    return;
  }
  console.log('✅ Script appliqué sans erreur.\n');

  const cols = await sql(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='user_preferences' ORDER BY ordinal_position;`);
  console.log('Colonnes :');
  (Array.isArray(cols.data) ? cols.data : []).forEach((c) =>
    console.log(`   ${c.column_name.padEnd(16)} ${String(c.data_type).padEnd(10)} ${c.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${c.column_default ?? ''}`)
  );

  const cnt = await sql(`SELECT count(*) AS total FROM user_preferences;`);
  console.log(`\nLignes : ${JSON.stringify(cnt.data)}`);

  const rls = await sql(`SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relname='user_preferences';`);
  console.log(`RLS activé : ${JSON.stringify(rls.data)}`);

  const pol = await sql(`SELECT policyname, cmd FROM pg_policies WHERE tablename='user_preferences';`);
  console.log(`Politiques : ${JSON.stringify(pol.data)}`);

  // Contraintes CHECK réellement posées
  const chk = await sql(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.user_preferences'::regclass AND contype='c';`);
  console.log('CHECK :');
  (Array.isArray(chk.data) ? chk.data : []).forEach((c) => console.log(`   ${c.conname}\n      ${c.def}`));

  // Accès anonyme doit être bloqué (RLS)
  const anon = await sql(`SET ROLE anon; SELECT count(*) AS anon_rows FROM user_preferences; RESET ROLE;`);
  console.log(`\nAccès anonyme (doit être 0) : ${JSON.stringify(anon.data)}`);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
