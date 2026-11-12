// COMAXE — Vérification du moteur d'abonnement (src/lib/billing/)
//   1. Structure et complétude de la config des 3 plans (Essential/Pro/Max)
//   2. Prix cohérents avec le marketing (src/components/marketing/plans.ts)
//   3. Limites numériques ↔ textes des cartes
//   4. Historique (3 jours / illimité) ↔ textes
//   5. Fonctionnalités (Objectifs/Analytique/Publicité) ↔ textes
//   6. Configuration Stripe (noms d'env, aucune fausse valeur)
//   7. Extensibilité (ajout futur d'un plan sans toucher aux pages)
//   8-10. Entitlements, compteurs, messages dynamiques
//   11. SQL serveur (scripts/billing.sql) ↔ config TS : limites, features,
//       statuts, triggers, messages — le miroir ne doit jamais dériver
//   12. Architecture : middleware + pages verrouillées + historique central,
//       zéro comparaison de plan en dur dans les pages
//   13. Gates de mutation (limites/fonctionnalités avant chaque écriture),
//       compteurs réutilisables exposés, erreurs affichées par les pages
//   14. Stripe : .env.example (5 vars, vides), config serveur sans clé en
//       dur, routeur d'événements idempotent, 4 routes API (demande ≠
//       paiement, webhook signé, simulateur sur l'utilisateur de session)
// Usage : node scripts/billing-verify.mjs
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'fs';
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

/* ── Compilation du moteur complet (types, config, usage, entitlements, messages) ── */
const outBilling = mkdtempSync(join(tmpdir(), 'comaxe-billing-'));
try {
  execSync(
    'npx tsc src/lib/billing/plans.config.ts src/lib/billing/usage.ts' +
      ' src/lib/billing/entitlements.ts src/lib/billing/messages.ts' +
      ' --outDir "' + outBilling +
      '" --rootDir src/lib/billing --target es2020 --module commonjs --skipLibCheck',
    { cwd: ROOT, stdio: 'pipe' }
  );
} catch (e) {
  console.error('ECHEC compilation moteur billing :', (e.stdout && e.stdout.toString()) || e.message);
  process.exit(1);
}
const billing = await import(pathToFileURL(join(outBilling, 'plans.config.js')).href);
const usageMod = await import(pathToFileURL(join(outBilling, 'usage.js')).href);
const ent = await import(pathToFileURL(join(outBilling, 'entitlements.js')).href);
const msg = await import(pathToFileURL(join(outBilling, 'messages.js')).href);

/* ── Compilation du marketing (source des textes) ── */
const outPlans = mkdtempSync(join(tmpdir(), 'comaxe-plans-mkt-'));
try {
  execSync(
    'npx tsc src/components/marketing/plans.ts --outDir "' + outPlans +
      '" --rootDir src/components/marketing --target es2020 --module commonjs --skipLibCheck',
    { cwd: ROOT, stdio: 'pipe' }
  );
} catch (e) {
  console.error('ECHEC compilation plans.ts :', (e.stdout && e.stdout.toString()) || e.message);
  process.exit(1);
}
const { PLANS } = await import(pathToFileURL(join(outPlans, 'plans.js')).href);

rmSync(outBilling, { recursive: true, force: true });
rmSync(outPlans, { recursive: true, force: true });

const { PLANS_CONFIG, DEFAULT_PLAN_ID, PLAN_IDS, getPlan, isPlanId } = billing;
const {
  resolveActivePlan, getEntitlements, isFeatureUnlocked, canUseFeature,
  historyCutoff, isWithinHistory, checkCanCreate, nextPlanId,
} = ent;
const {
  getResourceUsage, getAllUsage, countSalesThisMonth, countActiveDebts,
  buildUsageCounts, isSameMonth,
} = usageMod;
const { limitReachedMessage, featureLockedMessage, formatMessage } = msg;

console.log('════════════════════════════════════════════');
console.log('  VERIFY BILLING — moteur Essential/Pro/Max');
console.log('════════════════════════════════════════════\n');

/* ── Helpers ── */
const byId = (id) => PLANS.find((p) => p.id === id);
const norm = (s) => String(s).replace(/[\u00A0\u202F\s]+/g, ' ').trim();
const flat = (p) =>
  norm(p.details.map((g) => g.title.fr + ' :: ' + g.items.map((i) => i.fr).join(' | ')).join(' ; '));
const num = (s) => parseInt(String(s).replace(/[\u00A0\s]/g, ''), 10);
const REQUIRED_LIMITS = [
  'salesPerMonth', 'products', 'customers', 'activeDebts',
  'expensesHistoryDays', 'profitsHistoryDays',
];
const REQUIRED_FEATURES = ['goals', 'analytics', 'ads'];

/* ══ 1. Structure du moteur ══ */
console.log('1️⃣  Structure de la config');
check('PLAN_IDS exact = essential,pro,max', PLAN_IDS.join(',') === 'essential,pro,max', PLAN_IDS.join(','));
check('3 entrées dans PLANS_CONFIG', Object.keys(PLANS_CONFIG).length === 3, `n=${Object.keys(PLANS_CONFIG).length}`);
check('clés === PLAN_IDS', Object.keys(PLANS_CONFIG).join(',') === PLAN_IDS.join(','));
for (const id of PLAN_IDS) {
  const p = PLANS_CONFIG[id];
  check(`[${id}] id/cohérence`, p && p.id === id && typeof p.name === 'string');
  check(
    `[${id}] limites complètes`,
    p && REQUIRED_LIMITS.every((k) => k in p.limits),
    p ? REQUIRED_LIMITS.filter((k) => !(k in p.limits)).join(',') || 'ok' : 'absent'
  );
  check(
    `[${id}] features complètes`,
    p && REQUIRED_FEATURES.every((k) => typeof p.features[k] === 'boolean'),
    p ? REQUIRED_FEATURES.filter((k) => typeof p.features[k] !== 'boolean').join(',') || 'ok' : 'absent'
  );
  check(
    `[${id}] stripe.priceIdEnvMonthly/Annual valide (null = gratuit, sinon nom de variable)`,
    p && [p.stripe.priceIdEnvMonthly, p.stripe.priceIdEnvAnnual]
      .every((v) => v === null || typeof v === 'string'),
    p ? `${p.stripe.priceIdEnvMonthly} / ${p.stripe.priceIdEnvAnnual}` : 'absent'
  );
}
check('DEFAULT_PLAN_ID = essential', DEFAULT_PLAN_ID === 'essential', String(DEFAULT_PLAN_ID));
check("isPlanId('essential') === true", isPlanId('essential') === true);
check("isPlanId('ultime') === false (futur plan non implémenté)", isPlanId('ultime') === false);
check('getPlan("pro").priceMonthly === 5', getPlan('pro').priceMonthly === 5);
check('getPlan("max").priceMonthly === 14', getPlan('max').priceMonthly === 14);
check('getPlan("pro").priceAnnual === 49', getPlan('pro').priceAnnual === 49);
check('getPlan("max").priceAnnual === 149', getPlan('max').priceAnnual === 149);

