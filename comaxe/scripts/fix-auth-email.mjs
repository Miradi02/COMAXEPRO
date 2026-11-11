// COMAXE — Tente de réparer la configuration Auth/Email via l'API de gestion Supabase.
// 1. Relit la config Auth (plusieurs chemins possibles selon la version de l'API)
// 2. Force mailer_autoconfirm = false (pour que les emails de confirmation partent)
// Usage : node scripts/fix-auth-email.mjs [--apply]
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
const BASE = `https://api.supabase.com/v1/projects/${REF}`;
const APPLY = process.argv.includes('--apply');
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'If-Match': '*' };

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* pas du JSON */ }
  return { status: res.status, json, text };
}

function short(v, n = 300) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return (s || '').length > n ? s.slice(0, n) + '…' : s;
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  RÉPARATION CONFIG AUTH / EMAIL — Supabase');
  console.log(`  Mode : ${APPLY ? 'APPLIQUER LES CHANGEMENTS' : 'SIMULATION (ajouter --apply)'}`);
  console.log('════════════════════════════════════════════════════════\n');

  if (!TOKEN) { console.error('❌ SUPABASE_ACCESS_TOKEN absent'); process.exit(1); }

  // ── 1. Lecture de la config Auth, en essayant les chemins connus ──
  console.log('1️⃣  Lecture de la configuration Auth');
  const readPaths = ['/config/auth', '/auth/config', '/config'];
  let authConfig = null;
  for (const p of readPaths) {
    const r = await req('GET', p);
    console.log(`    GET ${p.padEnd(16)} → HTTP ${r.status}`);
    if (r.status === 200 && r.json) {
      authConfig = r.json;
      console.log(`       ✅ config récupérée (${Object.keys(r.json).length} clés)`);
      break;
    }
    if (r.status !== 404) console.log(`       ${short(r.text, 200)}`);
  }

  if (authConfig) {
    console.log('\n    Valeurs actuelles :');
    const keys = ['mailer_autoconfirm', 'disable_email', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_admin_email', 'smtp_max_frequency', 'max_frequency', 'secure_email_change'];
    for (const k of keys) console.log(`      ${k.padEnd(24)}: ${authConfig[k] === undefined ? '(absent)' : authConfig[k] === '' ? '(vide)' : authConfig[k]}`);
    const hasSmtp = Boolean(authConfig.smtp_host);
    const auto = authConfig.mailer_autoconfirm;
    console.log(`\n    🔎 VERDICT : mailer_autoconfirm = ${auto} | SMTP = ${hasSmtp ? authConfig.smtp_host : 'AUCUN'}`);
    if (auto === true) console.log('    🔎 → AUTOCONFIRM ACTIF : Supabase n\'envoie AUCUN email de confirmation.');
  } else {
    console.log('\n    ⚠️  Lecture impossible avec ce token (403/404).');
    console.log('        → La modification risque aussi d\'être refusée.');
  }

  // ── 2. Écriture ──
  console.log('\n2️⃣  Correction de mailer_autoconfirm → false');
  const patchPaths = ['/config/auth', '/auth/config'];
  let patched = false;
  for (const p of patchPaths) {
    const r = await req('PATCH', p, { mailer_autoconfirm: false });
    console.log(`    PATCH ${p.padEnd(15)} → HTTP ${r.status}`);
    if (r.status === 200 || r.status === 204) {
      console.log('    ✅ mailer_autoconfirm désactivé avec succès.');
      patched = true;
      break;
    }
    console.log(`       ${short(r.text, 300)}`);
  }

  // ── 3. Confirmation ──
  console.log('\n3️⃣  Vérification après correction');
  if (patched) {
    const r = await req('GET', '/config/auth');
    if (r.status === 200 && r.json) {
      console.log(`    mailer_autoconfirm = ${r.json.mailer_autoconfirm} ${r.json.mailer_autoconfirm === false ? '✅' : '❌'}`);
      console.log(`    smtp_host           = ${r.json.smtp_host || '(AUCUN SMTP)'} ${r.json.smtp_host ? '✅' : '🟠'}`);
    }
  } else {
    console.log('    ⚠️  Non vérifiable — la correction doit se faire dans le Dashboard Supabase :');
    console.log('        Authentication → Sign In / Providers → Email → "Confirm email" → décocher');
  }

  // ── 4. SMTP ──
  console.log('\n4️⃣  Service d\'envoi d\'emails (SMTP)');
  const host = authConfig?.smtp_host;
  if (host) {
    console.log(`    🟢 SMTP personnalisé actif : ${host}`);
  } else {
    console.log('    🟠 Aucun SMTP configuré.');
    console.log('       Sur les projets Supabase récents, les emails de confirmation NE PARTENT PAS');
    console.log('       tant qu\'un fournisseur SMTP n\'est pas branché (ou sont très limités).');
    console.log('       → Dashboard Supabase : Project Settings → Authentication → SMTP Settings');
  }

  console.log('\n════════════════════════════════════════════════════════');
  if (patched && authConfig?.smtp_host) {
    console.log('  ✅ RÉPARÉ — les emails de confirmation devraient maintenant partir.');
  } else if (patched) {
    console.log('  🟠 PARTIEL — autoconfirm corrigé, mais il reste à brancher le SMTP.');
  } else {
    console.log('  🔴 ACTION MANUELLE REQUISE dans le Dashboard Supabase (voir ci-dessus).');
  }
  console.log('════════════════════════════════════════════════════════');
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
