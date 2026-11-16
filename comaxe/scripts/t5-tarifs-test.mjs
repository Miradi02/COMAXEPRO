// COMAXE — Test T5 : Landing, tarifs & abonnement (visiteur / gratuit / payant).
//   1. Landing : « Commencer gratuitement » (hero + CTA) → /login (pas #tarifs)
//   2. /tarifs visiteur : Essential visible, AUCUN lien Accueil / Ouvrir
//      l'application / Retour à l'accueil, croix = seule sortie, logo non cliquable
//   3. /tarifs compte GRATUIT (nouveau) : Essential visible
//   4. /tarifs compte PAYANT (Pro) : 3 offres payantes seulement (Essential masquée)
//   5. /tarifs?offres=payer : 3 offres payantes (sans session)
//   6. Grille 3 offres : plein largeur desktop, 0 débordement mobile 375
// Usage : node scripts/t5-tarifs-test.mjs
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
const PORT = 9237;
const RUN = Date.now();
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

function connect(wsUrl) {
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
        } else if (m.method) lastActivity = Date.now();
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

/** Attend que la page soit hydratée (fin du loader « Chargement… »). */
async function waitReady(ctx, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const t = await evaljs(ctx.send, 'document.body.innerText');
      if (t && t.length > 300 && !t.includes('Chargement')) return true;
    } catch { /* navigation en cours */ }
    await sleep(300);
  }
  return false;
}

const TXT = `(() => JSON.stringify({
  path: location.pathname + location.search,
  vw: window.innerWidth,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  text: document.body.innerText.replace(/[\\u202f\\u00a0]/g, ' ').replace(/\\n{2,}/g, '\\n').trim(),
}))()`;

async function snap(ctx) {
  const s = JSON.parse(await evaljs(ctx.send, TXT));
  return { ...s, has: (frag) => s.text.includes(frag) };
}

/** Noms d'offres affichés (texte exact, indépendamment du text-transform). */
async function planNames(ctx) {
  const raw = await evaljs(ctx.send,
    `(() => [...document.querySelectorAll('main *')]
      .filter(e => e.children.length === 0 && /^(Essential|Pro|Max|Ultime)$/.test(e.textContent.trim()))
      .map(e => e.textContent.trim()))()`);
  return Array.isArray(raw) ? raw : [];
}

async function shot(ctx, name) {
  try {
    const s = await ctx.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(SHOTS, name), Buffer.from(s.data, 'base64'));
  } catch { /* capture non bloquante */ }
}

