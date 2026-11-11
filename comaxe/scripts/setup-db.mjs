// COMAXE — Script d'installation du schéma Supabase
// Usage : node scripts/setup-db.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lire le .env racine (contient SUPABASE_ACCESS_TOKEN)
const rootEnv = {};
readFileSync(join(__dirname, '..', '..', '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) rootEnv[m[1]] = m[2].trim();
});

const MGMT_TOKEN = rootEnv.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'mfqhhvzpwoepsjjhpbwz';

async function run() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  console.log(`Schéma lu (${schema.length} caractères)...`);

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: schema }),
  });

  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(text.substring(0, 1500));
}

run().catch((e) => {
  console.error('Erreur:', e.message);
  process.exit(1);
});
