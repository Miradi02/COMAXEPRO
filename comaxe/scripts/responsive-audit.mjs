// COMAXE — Audit de responsivité (mesures objectives, Edge headless).
// Pour chaque route × chaque largeur (mobile 375, tablette 768, desktop 1440) :
//   - débordement horizontal du document (scrollWidth - innerWidth)
//   - éléments plus larges que la fenêtre, EN EXCLUANT ceux correctement
//     contenus dans un ancêtre overflow-x (tables scrollables = comportement voulu)
//   - largeur / visibilité de la barre latérale
// Sauvegarde aussi des captures pleine page en mobile (scripts/_shots/).
// Usage : node scripts/responsive-audit.mjs
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
const PORT = 9225;
const EMAIL = `resp-audit-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';

const ROUTES = [
  ['login', '/login', false],
  ['dashboard', '/', true],
  ['dashboard-alt', '/dashboard', true],
  ['ventes', '/ventes', true],
  ['stock', '/stock', true],
  ['clients', '/clients', true],
  ['depenses', '/depenses', true],
  ['benefice', '/benefice', true],
  ['dettes', '/dettes', true],
  ['analytique', '/analytique', true],
  ['rapports', '/rapports', true],
  ['objectifs', '/objectifs', true],
  ['parametres', '/parametres', true],
];

const VIEWPORTS = [
  ['mobile', 375, 812, true],
  ['tablette', 768, 1024, true],
  ['desktop', 1440, 900, false],
];

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

const SHOTS = join(__dirname, '_shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// Horodatage de la dernière activité réseau CDP (stratégie "networkidle")
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
        } else if (m.method && onEvent) {
          onEvent(m);
        }
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

// Attend que la page soit hydratée ET que le réseau soit au calme : les 11
// requêtes Supabase arrivent après le premier rendu, une simple stabilité du
// texte suffit trop tôt et donne des captures vides.
async function waitReady(send, timeoutMs = 60000) {
  const t0 = Date.now();
  let prev = -1, stable = 0;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const len = await evaljs(send, 'document.body.innerText.length');
      const elapsed = Date.now() - t0;
      const netIdle = (Date.now() - lastActivity) > 1800;
      // Repli : si le réseau ne se calme jamais (rafraîchissements de session
      // en boucle sur /login), on accepte la stabilité après 15 s.
      const canSettle = netIdle || elapsed > 15000;
      if (len === prev && len > 300 && canSettle && elapsed > 2500) {
        stable++;
        if (stable >= 2) return true;
      } else {
        stable = 0;
        prev = len;
      }
    } catch { /* compilation */ }
    await sleep(500);
  }
  return false;
}

// Mesure d'une vue : renvoie débordement + éléments fautifs
const MEASURE = `(() => {
  try {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - vw;

    const inScrollableAncestor = (el) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const st = getComputedStyle(p);
        if (st.overflowX === 'auto' || st.overflowX === 'scroll') return true;
        p = p.parentElement;
      }
      return false;
    };

    const offenders = [];
    if (overflow > 1) {
      for (const el of document.querySelectorAll('body *')) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 40) continue;
        if (r.right <= vw + 1 && r.width <= vw + 1) continue;
        if (inScrollableAncestor(el)) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          w: Math.round(r.width),
          right: Math.round(r.right),
          cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
          txt: (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 55),
        });
      }
      offenders.sort((a, b) => b.right - a.right);
    }

    // Barre latérale : "réellement visible" = elle occupe vraiment la fenêtre
    // (un tiroir off-canvas via translateX(-100%) a width>0 mais left très négatif)
    const side = [...document.querySelectorAll('nav, aside')].find(n => n.offsetWidth > 120);
    const sideRect = side ? side.getBoundingClientRect() : null;
    const sideOnScreen = sideRect
      ? (sideRect.left > -2 && sideRect.right > 40 && getComputedStyle(side).visibility !== 'hidden')
      : false;

    // Grilles / flex dont le contenu est tronqué (colonne unique forcée à 1)
    const tables = [...document.querySelectorAll('table')].filter(t => t.offsetWidth > 0);
    const wrappedTables = tables.filter(t => {
      let p = t.parentElement;
      while (p && p !== document.body) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
        p = p.parentElement;
      }
      return false;
    });

    // Champs d'en-tête tronqués (texte coupé à droite dans leur conteneur)
    const clipped = [];
    for (const el of document.querySelectorAll('input')) {
      if (el.type !== 'text' && el.type !== 'search') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40) continue;
      if (r.right > vw + 1) clipped.push({ kind: 'input-deborde', w: Math.round(r.width), right: Math.round(r.right), ph: (el.placeholder || '').slice(0, 40) });
    }

    return JSON.stringify({
      vw, scrollW: doc.scrollWidth, overflow,
      offenders: offenders.slice(0, 5), nOff: offenders.length,
      sideW: side ? Math.round(sideRect.width) : 0,
      sideOnScreen,
      nTables: tables.length, nTablesWrapped: wrappedTables.length,
      clipped,
      textLen: document.body.innerText.length,
    });
  } catch (e) { return JSON.stringify({ err: String(e) }); }
})()`;

async function seed(uid) {
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (loginErr) throw new Error('seed login: ' + loginErr.message);
  const today = new Date().toISOString().slice(0, 10);
  const errs = [];

  // Chaque insert est vérifié : une colonne inexistante = PGRST204 silencieux
  const put = async (table, payload) => {
    const { error } = await anon.from(table).insert(payload);
    if (error) errs.push(`${table}: ${error.message}`);
    return !error;
  };

  const prods = [
    ['Iphone 15 Pro Max', 'Smartphones', 12, 4, 750, 520],
    ['Coque Silicone', 'Accessoires', 3, 5, 25, 8],
    ['Chargeur Rapide', 'Accessoires', 0, 3, 40, 15],
    ['Galaxy S24 Ultra', 'Smartphones', 6, 2, 690, 470],
    ['Écouteurs Bluetooth', 'Audio', 8, 4, 60, 28],
  ];
  const pids = [];
  for (const [name, cat, qty, min, sell, buy] of prods) {
    const status = qty <= 0 ? 'rupture' : qty <= min ? 'stock_faible' : 'en_stock';
    const { data, error } = await anon.from('products').insert({
      user_id: uid, name, category: cat, quantity: qty, min_threshold: min,
      selling_price: sell, purchase_price: buy, created_at: today, status, total_sales_count: 0,
    }).select('id').maybeSingle();
    if (error) errs.push(`products(${name}): ${error.message}`);
    else if (data) pids.push({ id: data.id, name, sell, buy, qty });
  }

  await put('customers', [
    { user_id: uid, name: 'Jean Mukendi', phone: '+243 81 123 4567', email: 'jean@mail.cd', purchases_count: 4, total_spent: 1250, last_purchase_date: today, avatar: '' },
    { user_id: uid, name: 'Alice Kasongo', phone: '+243 99 555 0101', purchases_count: 2, total_spent: 340, last_purchase_date: today, avatar: '' },
  ]);

  // expenses : la colonne est "description" (pas label/notes)
  await put('expenses', [
    { user_id: uid, date: today, category: 'approvisionnement', description: 'Achat marchandise fournisseur', amount: 420 },
    { user_id: uid, date: today, category: 'transport', description: 'Transport boda-bodi livraison', amount: 35 },
    { user_id: uid, date: today, category: 'loyer', description: 'Loyer boutique Gombe', amount: 300 },
  ]);

  // sales : PAS de colonne created_at (c'est created_at_ts, généré)
  const saleCode = `VNT-${Date.now().toString().slice(-8)}`;
  const { data: sv, error: sErr } = await anon.from('sales').insert({
    user_id: uid, date: today, code: saleCode,
    client_name: 'Jean Mukendi', client_phone: '+243 81 123 4567',
    payment_method: 'especes', total_amount: 775, total_profit: 205,
  }).select('id').maybeSingle();
  if (sErr) errs.push('sales: ' + sErr.message);
  if (sv) {
    await put('sale_items', [
      { sale_id: sv.id, product_id: pids[0]?.id ?? null, product_name: pids[0]?.name ?? 'Iphone 15 Pro Max', quantity: 1, unit_price: 750, purchase_price: 520, total: 750 },
      { sale_id: sv.id, product_id: pids[1]?.id ?? null, product_name: pids[1]?.name ?? 'Coque Silicone', quantity: 2, unit_price: 25, purchase_price: 8, total: 50 },
    ]);
    await put('stock_movements', [
      { user_id: uid, product_id: pids[0]?.id ?? null, product_name: pids[0]?.name ?? 'Iphone 15 Pro Max', movement_type: 'sortie', quantity: 1, reference: saleCode, note: 'Vente enregistrée', date: today },
      { user_id: uid, product_id: pids[1]?.id ?? null, product_name: pids[1]?.name ?? 'Coque Silicone', movement_type: 'sortie', quantity: 2, reference: saleCode, note: 'Vente enregistrée', date: today },
    ]);
  }

  // debts : initial_amount (pas amount), pas de code/due_date/created_at,
  // status limité à non_payee | partiellement_payee | payee
  await put('debts', [
    { user_id: uid, date: today, person_name: 'Patrick Ilunga', phone: '+243 82 777 8888', initial_amount: 500, paid_amount: 200, remaining_amount: 300, status: 'partiellement_payee', product_name: 'Iphone 15 Pro Max', quantity: 1 },
    { user_id: uid, date: today, person_name: 'Grâce Mbuyi', phone: '+243 83 222 4455', initial_amount: 150, paid_amount: 0, remaining_amount: 150, status: 'non_payee', product_name: 'Galaxy S24 Ultra', quantity: 1 },
  ]);

  // Garde-fou : on refuse de produire des captures vides
  const counts = {};
  for (const t of ['products', 'customers', 'expenses', 'sales', 'sale_items', 'debts', 'stock_movements']) {
    const { count } = await anon.from(t).select('*', { count: 'exact', head: true });
    counts[t] = count ?? 0;
  }
  console.log(`  🌱 seed → ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  if (errs.length) console.log('  ⚠️  erreurs seed : ' + errs.join(' | '));
  const empty = Object.entries(counts).filter(([, v]) => v === 0).map(([k]) => k);
  if (empty.length) console.log('  ⚠️  tables vides : ' + empty.join(', '));
  return counts;
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  AUDIT DE RESPONSIVITÉ — 3 largeurs × ' + ROUTES.length + ' routes');
  console.log('════════════════════════════════════════════════════════\n');
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Audit', last_name: 'Responsive', store_name: 'Boutique Audit', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }
  await seed(uid);

  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  if (existsSync(SHOTS)) rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const profile = join(tmpdir(), `comaxe-edge-resp-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  let ctx;
  const rows = [];
  try {
    await sleep(2500);
    const targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('aucune cible page');
    ctx = await connect(page.webSocketDebuggerUrl, () => { lastActivity = Date.now(); });
    // Navigation tolérante : la compilation froide d'une route Next peut
    // dépasser 30 s (dev server), l'accusé de réception attend alors le commit.
    const navigate = (url) => ctx.send('Page.navigate', { url }, 120000);

    await ctx.send('Network.enable');
    for (const c of cookies) await ctx.send('Network.setCookie', c);
    await ctx.send('Page.enable');
    await ctx.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    for (const [name, path, needAuth] of ROUTES) {
      try {
        if (!needAuth) {
          for (const c of cookies) await ctx.send('Network.deleteCookies', { name: c.name, url: 'http://localhost' });
        }
        lastActivity = Date.now();
        await navigate(APP + path);
        const ready = await waitReady(ctx.send);
        process.stdout.write(`  • ${name.padEnd(14)} ${path.padEnd(14)} ${ready ? '' : '(non stabilisé)'}`);

        for (const [vp, w, h, mobile] of VIEWPORTS) {
          await ctx.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
          await sleep(900);
          let m;
          try {
            m = JSON.parse(await evaljs(ctx.send, MEASURE));
          } catch (e) { m = { err: e.message }; }
          rows.push({ page: name, path, vp, w, ...m });

          if (vp === 'mobile') {
            try {
              const shot = await ctx.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
              writeFileSync(join(SHOTS, `${name}-mobile.png`), Buffer.from(shot.data, 'base64'));
            } catch { /* capture non bloquante */ }
          }
        }
        console.log('');
      } catch (e) {
        console.log(`  • ${name.padEnd(14)} ${path.padEnd(14)} ⚠️ ${e.message}`);
      }
      // Remet les cookies pour les routes suivantes (supprimés pour /login)
      for (const c of cookies) await ctx.send('Network.setCookie', c);
    }
  } catch (e) {
    console.log('\n  ⚠️  ' + e.message);
  } finally {
    try { ctx?.close(); } catch { /* fermé */ }
    try { edge.kill(); } catch { /* mort */ }
    await sleep(600);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* verrouillé */ }
    try { await admin.auth.admin.deleteUser(uid); } catch { /* déjà supprimé */ }
  }

  // ── Rapport ──
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  DÉBORDEMENT HORIZONTAL (scrollWidth − innerWidth)');
  console.log('════════════════════════════════════════════════════════\n');
  console.log('  route          ' + VIEWPORTS.map(([n, w]) => `${n}(${w})`.padEnd(16)).join(''));
  for (const [name] of ROUTES) {
    const cells = VIEWPORTS.map(([vp]) => {
      const r = rows.find((x) => x.page === name && x.vp === vp);
      if (!r) return '—'.padEnd(16);
      if (r.err) return 'ERR'.padEnd(16);
      return `${r.overflow}px${r.nOff ? ` (${r.nOff} él.)` : ''}`.padEnd(16);
    }).join('');
    console.log(`  ${name.padEnd(14)} ${cells}`);
  }

  const bad = rows.filter((r) => r.overflow > 1);
  console.log(`\n  → ${bad.length} combinaison(s) en débordement sur ${rows.length} mesures.\n`);

  if (bad.length) {
    console.log('════════════════════════════════════════════════════════');
    console.log('  ÉLÉMENTS RESPONSABLES (hors conteneurs scrollables)');
    console.log('════════════════════════════════════════════════════════');
    for (const r of bad) {
      console.log(`\n  ▸ ${r.path} @ ${r.vp} (${r.w}px) → déborde de ${r.overflow}px`);
      (r.offenders || []).slice(0, 4).forEach((o) => {
        console.log(`      <${o.tag}> w=${o.w} right=${o.right}`);
        if (o.cls) console.log(`        classe: ${o.cls}`);
        if (o.txt) console.log(`        texte : ${o.txt}`);
      });
    }
  }

  const sideIssues = rows.filter((r) => r.vp === 'mobile' && r.sideOnScreen);
  if (sideIssues.length) {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  BARRE LATÉRALE RÉELLEMENT VISIBLE EN MOBILE (devrait être masquée)');
    console.log('════════════════════════════════════════════════════════');
    sideIssues.forEach((r) => console.log(`  ▸ ${r.path} — sidebar sur l’écran, largeur ${r.sideW}px`));
  }

  const clipped = rows.filter((r) => (r.clipped && r.clipped.length > 0));
  if (clipped.length) {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  CHAMPS QUI DÉBORDENT DE LA FENÊTRE (texte coupé)');
    console.log('════════════════════════════════════════════════════════');
    clipped.forEach((r) => r.clipped.forEach((c) =>
      console.log(`  ▸ ${r.path} @ ${r.vp}(${r.w}) — ${c.kind} w=${c.w} right=${c.right} ph="${c.ph}"`)));
  }

  const noWrap = rows.filter((r) => r.nTables > 0 && r.nTablesWrapped < r.nTables);
  if (noWrap.length) {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  TABLEAUX SANS CONTENEUR SCROLLABLE (mobile)');
    console.log('════════════════════════════════════════════════════════');
    noWrap.forEach((r) => console.log(`  ▸ ${r.path} @ ${r.vp} — ${r.nTables} tableau(x), ${r.nTablesWrapped} enveloppé(s)`));
  }

  writeFileSync(join(SHOTS, 'audit.json'), JSON.stringify(rows, null, 2));
  console.log(`\n  📸 Captures mobile : ${SHOTS}`);
  console.log('════════════════════════════════════════════════════════');
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