/* ══ 2. Prix ↔ marketing ══ */
console.log('\n2️⃣  Prix ↔ marketing');
const pricePairs = [
  ['essential', null, 0],
  ['pro', 5, 5],
  ['max', 14, 14],
];
for (const [id, mkt, cfg] of pricePairs) {
  const m = byId(id);
  check(`[${id}] prix marketing ↔ config`, m && m.priceMonthly === mkt && PLANS_CONFIG[id].priceMonthly === cfg,
    `mkt=${m && m.priceMonthly} cfg=${PLANS_CONFIG[id].priceMonthly}`);
}
const annualPairs = [['pro', 49], ['max', 149]];
for (const [id, a] of annualPairs) {
  const m = byId(id);
  check(`[${id}] prix annuel marketing ↔ config (${a} $/an)`,
    m && m.priceAnnual === a && PLANS_CONFIG[id].priceAnnual === a,
    `mkt=${m && m.priceAnnual} cfg=${PLANS_CONFIG[id].priceAnnual}`);
}
check("CTA marketing essential = free", byId('essential').cta === 'free');
check("CTA marketing pro/max = subscribe", byId('pro').cta === 'subscribe' && byId('max').cta === 'subscribe');

/* ══ 3. Limites numériques ↔ textes ══ */
console.log('\n3️⃣  Limites ↔ textes marketing');
const limitTexts = {
  essential: ['15 ventes par mois', '10 produits', '15 clients', '5 dettes actives'],
  pro: ['200 ventes par mois', '70 produits', '200 clients', '50 dettes actives'],
  max: ['1 000 ventes par mois', '600 produits', '1 000 clients', '400 dettes actives'],
};
for (const id of PLAN_IDS) {
  const text = flat(byId(id));
  const missing = limitTexts[id].filter((s) => !text.includes(norm(s)));
  check(`[${id}] textes de limites présents`, missing.length === 0, missing.join(' | ') || 'ok');

  const cfg = PLANS_CONFIG[id].limits;
  const mSales = text.match(/(\d[\d\u00A0\u202F ]*) ventes par mois/);
  const mProd = text.match(/(\d[\d\u00A0\u202F ]*) produits/);
  const mCust = text.match(/(\d[\d\u00A0\u202F ]*) clients/);
  const mDebt = text.match(/(\d[\d\u00A0\u202F ]*) dettes actives/);
  check(`[${id}] ventes : texte = config`,
    mSales && num(mSales[1]) === cfg.salesPerMonth,
    `texte=${mSales && num(mSales[1])} cfg=${cfg.salesPerMonth}`);
  check(`[${id}] produits : texte = config`,
    mProd && num(mProd[1]) === cfg.products,
    `texte=${mProd && num(mProd[1])} cfg=${cfg.products}`);
  check(`[${id}] clients : texte = config`,
    mCust && num(mCust[1]) === cfg.customers,
    `texte=${mCust && num(mCust[1])} cfg=${cfg.customers}`);
  check(`[${id}] dettes : texte = config`,
    mDebt && num(mDebt[1]) === cfg.activeDebts,
    `texte=${mDebt && num(mDebt[1])} cfg=${cfg.activeDebts}`);
}

/* ══ 4. Historique ↔ textes ══ */
console.log('\n4️⃣  Historique ↔ textes marketing');
{
  const eText = flat(byId('essential'));
  const eCfg = PLANS_CONFIG.essential.limits;
  check('essential : 3 jours dépenses (texte)',
    eText.includes(norm('3 jours d’historique des dépenses')));
  check('essential : 3 jours bénéfices (texte)',
    eText.includes(norm('3 jours d’historique des bénéfices')));
  check('essential : config 3 / 3',
    eCfg.expensesHistoryDays === 3 && eCfg.profitsHistoryDays === 3,
    `${eCfg.expensesHistoryDays}/${eCfg.profitsHistoryDays}`);
  for (const id of ['pro', 'max']) {
    const text = flat(byId(id));
    const cfg = PLANS_CONFIG[id].limits;
    check(`[${id}] dépenses illimitées (texte)`, text.includes('Dépenses illimitées'));
    check(`[${id}] bénéfices illimités (texte)`, text.includes('Bénéfices illimités'));
    check(`[${id}] config null / null`,
      cfg.expensesHistoryDays === null && cfg.profitsHistoryDays === null,
      `${cfg.expensesHistoryDays}/${cfg.profitsHistoryDays}`);
  }
}

/* ══ 5. Fonctionnalités ↔ textes ══ */
console.log('\n5️⃣  Fonctionnalités ↔ textes marketing');
{
  const eText = flat(byId('essential'));
  const eF = PLANS_CONFIG.essential.features;
  check('essential : Objectifs bloqués (texte + config)',
    eText.includes('Objectifs bloqués') && eF.goals === false);
  check('essential : Analytique bloquée (texte + config)',
    eText.includes('Analytique bloquée') && eF.analytics === false);
  check('essential : Publicités activées (texte + config)',
    eText.includes('Publicités activées') && eF.ads === true);
  for (const id of ['pro', 'max']) {
    const text = flat(byId(id));
    const f = PLANS_CONFIG[id].features;
    check(`[${id}] Objectifs débloqués`, text.includes('Objectifs débloqués') && f.goals === true);
    check(`[${id}] Analytique débloquée`, text.includes('Analytique débloquée') && f.analytics === true);
    check(`[${id}] Sans publicité`, text.includes('Sans publicité') && f.ads === false);
  }
}

