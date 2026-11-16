// COMAXE — Compte démo pour parcourir le questionnaire d'onboarding.
// Crée (idempotent) un compte JAMAIS initialisé puis affiche les accès :
//   connexion → redirection automatique vers /onboarding (questionnaire).
// Usage : node scripts/demo-onboarding-account.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

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
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = 'demo-questionnaire@comaxe.test';
const PASSWORD = 'ComaxeTest!2026';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listErr) { console.error('🔴 listUsers : ' + listErr.message); process.exit(1); }

const existing = (listed?.users || []).find((u) => u.email?.toLowerCase() === EMAIL);
let user = existing;
if (existing) {
  console.log('✔ compte démo déjà présent');
} else {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    // Flag EXPLICITE : la connexion redirige vers /onboarding uniquement
    // quand `onboarding_completed === false` (absence de clé = jamais).
    user_metadata: { first_name: 'Démo', last_name: 'Questionnaire', onboarding_completed: false },
  });
  if (error) { console.error('🔴 createUser : ' + error.message); process.exit(1); }
  user = created.user;
  console.log('✔ compte démo créé (jamais initialisé)');
}

// Sécurité idempotente : garantit la clé sur un compte déjà existant
// (updateUserById REMPLACE tout user_metadata → on fusionne toujours).
if (user && user.user_metadata?.onboarding_completed !== false) {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata || {}), onboarding_completed: false },
  });
  if (error) { console.error('🔴 updateUserById : ' + error.message); process.exit(1); }
  console.log('✔ flag onboarding_completed = false posé');
}
console.log(`\n  E-mail    : ${EMAIL}\n  Mot de passe : ${PASSWORD}\n`);
