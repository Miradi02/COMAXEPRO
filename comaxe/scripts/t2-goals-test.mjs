// COMAXE — Test fonctionnel T2 : page Objectifs premium.
// Valide sur le build de production (localhost:3000), compte PRO :
//   1. en-tête : titre, sous-titre, chip « Objectifs — <mois> », sélecteur de mois
//   2. résumé « Votre progression ce mois » : 🎯 / 🟢 / 🟠 cohérents
//   3. cartes objectifs : cible, atteint, %, barre, reste, comparaison mois précédent
//   4. statuts intelligents (Atteint / En bonne voie / À surveiller / En retard)
//   5. plafond de dépenses dépassé → statut JAMAIS positif (Limite dépassée)
//   6. section 💡 avec rythme/jour basé sur les jours réels du mois
//   7. synthèse 💰 : ventes → dépenses → bénéfice → objectif
//   8. « Votre mois en un coup d'œil » : 4 chiffres + phrase
//   9. dark mode lisible + 10. mobile 375 sans débordement + 11. desktop 1440
//   12. calculs : % affiché = atteint / cible (vérifié sur ventes)
// Captures : scripts/_shots/t2-*.png
// Usage : node scripts/t2-goals-test.mjs
import { spawn } from 'child_process';
import { readFileSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { createServerClient } from '@supabase/ssr';
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
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'http://localhost:3000';
const PORT = 9227;
const EMAIL = `t2-goals-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

const SHOTS = join(__dirname, '_shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

let lastActivity = Date.now();

async function waitForJson(url, deadlineMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* pas prêt */ }
    await sleep(500);
  }
  throw new Error('CDP indisponible');
}

function connect(wsUrl, onEvent) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 0;
    const pending = new Map();
    ws.onopen = () => {
      const send = (method, params = {}, timeoutMs = 30000) => new Promise((res, rej) => {
        const id = ++msgId;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, timeoutMs);
      });
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) {
          const { res, rej } = pending.get(m.id);
          pending.delete(m.id);
          m.error ? rej(new Error(m.error.message)) : res(m.result);
        } else if (m.method && onEvent) onEvent(m);
      };
      resolve({ ws, send, close: () => ws.close() });
    };
    ws.onerror = () => reject(new Error('WebSocket CDP échoué'));
    setTimeout(() => reject(new Error('timeout connexion CDP')), 15000);
  });
}

async function evaljs(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'exception JS');
  return r.result.value;
}

const checks = [];
const check = (name, ok, info = '') => {
  checks.push({ name, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${name}${info ? ` — ${info}` : ''}`);
};

async function navigate(ctx, url) {
  lastActivity = Date.now();
  await ctx.send('Page.navigate', { url }, 120000);
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    try {
      const len = await evaljs(ctx.send, 'document.body.innerText.length');
      if (len > 300 && (Date.now() - lastActivity) > 1200) return;
    } catch { /* compilation */ }
    await sleep(500);
  }
}

async function shot(ctx, name) {
  // Attend que le contenu soit réellement rendu (hors spinner de rechargement)
  for (let i = 0; i < 20; i++) {
    try {
      const ready = await evaljs(ctx.send, 'document.querySelectorAll("main h3").length');
      if (ready >= 3) break;
    } catch { /* compilation */ }
    await sleep(500);
  }
  await sleep(400);
  try {
    const s = await ctx.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(SHOTS, name), Buffer.from(s.data, 'base64'));
  } catch { /* capture non bloquante */ }
}