/* ══ 6. Configuration Stripe ══ */
console.log('\n6️⃣  Configuration Stripe');
{
  const eM = PLANS_CONFIG.essential.stripe.priceIdEnvMonthly;
  const eA = PLANS_CONFIG.essential.stripe.priceIdEnvAnnual;
  const pM = PLANS_CONFIG.pro.stripe.priceIdEnvMonthly;
  const pA = PLANS_CONFIG.pro.stripe.priceIdEnvAnnual;
  const mM = PLANS_CONFIG.max.stripe.priceIdEnvMonthly;
  const mA = PLANS_CONFIG.max.stripe.priceIdEnvAnnual;
  check('essential : pas de Price ID (gratuit)', eM === null && eA === null,
    `${eM} / ${eA}`);
  check('pro : STRIPE_PRO_PRICE_ID_MONTHLY + STRIPE_PRO_PRICE_ID_ANNUAL',
    pM === 'STRIPE_PRO_PRICE_ID_MONTHLY' && pA === 'STRIPE_PRO_PRICE_ID_ANNUAL',
    `${pM} / ${pA}`);
  check('max : STRIPE_MAX_PRICE_ID_MONTHLY + STRIPE_MAX_PRICE_ID_ANNUAL',
    mM === 'STRIPE_MAX_PRICE_ID_MONTHLY' && mA === 'STRIPE_MAX_PRICE_ID_ANNUAL',
    `${mM} / ${mA}`);
  const envOk = [pM, pA, mM, mA].every((v) => /^[A-Z][A-Z0-9_]*$/.test(v));
  check("noms d'variables valides (MAJUSCULES_)", envOk);
  const raw = JSON.stringify(PLANS_CONFIG);
  const noFakeIds = !/(price_|sk_live|sk_test|pk_live|pk_test|whsec_)/.test(raw);
  check('aucune fausse clé / valeur Stripe en dur', noFakeIds);
}

/* ══ 7. Extensibilité ══ */
console.log('\n7️⃣  Extensibilité');
{
  const mktIds = PLANS.map((p) => p.id).join(',');
  check('marketing a 6 offres (moteur en a 3 pour l’instant)',
    PLANS.length === 6, `mkt=${mktIds}`);
  const futureOk = ['ultime', 'business-max', 'business-ultime'].every((id) => !PLAN_IDS.includes(id));
  check('plans futurs NON implémentés (phase 1)', futureOk);
  check('config 100 % typée : aucune entrée fantôme',
    Object.keys(PLANS_CONFIG).every((k) => PLAN_IDS.includes(k)));
}

/* ══ 8. Entitlements : plan actif, features, historique ══ */
console.log('\n8️⃣  Entitlements (plan actif ≠ plan demandé)');
const sub = (over = {}) => ({
  userId: 'u-test',
  planId: 'essential',
  requestedPlanId: null,
  status: 'active',
  startedAt: '2026-01-01T00:00:00.000Z',
  currentPeriodStart: '2026-01-01T00:00:00.000Z',
  currentPeriodEnd: null,
  endsAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
check('sans abonnement → Essential (gratuit)', resolveActivePlan(null) === 'essential');
check('actif pro → Pro', resolveActivePlan(sub({ planId: 'pro' })) === 'pro');
check('past_due max → Max (grâce conservée)', resolveActivePlan(sub({ planId: 'max', status: 'past_due' })) === 'max');
check(
  'pending : plan DEMANDÉ pro, plan ACTIF essential',
  resolveActivePlan(sub({ planId: 'essential', requestedPlanId: 'pro', status: 'pending' })) === 'essential'
);
check('canceled pro → retour gratuit', resolveActivePlan(sub({ planId: 'pro', status: 'canceled' })) === 'essential');
check('expired max → retour gratuit', resolveActivePlan(sub({ planId: 'max', status: 'expired' })) === 'essential');
check('unpaid pro → retour gratuit', resolveActivePlan(sub({ planId: 'pro', status: 'unpaid' })) === 'essential');

const e0 = getEntitlements(null);
check('entitlements(null) : essential + status none',
  e0.planId === 'essential' && e0.status === 'none' && e0.requestedPlanId === null);
const ePending = getEntitlements(sub({ planId: 'essential', requestedPlanId: 'pro', status: 'pending' }));
check('entitlements : plan actuel essential / demandé pro conservé',
  ePending.planId === 'essential' && ePending.requestedPlanId === 'pro');

check("essential : Objectifs VERROUILLÉ", isFeatureUnlocked('essential', 'goals') === false);
check("essential : Analytique VERROUILLÉE", isFeatureUnlocked('essential', 'analytics') === false);
check("essential : Publicité active", isFeatureUnlocked('essential', 'ads') === true);
check("pro : Objectifs+Analytique ouverts, sans pub",
  isFeatureUnlocked('pro', 'goals') === true &&
  isFeatureUnlocked('pro', 'analytics') === true &&
  isFeatureUnlocked('pro', 'ads') === false);
check("max : mêmes fonctionnalités que Pro",
  isFeatureUnlocked('max', 'goals') === true &&
  isFeatureUnlocked('max', 'analytics') === true &&
  isFeatureUnlocked('max', 'ads') === false);
check('canUseFeature(abonnement essential, analytics) false',
  canUseFeature(sub(), 'analytics') === false);
check('canUseFeature(abonnement pro, analytics) true',
  canUseFeature(sub({ planId: 'pro' }), 'analytics') === true);

check("nextPlanId : essential→pro→max→null", nextPlanId('essential') === 'pro' && nextPlanId('pro') === 'max' && nextPlanId('max') === null);

/* ══ 9. Usage : compteurs, limites, historique ══ */
console.log('\n9️⃣  Usage : compteurs et limites');
const NOW = new Date();
const thisMonth = new Date(NOW.getFullYear(), NOW.getMonth(), 15, 12).toISOString();
const prevMonth = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 15, 12).toISOString();
const nextMonth = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 15, 12).toISOString();

check('isSameMonth : mois courant true',
  isSameMonth(thisMonth, NOW) === true);
check('isSameMonth : mois précédent false / suivant false / invalide false',
  isSameMonth(prevMonth, NOW) === false &&
  isSameMonth(nextMonth, NOW) === false &&
  isSameMonth('pas-une-date', NOW) === false &&
  isSameMonth(undefined, NOW) === false);
check('countSalesThisMonth : 1 sur 4 (mois courant seul)',
  countSalesThisMonth(
    [{ createdAt: thisMonth }, { createdAt: prevMonth }, { createdAt: nextMonth }, { createdAt: 'invalid' }],
    NOW
  ) === 1);