async function cookiesFor(email) {
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let lastErr;
  for (let i = 0; i < 3; i++) {
    const { error } = await ssr.auth.signInWithPassword({ email, password: PASSWORD });
    if (!error) return [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));
    lastErr = error;
    await sleep(1200);
  }
  throw new Error('signIn ' + email + ' : ' + lastErr.message);
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T5 — TEST LANDING / TARIFS / ABONNEMENT');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Comptes : gratuit (nouveau) et payant (Pro) ──
  const EMAIL_FREE = `t5-free-${RUN}@comaxe.test`;
  const EMAIL_PRO = `t5-pro-${RUN}@comaxe.test`;
  const mk = async (email, meta) => {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { first_name: 'Test', last_name: 'T5', store_name: 'Boutique T5', store_currency: 'USD', store_country: 'CD', ...meta },
    });
    if (error || !data?.user) throw new Error('createUser ' + email);
    return data.user.id;
  };
  const uidFree = await mk(EMAIL_FREE, { onboarding_completed: true });
  const uidPro = await mk(EMAIL_PRO, { onboarding_completed: true });
  await admin.from('subscriptions').upsert(
    { user_id: uidPro, plan_id: 'pro', status: 'active', billing_period: 'monthly', started_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  await admin.from('user_preferences').upsert({ user_id: uidFree, theme: 'light' }, { onConflict: 'user_id' });
  await admin.from('user_preferences').upsert({ user_id: uidPro, theme: 'light' }, { onConflict: 'user_id' });

  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `comaxe-edge-t5-${RUN}`);
  mkdirSync(profile, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  let ctx;
  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(700);
      try { targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`, 3000); if (targets) break; } catch { /* pas prêt */ }
    }
    if (!targets) throw new Error('CDP indisponible');
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('aucune cible page');
    ctx = await connect(page.webSocketDebuggerUrl);
    await ctx.send('Network.enable');
    await ctx.send('Page.enable');
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // ── 1. Landing : CTA → /login ──
    console.log('  ── 1. Landing : « Commencer gratuitement » → /login ──');
    await navigate(ctx, APP + '/');
    await waitReady(ctx);
    const heroCta = await evaljs(ctx.send,
      `(() => { const a = [...document.querySelectorAll('a')].find(x => x.innerText.includes('Commencer gratuitement')); return a ? a.getAttribute('href') : null; })()`);
    check('CTA hero « Commencer gratuitement » → /login', heroCta === '/login', `href=${heroCta}`);
    const ctaCount = await evaljs(ctx.send,
      `[...document.querySelectorAll('a')].filter(x => x.innerText.includes('Commencer gratuitement') && x.getAttribute('href') === '/login').length`);
    check('Hero + section CTA → /login (x2)', ctaCount >= 2, `n=${ctaCount}`);

    // ── 2. /tarifs visiteur ──
    console.log('  ── 2. /tarifs visiteur ──');
    await navigate(ctx, APP + '/tarifs');
    await waitReady(ctx);
    let s = await snap(ctx);
    let names = await planNames(ctx);
    check('Visiteur : Essential affichée', names.includes('Essential'), `noms=${names.join(',')}`);
    check('Visiteur : 4 offres commerce', ['Essential', 'Pro', 'Max', 'Ultime'].every((n) => names.includes(n)), `noms=${names.join(',')}`);
    check('Pas de lien « Accueil »', !s.has('Accueil'));
    check('Pas de « Ouvrir l’application »', !s.has('Ouvrir l’application'));
    check('Pas de « Retour à l’accueil » (footer)', !s.has('Retour à l’accueil'));
    check('Croix = sortie (aria-label dashboard)',
      await evaljs(ctx.send, `!![...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('tableau de bord'))`));
    check('Logo non cliquable (pas d’ancre sur le header)',
      await evaljs(ctx.send, `!document.querySelector('header a[href="/"]')`));
    check('Connexion conservée pour le visiteur', s.has('Connexion'));
    check('Desktop 1440 sans débordement', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't5-01-tarifs-visiteur.png');

    // ── 3. /tarifs?offres=payer (sans session) ──
    console.log('  ── 3. /tarifs?offres=payer (3 payantes) ──');
    await navigate(ctx, APP + '/tarifs?offres=payer');
    await waitReady(ctx);
    s = await snap(ctx);
    names = await planNames(ctx);
    check('offres=payer : Essential MASQUÉE', !names.includes('Essential'), `noms=${names.join(',')}`);
    check('offres=payer : 3 offres payantes visibles', ['Pro', 'Max', 'Ultime'].every((n) => names.includes(n)), `noms=${names.join(',')}`);
    check('offres=payer desktop sans débordement', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't5-02-tarifs-payant.png');

    // ── 4. Compte GRATUIT connecté → Essential visible ──
    console.log('  ── 4. Compte gratuit connecté ──');
    let cookies = await cookiesFor(EMAIL_FREE);
    for (const c of cookies) await ctx.send('Network.setCookie', c);
    await navigate(ctx, APP + '/tarifs');
    await waitReady(ctx);
    await sleep(800);
    s = await snap(ctx);
    names = await planNames(ctx);
    check('Compte gratuit : Essential affichée', names.includes('Essential'), `noms=${names.join(',')}`);
    check('Compte gratuit : bouton Connexion absent', !s.has('Connexion'));

    // ── 5. Compte PAYANT (Pro) connecté → 3 payantes seulement ──
    console.log('  ── 5. Compte Pro connecté ──');
    // purge cookies puis session Pro
    await ctx.send('Network.clearBrowserCookies');
    cookies = await cookiesFor(EMAIL_PRO);
    for (const c of cookies) await ctx.send('Network.setCookie', c);
    await navigate(ctx, APP + '/tarifs');
    await waitReady(ctx);
    await sleep(1200);
    s = await snap(ctx);
    names = await planNames(ctx);
    check('Pro : Essential MASQUÉE', !names.includes('Essential'), `noms=${names.join(',')}`);
    check('Pro : 3 offres payantes (Pro, Max, Ultime)', ['Pro', 'Max', 'Ultime'].every((n) => names.includes(n)), `noms=${names.join(',')}`);
    check('Pro : pas de « Ouvrir l’application » (croix seule)', !s.has('Ouvrir l’application'));
    check('Pro desktop 1440 sans débordement', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't5-03-tarifs-pro-desktop.png');

    // Grille 3 offres : largeur pleine (aucune colonne vide)
    const grid = await evaljs(ctx.send, `(() => {
      const cards = [...document.querySelectorAll('main .grid > div')].filter(d => d.innerText.includes('$'));
      if (cards.length < 3) return JSON.stringify({ n: cards.length });
      const r = cards.slice(0, 3).map(c => Math.round(c.getBoundingClientRect().width));
      const rowW = Math.round(cards[0].getBoundingClientRect().top) === Math.round(cards[1].getBoundingClientRect().top);
      return JSON.stringify({ n: cards.length, widths: r, sameRow: rowW, vw: window.innerWidth });
    })()`);
    const g = JSON.parse(grid);
    check('Grille : cartes de largeur égale (pleine largeur)', g.n >= 3 && g.widths?.every((w) => w === g.widths[0]), grid);

    // ── 6. Mobile 375 : aucun débordement ──
    console.log('  ── 6. Mobile 375 (3 offres payantes) ──');
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await navigate(ctx, APP + '/tarifs');
    await waitReady(ctx);
    await sleep(600);
    s = await snap(ctx);
    check('Pro mobile 375 sans débordement', s.overflow <= 0, `overflow=${s.overflow}`);
    const mNames = await planNames(ctx);
    check('Pro mobile : 3 offres toujours affichées', ['Pro', 'Max', 'Ultime'].every((n) => mNames.includes(n)), `noms=${mNames.join(',')}`);
    await shot(ctx, 't5-04-tarifs-pro-mobile.png');

    // Visiteur mobile
    await ctx.send('Network.clearBrowserCookies');
    await navigate(ctx, APP + '/tarifs');
    await waitReady(ctx);
    await sleep(600);
    s = await snap(ctx);
    check('Visiteur mobile 375 sans débordement', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't5-05-tarifs-visiteur-mobile.png');
  } finally {
    try { ctx?.close(); } catch { /* déjà fermé */ }
    try { edge.kill(); } catch { /* déjà tué */ }
    try {
      await admin.auth.admin.deleteUser(uidFree);
      await admin.auth.admin.deleteUser(uidPro);
    } catch { /* nettoyage best effort */ }
  }

  const failed = checks.filter((c) => !c.ok);
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`  T5 TARIFS : ${checks.length - failed.length}/${checks.length} checks OK`);
  if (failed.length) failed.forEach((f) => console.log(`   ❌ ${f.name}`));
  console.log('──────────────────────────────────────────────────────────');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('  🔴', e.message);
  process.exit(1);
});