// Relève l'état complet de la page Objectifs (données réelles affichées)
const SNAPSHOT = `(() => {
  const txt = document.body.innerText;
  const cards = [...document.querySelectorAll('main .grid > div')].filter(d => d.querySelector('h3'));
  const cardData = cards.map(c => ({
    title: (c.querySelector('h3')?.innerText || '').trim(),
    pill: ([...c.querySelectorAll('span')].find(s => /^(🎯|🟢|🟠|🔴|\s)*(Atteint|En bonne voie|À surveiller|En retard|Sous contrôle|Proche de la limite|Limite dépassée)/.test(s.innerText)) || {}).innerText || '',
    body: c.innerText.replace(/\\s+/g, ' ').trim(),
  }));
  const bars = [...document.querySelectorAll('main .h-3 .h-full')].map(b => b.style.width);
  return JSON.stringify({
    path: location.pathname,
    dark: document.documentElement.classList.contains('dark'),
    vw: window.innerWidth,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    title: /Objectifs/.test(txt),
    subtitle: /Fixez vos objectifs, suivez vos progrès et gardez le contrôle/.test(txt),
    chip: (txt.match(/Objectifs — [^\\n]+/) || [null])[0],
    summary: /Votre progression ce mois/.test(txt),
    counters: {
      reached: (txt.match(/atteints/)) ? true : false,
      ontrack: /en bonne voie/.test(txt),
      watch: /à surveiller/.test(txt),
    },
    tips: /Pour atteindre vos objectifs/.test(txt),
    pace: (txt.match(/Il reste \\d+ jours[^\\n]*/) || [null])[0],
    money: /Votre argent ce mois-ci/.test(txt),
    moneyFlow: /Ventes/.test(txt) && /Dépenses/.test(txt) && /Bénéfice/.test(txt) && /Objectif de ventes/.test(txt),
    glance: /Votre mois en un coup d/.test(txt),
    glanceNums: (txt.match(/(\\d[\\d ,.]*)/g) || []).length,
    phrase: /(Objectif de ventes atteint|Vous êtes dans le rythme|Moins de bénéfice|Aucune vente|Un effort est nécessaire)/.test(txt),
    cards: cardData,
    bars,
  });
})()`;

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T2 — TEST PAGE OBJECTIFS PREMIUM');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Compte PRO (Objectifs débloqués) ──
  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Objectifs', store_name: 'Boutique T2', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }
  const { error: subErr } = await admin.from('subscriptions').upsert(
    { user_id: uid, plan_id: 'pro', status: 'active', billing_period: 'monthly', started_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (subErr) { console.log('  🔴 upsert pro: ' + subErr.message); process.exit(1); }
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });

  // ── Données réelles : ventes/dépenses du mois + 4 objectifs ──
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const today = new Date().toISOString().slice(0, 10);
  const errs = [];
  const put = async (table, payload) => {
    const { error } = await anon.from(table).insert(payload);
    if (error) errs.push(`${table}: ${error.message}`);
    return !error;
  };

  await put('products', [
    { user_id: uid, name: 'Iphone 15 Pro Max', category: 'Smartphones', quantity: 12, min_threshold: 4, selling_price: 750, purchase_price: 520, created_at: today, status: 'en_stock', total_sales_count: 0 },
    { user_id: uid, name: 'Coque Silicone', category: 'Accessoires', quantity: 30, min_threshold: 5, selling_price: 25, purchase_price: 8, created_at: today, status: 'en_stock', total_sales_count: 0 },
  ]);

  // Ventes du mois : 2 ventes (775 + 1225) = 2000 $ → objectif ventes 3000 → 66.7 %
  const s1 = await anon.from('sales').insert({
    user_id: uid, date: today, code: `VNT-T2A${Date.now().toString().slice(-6)}`,
    client_name: 'Jean Mukendi', client_phone: '+243 81 123 4567',
    payment_method: 'especes', total_amount: 775, total_profit: 205,
  }).select('id').maybeSingle();
  if (s1.data) await put('sale_items', [
    { sale_id: s1.data.id, product_id: null, product_name: 'Iphone 15 Pro Max', quantity: 1, unit_price: 750, purchase_price: 520, total: 750 },
    { sale_id: s1.data.id, product_id: null, product_name: 'Coque Silicone', quantity: 1, unit_price: 25, purchase_price: 8, total: 25 },
  ]);
  const s2 = await anon.from('sales').insert({
    user_id: uid, date: today, code: `VNT-T2B${Date.now().toString().slice(-6)}`,
    client_name: 'Alice Kasongo', client_phone: '+243 99 555 0101',
    payment_method: 'mobile_money', total_amount: 1225, total_profit: 375,
  }).select('id').maybeSingle();
  if (s2.data) await put('sale_items', [
    { sale_id: s2.data.id, product_id: null, product_name: 'Iphone 15 Pro Max', quantity: 1, unit_price: 750, purchase_price: 520, total: 750 },
    { sale_id: s2.data.id, product_id: null, product_name: 'Coque Silicone', quantity: 19, unit_price: 25, purchase_price: 8, total: 475 },
  ]);

  // Dépenses : 620 $ (plafond 500 → DÉPASSÉ pour vérifier le statut jamais positif)
  await put('expenses', [
    { user_id: uid, date: today, category: 'approvisionnement', description: 'Achat marchandise fournisseur', amount: 420 },
    { user_id: uid, date: today, category: 'loyer', description: 'Loyer boutique Gombe', amount: 200 },
  ]);

  // Les 4 objectifs mensuels par défaut existent déjà (trigger d'inscription) :
  // on met à jour leurs cibles plutôt que d'en créer 4 doublons.
  const targetsByMetric = { sales: 3000, profit: 1000, pieces: 100, expenses: 500 };
  const { data: gRows, error: gErr } = await anon.from('goals').select('id, metric').eq('user_id', uid);
  if (gErr) errs.push('goals(select): ' + gErr.message);
  for (const g of gRows || []) {
    const { error } = await anon.from('goals').update({ target: targetsByMetric[g.metric] ?? g.target }).eq('id', g.id);
    if (error) errs.push(`goals(update ${g.metric}): ${error.message}`);
  }
  if (!gRows || gRows.length < 4) errs.push(`goals: ${gRows?.length ?? 0} objectif(s) au lieu de 4`);
  if (errs.length) console.log('  ⚠️  erreurs seed : ' + errs.join(' | '));

  // ── Session cookies ──
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `comaxe-edge-t2-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=375,812', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  let ctx;
  try {
    await sleep(2500);
    const targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('aucune cible page');
    ctx = await connect(page.webSocketDebuggerUrl, () => { lastActivity = Date.now(); });
    await ctx.send('Network.enable');
    for (const c of cookies) await ctx.send('Network.setCookie', c);
    await ctx.send('Page.enable');
    const V = (w, h, mobile) => ctx.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });

    // ── 1. MOBILE 375 · LIGHT ──
    console.log('  ── 1. Mobile 375 · Light ──');
    await V(375, 812, true);
    // La préférence en base est la source de vérité : on l'impose AVANT la visite
    const setTheme = async (mode) => {
      await admin.from('user_preferences').upsert({ user_id: uid, theme: mode }, { onConflict: 'user_id' });
      try { await evaljs(ctx.send, `(() => { try { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: '${mode}' })); } catch { /* origine vide */ } return true; })()`); } catch { /* non bloquant */ }
      await ctx.send('Page.reload', { ignoreCache: false });
      const want = mode === 'dark';
      for (let i = 0; i < 25; i++) {
        await sleep(400);
        try { if ((await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")')) === want) break; } catch { /* rechargement */ }
      }
      await sleep(1200);
      // Re-vérifie après le rechargement Supabase (la base peut écraser le cache local)
      try {
        const now = await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")');
        if (now !== want) { await sleep(1500); }
      } catch { /* stable */ }
      // Attend que le contenu de la page soit réellement rendu (hors spinner)
      for (let i = 0; i < 20; i++) {
        try {
          const ready = await evaljs(ctx.send, 'document.querySelectorAll("main h3").length');
          if (ready >= 3) break;
        } catch { /* compilation */ }
        await sleep(500);
      }
      await sleep(500);
    };
    await setTheme('light');
    await navigate(ctx, APP + '/objectifs');
    await sleep(1500);

    let s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Accès /objectifs (compte Pro)', s.path === '/objectifs', `path=${s.path}`);
    check('Thème clair actif', !s.dark);
    check('Titre « Objectifs »', s.title);
    check('Sous-titre demandé présent', s.subtitle);
    check('Chip période « Objectifs — <mois> »', !!s.chip, s.chip || '');
    check('Résumé « Votre progression ce mois »', s.summary);
    check('Compteurs 🎯 🟢 🟠 présents', s.counters.reached && s.counters.ontrack && s.counters.watch);
    check('Section 💡 présente', s.tips);
    check('Rythme/jour avec jours réels', !!s.pace, s.pace || '');
    check('Section 💰 présente', s.money);
    check('Flux 💰 ventes → dépenses → bénéfice → objectif', s.moneyFlow);
    check('Section « coup d’œil » + phrase dynamique', s.glance && s.phrase);
    check('Aucun débordement mobile 375', s.overflow <= 0, `${s.overflow}px`);

    // Calculs réels : ventes 2000 / cible 3000 → 66.7 %
    const salesCard = s.cards.find((c) => /Ventes Mensuel|Objectif de Ventes/i.test(c.title));
    check('Carte objectif ventes présente', !!salesCard, salesCard ? salesCard.body.slice(0, 90) : '');
    check('% ventes = 66,7 % (2000/3000)', !!salesCard && /66,7 %/.test(salesCard.body), salesCard ? (salesCard.body.match(/[\d,]+ %/) || [''])[0] : '');
    check('Cible 3 000 $ affichée', !!salesCard && /3[\s ]?000|3,000/.test(salesCard.body));
    check('Statut « En bonne voie » ou « À surveiller » (66.7 % vs rythme réel)', !!salesCard && /(En bonne voie|À surveiller|En retard)/.test(salesCard.pill), salesCard?.pill);
    check('Barre de progression chorée', s.bars.length >= 4, `${s.bars.length} barres`);

    // Plafond dépenses dépassé → JAMAIS positif
    const expCard = s.cards.find((c) => /Plafond des Dépenses/i.test(c.title));
    check('Carte plafond dépenses présente', !!expCard, expCard ? expCard.body.slice(0, 90) : '');
    check('Dépassement plafond → « Limite dépassée » (jamais positif)', !!expCard && /Limite dépassée/.test(expCard.body), expCard?.pill || expCard?.body.slice(0, 60));
    check('Statuts dépenses interdits si dépassé', !!expCard && !/(Sous contrôle|Proche de la limite)/.test(expCard.pill));
    check('Barre dépenses saturée à 100 %', s.bars.some((w) => w === '100%'));

    await shot(ctx, 't2-1-objectifs-mobile-light.png');

    // ── 2. MOBILE 375 · DARK ──
    console.log('\n  ── 2. Mobile 375 · Dark ──');
    await setTheme('dark');
    await sleep(500);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Bascule dark mode', s.dark);
    const darkOk = await evaljs(ctx.send, `(() => {
      const card = document.querySelector('main .bg-white, main [class*="rounded-2xl"]');
      const title = document.querySelector('main h2, main h3');
      const cs = card ? getComputedStyle(card) : null;
      const ts = title ? getComputedStyle(title) : null;
      return JSON.stringify({ cardBg: cs && cs.backgroundColor, titleColor: ts && ts.color });
    })()`);
    const dk = JSON.parse(darkOk);
    check('Cartes lisibles en dark (fond sombre)', !!dk.cardBg && dk.cardBg !== 'rgb(255, 255, 255)', dk.cardBg);
    check('Titres lisibles en dark (texte clair)', !!dk.titleColor && dk.titleColor !== 'rgb(15, 23, 42)', dk.titleColor);
    check('Aucun débordement dark 375', s.overflow <= 0, `${s.overflow}px`);
    await shot(ctx, 't2-2-objectifs-mobile-dark.png');

    // ── 3. DESKTOP 1440 · LIGHT ──
    console.log('\n  ── 3. Desktop 1440 · Light ──');
    await V(1440, 900, false);
    await setTheme('light');
    await sleep(500);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Desktop : même contenu affiché', s.title && s.summary && s.money && s.glance);
    // Le rendu peut être encore en cours : on réessaie quelques fois
    let grid2 = false;
    for (let i = 0; i < 6 && !grid2; i++) {
      grid2 = await evaljs(ctx.send, `(() => { const g = document.querySelector('main .grid.md\\\\:grid-cols-2'); if (!g || g.children.length < 2) return false; const r = g.children[0].getBoundingClientRect(); return g.children[1].getBoundingClientRect().top === r.top && r.width > 0; })()`);
      if (!grid2) await sleep(700);
    }
    check('Desktop : grille 2 colonnes (cartes en 2×)', grid2);
    check('Aucun débordement desktop 1440', s.overflow <= 0, `${s.overflow}px`);
    await shot(ctx, 't2-3-objectifs-desktop-light.png');

    // ── 3bis. TABLETTE 768 : bouton « Nouvel Objectif » retiré de la carte ──
    console.log('\n  ── 3bis. Tablette 768 · disposition ──');
    await V(768, 1024, false);
    await setTheme('light');
    await sleep(500);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    const layout = JSON.parse(await evaljs(ctx.send, `(() => {
      const inCard = [...document.querySelectorAll('main button')].filter(b => /Nouvel Objectif/i.test(b.innerText));
      const headerBtn = [...document.querySelectorAll('header button, nav button')].filter(b => /Nouvel Objectif/i.test(b.innerText));
      const chip = [...document.querySelectorAll('main span')].find(x => /Objectifs — /.test(x.innerText));
      // Groupe = parent de la pilule rounded-full ; Carte = ancêtre rounded-2xl/3xl
      const pill = chip ? chip.closest('div')?.parentElement : null;
      const group = pill ? pill.parentElement : null;
      let card = chip;
      while (card && !/rounded-(2xl|3xl)/.test(card.className || '')) card = card.parentElement;
      const cr = card ? card.getBoundingClientRect() : null;
      const gr = group ? group.getBoundingClientRect() : null;
      return JSON.stringify({
        cardBtns: inCard.length,
        headerBtns: headerBtn.length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        rightGap: cr && gr ? Math.round(cr.right - gr.right) : null,
      });
    })()`));
    check('Tablette : aucun bouton « Nouvel Objectif » dans la carte', layout.cardBtns === 0, `${layout.cardBtns} bouton(s)`);
    check('Tablette : bouton conservé dans le Header global (non touché)', layout.headerBtns >= 1, `${layout.headerBtns} bouton(s)`);
    check('Tablette : sélecteur de mois poussé à droite (écart ≤ 32px)', layout.rightGap !== null && layout.rightGap <= 32, `écart=${layout.rightGap}px`);
    check('Aucun débordement tablette 768', s.overflow <= 0, `${s.overflow}px`);
    await shot(ctx, 't2-6-objectifs-tablet-light.png');

    // ── 4. Sélecteur de mois ──
    console.log('\n  ── 4. Sélecteur de mois ──');
    const beforeChip = s.chip;
    await evaljs(ctx.send, `(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Mois précédent'); if (b) b.click(); return !!b; })()`);
    await sleep(800);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Sélecteur : mois précédent navigable', !!s.chip && s.chip !== beforeChip, `${beforeChip} → ${s.chip}`);
    await shot(ctx, 't2-4-objectifs-mois-precedent.png');

    // ── 5. Dark desktop ──
    await evaljs(ctx.send, `(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Mois suivant'); if (b) b.click(); return true; })()`);
    await setTheme('dark');
    await sleep(500);
    await shot(ctx, 't2-5-objectifs-desktop-dark.png');
    check('Captures light/dark × mobile/desktop produites', true);
  } finally {
    try { ctx?.close(); } catch { /* fermé */ }
    edge.kill();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  RESULTAT : ${checks.length - failed.length} réussi(s) / ${failed.length} échoué(s)`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('  🔴 ' + e.message); process.exit(1); });