check('countActiveDebts : solde > 0 uniquement',
  countActiveDebts([{ remainingAmount: 50 }, { remainingAmount: 0 }, { remainingAmount: 100 }]) === 2);

const counts = buildUsageCounts(
  { sales: [{ createdAt: thisMonth }, { createdAt: thisMonth }], products: [{}, {}], customers: [{}], debts: [{ remainingAmount: 10 }] },
  NOW
);
check('buildUsageCounts', counts.salesCurrentMonth === 2 && counts.products === 2 && counts.customers === 1 && counts.activeDebts === 1,
  JSON.stringify(counts));

const u30 = getResourceUsage('essential', 'product', { salesCurrentMonth: 0, products: 10, customers: 0, activeDebts: 0 });
check('essential 10/10 produits → refus, reste 0, 100 %',
  u30.canCreate === false && u30.remaining === 0 && u30.percent === 100 && u30.limit === 10 && u30.used === 10);
const u29 = getResourceUsage('essential', 'product', { salesCurrentMonth: 0, products: 9, customers: 0, activeDebts: 0 });
check('essential 9/10 produits → autorisé, reste 1', u29.canCreate === true && u29.remaining === 1 && u29.percent === 90);
check('essential 15/15 ventes/mois → refus',
  getResourceUsage('essential', 'sale', { salesCurrentMonth: 15, products: 0, customers: 0, activeDebts: 0 }).canCreate === false);
check('essential 14/15 ventes/mois → autorisé',
  getResourceUsage('essential', 'sale', { salesCurrentMonth: 14, products: 0, customers: 0, activeDebts: 0 }).canCreate === true);
check('essential 5/5 dettes → refus',
  getResourceUsage('essential', 'debt', { salesCurrentMonth: 0, products: 0, customers: 0, activeDebts: 5 }).canCreate === false);
check('essential 15/15 clients → refus',
  getResourceUsage('essential', 'customer', { salesCurrentMonth: 0, products: 0, customers: 15, activeDebts: 0 }).canCreate === false);
check('pro 200/200 ventes → refus / 199 → autorisé',
  getResourceUsage('pro', 'sale', { salesCurrentMonth: 200, products: 0, customers: 0, activeDebts: 0 }).canCreate === false &&
  getResourceUsage('pro', 'sale', { salesCurrentMonth: 199, products: 0, customers: 0, activeDebts: 0 }).canCreate === true);
check('pro 70/70 produits → refus / 69 → autorisé',
  getResourceUsage('pro', 'product', { salesCurrentMonth: 0, products: 70, customers: 0, activeDebts: 0 }).canCreate === false &&
  getResourceUsage('pro', 'product', { salesCurrentMonth: 0, products: 69, customers: 0, activeDebts: 0 }).canCreate === true);
check('max 1000/1000 ventes → refus / 999 → autorisé',
  getResourceUsage('max', 'sale', { salesCurrentMonth: 1000, products: 0, customers: 0, activeDebts: 0 }).canCreate === false &&
  getResourceUsage('max', 'sale', { salesCurrentMonth: 999, products: 0, customers: 0, activeDebts: 0 }).canCreate === true);
check('max 600/600 produits et 1000/1000 clients → refus / 400/400 dettes → refus',
  getResourceUsage('max', 'product', { salesCurrentMonth: 0, products: 600, customers: 0, activeDebts: 0 }).canCreate === false &&
  getResourceUsage('max', 'customer', { salesCurrentMonth: 0, products: 0, customers: 1000, activeDebts: 0 }).canCreate === false &&
  getResourceUsage('max', 'debt', { salesCurrentMonth: 0, products: 0, customers: 0, activeDebts: 400 }).canCreate === false);
check('getAllUsage : 4 ressources', Object.keys(getAllUsage('pro', counts)).join(',') === 'sale,product,customer,debt');

const chk = checkCanCreate('essential', 'product', { salesCurrentMonth: 0, products: 10, customers: 0, activeDebts: 0 });
check('checkCanCreate refus : port {planId, resource, used, limit}',
  chk.ok === false && chk.planId === 'essential' && chk.resource === 'product' && chk.used === 10 && chk.limit === 10);

const cutEss = historyCutoff('essential', 'expense', NOW);
const daysDiff = cutEss ? (NOW - cutEss) / 86400000 : -1;
check('historyCutoff essential ≈ 3 jours', cutEss !== null && Math.round(daysDiff) === 3, `${daysDiff.toFixed(2)} j`);
check('historyCutoff pro/max → null (illimité)',
  historyCutoff('pro', 'expense', NOW) === null &&
  historyCutoff('max', 'profit', NOW) === null);
const twoDaysAgo = new Date(NOW.getTime() - 2 * 86400000).toISOString();
const fourDaysAgo = new Date(NOW.getTime() - 4 * 86400000).toISOString();
const threeYearsAgo = new Date(NOW.getTime() - 1000 * 86400000).toISOString();
check('isWithinHistory essential : 2 j dedans / 4 j dehors / sans date dehors',
  isWithinHistory('essential', 'expense', twoDaysAgo, NOW) === true &&
  isWithinHistory('essential', 'expense', fourDaysAgo, NOW) === false &&
  isWithinHistory('essential', 'expense', '', NOW) === false);
check('isWithinHistory pro : 3 ans dedans (illimité)',
  isWithinHistory('pro', 'expense', threeYearsAgo, NOW) === true);

