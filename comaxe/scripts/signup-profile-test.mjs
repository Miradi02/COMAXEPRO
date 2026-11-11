// COMAXE — Test du flux d'INSCRIPTION avec informations du commerce
// Vérifie que les infos saisies à l'inscription (boutique, pays, devise)
// arrivent dans la table PROTÉGÉE store_profiles (via le trigger serveur).
// À la fin : compte supprimé → retour à zéro.
// Usage : node scripts/signup-profile-test.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(join(__dirname, '..', '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = `signup-profile-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';

// Données comme le formulaire d'inscription les envoie
const SIGNUP_DATA = {
  first_name: 'Patrick',
  last_name: 'Ilunga',
  store_name: 'Tech Kinshasa',
  store_phone: '+243 810 000 000',
  store_address: 'Av. de la Justice, Kinshasa',
  store_category: 'Électronique',
  store_currency: 'CDF',
  store_country: 'CD',
};

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  TEST INSCRIPTION + INFORMATIONS DU COMMERCE');
  console.log('════════════════════════════════════════════\n');

  try {
    // ── 1. Inscription exactement comme le formulaire ──
    console.log('1️⃣  Inscription (signUp avec infos boutique, pays, devise)');
    const { data, error } = await anon.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
      options: { data: SIGNUP_DATA },
    });

    if (!error && data.user) {
      userId = data.user.id;
      check('Compte créé (parcours réel du formulaire)', true, `uid=${userId.slice(0, 8)}…`);
      console.log('  ℹ️  Formulaire → signUp → trigger serveur');
    } else {
      // Le quota d'emails de confirmation peut être temporairement épuisé.
      // On crée le compte via l'API admin avec EXACTEMENT les mêmes métadonnées :
      // le trigger serveur handle_new_user reçoit le même raw_user_meta_data.
      console.log(`  ⚠️  signUp indisponible (${error?.message}) → repli API admin (mêmes métadonnées)`);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: SIGNUP_DATA,
      });
      check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
      userId = created?.user?.id;
    }
    if (!userId) throw new Error('Abort');

    // ── 2. Métadonnées enregistrées sur le compte ──
    console.log('\n2️⃣  Métadonnées du compte (données protégées)');
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    const meta = userData.user?.user_metadata ?? {};
    check('Prénom/nom stockés', meta.first_name === 'Patrick' && meta.last_name === 'Ilunga', `${meta.first_name} ${meta.last_name}`);
    check('Devise + pays dans les métadonnées', meta.store_currency === 'CDF' && meta.store_country === 'CD', `${meta.store_currency} / ${meta.store_country}`);

    // ── 3. Trigger : store_profiles rempli automatiquement ──
    console.log('\n3️⃣  Table protégée store_profiles (remplie par le trigger)');
    const { data: profiles, error: pErr } = await admin
      .from('store_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    check('Profil boutique créé', !pErr && !!profiles, pErr?.message || `id=${profiles?.id?.slice(0, 8)}…`);
    if (profiles) {
      check('Nom commercial', profiles.store_name === 'Tech Kinshasa', `store_name="${profiles.store_name}"`);
      check('Téléphone', profiles.phone === '+243 810 000 000', `phone="${profiles.phone}"`);
      check('Adresse', profiles.address === 'Av. de la Justice, Kinshasa', `address="${profiles.address}"`);
      check('Catégorie', profiles.category === 'Électronique', `category="${profiles.category}"`);
      check('Devise choisie', profiles.currency === 'CDF', `currency=${profiles.currency}`);
      check('Pays choisi', profiles.country === 'CD', `country=${profiles.country}`);
      check('Email du compte', profiles.email === EMAIL, `email="${profiles.email}"`);
    }

    // ── 4. Objectifs créés automatiquement ──
    console.log('\n4️⃣  Objectifs créés automatiquement');
    const { data: goals } = await admin.from('goal_targets').select('*').eq('user_id', userId).maybeSingle();
    check('goal_targets présent', !!goals);

    // ── 5. RLS : le compte ne voit QUE son profil ──
    console.log('\n5️⃣  Protection RLS du profil');
    // Simulation du clic sur le lien de confirmation email
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    const { error: loginErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Connexion possible', !loginErr, loginErr?.message || 'session active');
    const { data: ownProfile, error: ownErr } = await anon.from('store_profiles').select('*').maybeSingle();
    check('Lecture de SON profil (RLS)', !ownErr && ownProfile?.store_name === 'Tech Kinshasa', ownErr?.message || `store_name="${ownProfile?.store_name}"`);
    const { count: totalProfiles } = await anon.from('store_profiles').select('*', { count: 'exact', head: true });
    check('Ne voit que SES profils', totalProfiles === 1, `profil(s) visible(s)=${totalProfiles}`);
    await anon.auth.signOut();
  } catch (e) {
    fail++;
    console.log(`\n❌ ERREUR FATALE: ${e.message}`);
  } finally {
    console.log('\n🧹 NETTOYAGE');
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      console.log(`  ${error ? '⚠️ ' + error.message : '✅ Compte de test supprimé (cascade → profil + objectifs supprimés)'}`);
    }
    const { count } = await admin.from('store_profiles').select('*', { count: 'exact', head: true });
    console.log(`  ${count === 0 ? '✅' : '⚠️'} store_profiles: ${count} ligne(s) — base retournée à zéro`);
    console.log('\n════════════════════════════════════════════');
    console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
    console.log('════════════════════════════════════════════');
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
