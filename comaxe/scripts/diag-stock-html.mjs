// COMAXE — Diagnostique la 3ᵉ défaillance : 'undefined' / '[object Object]'
// dans le HTML servi de /stock. Affiche le contexte exact de chaque occurrence.
import { createServerClient } from '@supabase/ssr';
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
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^(https:\/\/[^/]+\.supabase\.co).*$/, '$1');
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'http://localhost:3000';
const EMAIL = `stock-diag-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Diag', last_name: 'Tester', store_name: 'Boutique Diag', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('createUser a échoué'); return; }

  try {
    const jar = new Map();
    const ssr = createServerClient(URL_SB, ANON, {
      cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    // 1) Page propre
    const clean = await (await fetch(`${APP}/stock`, { redirect: 'manual', headers: { Cookie: cookieHeader } })).text();
    report('/stock (compte vierge)', clean);

    // 2) Comparaison avec une page de référence
    const ref = await (await fetch(`${APP}/ventes`, { redirect: 'manual', headers: { Cookie: cookieHeader } })).text();
    report('/ventes (référence)', ref);

    // 3) Le rendu est-il serveur ou client pour /stock ?
    console.log('\n── Nature du rendu ──');
    console.log('/stock contient l\'état vide historique : ' + clean.includes('Aucun mouvement de stock enregistré'));
    console.log('/stock contient le tableau de mouvements (entête) : ' + clean.includes('Mouvement'));
    console.log('/stock contient l\'état vide (aucune ligne) : ' + clean.includes('Créations de produit, réappro, ventes et dettes apparaîtront ici'));
  } finally {
    await admin.auth.admin.deleteUser(uid);
    console.log('\n🧹 compte supprimé');
  }
}

function report(label, html) {
  console.log(`\n═══ ${label} ═══`);
  console.log(`taille=${html.length}`);
  for (const needle of ['undefined', '[object Object]']) {
    const idxs = [];
    let i = html.indexOf(needle);
    while (i !== -1 && idxs.length < 8) { idxs.push(i); i = html.indexOf(needle, i + 1); }
    console.log(`\n"${needle}" : ${idxs.length} occurrence(s) (max affiché 8)`);
    idxs.forEach((idx) => {
      const start = Math.max(0, idx - 110);
      const ctx = html.slice(start, idx + needle.length + 60).replace(/\s+/g, ' ');
      console.log(`  @${idx} …${ctx}…`);
    });
  }
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
