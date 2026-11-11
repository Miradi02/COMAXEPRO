// COMAXE — Vérification du RENDU connecté
// 1) Compte de test avec nom + boutique  2) Connexion (cookies réels)
// 3) Vérifie dans le HTML servi : nom de l'utilisateur dans le menu/en-tête,
//    nom de la boutique, et le bouton de déconnexion dans Paramètres.
// 4) Nettoie tout.
// Usage : node scripts/verify-ui-test.mjs

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

const EMAIL = `verify-ui-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const META = {
  first_name: 'Patrick',
  last_name: 'Testeur',
  store_name: 'Boutique Vérif',
  store_phone: '+243 700 000 000',
  store_category: 'Alimentation',
  store_currency: 'XOF',
  store_country: 'SN',
};

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  TEST DU RENDU (nom utilisateur, boutique, déconnexion)');
  console.log('════════════════════════════════════════════\n');

  try {
    // ── 1. Compte de test ──
    console.log('1️⃣  Création du compte de test');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: META,
    });
    check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    // ── 2. Connexion → cookies ──
    console.log('\n2️⃣  Connexion (cookies @supabase/ssr)');
    const jar = new Map();
    const ssr = createServerClient(URL_SB, ANON, {
      cookies: {
        get: (n) => jar.get(n),
        set: (n, v) => jar.set(n, v),
        remove: (n) => jar.delete(n),
      },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('Connexion réussie', !loginErr, loginErr?.message || `${jar.size} cookie(s)`);
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    // ── 3. Rendu des pages connecté ──
    console.log('\n3️⃣  HTML servi avec session');

    const dash = await fetch(`${APP}/dashboard`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const dashHtml = await dash.text();
    check('Page /dashboard accessible (200)', dash.status === 200, `status=${dash.status}`);
    check('Nom utilisateur dans le rendu', dashHtml.includes('Patrick Testeur'), 'attendu: "Patrick Testeur" (sidebar + en-tête)');
    check('Plus de "Boutique Tech Express"', !dashHtml.includes('Boutique Tech Express'));
    check('Plus de "Commerçant Enregistré"', !dashHtml.includes('Commerçant Enregistré'));
    check('Dashboard SANS bouton "Enregistrer une Vente"', !dashHtml.includes('Enregistrer une Vente'), 'consultation seule');
    check('Dashboard garde la section des ventes', dashHtml.includes('Ventes Enregistrées'));
    check('Montants affichés en devise du commerce (FCFA)', dashHtml.includes('FCFA'), 'compte en XOF → formatMoney appliqué');
    check(
      'Badges sidebar dynamiques (compte vide → aucun faux chiffre)',
      !dashHtml.includes('+5') && !dashHtml.includes('4 alertes') && !dashHtml.includes('>Net<') && !dashHtml.includes('>Suivi<'),
      'plus de valeurs codées en dur'
    );

    const ventes = await fetch(`${APP}/ventes`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const ventesHtml = await ventes.text();
    check('Page /ventes accessible (200)', ventes.status === 200, `status=${ventes.status}`);
    check('Page Ventes GARDE le bouton "Enregistrer une Vente"', ventesHtml.includes('Enregistrer une Vente'), 'enregistrement ici');

    // ── Tâche 3 : les 2 boutons "Enregistrer une Vente" ouvrent la même modale ──
    const headerSrc = readFileSync(join(__dirname, '..', 'src', 'components', 'layout', 'Header.tsx'), 'utf8');
    const ventesBranch = headerSrc.split("pathname === '/ventes'")[1]?.split("pathname === '/stock'")[0] || '';
    check(
      'Bouton Header /ventes clique sur [data-add-sale-btn]',
      ventesBranch.includes('[data-add-sale-btn]') && ventesBranch.includes('.click()'),
      'pattern identique aux autres pages'
    );
    check('Bouton Header /ventes ne fait plus un simple router.push/scroll', !ventesBranch.includes('router.push'), 'il ouvre la modale');
    const salesSrc = readFileSync(join(__dirname, '..', 'src', 'components', 'dashboard', 'RecentSalesTable.tsx'), 'utf8');
    const btnCtx = salesSrc.split('data-add-sale-btn')[0]?.slice(-300) || '';
    check(
      'Bouton carte /ventes : data-add-sale-btn ouvre la modale',
      salesSrc.includes('data-add-sale-btn') && btnCtx.includes('setIsModalOpen(true)'),
      'cible cliquée par le Header'
    );
    check('Page /ventes rend le bouton data-add-sale-btn', ventesHtml.includes('data-add-sale-btn'), 'bouton présent dans le HTML');

    // ── Tâche 4 : historique des dettes = tous les événements ──
    const dettesSrc = readFileSync(join(__dirname, '..', 'src', 'app', '(app)', 'dettes', 'page.tsx'), 'utf8');
    const ctxSrc = readFileSync(join(__dirname, '..', 'src', 'context', 'CommerceContext.tsx'), 'utf8');
    check(
      'Historique : requête par created_at_ts (colonne réelle)',
      ctxSrc.includes("from('debt_history').select('*').order('created_at_ts'"),
      'sinon l\'historique reste vide'
    );
    check('Historique : section "Historique des Dettes" présente', dettesSrc.includes('Historique des Dettes'));
    check('Historique : colonne "Opération" ajoutée', dettesSrc.includes("{t('Opération', 'Operation')}"));
    check('Historique : badge événement CRÉATION', dettesSrc.includes("{t('Création', 'Creation')}"));
    check('Historique : badge PAIEMENT PARTIEL', dettesSrc.includes("{t('Paiement partiel', 'Partial payment')}"));
    check('Historique : badge PAIEMENT TOTAL', dettesSrc.includes("{t('Paiement total', 'Full payment')}"));
    check('Historique : montant du paiement affiché (+ montant)', dettesSrc.includes('`+ ${formatAmount(op.paymentAmount)}`'));
    check('Formulaires dette : plus de date codée en dur 07/10/2026', !dettesSrc.includes('07/10/2026') && dettesSrc.includes('todayFr'));

    // ── Tâche 5 : dette liée au produit + vente automatique ──
    const schemaSql = readFileSync(join(__dirname, '..', 'scripts', 'schema.sql'), 'utf8');
    const fnStart = schemaSql.indexOf('DROP FUNCTION IF EXISTS create_debt_with_history');
    const fnEnd = schemaSql.indexOf('$$ LANGUAGE plpgsql SECURITY DEFINER;', fnStart);
    const fnBlock = fnStart >= 0 && fnEnd > fnStart ? schemaSql.slice(fnStart, fnEnd) : '';
    check('Schéma : sales.debt_id (vente liée à la dette)', schemaSql.includes('debt_id UUID REFERENCES debts(id) ON DELETE CASCADE'));
    check('Schéma : debts.product_id (produit endetté)', schemaSql.includes('product_id UUID REFERENCES products(id) ON DELETE SET NULL'));
    check('RPC création dette : insère la vente automatique', fnBlock.includes('INSERT INTO sales'));
    check('RPC création dette : décrémente le stock', fnBlock.includes('UPDATE products'));
    check('RPC création dette : contrôle de stock insuffisant', fnBlock.includes('Stock insuffisant'));
    check('RPC création dette : historique avec produit', fnBlock.includes('product_name') && fnBlock.includes('quantity'));
    check('Formulaire dette : sélecteur "Produit endetté"', dettesSrc.includes("{t('Produit endetté', 'Product on credit')}"));
    check('Tableaux dette : colonne Produit × 3 blocs', (dettesSrc.match(/\{t\('Produit', 'Product'\)\}/g) || []).length === 3);
    check('addDebt : RPC enrichi (p_product_id, p_quantity, p_code)', ctxSrc.includes('p_product_id:') && ctxSrc.includes('p_quantity:') && ctxSrc.includes('p_code: code'));
    check('deleteDebt : restaure la vente liée (delete_sale_data)', ctxSrc.includes('delete_sale_data'));
    check('Types : Debt porte productId/productName/quantity', readFileSync(join(__dirname, '..', 'src', 'types', 'index.ts'), 'utf8').includes('productId?: string; // Produit endetté'));

    // ── Statique : refonte du sélecteur Pays/Devise + conversion abonnement ──
    const loginSrc = readFileSync(join(__dirname, '..', 'src', 'app', 'login', 'page.tsx'), 'utf8');
    check('Sélecteur pays/devise nouvelle génération (SearchSelect)', loginSrc.includes('<SearchSelect'));
    check('Listes pays ET devise en ordre alphabétique', (loginSrc.match(/localeCompare\(b\.name, 'fr', \{ sensitivity: 'base' \}\)/g) || []).length === 2);
    check('Anciens <optgroup> de continents supprimés', !loginSrc.includes('<optgroup'));
    const paramsSrc = readFileSync(join(__dirname, '..', 'src', 'app', '(app)', 'parametres', 'page.tsx'), 'utf8');
    check('Abonnement facturé en USD (29 $ / mois)', paramsSrc.includes('29 $ / mois') && !paramsSrc.includes('open.er-api.com'));

    const params = await fetch(`${APP}/parametres`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const paramsHtml = await params.text();
    check('Page /parametres accessible (200)', params.status === 200, `status=${params.status}`);
    check('Carte "Déconnexion" présente', paramsHtml.includes('Déconnexion'));
    check('Bouton "Se déconnecter" présent', paramsHtml.includes('Se déconnecter'));
    check('Texte d\u2019aide du bouton présent', paramsHtml.includes('page de connexion'));
    check('Onglet "Informations du Commerce" supprimé', !paramsHtml.includes('Informations du Commerce'));
    check('Onglet "Données Locales" supprimé', !paramsHtml.includes('Données Locales'));
    check('Bouton "Réinitialiser les données" supprimé', !paramsHtml.includes('Réinitialiser les données'));
    check('Onglet "Abonnement" toujours présent', paramsHtml.includes('Abonnement COMAXE'));

    // ── Langue du navigateur : Accept-Language en-GB → anglais ──
    console.log('\n3️⃣bis  Langue suivant le navigateur (en-GB)');
    const loginEn = await fetch(`${APP}/login`, { headers: { 'Accept-Language': 'en-GB' } });
    const loginEnHtml = await loginEn.text();
    check('EN : <html lang="en">', loginEnHtml.includes('<html lang="en"'));
    check('EN : titre "Sign in"', loginEnHtml.includes('Sign in'));
    check('EN : accueil "Simplified business management"', loginEnHtml.includes('Simplified business management'));
    check('EN : plus "Gestion commerciale simplifiée"', !loginEnHtml.includes('Gestion commerciale simplifiée'));
    check('EN : plus "Se connecter" (FR)', !loginEnHtml.includes('Se connecter'));
    check('EN : plus "Mot de passe" (FR)', !loginEnHtml.includes('Mot de passe'));

    const dashEn = await fetch(`${APP}/dashboard`, {
      redirect: 'manual',
      headers: { Cookie: cookieHeader, 'Accept-Language': 'en-GB' },
    });
    const dashEnHtml = await dashEn.text();
    check('EN : /dashboard accessible (200)', dashEn.status === 200, `status=${dashEn.status}`);
    check('EN : <html lang="en"> sur /dashboard', dashEnHtml.includes('<html lang="en"'));
    check('EN : section "Recorded Sales"', dashEnHtml.includes('Recorded Sales'));
    check('EN : plus "Ventes Enregistrées" (FR)', !dashEnHtml.includes('Ventes Enregistrées'));
    check('EN : sidebar "Business Management"', dashEnHtml.includes('Business Management'));
    check('EN : sidebar "Products &amp; Stock"', dashEnHtml.includes('Products &amp; Stock'));
    check('EN : sidebar sans "Produits &amp; Stock" (FR)', !dashEnHtml.includes('Produits &amp; Stock'));
    check('EN : sidebar "Expenses" / "Profit"', dashEnHtml.includes('Expenses') && dashEnHtml.includes('Profit'));
    check('EN : sidebar sans "Dépenses" / "Bénéfice" (FR)', !dashEnHtml.includes('Dépenses') && !dashEnHtml.includes('Bénéfice'));

    // ── Sans Accept-Language → français intact (24 assertions FR inchangées) ──
    const dashFr = await fetch(`${APP}/dashboard`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const dashFrHtml = await dashFr.text();
    check('FR (défaut) : <html lang="fr">', dashFrHtml.includes('<html lang="fr"'));
    check('FR (défaut) : section "Ventes Enregistrées"', dashFrHtml.includes('Ventes Enregistrées'));

    // ── 4. SignOut → les cookies deviennent invalides ──
    console.log('\n4️⃣  Déconnexion');
    await ssr.auth.signOut();
    const cookieAfter = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
    const after = await fetch(`${APP}/dashboard`, { redirect: 'manual', headers: { Cookie: cookieAfter } });
    check('Après déconnexion → /dashboard renvoie sur /login', after.status === 307 && (after.headers.get('location') || '').includes('/login'), `status=${after.status} → ${after.headers.get('location')}`);
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