/* ══ 10. Messages dynamiques ══ */
console.log('\n🔟  Messages dynamiques');
{
  const m = limitReachedMessage({ planId: 'essential', resource: 'product', used: 10, limit: 10 });
  check('limite produits FR : 10 + produits + Essential + Pro',
    m.fr.includes('10') && m.fr.includes('produits') && m.fr.includes('Essential') && m.fr.includes('Pro') && m.fr.startsWith('Vous avez atteint'),
    m.fr);
  check('limite produits EN : 10 + products + Pro',
    m.en.includes('10') && m.en.includes('products') && m.en.includes('Pro'), m.en);

  const mSale = limitReachedMessage({ planId: 'essential', resource: 'sale', used: 15, limit: 15 });
  check('limite ventes FR : « 15 ventes par mois »', norm(mSale.fr).includes('15 ventes par mois'), mSale.fr);

  const mMax = limitReachedMessage({ planId: 'max', resource: 'sale', used: 1000, limit: 1000 });
  check('limite max FR : « 1 000 » + sans offre supérieure',
    norm(mMax.fr).includes('1 000') && !mMax.fr.includes('Passez à'), mMax.fr);

  const mDebt = limitReachedMessage({ planId: 'pro', resource: 'debt', used: 50, limit: 50 });
  check('limite dettes FR : 50 + dettes actives + Max (suivante)',
    mDebt.fr.includes('50') && mDebt.fr.includes('dettes actives') && mDebt.fr.includes('Max'), mDebt.fr);

  const mCust = limitReachedMessage({ planId: 'essential', resource: 'customer', used: 15, limit: 15 });
  check('limite clients FR : « 15 clients »', norm(mCust.fr).includes('15 clients'), mCust.fr);

  const f = featureLockedMessage('essential', 'analytics');
  check('fonctionnalité verrouillée FR : Analytique + Essential + Pro',
    f.fr.includes('Analytique') && f.fr.includes('Essential') && f.fr.includes('Pro'), f.fr);
  check('fonctionnalité verrouillée EN : Analytics',
    f.en.includes('Analytics') && f.en.includes('Pro'), f.en);
  const fGoals = featureLockedMessage('essential', 'goals');
  check('Objectifs verrouillés FR', fGoals.fr.includes('Objectifs'), fGoals.fr);
  check('formatMessage locale', formatMessage(f, 'fr') === f.fr && formatMessage(f, 'en') === f.en);
}

