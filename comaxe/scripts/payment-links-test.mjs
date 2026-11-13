// COMAXE — Test RÉEL des 4 Payment Links (Tâche 2).
//
// Confronte la table PAYMENT_LINKS (src/lib/billing/stripe.ts) à l'API
// Stripe : chaque combinaison offre × intervalle doit pointer vers SON
// lien, qui doit porter SON Price (env), SON intervalle et SON montant.
// Mapping non ambigu vérifié dans les DEUX sens (code → Stripe, env → Price).
//
// Usage : node scripts/payment-links-test.mjs  (STRIPE_SECRET_KEY requise)
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const env = {};
for (const rel of [['..', '.env'], ['..', '..', '.env']]) {
  try {
    readFileSync(join(__dirname, ...rel), 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
    });
  } catch { /* absent */ }
}

const KEY = env.STRIPE_SECRET_KEY;
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

// ── 1. Table PAYMENT_LINKS lue dans le CODE (source de vérité) ──
console.log('\n1️⃣  Table PAYMENT_LINKS (stripe.ts)');
const stripeSrc = readFileSync(join(ROOT, 'src/lib/billing/stripe.ts'), 'utf8');
const block = (stripeSrc.match(/const PAYMENT_LINKS[^=]*=\s*\{([\s\S]*?)\n\};/) || [])[1] || '';
const links = {};
for (const m of block.matchAll(/(pro|max):\s*\{\s*month:\s*'([^']+)',\s*year:\s*'([^']+)'/g)) {
  links[m[1]] = { month: m[2], year: m[3] };
}
check('table lue : pro et max présents', Boolean(links.pro && links.max),
  Object.keys(links).join(',') || 'vide');
check('4 URLs uniques dans le code',
  new Set(Object.values(links).flatMap((x) => Object.values(x))).size === 4);

const RETURN_URL = 'https://comaxepro-516c.vercel.app/parametres/abonnement?checkout=success';

// ── 2. Identité attendue (env + montants marketing inchangés) ──
const EXPECT = [
  { plan: 'pro', interval: 'month', envVar: 'STRIPE_PRO_PRICE_ID_MONTHLY', amount: 500 },
  { plan: 'pro', interval: 'year', envVar: 'STRIPE_PRO_PRICE_ID_ANNUAL', amount: 4900 },
  { plan: 'max', interval: 'month', envVar: 'STRIPE_MAX_PRICE_ID_MONTHLY', amount: 1400 },
  { plan: 'max', interval: 'year', envVar: 'STRIPE_MAX_PRICE_ID_ANNUAL', amount: 14900 },
];

console.log('\n2️⃣  Code ↔ Stripe : chaque lien pointe vers SON Price');
if (!KEY) {
  check('STRIPE_SECRET_KEY présente', false, 'absente — test API impossible');
} else {
  const list = await fetch(`https://api.stripe.com/v1/payment_links?limit=100`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }).then((r) => r.json());
  for (const exp of EXPECT) {
    const url = links[exp.plan]?.[exp.interval];
    const label = `${exp.plan}/${exp.interval}`;
    if (!url) {
      check(`${label} : URL présente dans stripe.ts`, false, 'entrée manquante');
      continue;
    }
    // Lien réel : recherche par URL dans la liste des Payment Links
    const found = (list.data || []).find((p) => p.url === url);
    check(`${label} : lien existe chez Stripe`, Boolean(found), url);
    if (!found) continue;
    check(`${label} : lien actif`, found.active === true, `active=${found.active}`);
    check(`${label} : après paiement → redirection COMAXE (after_completion)`,
      found.after_completion?.type === 'redirect' &&
      found.after_completion?.redirect?.url === RETURN_URL,
      `${found.after_completion?.type} → ${found.after_completion?.redirect?.url ?? 'n/a'}`);

    // Price du lien (line_items)
    const li = await fetch(`https://api.stripe.com/v1/payment_links/${found.id}/line_items?expand[]=data.price`, {
      headers: { Authorization: `Bearer ${KEY}` },
    }).then((r) => r.json());
    const price = li.data?.[0]?.price;
    const expectedPrice = env[exp.envVar] || null;
    check(`${label} : Price du lien = env ${exp.envVar}`,
      Boolean(price) && price.id === expectedPrice,
      `lien=${price?.id} env=${expectedPrice}`);
    check(`${label} : intervalle du Price = ${exp.interval}`,
      price?.recurring?.interval === exp.interval,
      `reçu=${price?.recurring?.interval}`);
    check(`${label} : montant inchangé = ${exp.amount} cents USD`,
      price?.unit_amount === exp.amount && price?.currency === 'usd',
      `reçu=${price?.unit_amount} ${price?.currency}`);
  }
}

// ── 3. Aucun croisement : chaque Price n'appartient qu'à UN lien ──
console.log('\n3️⃣  Non-croisement (1 Price = 1 lien, 1 lien = 1 Price)');
{
  const prices = EXPECT.map((e) => env[e.envVar]).filter(Boolean);
  check('4 Price IDs env distincts', new Set(prices).size === 4, prices.join(','));
}

console.log('\n════════════════════════════════════════════');
console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
console.log('════════════════════════════════════════════');
process.exit(fail ? 1 : 0);
