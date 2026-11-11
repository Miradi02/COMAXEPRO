// COMAXE — Vérification des 6 offres tarifaires (source : src/components/marketing/plans.ts)
// Partie 7 de la mission : offres, prix, limites, calculs ×10, collaborateurs, accès IA, boutons.
// Usage : node scripts/plans-verify.mjs
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${label}${detail ? ' — ' + detail : ''}`);
};

/* ── Compilation de plans.ts en JS lisible par Node ── */
const out = mkdtempSync(join(tmpdir(), 'comaxe-plans-'));
try {
  execSync(
    'npx tsc src/components/marketing/plans.ts --outDir "' + out +
      '" --rootDir src/components/marketing --target es2020 --module commonjs --skipLibCheck',
    { cwd: ROOT, stdio: 'pipe' }
  );
} catch (e) {
  console.error('ECHEC compilation plans.ts :', (e.stdout && e.stdout.toString()) || e.message);
  process.exit(1);
}
const { PLANS, CATEGORIES, CTA_LABELS, BUSINESS_RULES } = await import(
  pathToFileURL(join(out, 'plans.js')).href
);
rmSync(out, { recursive: true, force: true });

console.log('════════════════════════════════════════════');
console.log('  VERIFY PLANS — 6 offres, prix, limites, ×10');
console.log('════════════════════════════════════════════\n');

/* ── Helpers ── */
const byId = (id) => PLANS.find((p) => p.id === id);
const group = (p, titleFr) => p.details.find((g) => g.title.fr === titleFr);
const flat = (p) =>
  p.details.map((g) => g.title.fr + ' :: ' + g.items.map((i) => i.fr).join(' | ')).join(' ; ');
const nums = (s) =>
  (s.match(/\d[\d\u00A0 ]*/g) || []).map((x) => parseInt(x.replace(/[\u00A0\s]/g, ''), 10));
const has = (text, arr) => arr.filter((s) => !text.includes(s));

/* ── 1. Les six offres ── */
console.log('1️⃣  Six offres');
const ids = PLANS.map((p) => p.id).join(',');
check(
  'ids exacts et dans lordre',
  ids === 'essential,pro,max,ultime,business-max,business-ultime',
  ids
);
const commerce = PLANS.filter((p) => p.category === 'commerce');
const entreprise = PLANS.filter((p) => p.category === 'entreprise');
check('catégorie commerce = 4 offres', commerce.length === 4, `n=${commerce.length}`);
check('catégorie entreprise = 2 offres', entreprise.length === 2, `n=${entreprise.length}`);
check('2 catégories définies', CATEGORIES.length === 2);

/* ── 2. Prix ── */
console.log('\n2️⃣  Prix');
const priceTable = {
  essential: [null, null],
  pro: [5, 49],
  max: [14, 149],
  ultime: [24, 249],
  'business-max': [59, 599],
  'business-ultime': [99, 999],
};
for (const [id, [m, a]] of Object.entries(priceTable)) {
  const p = byId(id);
  check(
    `prix ${id}`,
    p.priceMonthly === m && p.priceAnnual === a,
    `mensuel=${p.priceMonthly} annuel=${p.priceAnnual} (attendu ${m}/${a})`
  );
}
check(
  'notes économie présentes (5 offres payantes) et absente (Essential)',
  ['pro', 'max', 'ultime', 'business-max', 'business-ultime'].every((id) => byId(id).annualNote) &&
    !byId('essential').annualNote
);
const savingPct = (m, a) => Math.round((1 - a / (m * 12)) * 100);
const expectedPcts = [[5, 49], [14, 149], [24, 249], [59, 599], [99, 999]]
  .map(([m, a]) => savingPct(m, a));
check(
  'note économie = % réel arrondi (mensuel ×12 vs annuel)',
  ['pro', 'max', 'ultime', 'business-max', 'business-ultime'].every((id, i) =>
    byId(id).annualNote.fr.includes(String(expectedPcts[i]))),
  `pcts=${expectedPcts.join(',')}`
);

/* ── 3. Limites commerciales ── */
console.log('\n3️⃣  Limites commerciales');
const limitTable = {
  essential: ['50 ventes par mois', '30 produits', '30 clients', '20 dettes actives'],
  pro: ['500 ventes par mois', '300 produits', '300 clients', '200 dettes actives'],
  max: ['1 000 ventes par mois', '600 produits', '600 clients', '400 dettes actives'],
  ultime: ['4 000 ventes par mois', '2 400 produits', '2 400 clients', '1 600 dettes actives'],
  'business-max': ['8 000 ventes par mois', '4 800 produits', '4 800 clients', '3 200 dettes actives'],
  'business-ultime': ['80 000 ventes par mois', '48 000 produits', '48 000 clients', '32 000 dettes actives'],
};
for (const [id, expected] of Object.entries(limitTable)) {
  const missing = has(flat(byId(id)), expected);
  check(`limites ${id}`, missing.length === 0, missing.length ? `manquant: ${missing.join(', ')}` : '');
}
check(
  'Essential — suite exacte (7 j ×2, bloqués, publicités)',
  has(flat(byId('essential')), [
    '7 jours d’historique des dépenses',
    '7 jours d’historique des bénéfices',
    'Objectifs bloqués',
    'Analytique bloquée',
    'Publicités activées',
  ]).length === 0
);
check(
  'Pro — suite exacte (illimités, débloqués, sans pub) + 8 fonctionnalités',
  has(flat(byId('pro')), [
    'Dépenses illimitées',
    'Bénéfices illimités',
    'Objectifs débloqués',
    'Analytique débloquée',
    'Sans publicité',
    'Gestion des ventes',
    'Gestion du stock',
    'Gestion des clients',
    'Gestion des dettes',
    'Suivi des dépenses',
    'Suivi des bénéfices',
    'Création et suivi des objectifs',
    'Analyse des performances commerciales',
  ]).length === 0
);
check(
  'Max — hérite de Pro et SANS IA / multi-boutiques / collaborateurs',
  has(flat(byId('max')), [
    'Toutes les fonctionnalités de Pro',
    'Pas d’intelligence artificielle',
    'Pas de gestion multi-boutiques',
    'Pas de comptes collaborateurs',
    'Dépenses illimitées',
    'Bénéfices illimités',
  ]).length === 0 && !flat(byId('max')).includes('Assistant IA intégré')
);
check(
  'Ultime — hérite de Max + IA complète (10 items)',
  has(flat(byId('ultime')), [
    'Toutes les fonctionnalités de Max',
    'Assistant IA intégré',
    'Analyse intelligente des ventes',
    'Analyse intelligente du stock',
    'Analyse des bénéfices et des dépenses',
    'Recommandations intelligentes',
    'Actions assistées par IA',
    'Aide à la prise de décision',
    'Accompagnement intelligent',
    'Détection des anomalies commerciales',
    'Suggestions d’amélioration des performances',
  ]).length === 0
);

/* ── 4. Calculs ×10 (Business Ultime = Business Max × 10) ── */
console.log('\n4️⃣  Calculs ×10');
const bm = byId('business-max');
const bu = byId('business-ultime');
const bmLim = group(bm, 'Limites commerciales').items.slice(0, 4).map((i) => nums(i.fr)[0]);
const buLim = group(bu, 'Limites commerciales (×10)').items.slice(0, 4).map((i) => nums(i.fr)[0]);
check(
  'limites commerciales ×10 (8 000/4 800/4 800/3 200)',
  bmLim.join() === '8000,4800,4800,3200' && buLim.join() === '80000,48000,48000,32000',
  `BM=[${bmLim}] BU=[${buLim}]`
);
check(
  'BU = BM × 10 pour les 4 limites',
  buLim.every((v, i) => v === bmLim[i] * 10)
);
check(
  'invariants (illimités / débloqués / sans pub) présents chez BU',
  has(flat(bu), [
    'Dépenses illimitées',
    'Bénéfices illimités',
    'Objectifs débloqués',
    'Analytique débloquée',
    'Sans publicité',
  ]).length === 0
);

/* ── 5. Limites des collaborateurs ── */
console.log('\n5️⃣  Collaborateurs');
const bmC = group(bm, 'Collaborateurs');
const buC = group(bu, 'Collaborateurs (×10)');
const bmCn = bmC.items.slice(0, 4).map((i) => nums(i.fr)[0]);
const buCn = buC.items.slice(0, 4).map((i) => nums(i.fr)[0]);
check('Business Max : 20 / 20 / 5 / 1', bmCn.join() === '20,20,5,1', `=[${bmCn}]`);
check('Business Ultime : 200 / 200 / 50 / 5', buCn.join() === '200,200,50,5', `=[${buCn}]`);
check('comptes ×10 (20 → 200)', buCn[0] === bmCn[0] * 10);
check('générations ×10 (20 → 200)', buCn[1] === bmCn[1] * 10);
check('gérants ×10 (5 → 50)', buCn[2] === bmCn[2] * 10);
check('IA collaborateurs = 5 (valeur explicite de la mission, pas 10)', buCn[3] === 5);
check(
  'mention propriétaire IA conservée dans les 2 offres',
  flat(bm).includes('Le propriétaire possède automatiquement son propre accès à l’IA') &&
    flat(bu).includes('Le propriétaire possède automatiquement son propre accès à l’IA')
);

/* ── 6. Accès IA ── */
console.log('\n6️⃣  Accès IA');
const ultimeAcces = group(byId('ultime'), 'Accès à l’IA');
check('Ultime : accès propriétaire automatique, aucun collaborateur',
  !!ultimeAcces && ultimeAcces.items.length === 2 &&
    ultimeAcces.items[0].fr.includes('automatiquement') &&
    ultimeAcces.items[1].fr.includes('Aucun collaborateur supplémentaire'));
const bmIA = group(bm, 'Intelligence artificielle');
check('Business Max : propriétaire + 1 collaborateur (remplaçable/retirable)',
  !!bmIA && bmIA.items.some((i) => i.fr.includes('automatique pour le propriétaire')) &&
    bmIA.items.some((i) => i.fr.includes('1 collaborateur supplémentaire')) &&
    bmIA.items.some((i) => i.fr.includes('respecte les permissions')));
const buIA = group(bu, 'Intelligence artificielle avancée');
check('Business Ultime : propriétaire + jusqu’à 5 collaborateurs + contrôle conservé',
  !!buIA && buIA.items.some((i) => i.fr.includes('Jusqu’à 5 collaborateurs')) &&
    buIA.items.some((i) => i.fr.includes('conserve toujours le contrôle')));

/* ── 7. Boutons ── */
console.log('\n7️⃣  Boutons');
const ctaOf = Object.fromEntries(PLANS.map((p) => [p.id, p.cta]));
check(
  'conformes à la mission (free, subscribe, subscribe, soon, soon, soon)',
  ctaOf.essential === 'free' && ctaOf.pro === 'subscribe' && ctaOf.max === 'subscribe' &&
    ctaOf.ultime === 'soon' && ctaOf['business-max'] === 'soon' && ctaOf['business-ultime'] === 'soon',
  JSON.stringify(ctaOf)
);
check(
  'libellés : Commencer gratuitement / S’abonner / Bientôt disponible',
  CTA_LABELS.free.fr === 'Commencer gratuitement' &&
    CTA_LABELS.subscribe.fr === 'S’abonner' &&
    CTA_LABELS.soon.fr === 'Bientôt disponible'
);
check('badge « Le plus populaire » sur Max uniquement',
  byId('max').badge && PLANS.filter((p) => p.badge).length === 1);
check('5 règles Business', BUSINESS_RULES.length === 5);

console.log(`\nRESULTAT : ${pass} reussi(s) / ${fail} echoue(s)`);
process.exitCode = fail ? 1 : 0;
