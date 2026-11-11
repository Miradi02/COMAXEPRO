// COMAXE — Test du flux de CONNEXION réel (cookies + middleware)
// 1) Crée un compte confirmé  2) Se connecte via @supabase/ssr (mêmes cookies que le navigateur)
// 3) Rejoue ces cookies contre le serveur Next.js : /dashboard doit répondre 200 (et non 307)
// 4) Nettoie tout (retour à zéro)
// Usage : node scripts/login-flow-test.mjs

import { createServerClient } from '@supabase/ssr';
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
const APP = 'http://localhost:3000';

const EMAIL = `login-flow-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function request(path, cookies) {
  const res = await fetch(`${APP}${path}`, {
    redirect: 'manual',
    headers: cookies ? { Cookie: cookies } : {},
  });
  return { status: res.status, location: res.headers.get('location') };
}

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  TEST FLUX DE CONNEXION (cookies + middleware)');
  console.log('════════════════════════════════════════════\n');

  try {
    // ── 1. Compte de test confirmé ──
    console.log('1️⃣  Création d\u2019un compte de test');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    check('Compte créé (email déjà confirmé)', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    // ── 2. Connexion via @supabase/ssr (identique au navigateur) ──
    console.log('\n2️⃣  Connexion via @supabase/ssr (mêmes cookies qu\u2019en navigateur)');
    const jar = new Map();
    const supabaseSSR = createServerClient(URL_SB, ANON, {
      cookies: {
        get: (name) => jar.get(name),
        set: (name, value) => { jar.set(name, value); },
        remove: (name) => { jar.delete(name); },
      },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await supabaseSSR.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('signInWithPassword réussi', !loginErr, loginErr?.message || `${jar.size} cookie(s) écrit(s)`);
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    // ── 3. Rejeu contre le serveur Next.js ──
    console.log('\n3️⃣  Rejeu des cookies sur le serveur (http://localhost:3000)');
    const anonDashboard = await request('/dashboard');
    check('Sans cookie → /dashboard redirige vers /login', anonDashboard.status === 307 && (anonDashboard.location || '').includes('/login'), `status=${anonDashboard.status} → ${anonDashboard.location}`);

    const dash = await request('/dashboard', cookieHeader);
    check('AVEC cookie → /dashboard répond 200 (accès autorisé)', dash.status === 200, `status=${dash.status}`);

    const root = await request('/', cookieHeader);
    check('AVEC cookie → / (racine) répond 200', root.status === 200, `status=${root.status}`);

    const ventes = await request('/ventes', cookieHeader);
    check('AVEC cookie → /ventes répond 200', ventes.status === 200, `status=${ventes.status}`);

    const login = await request('/login', cookieHeader);
    check('Connecté sur /login → redirigé vers /tarifs', login.status === 307 && (login.location || '').endsWith('/tarifs'), `status=${login.status} → ${login.location}`);

    const anonRoot = await request('/');
    check('Sans cookie → / (landing publique) répond 200', anonRoot.status === 200, `status=${anonRoot.status}`);

    const anonTarifs = await request('/tarifs');
    check('Sans cookie → /tarifs répond 200', anonTarifs.status === 200, `status=${anonTarifs.status}`);

    // ── 4. Page de connexion : aucun menu de gestion ──
    console.log('\n4️⃣  Contenu de la page /login (sans session)');
    const loginPage = await fetch(`${APP}/login`);
    const html = await loginPage.text();
    check('Page /login répond 200', loginPage.status === 200);
    const hasMenu = /Dashboard/.test(html) && /D[ée]penses/.test(html) && /<nav/.test(html);
    check('Aucun menu de gestion sur /login', !hasMenu, hasMenu ? 'menu détecté' : 'espace connexion seul');
    check('Formulaire de connexion présent', /Se connecter/.test(html) && /mot de passe|Mdp|password/i.test(html));
  } catch (e) {
    fail++;
    console.log(`\n❌ ERREUR FATALE: ${e.message}`);
  } finally {
    console.log('\n🧹 NETTOYAGE');
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      console.log(`  ${error ? '⚠️ ' + error.message : '✅ Compte de test supprimé'}`);
    }
    console.log('\n════════════════════════════════════════════');
    console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
    console.log('════════════════════════════════════════════');
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
