// COMAXE — Diagnostic : vérifie la configuration Auth/Email du projet Supabase
// N'AFFICHE AUCUNE CLÉ. Usage : node scripts/check-auth-email.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Les clés vivent à la RACINE du workspace (comme setup-db.mjs) ; comaxe/.env ne
// contient que les variables NEXT_PUBLIC. On fusionne les deux pour être robuste.
const env = {};
for (const rel of [['..', '..', '.env'], ['..', '.env']]) {
  const p = join(__dirname, ...rel);
  try {
    readFileSync(p, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    });
  } catch { /* fichier absent : on ignore */ }
}

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = 'mfqhhvzpwoepsjjhpbwz';
const API = `https://api.supabase.com/v1/projects/${REF}`;

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function get(path) {
  const res = await fetch(API + path, { method: 'GET', headers: H });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* noop */ }
  return { status: res.status, json, text };
}

function mask(v) {
  if (v == null || v === '') return '(vide)';
  const s = String(v);
  return s.length <= 6 ? '***' : `${s.slice(0, 3)}…${s.slice(-3)} (len ${s.length})`;
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC AUTH / EMAIL — Supabase');
  console.log('════════════════════════════════════════════════════════\n');

  if (!TOKEN) { console.error('❌ SUPABASE_ACCESS_TOKEN manquant dans .env'); process.exit(1); }

  // ── 1. Statut du projet (paused = e-mails impossibles) ──
  console.log('1️⃣  Statut du projet');
  const p = await get('');
  console.log(`    HTTP ${p.status}`);
  if (p.json) {
    console.log(`    name           : ${p.json.name ?? '?'}`);
    console.log(`    region         : ${p.json.region ?? '?'}`);
    console.log(`    status         : ${p.json.status ?? '?'}`);
    console.log(`    database       : ${p.json.database?.version ?? '?'}`);
  } else {
    console.log(`    ${p.text.substring(0, 400)}`);
  }

  // ── 2. Configuration Auth (SMTP, confirmations email) ──
  console.log('\n2️⃣  Configuration Auth (config/auth)');
  const a = await get('/config/auth');
  console.log(`    HTTP ${a.status}`);
  if (a.json) {
    console.log(`    mailer_autoconfirm     : ${a.json.mailer_autoconfirm}`);
    console.log(`    secure_email_change    : ${a.json.secure_email_change}`);
    console.log(`    max_frequency          : ${a.json.max_frequency}`);
    console.log(`    otp_length             : ${a.json.otp_length}`);
    console.log(`    smtp_admin_email       : ${a.json.smtp_admin_email ?? '(vide)'}`);
    console.log(`    smtp_host              : ${a.json.smtp_host ?? '(NON CONFIGURÉ → service email Supabase partagé, très limité)'}`);
    console.log(`    smtp_port              : ${a.json.smtp_port ?? '-'}`);
    console.log(`    smtp_user              : ${a.json.smtp_user ?? '-'}`);
    console.log(`    smtp_pass              : ${mask(a.json.smtp_pass)}`);
    console.log(`    smtp_max_frequency     : ${a.json.smtp_max_frequency ?? '-'}`);
    console.log(`    disable_email          : ${a.json.disable_email ?? false}`);
  } else {
    console.log(`    ${a.text.substring(0, 600)}`);
  }

  // ── 3. Templates d'email ──
  console.log('\n3️⃣  Template "confirm_signup"');
  const t = await get('/config/auth/templates/confirm_signup');
  console.log(`    HTTP ${t.status}`);
  if (t.json) {
    console.log(`    has  : ${t.json.has ?? '?'}`);
    console.log(`    content (500 premiers car.) :`);
    console.log('    ' + String(t.json.content ?? '').replace(/\n/g, '\n    ').substring(0, 500));
  } else {
    console.log(`    ${t.text.substring(0, 400)}`);
  }

  // ── 4. Derniers utilisateurs créés (pour voir si le compte existe bien) ──
  console.log('\n4️⃣  Derniers utilisateurs (auth.users)');
  const u = await get('/users?page=1&per_page=5');
  console.log(`    HTTP ${u.status}`);
  if (Array.isArray(u.json)) {
    if (u.json.length === 0) console.log('    (aucun utilisateur)');
    u.json.forEach((x, i) => {
      console.log(`    [${i + 1}] ${x.email} — confirmé=${x.email_confirmed_at ? 'OUI' : 'NON'} — créé=${x.created_at}`);
    });
  } else {
    console.log(`    ${u.text.substring(0, 400)}`);
  }

  // ── 5. Vérification que le trigger existe ──
  console.log('\n5️⃣  Résumé / Verdict');
  const auto = a.json?.mailer_autoconfirm;
  const smtpHost = a.json?.smtp_host;
  const disabled = a.json?.disable_email;
  if (disabled === true) console.log('    🔴 disable_email = true → TOUS les emails sont bloqués côté Supabase.');
  if (smtpHost) console.log(`    🟢 SMTP personnalisé configuré (host: ${smtpHost}).`);
  else console.log('    🟠 Aucun SMTP configuré → Supabase utilise son service email partagé : quota très faible (quelques emails/heure), emails souvent non livrés ou en spam.');
  if (auto === true) console.log('    🟠 mailer_autoconfirm = true → la confirmation email est INUTILE (compte actif immédiatement, aucun email envoyé).');
  else if (auto === false) console.log('    🟢 mailer_autoconfirm = false → confirmation email requise (comportement attendu par l\'app).');
  else console.log('    ❓ mailer_autoconfirm indéfini.');
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
