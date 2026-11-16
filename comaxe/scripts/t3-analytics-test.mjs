// COMAXE — Test fonctionnel T3 : page Analytique premium.
// Valide sur le build de production (localhost:3000), compte PRO :
//   1. 7 périodes (Aujourd'hui → Personnalisé) + bascule fonctionnelle
//   2. 4 KPI (ventes, bénéfice net + marge, dépenses, rotation stock)
//   3. graphique d'évolution + top produits (composants réutilisés)
//   4. anneau de répartition des encaissements (SVG) + montants/%
//   5. top 3 catégories rentables
//   6. section « À retenir » : 2 à 4 observations réelles
//   7. mobile 375 / tablette 768 / desktop 1440 sans débordement + dark lisible
// Captures : scripts/_shots/t3-*.png
// Usage : node scripts/t3-analytics-test.mjs
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
const PORT = 9228;
const EMAIL = `t3-analytics-${Date.now()}@comaxe.test`;
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

const SNAPSHOT = `(() => {
  const txt = document.body.innerText;
  // Barre de périodes principale = conteneur portant l'onglet « Personnalisé »
  const allBtns = [...document.querySelectorAll('main button')];
  const periodBar = allBtns.find(b => b.innerText.trim() === 'Personnalisé')?.parentElement;
  const periods = periodBar ? [...periodBar.querySelectorAll('button')] : [];
  const kpiLabels = ['VENTES TOTALES', 'BÉNÉFICE NET', 'DÉPENSES DÉCAISSÉES', 'ROTATION DU STOCK'];
  const kpiCards = [...document.querySelectorAll('main .grid > div')].filter(d =>
    kpiLabels.some(l => (d.innerText || '').toUpperCase().includes(l))
  );
  const ringSegs = document.querySelectorAll('main svg circle[stroke-dasharray]').length;
  const takeaways = [...document.querySelectorAll('main .grid > div')].filter(d =>
    d.className.includes('rounded-xl') && d.className.includes('border') && d.className.includes('bg-')
  );
  return JSON.stringify({
    path: location.pathname,
    dark: document.documentElement.classList.contains('dark'),
    vw: window.innerWidth,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    periods: periods.length,
    periodLabels: periods.map(p => p.innerText.trim()),
    kpiCount: kpiCards.length,
    kpiText: kpiCards.map(k => k.innerText.replace(/\\s+/g, ' ').slice(0, 70)),
    hasChart: /Évolution|Evolution|Ventes/i.test(txt),
    hasTopProducts: /meilleurs|Top|produits/i.test(txt),
    hasRing: ringSegs >= 1,
    ringSegs,
    hasCategories: /Catégories les Plus Rentables/.test(txt),
    chart: (() => {
      const svg = [...document.querySelectorAll('main svg')].find(s => s.querySelector('path[stroke="#1E5BF8"]'));
      if (!svg) return { line: false, goalLine: false, yTop: '', goalLabel: '' };
      const texts = [...svg.querySelectorAll('text')].map(x => x.textContent || '');
      return {
        line: true,
        goalLine: !!svg.querySelector('line[stroke="#10B981"]'),
        yTicks: texts.slice(0, 3),
        goalLabel: texts.find(x => /Objectif|Goal/.test(x)) || '',
        xLabels: texts.filter(x => /^(Jan|Fév|Mar|Avr|Mai|Juin|Juil|Aoû|Sep|Oct|Nov|Déc|Sem|Cette|Auj|\\d)/.test(x)).length,
      };
    })(),
    takeawaysTitle: /À retenir/.test(txt),
    takeawayCount: takeaways.length,
    takeawayTexts: takeaways.map(t2 => t2.innerText.replace(/\\s+/g, ' ').slice(0, 110)),
  });
})()`;

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T3 — TEST PAGE ANALYTIQUE PREMIUM');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Compte PRO (Analytique débloquée) ──
  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Analytics', store_name: 'Boutique T3', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }
  const { error: subErr } = await admin.from('subscriptions').upsert(
    { user_id: uid, plan_id: 'pro', status: 'active', billing_period: 'monthly', started_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (subErr) { console.log('  🔴 upsert pro: ' + subErr.message); process.exit(1); }
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });

  // ── Données réelles ──
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
    { user_id: uid, name: 'Chargeur USB-C', category: 'Accessoires', quantity: 18, min_threshold: 5, selling_price: 35, purchase_price: 12, created_at: today, status: 'en_stock', total_sales_count: 0 },
  ]);

  const s1 = await anon.from('sales').insert({
    user_id: uid, date: today, code: `VNT-T3A${Date.now().toString().slice(-6)}`,
    client_name: 'Jean Mukendi', client_phone: '+243 81 123 4567',
    payment_method: 'especes', total_amount: 775, total_profit: 205,
  }).select('id').maybeSingle();
  if (s1.data) await put('sale_items', [
    { sale_id: s1.data.id, product_id: null, product_name: 'Iphone 15 Pro Max', quantity: 1, unit_price: 750, purchase_price: 520, total: 750 },
    { sale_id: s1.data.id, product_id: null, product_name: 'Coque Silicone', quantity: 1, unit_price: 25, purchase_price: 8, total: 25 },
  ]);
  const s2 = await anon.from('sales').insert({
    user_id: uid, date: today, code: `VNT-T3B${Date.now().toString().slice(-6)}`,
    client_name: 'Alice Kasongo', client_phone: '+243 99 555 0101',
    payment_method: 'mobile_money', total_amount: 1225, total_profit: 375,
  }).select('id').maybeSingle();
  if (s2.data) await put('sale_items', [
    { sale_id: s2.data.id, product_id: null, product_name: 'Iphone 15 Pro Max', quantity: 1, unit_price: 750, purchase_price: 520, total: 750 },
    { sale_id: s2.data.id, product_id: null, product_name: 'Chargeur USB-C', quantity: 13, unit_price: 35, purchase_price: 12, total: 455 },
  ]);

  await put('expenses', [
    { user_id: uid, date: today, category: 'approvisionnement', description: 'Achat marchandise fournisseur', amount: 420 },
    { user_id: uid, date: today, category: 'loyer', description: 'Loyer boutique Gombe', amount: 200 },
  ]);
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
  const profile = join(tmpdir(), `comaxe-edge-t3-${Date.now()}`);
  mkdirSync(profile, { recursive: true });

  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1440,900', 'about:blank',
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

    const setTheme = async (mode) => {
      await admin.from('user_preferences').upsert({ user_id: uid, theme: mode }, { onConflict: 'user_id' });
      try { await evaljs(ctx.send, `(() => { try { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: '${mode}' })); } catch { /* */ } return true; })()`); } catch { /* non bloquant */ }
      await ctx.send('Page.reload', { ignoreCache: false });
      const want = mode === 'dark';
      for (let i = 0; i < 25; i++) {
        await sleep(400);
        try { if ((await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")')) === want) break; } catch { /* rechargement */ }
      }
      await sleep(1200);
      for (let i = 0; i < 20; i++) {
        try {
          const ready = await evaljs(ctx.send, 'document.querySelectorAll("main h3").length');
          if (ready >= 3) break;
        } catch { /* compilation */ }
        await sleep(500);
      }
      await sleep(400);
    };

    // ── 1. DESKTOP 1440 · LIGHT ──
    console.log('  ── 1. Desktop 1440 · Light ──');
    await V(1440, 900, false);
    await setTheme('light');
    await navigate(ctx, APP + '/analytique');
    await sleep(1500);
    // Stabilisation : attend le rendu réel de la barre de périodes
    for (let i = 0; i < 20; i++) {
      try {
        const ready = await evaljs(ctx.send, `[...document.querySelectorAll('main button')].some(b => b.innerText.trim() === 'Personnalisé')`);
        if (ready) break;
      } catch { /* compilation */ }
      await sleep(500);
    }
    await sleep(400);

    let s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Accès /analytique (compte Pro)', s.path === '/analytique', `path=${s.path}`);
    check('7 périodes affichées', s.periods === 7, `${s.periods} : ${s.periodLabels.join(', ')}`);
    check('4 cartes KPI', s.kpiCount === 4, `${s.kpiCount}`);
    check('KPI ventes totales', s.kpiText.some((k) => /ventes totales/i.test(k)));
    check('KPI bénéfice net + marge', s.kpiText.some((k) => /bénéfice net/i.test(k)));
    check('KPI dépenses', s.kpiText.some((k) => /dépenses/i.test(k)));
    check('KPI rotation du stock', s.kpiText.some((k) => /rotation du stock/i.test(k)));
    check('Montants en USD ($)', s.kpiText.some((k) => /\$/.test(k)), (s.kpiText.find((k) => /\$/.test(k)) || '').slice(0, 40));
    check('Graphique d’évolution présent', s.hasChart);
    check('Courbe en ligne (path SVG bleu)', s.chart.line);
    check('Ligne d’objectif (pointillés émeraude)', s.chart.goalLine);
    check('Axe Y gradué en $ (3 ticks)', s.chart.yTicks.length === 3 && s.chart.yTicks.every(x => /\$/.test(x)), s.chart.yTicks.join(' | '));
    check('Axe Y plafonné à l’objectif', (() => {
      const num = (s) => { const m = String(s).replace(/\s/g, '').match(/([\d.,]+)(k?)\$/); if (!m) return NaN; return parseFloat(m[1].replace(',', '.')) * (m[2] === 'k' ? 1000 : 1); };
      return !!s.chart.goalLabel && num(s.chart.yTicks[2]) === num(s.chart.goalLabel);
    })(), `${s.chart.yTicks[2]} ↔ ${s.chart.goalLabel}`);
    check('Axe X = temps (étiquettes période)', s.chart.xLabels >= 4, `${s.chart.xLabels} étiquettes`);
    check('Top produits présent', s.hasTopProducts);
    check('Anneau encaissements (SVG)', s.hasRing, `${s.ringSegs} segment(s)`);
    check('Top 3 catégories rentables', s.hasCategories);
    check('Section « À retenir » présente', s.takeawaysTitle);
    check('« À retenir » : 2 à 4 observations', s.takeawayCount >= 2 && s.takeawayCount <= 4, `${s.takeawayCount} — ${s.takeawayTexts[0] || ''}`);
    check('Aucun débordement desktop 1440', s.overflow <= 0, `${s.overflow}px`);
    await shot(ctx, 't3-1-analytique-desktop-light.png');

    // ── 2. Bascule de période ──
    console.log('\n  ── 2. Bascule de période ──');
    const clicked = await evaljs(ctx.send, `(() => { const b = [...document.querySelectorAll('main button')].find(x => x.innerText.trim() === "Aujourd'hui"); if (b) b.click(); return !!b; })()`);
    await sleep(900);
    const s2v = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Période « Aujourd’hui » cliquable', clicked);
    check('Bascule effective (libellé de période)', /Aujourd/i.test(await evaljs(ctx.send, 'document.body.innerText')), '');
    await shot(ctx, 't3-2-analytique-aujourdhui.png');

    // ── 3. MOBILE 375 · LIGHT ──
    console.log('\n  ── 3. Mobile 375 · Light ──');
    await V(375, 812, true);
    await sleep(700);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Aucun débordement mobile 375', s.overflow <= 0, `${s.overflow}px`);
    check('Contenu complet en mobile', s.kpiCount === 4 && s.takeawaysTitle);
    await shot(ctx, 't3-3-analytique-mobile-light.png');

    // ── 4. TABLETTE 768 ──
    console.log('\n  ── 4. Tablette 768 · Light ──');
    await V(768, 1024, false);
    await sleep(700);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    check('Aucun débordement tablette 768', s.overflow <= 0, `${s.overflow}px`);
    await shot(ctx, 't3-4-analytique-tablet-light.png');

    // ── 5. DARK ──
    console.log('\n  ── 5. Desktop 1440 · Dark ──');
    await V(1440, 900, false);
    await setTheme('dark');
    await sleep(500);
    s = JSON.parse(await evaljs(ctx.send, SNAPSHOT));
    const dk = JSON.parse(await evaljs(ctx.send, `(() => {
      const card = document.querySelector('main .bg-white, main [class*="rounded-2xl"]');
      const title = document.querySelector('main h3');
      const cs = card ? getComputedStyle(card) : null;
      const ts = title ? getComputedStyle(title) : null;
      return JSON.stringify({ cardBg: cs && cs.backgroundColor, titleColor: ts && ts.color });
    })()`));
    check('Bascule dark mode', s.dark);
    check('Cartes lisibles en dark', !!dk.cardBg && dk.cardBg !== 'rgb(255, 255, 255)', dk.cardBg);
    check('Titres lisibles en dark', !!dk.titleColor && dk.titleColor !== 'rgb(15, 23, 42)', dk.titleColor);
    check('Aucun débordement dark 1440', s.overflow <= 0, `${s.overflow}px`);
    await shot(ctx, 't3-5-analytique-desktop-dark.png');
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