/* ══ 11. SQL serveur ↔ config TS (scripts/billing.sql) ══ */
console.log('\n1️⃣1  SQL serveur ↔ config TS (billing.sql)');
{
  const sqlText = readFileSync(join(__dirname, 'billing.sql'), 'utf8');
  const normApo = (s) => String(s).replace(/[\u2018\u2019]/g, "'");

  // Parse une ligne `WHEN '<x>' THEN CASE p_plan WHEN '<plan>' THEN <valeur> ... END`
  const parseCaseLine = (label) => {
    const line = sqlText.split('\n').find((l) => l.includes(`WHEN '${label}' THEN CASE p_plan`));
    if (!line) return null;
    const out = {};
    for (const m of line.matchAll(/WHEN '([\w-]+)' THEN (TRUE|FALSE|\d+)/g)) {
      out[m[1]] = m[2] === 'TRUE' ? true : m[2] === 'FALSE' ? false : Number(m[2]);
    }
    return out;
  };

  // Limites : 4 ressources × 3 plans
  const sqlLimits = { sales: 'salesPerMonth', products: 'products', customers: 'customers', debts: 'activeDebts' };
  for (const [res, key] of Object.entries(sqlLimits)) {
    const parsed = parseCaseLine(res);
    const diffs = PLAN_IDS
      .filter((id) => !parsed || parsed[id] !== PLANS_CONFIG[id].limits[key])
      .map((id) => `${id}: sql=${parsed ? parsed[id] : 'ligne absente'} ts=${PLANS_CONFIG[id].limits[key]}`);
    check(`limites SQL [${res}] ↔ config.limits.${key}`, diffs.length === 0, diffs.join(' | ') || 'ok');
  }

  // Fonctionnalités : goals / analytics / ads
  for (const feat of ['goals', 'analytics', 'ads']) {
    const parsed = parseCaseLine(feat);
    const diffs = PLAN_IDS
      .filter((id) => !parsed || parsed[id] !== PLANS_CONFIG[id].features[feat])
      .map((id) => `${id}: sql=${parsed ? parsed[id] : '?'} ts=${PLANS_CONFIG[id].features[feat]}`);
    check(`features SQL [${feat}] ↔ config.features.${feat}`, diffs.length === 0, diffs.join(' | ') || 'ok');
  }

  // Contraintes CHECK plan_id / requested_plan_id ↔ PLAN_IDS (nouveau plan = 2 endroits)
  const idsIn = (re) => {
    const m = sqlText.match(re);
    return m ? [...m[1].matchAll(/'([\w-]+)'/g)].map((x) => x[1]) : [];
  };
  const sqlPlanIds = idsIn(/plan_id IN \(([^)]+)\)/);
  check('CHECK plan_id SQL ↔ PLAN_IDS', sqlPlanIds.join(',') === PLAN_IDS.join(','), sqlPlanIds.join(','));
  const sqlReqIds = idsIn(/requested_plan_id IS NULL OR requested_plan_id IN \(([^)]+)\)/);
  check('CHECK requested_plan_id SQL ↔ PLAN_IDS', sqlReqIds.join(',') === PLAN_IDS.join(','), sqlReqIds.join(','));

  // Statuts SQL ↔ SubscriptionStatus (types.ts)
  const typesSrc = readFileSync(join(ROOT, 'src/lib/billing/types.ts'), 'utf8');
  const mTsStatus = typesSrc.match(/SubscriptionStatus\s*=\s*([^;]+);/);
  const tsStatuses = mTsStatus ? [...mTsStatus[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : [];
  const mSqlStatus = sqlText.match(/CHECK \(status IN \(([^)]+)\)\)/);
  const sqlStatuses = mSqlStatus ? [...mSqlStatus[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : [];
  check('statuts SQL ↔ SubscriptionStatus (types.ts)',
    sqlStatuses.join(',') === tsStatuses.join(','),
    `sql=[${sqlStatuses.join(',')}] ts=[${tsStatuses.join(',')}]`);

  // Plan actif SQL (granting) ↔ resolveActivePlan
  check("billing_active_plan : granted = active,past_due,pending (miroir resolveActivePlan)",
    sqlText.includes("s.status IN ('active','past_due','pending')"));

  // Messages serveur (RAISE) ↔ messages.ts (FR) : rendu du template SQL
  const sqlLimitTmpl = (sqlText.match(/Vous avez atteint la limite de % % de votre offre %\. Passez à % pour continuer\./) || [])[0];
  const lVals = ['10', 'produits', 'Essential', 'Pro'];
  const sqlLimitRendered = sqlLimitTmpl ? sqlLimitTmpl.replace(/%/g, () => lVals.shift()) : null;
  const tsLimitRendered = limitReachedMessage({ planId: 'essential', resource: 'product', used: 10, limit: 10 }).fr;
  check('message RAISE SQL limite = limitReachedMessage TS (FR)',
    sqlLimitRendered === tsLimitRendered,
    `sql=${sqlLimitRendered ?? 'template absent'} | ts=${tsLimitRendered}`);

  const sqlGoalTmpl = (sqlText.match(/La fonctionnalité « Objectifs » est verrouillée avec votre offre %\. Passez à % pour l''activer\./) || [])[0];
  const gVals = ['Essential', 'Pro'];
  const sqlGoalRendered = sqlGoalTmpl ? normApo(sqlGoalTmpl.replace(/%/g, () => gVals.shift()).replace(/''/g, "'")) : null;
  const tsGoalRendered = normApo(featureLockedMessage('essential', 'goals').fr);
  check('message RAISE SQL Objectifs = featureLockedMessage TS (FR)',
    sqlGoalRendered === tsGoalRendered,
    `sql=${sqlGoalRendered ?? 'template absent'} | ts=${tsGoalRendered}`);

  // Mécaniques clés présentes dans le SQL
  check('ventes : comptage mois civil via created_at_ts (date_trunc month)',
    sqlText.includes("created_at_ts >= date_trunc('month', NOW())"));
  check('dettes : filtre solde actif (remaining_amount > 0)',
    sqlText.includes('WHERE user_id = NEW.user_id AND remaining_amount > 0'));
  check("trigger d'inscription → abonnement Essential pour les nouveaux comptes",
    sqlText.includes('on_auth_user_created_billing') && sqlText.includes("VALUES (NEW.id, 'essential'"));
  check('seed : comptes existants migrés en Essential',
    sqlText.includes('FROM auth.users u') && sqlText.includes("'essential', 'active', NOW(), NOW()"));
  for (const t of ['products', 'customers', 'sales', 'debts']) {
    check(`trigger billing_limits_${t} déclaré`, sqlText.includes(`CREATE TRIGGER billing_limits_${t}`));
  }
  check('trigger billing_feature_goals déclaré (INSERT OR UPDATE)', sqlText.includes('CREATE TRIGGER billing_feature_goals'));
  check("RLS : aucune policy d'écriture client sur subscriptions",
    !/CREATE POLICY[^;]*ON subscriptions FOR (INSERT|UPDATE|DELETE)/m.test(sqlText));
}

/* ══ 12. Architecture : verrous, pages, historique central ══ */
console.log('\n1️⃣2  Architecture (middleware, pages, historique)');
{
  // Balayage récursif des pages (.tsx de src/app)
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
  const pageFiles = walk(join(ROOT, 'src', 'app'));

  // (a) Zéro comparaison de plan en dur dans les pages
  const planComparisons = [];
  for (const file of pageFiles) {
    const src = readFileSync(file, 'utf8');
    const hits = src.match(/['"](essential|pro|max|business-max|business-ultime|ultime)['"]\s*===|===\s*['"](essential|pro|max|business-max|business-ultime|ultime)['"]/g);
    if (hits) planComparisons.push(`${file.replace(ROOT, '')}: ${hits.join(' ')}`);
  }
  check('zéro comparaison de plan en dur dans src/app (règles centralisées)',
    planComparisons.length === 0, planComparisons.join(' | ') || 'ok');

  // (b) Middleware : les deux verrous d'accès serveur
  const mw = readFileSync(join(ROOT, 'src', 'middleware.ts'), 'utf8');
  check("middleware : gate /objectifs → goals", mw.includes("'/objectifs': 'goals'"));
  check("middleware : gate /analytique → analytics", mw.includes("'/analytique': 'analytics'"));
  check('middleware : plan actif via resolveActivePlan + redirection /tarifs?locked=',
    mw.includes('resolveActivePlan') && mw.includes('/tarifs?locked='));

  // (c) Pages verrouillées : état fonctionnel en plus du middleware
  const objPage = readFileSync(join(ROOT, 'src/app/(app)/objectifs/page.tsx'), 'utf8');
  check('objectifs : gate client isFeatureUnlocked(goals) + État verrouillé',
    objPage.includes("isFeatureUnlocked(planId, 'goals')") && objPage.includes('<FeatureLocked feature="goals"'));
  const anaPage = readFileSync(join(ROOT, 'src/app/(app)/analytique/page.tsx'), 'utf8');
  check('analytique : gate client isFeatureUnlocked(analytics) + État verrouillé',
    anaPage.includes("isFeatureUnlocked(planId, 'analytics')") && anaPage.includes('<FeatureLocked feature="analytics"'));

  // (d) Contexte billing monté au-dessus de CommerceProvider.
  //     BillingProvider vit au layout RACINE (dispo sur /, /tarifs, /login
  //     ET (app)) : il précède donc AppShell → CommerceProvider.
  const rootLayout = readFileSync(join(ROOT, 'src/app/layout.tsx'), 'utf8');
  const shell = readFileSync(join(ROOT, 'src/components/layout/AppShell.tsx'), 'utf8');
  check('BillingProvider monté au layout racine (au-dessus de CommerceProvider)',
    rootLayout.includes('<BillingProvider>') && shell.includes('<CommerceProvider>'));

  // (e) Fenêtre d'historique réellement branchée
  const commerce = readFileSync(join(ROOT, 'src/context/CommerceContext.tsx'), 'utf8');
  check('historique dépenses : filtre central isWithinHistory(expense)',
    commerce.includes("isWithinHistory(planId, 'expense'"));
  check('historique bénéfices : filtre central dans getPeriodMetrics(profit)',
    commerce.includes("isWithinHistory(planId, 'profit'"));
  check('mappage createdAt (created_at_ts) sur Sales et Expenses',
    (commerce.match(/createdAt: r\.created_at_ts/g) || []).length >= 2);
  const benefPage = readFileSync(join(ROOT, 'src/app/(app)/benefice/page.tsx'), 'utf8');
  check('page bénéfice : date active + totaux bornés à la fenêtre',
    benefPage.includes('historySales') && benefPage.includes('activeSales'));
}

/* ══ 13. Gates de mutation + compteurs ══ */
console.log('\n1️⃣3  Gates de mutation (limites & fonctionnalités)');
{
  const commerce = readFileSync(join(ROOT, 'src/context/CommerceContext.tsx'), 'utf8');
  const count = (needle) => commerce.split(needle).length - 1;

  check('addSale : gate limite de ventes', commerce.includes("guardResource('sale')"));
  check('addProduct : gate limite de produits', commerce.includes("guardResource('product')"));
  check('addDebt : gate limite de dettes actives', commerce.includes("guardResource('debt')"));
  check('gate client (vente/dette/création client) : limite clients',
    count("guardResource('customer')") >= 3);
  check('addGoal + updateGoal : gate fonctionnalité Objectifs',
    count("guardFeature('goals')") >= 2);
  check('messages centralisés (limitReachedMessage + featureLockedMessage + formatMessage)',
    commerce.includes('limitReachedMessage(') &&
    commerce.includes('featureLockedMessage(') &&
    commerce.includes('formatMessage('));
  // Ordre des gardes = ordre des insertions serveur (messages cohérents)
  const saleFn = commerce.slice(commerce.indexOf('const addSale'), commerce.indexOf('const updateSale'));
  check('ordre addSale : vente → client (miroir process_sale)',
    saleFn.indexOf("guardResource('sale')") < saleFn.indexOf("guardResource('customer')"));
  const debtFn = commerce.slice(commerce.indexOf('const addDebt'), commerce.indexOf('const recordDebtPayment'));
  check('ordre addDebt : dette → vente → client (miroir create_debt_with_history)',
    debtFn.indexOf("guardResource('debt')") < debtFn.indexOf("guardResource('sale')") &&
    debtFn.indexOf("guardResource('sale')") < debtFn.indexOf("guardResource('customer')"));

  // Compteurs réutilisables exposés (limite / utilisé / reste / % / autorisé)
  check('compteurs : usageCounts + usage calculés (buildUsageCounts/getAllUsage)',
    commerce.includes('buildUsageCounts(') && commerce.includes('getAllUsage('));
  check('compteurs exposés : usage + checkCreate dans la valeur du contexte',
    commerce.includes('        usage,') && commerce.includes('        checkCreate,'));
  check('interface : usage + checkCreate déclarés',
    commerce.includes('usage: Record<ResourceKey, ResourceUsage> | null') &&
    commerce.includes('checkCreate: (resource: ResourceKey) => CreateCheck | null'));

  // Les pages affichent réellement le refus (pas de refus silencieux)
  const stock = readFileSync(join(ROOT, 'src/app/(app)/stock/page.tsx'), 'utf8');
  check("page stock : refus affiché (addError + !res.success)",
    stock.includes('setAddError') && stock.includes('if (!res.success)'));
  const clients = readFileSync(join(ROOT, 'src/app/(app)/clients/page.tsx'), 'utf8');
  check('page clients : refus affiché (addError + !res.success)',
    clients.includes('setAddError') && clients.includes('if (!res.success)'));
  const obj = readFileSync(join(ROOT, 'src/app/(app)/objectifs/page.tsx'), 'utf8');
  check('page objectifs : refus affiché (setFormError + !res.success)',
    obj.includes('setFormError(res.error') && obj.includes('if (!res.success)'));
}

/* ══ 14. Stripe env + config serveur + routes API + idempotence ══ */
console.log('\n1️⃣4  Stripe (env, config serveur, webhook, simulateur)');
{
  const read = (p) => readFileSync(join(ROOT, p), 'utf8');
  const exists = (p) => { try { readFileSync(join(ROOT, p)); return true; } catch { return false; } };
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });

  // (a) .env.example : les 7 variables, valeur vide, aucune clé renseignée
  let envExample = '';
  try { envExample = read('.env.example'); } catch { /* absent */ }
  check('.env.example existe', envExample.length > 0);
  const ENV_VARS = [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRO_PRICE_ID_MONTHLY', 'STRIPE_PRO_PRICE_ID_ANNUAL',
    'STRIPE_MAX_PRICE_ID_MONTHLY', 'STRIPE_MAX_PRICE_ID_ANNUAL',
  ];
  for (const v of ENV_VARS) {
    check(`.env.example : ${v} déclarée, valeur VIDE`,
      new RegExp(`^${v}=$`, 'm').test(envExample), v);
  }
  const filled = envExample.split('\n').filter((l) =>
    !l.trimStart().startsWith('#') && /=\s*\S/.test(l) && /_(KEY|SECRET|ID)=/.test(l));
  check('.env.example : aucune valeur de clé renseignée', filled.length === 0, filled.join(' ; '));

  // (b) Aucune clé réelle ni Price ID codé en dur dans src/
  const srcFiles = walk(join(ROOT, 'src'));
  const keyHits = [];
  for (const f of srcFiles) {
    const content = readFileSync(f, 'utf8');
    const m = content.match(/(sk|pk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|price_[A-Za-z0-9]{10,}/g);
    if (m) keyHits.push(`${f.replace(ROOT, '')}: ${m.join(',')}`);
  }
  check('src/ : aucune clé Stripe ni Price ID en dur', keyHits.length === 0, keyHits.join(' ; '));

  // (c) Config serveur (stripe.ts) : lecture d'env uniquement + garde client
  const stripe = read('src/lib/billing/stripe.ts');
  for (const v of ENV_VARS) {
    check(`stripe.ts lit process.env.${v}`, stripe.includes(`process.env.${v}`));
  }
  check("stripe.ts : garde d'import côté client (typeof window)",
    stripe.includes("typeof window !== 'undefined'"));
  check('stripe.ts : helpers isCheckoutConfigured + priceIdForPlan + stripeFetch',
    stripe.includes('export function isCheckoutConfigured') &&
    stripe.includes('export function priceIdForPlan') &&
    stripe.includes('export async function stripeFetch'));
  check("stripe.ts : sans clé secrète → pas d'appel Stripe (erreur explicite)",
    stripe.includes('Stripe non configuré'));

  // (d) Routeur d'événements partagé (events.ts) : idempotence réelle
  const events = read('src/lib/billing/events.ts');
  check("events.ts : journalisation par event_id (clé d'idempotence)",
    events.includes('event_id: ev.eventId'));
  check('events.ts : doublon détecté via code SQL 23505 → no-op',
    events.includes("journalErr.code === '23505'") &&
    events.includes('applied: false') && events.includes('duplicate: true'));
  check('events.ts : compensation si échec d’application (retraitement possible)',
    events.includes(".delete().eq('event_id', ev.eventId)"));
  check("events.ts : application sur subscriptions (upsert onConflict user_id)",
    events.includes("onConflict: 'user_id'"));
  check('events.ts : plan_id = accord sur paiement actif + remise à zéro sur statut terminal (2 écritures max)',
    events.includes("if (ev.status === 'active')") &&
    events.includes('update.plan_id = granted') &&
    events.includes("update.plan_id = 'essential'") &&
    (events.match(/update\.plan_id/g) || []).length === 2);
  check('events.ts : demande soldée au paiement (requested_plan_id → null)',
    events.includes('update.requested_plan_id = null'));
  check('events.ts : statuts terminaux (canceled/expired/unpaid) → demande abandonnée',
    events.includes("ev.status === 'canceled' || ev.status === 'expired' || ev.status === 'unpaid'"));

  // (e) Les routes API existent et exportent POST
  // (+ webhook Stripe dédié /api/stripe/webhook — voir (h))
  const ROUTES = ['subscription', 'checkout', 'simulator'];
  for (const r of ROUTES) {
    const src = read(`src/app/api/billing/${r}/route.ts`);
    check(`route /api/billing/${r} : POST exporté`, src.includes('export async function POST'));
  }

  // (f) Souscription : demande ≠ paiement
  const subRoute = read('src/app/api/billing/subscription/route.ts');
  const apiHelper = read('src/lib/billing/api.ts');
  check('subscription POST : markPlanRequested (jamais plan_id direct)',
    subRoute.includes('markPlanRequested('));
  check('api.ts : écrit requested_plan_id + pending, SANS toucher plan_id',
    apiHelper.includes('requested_plan_id: plan') &&
    !/(?<!requested_)plan_id:/.test(apiHelper));
  check('subscription GET : plan rendu = resolveActivePlan (plan RÉSOLU)',
    subRoute.includes('resolveActivePlan('));

  // (g) Checkout : 503 si non configuré, traçabilité utilisateur
  const checkout = read('src/app/api/billing/checkout/route.ts');
  check('checkout : 503 tant que Stripe n’est pas configuré',
    checkout.includes('status: 503') && checkout.includes('isCheckoutConfigured'));
  check('checkout : demande de plan avant session Stripe (clic ≠ paiement)',
    checkout.indexOf('markPlanRequested(') < checkout.indexOf("'/checkout/sessions'"));
  check('checkout : client_reference_id + metadata plan_id/user_id',
    checkout.includes('client_reference_id') &&
    checkout.includes("'metadata[plan_id]'") &&
    checkout.includes("'metadata[user_id]'"));
  check('checkout : intervalle validé (month|year, défaut month) + Price dédié',
    checkout.includes("body.interval !== 'month' && body.interval !== 'year'") &&
    checkout.includes('isCheckoutConfigured(plan as PaidPlanId, interval)') &&
    checkout.includes('priceIdForPlan(plan as PaidPlanId, interval)'));

  // (h) Webhook : signature vérifiée AVANT lecture du corps
  const webhook = read('src/app/api/stripe/webhook/route.ts');
  const whHandler = read('src/lib/billing/webhook.ts');
  check("webhook : secret requis (503 sans STRIPE_WEBHOOK_SECRET)",
    webhook.includes('status: 503') && webhook.includes('webhookSecret'));
  check('webhook : en-tête Stripe-Signature + HMAC SHA-256',
    webhook.includes('stripe-signature') && webhook.includes("import { verifyStripeSignature }"));
  // ⬇️ signature checks déplacées dans le module dédié
  const sigMod = read('src/lib/billing/stripe-signature.ts');
  check('signature : comparaison time-safe', sigMod.includes('timingSafeEqual'));
  check('signature : tolérance temporelle (5 min)', sigMod.includes('toleranceSec'));
  check('signature : rawBody lu avant JSON.parse (vérifié dans webhook)',
    webhook.indexOf('await req.text()') !== -1 &&
    webhook.indexOf('await req.text()') < webhook.indexOf('JSON.parse(raw)'));
  check('webhook : POST uniquement (GET → 405)',
    webhook.includes('export async function GET') && webhook.includes('status: 405'));
  check('webhook : événements délégués au handler partagé (handleStripeEvent)',
    webhook.includes('handleStripeEvent('));
  check('handler webhook : applique via applySubscriptionEvent (source unique)',
    whHandler.includes('applySubscriptionEvent('));
  check('handler webhook : ancienne route /api/billing/webhook supprimée',
    !exists('src/app/api/billing/webhook/route.ts'));

  // (h2) Événements Stripe + plan via Price ID (jamais de prix en dur)
  const supBlock =
    (whHandler.split('SUPPORTED_STRIPE_EVENTS = [')[1] || '').split('] as const')[0] || '';
  const supCount = (supBlock.match(/'/g) || []).length / 2;
  check('handler webhook : 10 événements Stripe pris en charge', supCount === 10, `n=${supCount}`);
  for (const evt of [
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed', 'checkout.session.expired',
    'customer.subscription.created', 'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required',
  ]) {
    check(`handler webhook : événement « ${evt} » déclaré`, supBlock.includes(`'${evt}'`));
  }
  check('handler webhook : plan résolu par Price ID env (planIdForPrice)',
    whHandler.includes('planIdForPrice(') && whHandler.includes("planIdForPrice } from './stripe'"));
  check('handler webhook : aucun prix en dur (ni priceMonthly ni getPlan)',
    !whHandler.includes('priceMonthly') && !whHandler.includes('getPlan('));
  check('handler webhook : plan accordé SEULEMENT sur statut actif',
    whHandler.includes("status === 'active' ? planFromObject(obj) : null"));

  // (i) Simulateur : même routeur, utilisateur de session uniquement
  const sim = read('src/app/api/billing/simulator/route.ts');
  check('simulateur : même routeur que le webhook (applySubscriptionEvent)',
    sim.includes('applySubscriptionEvent('));
  check("simulateur : authentification obligatoire (getSessionUser)",
    sim.includes('getSessionUser(') && sim.includes('unauthorized()'));
  check("simulateur : cible = utilisateur de session (jamais user_id du corps)",
    sim.includes('userId: user.id') && !/userId:\s*body/.test(sim));
  check('simulateur : types limités au domaine (STATUS_BY_TYPE)',
    sim.includes('STATUS_BY_TYPE') && sim.includes("'subscription.unpaid'"));
}

console.log('\n════════════════════════════════════════════');
console.log(`  RESULTAT : ${pass} reussi(s) / ${fail} echoue(s)`);
console.log('════════════════════════════════════════════');
process.exitCode = fail === 0 ? 0 : 1;
