// COMAXE — Configure le retour après paiement des 4 Payment Links.
//
// Après un paiement validé sur la page hébergée Stripe, le navigateur
// redirige vers COMAXE `/parametres/abonnement?checkout=success`
// (URL fixe côté Stripe — production Vercel). Ne touche JAMAIS aux prix,
// aux intervalles ni aux Price : uniquement `after_completion`.
// Idempotent : réexécutable à volonté (les liens sont trouvés par URL,
// source unique = src/lib/billing/stripe.ts).
//
// Usage : node scripts/update-payment-links.mjs
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const env = {};
readFileSync(join(ROOT, '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
});

const KEY = env.STRIPE_SECRET_KEY;
const RETURN_URL = 'https://comaxepro-516c.vercel.app/parametres/abonnement?checkout=success';

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

// 1. URLs des 4 liens : table PAYMENT_LINKS de stripe.ts (source unique)
const stripeSrc = readFileSync(join(ROOT, 'src/lib/billing/stripe.ts'), 'utf8');
const block = (stripeSrc.match(/const PAYMENT_LINKS[^=]*=\s*\{([\s\S]*?)\n\};/) || [])[1] || '';
const urls = [...block.matchAll(/'(https:\/\/buy\.stripe\.com\/[^']+)'/g)].map((m) => m[1]);
console.log('\n1️⃣  Liens à configurer (lus dans stripe.ts)');
check('4 URLs lues', urls.length === 4, `n=${urls.length}`);

if (!KEY) {
  check('STRIPE_SECRET_KEY présente', false, 'absente');
} else {
  const auth = { Authorization: `Bearer ${KEY}` };
  const list = await fetch('https://api.stripe.com/v1/payment_links?limit=100', { headers: auth })
    .then((r) => r.json());

  console.log(`\n2️⃣  after_completion → redirect ${RETURN_URL}`);
  for (const url of urls) {
    const found = (list.data || []).find((p) => p.url === url);
    const short = url.split('/').pop();
    if (!found) {
      check(`lien ${short} : existe chez Stripe`, false, 'introuvable');
      continue;
    }
    // Mise à jour (after_completion UNIQUEMENT — prix intacts)
    const body = new URLSearchParams({
      'after_completion[type]': 'redirect',
      'after_completion[redirect][url]': RETURN_URL,
    });
    const upd = await fetch(`https://api.stripe.com/v1/payment_links/${found.id}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).then((r) => r.json());
    check(`${short} : after_completion = redirect COMAXE`,
      upd.after_completion?.type === 'redirect' &&
      upd.after_completion?.redirect?.url === RETURN_URL,
      `${upd.after_completion?.type} → ${upd.after_completion?.redirect?.url ?? upd.error?.message ?? ''}`);
    // Les prix n'ont pas bougé (garde-fou : Price = une des 4 valeurs env)
    const li = await fetch(`https://api.stripe.com/v1/payment_links/${found.id}/line_items?expand[]=data.price`, { headers: auth })
      .then((r) => r.json());
    const priceId = li.data?.[0]?.price?.id ?? null;
    const envPrices = [
      env.STRIPE_PRO_PRICE_ID_MONTHLY, env.STRIPE_PRO_PRICE_ID_ANNUAL,
      env.STRIPE_MAX_PRICE_ID_MONTHLY, env.STRIPE_MAX_PRICE_ID_ANNUAL,
    ];
    check(`${short} : Price intact après mise à jour (toujours un prix env)`,
      priceId !== null && envPrices.includes(priceId), priceId ?? 'aucun prix');
    check(`${short} : lien toujours actif`, upd.active === true, `active=${upd.active}`);
  }
}

console.log('\n════════════════════════════════════════════');
console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
console.log('════════════════════════════════════════════');
process.exit(fail ? 1 : 0);
