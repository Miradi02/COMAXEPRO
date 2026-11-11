// COMAXE — Test RÉEL du flux d'inscription (identique à l'app)
// Crée un compte via la clé anon comme le fait AuthContext.signUp, puis observe
// ce que Supabase renvoie : session immédiate = autoconfirm = AUCUN EMAIL envoyé.
// Nettoie le compte de test à la fin. Usage : node scripts/test-signup-flow.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Les variables NEXT_PUBLIC sont dans comaxe/.env (c'est CE fichier que Next.js lit).
// Le .env racine porte en plus SUPABASE_ACCESS_TOKEN (gestion API) — mais son
// NEXT_PUBLIC_SUPABASE_URL est CORROMPU (suffixe /rest/v1/) : on le charge en DERNIER
// pour ne jamais écraser la bonne valeur.
const env = {};
for (const rel of [['..', '.env'], ['..', '..', '.env']]) {
  try {
    readFileSync(join(__dirname, ...rel), 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    });
  } catch { /* fichier absent : on ignore */ }
}

// Garde-fou : une URL Supabase doit se terminer par le domaine du projet.
if (env.NEXT_PUBLIC_SUPABASE_URL && !env.NEXT_PUBLIC_SUPABASE_URL.endsWith('.supabase.co')) {
  console.warn(`⚠️  NEXT_PUBLIC_SUPABASE_URL malformée : ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.warn('    → correction automatique (retrait du chemin parasite).\n');
  env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL.replace(/^(https:\/\/[^/]+\.supabase\.co).*$/, '$1');
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const EMAIL = `diag-signup-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  TEST RÉEL — Flux d\'inscription (clé anon, comme l\'app)');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`  Email de test : ${EMAIL}\n`);

  // ── 1. signUp EXACTEMENT comme AuthContext.signUp ──
  console.log('1️⃣  app.supabase.auth.signUp(...) — même appel que l\'app');
  const { data, error } = await anon.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: {
      emailRedirectTo: 'http://localhost:3000/login',
      data: {
        first_name: 'Patrick',
        last_name: 'Testeur',
        store_name: 'Boutique Diagnostic',
        store_phone: '+243 700 000 000',
        store_address: 'Kinshasa',
        store_category: 'Alimentation',
        store_currency: 'USD',
        store_country: 'CD',
      },
    },
  });

  if (error) {
    console.log(`    🔴 ERREUR : ${error.message}`);
    console.log(`       status=${error.status ?? '-'}`);
  } else {
    console.log('    ✅ signUp sans erreur');
  }
  console.log(`    user.id                 : ${data?.user?.id ?? '(aucun)'}`);
  console.log(`    user.email_confirmed_at : ${data?.user?.email_confirmed_at ?? '(NULL = non confirmé)'}`);
  console.log(`    identities[0].identity_data : ${JSON.stringify(data?.user?.identities?.[0]?.identity_data ?? null)}`);
  console.log(`    ⭐ SESSION RETOURNÉE ?  : ${data?.session ? 'OUI' : 'NON'}`);

  const userId = data?.user?.id;

  // ── 2. Interprétation ──
  console.log('\n2️⃣  Interprétation');
  if (data?.session) {
    console.log('    🔴🔴 CONFIRMÉ : une SESSION est renvoyée immédiatement.');
    console.log('       → mailer_autoconfirm = TRUE dans ton projet Supabase.');
    console.log('       → Supabase NE SEND AUCUN email de confirmation.');
    console.log('       → L\'utilisateur est connecté tout de suite.');
    console.log('       → CONSÉQUENCE DANS L\'APP : user devient non-null,');
    console('         le useEffect de /login fait router.replace("/"),');
    console('         donc on est REDIRIGÉ vers le dashboard');
    console('         et on ne voit JAMAIS le message « Compte créé ! ».');
  } else {
    console.log('    🟢 Pas de session → la confirmation email est REQUISE.');
    console.log('       → Un email de confirmation DEVRAIT être envoyé.');
    console.log('       → S\'il n\'arrive pas, c\'est le service email (SMTP) qui bloque.');
  }

  // ── 3. Vérif côté base : le trigger a-t-il créé le profil ? ──
  console.log('\n3️⃣  Trigger handle_new_user (store_profiles + goal_targets)');
  if (userId) {
    const { data: prof } = await admin.from('store_profiles').select('*').eq('user_id', userId);
    const { data: goals } = await admin.from('goal_targets').select('*').eq('user_id', userId);
    console.log(`    store_profiles : ${(prof?.length ?? 0) === 1 ? '✅ créé' : '🔴 MANQUANT'}` +
      (prof?.[0] ? ` (store_name="${prof[0].store_name}", currency=${prof[0].currency}, country=${prof[0].country})` : ''));
    console.log(`    goal_targets   : ${(goals?.length ?? 0) === 1 ? '✅ créé' : '🔴 MANQUANT'}`);
    console.log(`    ⚠️  Si MANQUANT → le trigger on_auth_user_created n\'est pas installé dans la base.`);
  }

  // ── 4. Lister les vrais users pour voir l\'état des confirmations ──
  console.log('\n4️⃣  État réel des comptes (admin.listUsers)');
  const { data: list, error: lErr } = await admin.auth.admin.listUsers();
  if (lErr) {
    console.log(`    🔴 ${lErr.message}`);
  } else {
    const users = list?.users ?? [];
    console.log(`    ${users.length} compte(s) sur le projet :`);
    users.slice(0, 12).forEach((u, i) => {
      console.log(`    [${i + 1}] ${u.email}`);
      console.log(`         créé=${u.created_at}  confirmé=${u.email_confirmed_at ?? '🔴 JAMAIS (email non reçu/non cliqué)'}`);
    });
    const unconfirmed = users.filter((u) => !u.email_confirmed_at).length;
    console.log(`\n    → ${unconfirmed}/${users.length} compte(s) NON confirmé(s).`);
    if (unconfirmed > 0 && !data?.session) {
      console.log('      Interprétation : la confirmation est bien requise, mais les');
      console('      utilisateurs ne cliquent jamais le lien → email non délivré.');
    }
  }

  // ── 5. Nettoyage ──
  console.log('\n5️⃣  Nettoyage du compte de test');
  if (userId) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    console.log(`    ${delErr ? '⚠️ ' + delErr.message : '✅ compte supprimé'}`);
  }
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
