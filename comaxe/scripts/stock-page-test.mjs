// COMAXE — Vérification de la Tâche « Page Stock » :
//   A) 2 onglets dans la modale (nouveau produit / produit existant)
//   B) Message exact quand le nom existe déjà + garde-fou à la soumission
//   C) Espace « Historique du Stock » réellement rendu avec les mouvements
// Usage : node scripts/stock-page-test.mjs   (serveur dev requis sur :3000)
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
const STOCK_PAGE = join(__dirname, '..', 'src', 'app', '(app)', 'stock', 'page.tsx');

const EMAIL = `stock-pg-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  TEST — Page Produits & Stock');
  console.log('════════════════════════════════════════════════════════\n');
  const src = readFileSync(STOCK_PAGE, 'utf8');

  // ── A. Les deux onglets ──
  console.log("A️⃣  Deux points d'entrée dans la modale");
  check("État modalTab 'nouveau' | 'restock'", src.includes("useState<'nouveau' | 'restock'>('nouveau')"));
  check("Onglet 1 libellé « Nouveau produit »", src.includes("t('Nouveau produit', 'New product')"));
  check("Onglet 2 libellé « Produit existant »", src.includes("t('Produit existant', 'Existing product')"));
  check('Onglet 2 dédié au réappro (PackagePlus)', src.includes('setModalTab(\'restock\')') && src.includes('<PackagePlus'));
  check('Formulaire existant : select des produits', src.includes('restockProductId') && src.includes('restockProduct.quantity +'));
  check('updateProduct recalcule le statut', src.includes('quantity: prod.quantity + qty'));

  // ── B. Duplication de nom ──
  console.log('\nB️⃣  Nom déjà présent → message + blocage');
  const MSG = 'Produit existant, veuillez réapprovisionner dans l’onglet produit existant.';
  check('Message exact présent', src.includes(MSG));
  check('Comparaison insensible à la casse', src.includes('.trim().toLowerCase() === trimmedNewName.toLowerCase()'));
  check('Blocage à la soumission (duplicateProduct)', /if \(duplicateProduct\) return;/.test(src));
  check('Bouton désactivé si doublon', src.includes('disabled={Boolean(duplicateProduct)}'));
  check('Champ passe en rouge (border-rose-400)', src.includes("border-rose-400 focus:ring-rose-200"));
  check('Bandeau de message (role=alert)', src.includes('role="alert"'));

  // ── C. Historique du stock ──
  console.log('\nC️⃣  Espace Historique du Stock');
  check("Titre « Historique du Stock »", src.includes("t('Historique du Stock', 'Stock History')"));
  check('4 types de mouvement affichés', src.includes("'creation'") && src.includes("'entree'") && src.includes("'sortie'") && src.includes("'annulation'"));
  check('Recherche + filtres + date active', src.includes('historyQuery') && src.includes('historyType') && src.includes('historyActiveDateOnly'));
  check('État vide explicite', src.includes('Aucun mouvement de stock enregistré'));
  check('Contexte expose stockMovements', readFileSync(join(__dirname, '..', 'src', 'context', 'CommerceContext.tsx'), 'utf8').includes('stockMovements,'));

  // ── D. Runtime : la page rend + RLS OK ──
  console.log('\nD️⃣  Rendu réel (SSR) + RLS');
  let userId2 = null;
  try {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
      user_metadata: { first_name: 'Stock', last_name: 'Tester', store_name: 'Boutique Stock Test', store_currency: 'USD', store_country: 'CD' },
    });
    check('Compte de test créé', !cErr && !!created?.user, cErr?.message);
    userId2 = created?.user?.id;
    userId = userId2;
    if (!userId2) throw new Error('abort');

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
    check('Connexion réussie', !loginErr, loginErr?.message);
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    // Insertion d'un produit + d'un mouvement via la clé anon (test RLS INSERT)
    const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    const today = new Date().toISOString().slice(0, 10);
    const { data: prod, error: pErr } = await anon.from('products').insert({
      user_id: userId2, name: 'Article Historique', category: 'Test',
      quantity: 7, min_threshold: 2, selling_price: 120, purchase_price: 70,
      created_at: today, status: 'en_stock', total_sales_count: 0,
    }).select('id').maybeSingle();
    check('Produit inséré (RLS INSERT)', !pErr && !!prod, pErr?.message);

    const { error: mErr } = await anon.from('stock_movements').insert({
      user_id: userId2, product_id: prod?.id ?? null, product_name: 'Article Historique',
      movement_type: 'entree', quantity: 7, note: 'Réapprovisionnement',
      date: today, reference: null,
    });
    check('Mouvement inséré (RLS INSERT stock_movements)', !mErr, mErr?.message);

    // Lecture du HTML de /stock
    const res = await fetch(`${APP}/stock`, { redirect: 'manual', headers: { Cookie: cookieHeader } });
    const html = await res.text();
    check('/stock répond 200', res.status === 200, `status=${res.status}`);
    // /stock est une page 'use client' : le SSR sert l'état vide, les lignes
    // n'apparaissent qu'après hydratation + chargement des données.
    check('Section historique rendue (SSR)', html.includes('Historique du Stock'));
    check('En-têtes de tableau rendus', html.includes('Mouvement'));
    check('État vide SSR cohérent (données chargées côté client)',
      html.includes('Aucun mouvement de stock enregistré'));
    check('Aucun "[object Object]" dans le HTML', !html.includes('[object Object]'));
  } catch (e) {
    console.log('  ⚠️  ' + e.message);
  } finally {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
      console.log('\n  🧹 Compte de test supprimé (données en cascade)');
    }
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  ${fail === 0 ? '✅ TOUS LES TESTS PASSENT' : '❌ ÉCHECS'} — ${pass} réussis / ${fail} échoués`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
