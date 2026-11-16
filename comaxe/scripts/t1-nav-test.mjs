// COMAXE — Test fonctionnel T1 : navigation mobile & tablette.
// Valide, sur le build de production (localhost:3000) :
//   1. barre inférieure mobile : 3 items + état actif accentué
//   2. bouton ⚙️ Paramètres en haut à DROITE (tous formats) → page /parametres
//   2b. en-tête : aucun raccourci Stock/Dépenses, aucun chip utilisateur,
//       calendrier calé à droite en téléphone, ☰ ⚙️ sur la même ligne
//   3. page Paramètres = dédiée : ni barre, ni hamburger ; bouton ← Retour
//   4. le retour restaure la navigation (barre + hamburger + ⚙️)
//   5. le tiroir hamburger passe au-dessus de la barre (backdrop recouvre)
//      + entrée « Paramètres » ABSENTE du menu général (tiroir)
//   6. navigation par la barre (clic Ventes) + bascule d'item actif
//   7. tablette 768 : 4ᵉ item Dépenses visible
//   8. desktop 1440 : AUCUNE barre, aucun hamburger, ⚙️ présente à droite,
//      sidebar visible, ni raccourci ni chip utilisateur
//   9. dark mode : barre + état actif lisibles
// Captures : scripts/_shots/t1-*.png
// Usage : node scripts/t1-nav-test.mjs
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
const PORT = 9226;
const EMAIL = `t1-nav-${Date.now()}@comaxe.test`;
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
  // Attend que la page cible soit prête (élément de nav ou texte stable)
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    try {
      const len = await evaljs(ctx.send, 'document.body.innerText.length');
      if (len > 300 && (Date.now() - lastActivity) > 1200) return;
    } catch { /* compilation */ }
    await sleep(500);
  }
}

async function waitPath(ctx, substr, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const p = await evaljs(ctx.send, 'location.pathname');
      if (p === substr || p.startsWith(substr)) return p;
    } catch { /* transition */ }
    await sleep(300);
  }
  return evaljs(ctx.send, 'location.pathname');
}

async function shot(ctx, name) {
  try {
    const s = await ctx.send('Page.captureScreenshot', { format: 'png' }); // viewport = barre visible
    writeFileSync(join(SHOTS, name), Buffer.from(s.data, 'base64'));
  } catch { /* capture non bloquante */ }
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T1 — TEST NAVIGATION MOBILE & TABLETTE');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Navigation', store_name: 'Boutique T1', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }

  // Thème clair imposé en BASE : la ligne user_preferences est la source de
  // vérité (elle écrase le cache local après le chargement Supabase).
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });

  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `comaxe-edge-t1-${Date.now()}`);
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

    // ── 1. MOBILE 375 — Dashboard (light forcé : la couleur système de la
    //        machine hôte peut être sombre et fausser les assertions) ──
    console.log('  ── 1. Mobile 375 · Dashboard ──');
    await V(375, 812, true);
    await navigate(ctx, APP + '/dashboard');
    await evaljs(ctx.send, `(() => { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: 'light' })); return true; })()`);
    await ctx.send('Page.reload', { ignoreCache: false });
    // Attend que le thème clair soit effectivement appliqué (10 s max)
    let isLight = false;
    for (let i = 0; i < 25 && !isLight; i++) {
      await sleep(400);
      try { isLight = !(await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")')); } catch { /* rechargement */ }
    }
    await sleep(1200);

    let m = await evaljs(ctx.send, `(() => {
      const bn = document.querySelector('[data-bottom-nav]');
      const act = bn && bn.querySelector('a[aria-current="page"]');
      const cap = act && act.querySelector('span');
      const gear = document.querySelector('header a[aria-label="Paramètres"], header a[aria-label="Settings"]');
      const burger = document.querySelector('header button[aria-label="Ouvrir le menu"], header button[aria-label="Open menu"]');
      const dateBtn = document.querySelector('header button[aria-pressed]');
      const main = document.querySelector('main');
      const gr = gear ? gear.getBoundingClientRect() : null;
      const br = burger ? burger.getBoundingClientRect() : null;
      const dr = dateBtn ? dateBtn.getBoundingClientRect() : null;
      const header = document.querySelector('header');
      return JSON.stringify({
        dark: document.documentElement.classList.contains('dark'),
        bar: !!bn,
        items: bn ? [...bn.querySelectorAll('a')].filter(a => a.getBoundingClientRect().width > 0).length : 0,
        active: act ? (act.innerText || '').replace(/\\s+/g, ' ').trim() : null,
        activeColor: act ? getComputedStyle(act).color : null,
        capBg: cap ? getComputedStyle(cap).backgroundColor : null,
        gearVisible: gear ? gear.getBoundingClientRect().width > 0 && getComputedStyle(gear).display !== 'none' : false,
        gearRight: gr ? Math.round(gr.right) : null,
        gearTop: gr ? Math.round(gr.top) : null,
        burgerTop: br ? Math.round(br.top) : null,
        vw: window.innerWidth,
        dateRight: dr ? Math.round(dr.right) : null,
        dateTop: dr ? Math.round(dr.top) : null,
        shortcuts: !!document.querySelector('header a[href="/stock"], header a[href="/depenses"]'),
        userChip: !!header && /Test Navigation/.test(header.innerText),
        burgerVisible: burger ? burger.getBoundingClientRect().width > 0 && getComputedStyle(burger).display !== 'none' : false,
        mainPb: main ? getComputedStyle(main).paddingBottom : null,
        path: location.pathname,
      });
    })()`);
    m = JSON.parse(m);
    check('Thème clair actif pour la mesure', !m.dark);
    check('Barre présente sur /dashboard (mobile)', m.bar, `path=${m.path}`);
    check('3 items visibles sur téléphone', m.items === 3, `${m.items} items`);
    check('Item actif = Dashboard', m.active === 'Dashboard', `actif="${m.active}"`);
    check('Actif en accent COMAXE', m.activeColor === 'rgb(30, 91, 248)', m.activeColor);
    check('Capsule d\'état actif colorée', !!m.capBg && m.capBg !== 'rgba(0, 0, 0, 0)', m.capBg);
    check('Bouton ⚙️ Paramètres visible en haut', m.gearVisible);
    check('⚙️ calée à DROITE (marge droite ≤ 40px)', m.gearRight !== null && m.vw - m.gearRight <= 40, `x=${m.gearRight}/${m.vw}`);
    check('⚙️ sur la MÊME ligne que ☰ (Δtop ≤ 6px)', m.gearTop !== null && m.burgerTop !== null && Math.abs(m.gearTop - m.burgerTop) <= 6, `Δ=${m.gearTop !== null && m.burgerTop !== null ? Math.abs(m.gearTop - m.burgerTop) : '?'}px`);
    check('Aucun raccourci Stock/Dépenses dans l\'en-tête', !m.shortcuts);
    check('Aucun chip utilisateur dans l\'en-tête', !m.userChip);
    check('Calendrier à DROITE sur téléphone (marge ≤ 40px)', m.dateRight !== null && m.vw - m.dateRight <= 40, `x=${m.dateRight}/${m.vw}`);
    check('Hamburger visible (pages non-Paramètres)', m.burgerVisible);
    check('Contenu réservé au-dessus de la barre (pb-28)', m.mainPb === '112px', m.mainPb);
    await shot(ctx, 't1-1-dashboard-mobile-light.png');

    // ── 2. ⚙️ → Paramètres (page dédiée) ──
    console.log('\n  ── 2. Clic ⚙️ → page Paramètres dédiée ──');
    await evaljs(ctx.send, `(() => { const g = document.querySelector('header a[aria-label="Paramètres"], header a[aria-label="Settings"]'); if (g) g.click(); return !!g; })()`);
    const p2 = await waitPath(ctx, '/parametres');
    await sleep(800);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const bn = document.querySelector('[data-bottom-nav]');
      const burger = document.querySelector('header button[aria-label="Ouvrir le menu"], header button[aria-label="Open menu"]');
      const back = document.querySelector('header button[aria-label="Retour à l\\'application"], header button[aria-label="Back to the app"]');
      const gear = document.querySelector('header a[aria-label="Paramètres"], header a[aria-label="Settings"]');
      const main = document.querySelector('main');
      return JSON.stringify({
        path: location.pathname,
        bar: !!bn,
        burger: burger ? getComputedStyle(burger).display !== 'none' : false,
        gear: gear ? getComputedStyle(gear).display !== 'none' : false,
        back: back ? back.getBoundingClientRect().width > 0 : false,
        mainPb: main ? getComputedStyle(main).paddingBottom : null,
      });
    })()`));
    check('Navigation vers /parametres', p2.startsWith('/parametres'), `path=${m.path}`);
    check('Barre inférieure MASQUÉE sur Paramètres', !m.bar);
    check('Hamburger masqué sur Paramètres', !m.burger);
    check('⚙️ masquée sur Paramètres', !m.gear);
    check('Bouton ← Retour affiché', m.back);
    check('Padding bas normal sur Paramètres (pb-6)', m.mainPb === '24px', m.mainPb);
    await shot(ctx, 't1-2-parametres-mobile-light.png');

    // ── 3. Retour → la navigation se restaure ──
    console.log('\n  ── 3. Clic ← Retour → navigation restaurée ──');
    await evaljs(ctx.send, `(() => { const b = document.querySelector('header button[aria-label="Retour à l\\'application"], header button[aria-label="Back to the app"]'); if (b) b.click(); return !!b; })()`);
    await sleep(1200);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const bn = document.querySelector('[data-bottom-nav]');
      const burger = document.querySelector('header button[aria-label="Ouvrir le menu"], header button[aria-label="Open menu"]');
      const gear = document.querySelector('header a[aria-label="Paramètres"], header a[aria-label="Settings"]');
      return JSON.stringify({
        path: location.pathname,
        bar: !!bn,
        items: bn ? [...bn.querySelectorAll('a')].filter(a => a.getBoundingClientRect().width > 0).length : 0,
        burger: burger ? getComputedStyle(burger).display !== 'none' : false,
        gear: gear ? getComputedStyle(gear).display !== 'none' : false,
      });
    })()`));
    check('Retour vers une page de l\'application', m.path === '/dashboard' || (!m.path.startsWith('/parametres') && m.bar), `path=${m.path}`);
    check('Barre restaurée après Paramètres', m.bar && m.items === 3, `${m.items} items`);
    check('Hamburger restauré', m.burger);
    check('⚙️ restaurée', m.gear);

    // ── 4. Tiroir hamburger au-dessus de la barre ──
    console.log('\n  ── 4. Tiroir hamburger ──');
    await evaljs(ctx.send, `(() => { const b = document.querySelector('header button[aria-label="Ouvrir le menu"], header button[aria-label="Open menu"]'); if (b) b.click(); return !!b; })()`);
    await sleep(600);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const aside = document.querySelector('aside');
      const backdrop = [...document.querySelectorAll('div')].find(d => d.getAttribute('aria-hidden') === 'true' && d.className.includes('inset-0'));
      const bn = document.querySelector('[data-bottom-nav]');
      const r = aside ? aside.getBoundingClientRect() : null;
      const point = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 8);
      const inDrawer = (aside && aside.contains(point)) || (backdrop && backdrop.contains(point)) || point === backdrop;
      return JSON.stringify({
        drawerOpen: r ? r.left === 0 : false,
        drawerLinks: aside ? aside.querySelectorAll('a').length : 0,
        settingsInDrawer: aside ? !!aside.querySelector('a[href="/parametres"]') : false,
        // Le point testé (bas de l'écran) doit appartenir au tiroir,
        // JAMAIS à la barre inférieure : le tiroir la recouvre bien.
        covered: Boolean(inDrawer) && !(bn && bn.contains(point)),
        topTag: point ? (point.tagName + '.' + String(point.className).slice(0, 40)) : null,
      });
    })()`));
    check('Tiroir ouvert (aside à x=0)', m.drawerOpen, `${m.drawerLinks} liens`);
    check('Entrée « Paramètres » ABSENTE du menu général', !m.settingsInDrawer);
    check('Tiroir/backdrop recouvre la barre en bas', m.covered, `au-dessus : ${m.topTag}`);
    // Doublons de la barre inférieure : absents du tiroir sur mobile
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const aside = document.querySelector('aside');
      // On ne mesure que la NAV (le lien du logo pointe aussi vers /dashboard)
      const vis = aside ? [...aside.querySelectorAll('nav a')].filter(a => a.getBoundingClientRect().width > 0) : [];
      const hrefs = vis.map(a => a.getAttribute('href'));
      return JSON.stringify({
        visible: vis.length,
        dup: ['/dashboard', '/ventes', '/stock'].filter(h => hrefs.includes(h)),
        kept: ['/clients', '/benefice', '/dettes'].filter(h => hrefs.includes(h)),
      });
    })()`));
    check('Mobile : doublons barre absents du tiroir', m.dup.length === 0, `présents=${m.dup.join(',') || 'aucun'}`);
    check('Mobile : sections restantes conservées', m.kept.length === 3, `${m.visible} liens visibles · ${m.kept.join(', ')}`);
    await shot(ctx, 't1-4-drawer-mobile-light.png');
    // Fermeture
    await evaljs(ctx.send, `(() => { const b = document.querySelector('header button[aria-label="Fermer le menu"], header button[aria-label="Close menu"]'); if (b) b.click(); return !!b; })()`);
    await sleep(500);

    // ── 5. Navigation par la barre ──
    console.log('\n  ── 5. Clic « Ventes » dans la barre ──');
    await evaljs(ctx.send, `(() => { const a = document.querySelector('[data-bottom-nav] a[href="/ventes"]'); if (a) a.click(); return !!a; })()`);
    const p5 = await waitPath(ctx, '/ventes');
    await sleep(800);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const act = document.querySelector('[data-bottom-nav] a[aria-current="page"]');
      return JSON.stringify({ path: location.pathname, active: act ? (act.innerText || '').replace(/\\s+/g, ' ').trim() : null, color: act ? getComputedStyle(act).color : null });
    })()`));
    check('Navigation vers /ventes via la barre', p5.startsWith('/ventes'), `path=${m.path}`);
    check('Item actif basculé sur Ventes', m.active === 'Ventes', `actif="${m.active}" · ${m.color}`);

    // ── 6. TABLETTE 768 — 4 items ──
    console.log('\n  ── 6. Tablette 768 ──');
    await V(768, 1024, true);
    await navigate(ctx, APP + '/dashboard');
    await sleep(1500);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const bn = document.querySelector('[data-bottom-nav]');
      const dep = bn && bn.querySelector('a[href="/depenses"]');
      return JSON.stringify({
        bar: !!bn,
        items: bn ? [...bn.querySelectorAll('a')].filter(a => a.getBoundingClientRect().width > 0).length : 0,
        depVisible: dep ? dep.getBoundingClientRect().width > 0 : false,
        active: bn && bn.querySelector('a[aria-current="page"]') ? bn.querySelector('a[aria-current="page"]').innerText.trim() : null,
      });
    })()`));
    check('Barre présente sur tablette', m.bar);
    check('4 items visibles sur tablette', m.items === 4, `${m.items} items`);
    check('Item « Dépenses » visible sur tablette', m.depVisible);
    check('Actif = Dashboard', m.active === 'Dashboard', m.active);
    await shot(ctx, 't1-3-dashboard-tablette-light.png');

    // Tablette : tiroir sans doublons (Dépenses y est aussi dans la barre)
    await evaljs(ctx.send, `(() => { const b = document.querySelector('header button[aria-label="Ouvrir le menu"], header button[aria-label="Open menu"]'); if (b) b.click(); return !!b; })()`);
    await sleep(600);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const aside = document.querySelector('aside');
      const vis = aside ? [...aside.querySelectorAll('nav a')].filter(a => a.getBoundingClientRect().width > 0) : [];
      const hrefs = vis.map(a => a.getAttribute('href'));
      return JSON.stringify({
        dup: ['/dashboard', '/ventes', '/stock', '/depenses'].filter(h => hrefs.includes(h)),
        visible: vis.length,
      });
    })()`));
    check('Tablette : doublons barre absents du tiroir', m.dup.length === 0, `${m.visible} liens visibles · présents=${m.dup.join(',') || 'aucun'}`);
    await shot(ctx, 't1-6-drawer-tablette-light.png');
    await evaljs(ctx.send, `(() => { const b = document.querySelector('header button[aria-label="Fermer le menu"], header button[aria-label="Close menu"]'); if (b) b.click(); return !!b; })()`);
    await sleep(400);

    // ── 7. DESKTOP 1440 — aucune modification ──
    console.log('\n  ── 7. Desktop 1440 (inchangé) ──');
    await V(1440, 900, false);
    await navigate(ctx, APP + '/dashboard');
    await sleep(1500);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const bn = document.querySelector('[data-bottom-nav]');
      // "Présente" = réellement rendue (lg:hidden → display:none en desktop)
      const barVisible = bn ? getComputedStyle(bn).display !== 'none' && bn.getBoundingClientRect().height > 0 : false;
      const burger = document.querySelector('header button[aria-label="Ouvrir le menu"], header button[aria-label="Open menu"]');
      const gear = document.querySelector('header a[aria-label="Paramètres"], header a[aria-label="Settings"]');
      const gr = gear ? gear.getBoundingClientRect() : null;
      const header = document.querySelector('header');
      const aside = document.querySelector('aside');
      const ar = aside ? aside.getBoundingClientRect() : null;
      const main = document.querySelector('main');
      return JSON.stringify({
        bar: barVisible,
        burger: burger ? getComputedStyle(burger).display !== 'none' : false,
        gear: gear ? getComputedStyle(gear).display !== 'none' : false,
        gearRight: gr ? Math.round(gr.right) : null,
        vw: window.innerWidth,
        shortcuts: !!document.querySelector('header a[href="/stock"], header a[href="/depenses"]'),
        userChip: !!header && /Test Navigation/.test(header.innerText),
        settingsInSidebar: aside ? !!aside.querySelector('a[href="/parametres"]') : false,
        navLinks: aside ? [...aside.querySelectorAll('nav a')].filter(a => a.getBoundingClientRect().width > 0).map(a => a.getAttribute('href')) : [],
        sidebarLeft: ar ? Math.round(ar.left) : null,
        sidebarW: ar ? Math.round(ar.width) : null,
        mainPb: main ? getComputedStyle(main).paddingBottom : null,
        pl: main ? getComputedStyle(main.parentElement).paddingLeft : null,
      });
    })()`));
    check('Aucune barre inférieure sur desktop', !m.bar);
    check('Aucun hamburger mobile sur desktop', !m.burger);
    check('⚙️ présente à droite sur desktop (marge ≤ 50px)', m.gear && m.vw - m.gearRight <= 50, `x=${m.gearRight}/${m.vw}`);
    check('Aucun raccourci Stock/Dépenses sur desktop', !m.shortcuts);
    check('Aucun chip utilisateur sur desktop', !m.userChip);
    check('Entrée « Paramètres » absente de la sidebar desktop', !m.settingsInSidebar);
    check('Sidebar desktop visible (x=0, 256px)', m.sidebarLeft === 0 && m.sidebarW === 256, `x=${m.sidebarLeft} w=${m.sidebarW}`);
    check('Desktop : Dashboard/Ventes/Stock toujours dans la sidebar', ['/dashboard', '/ventes', '/stock'].every(h => m.navLinks.includes(h)), `${m.navLinks.length} liens`);
    check('Padding bas desktop d\'origine (pb-6)', m.mainPb === '24px', m.mainPb);
    check('Décalage desktop d\'origine (lg:pl-64 = 256px)', m.pl === '256px', m.pl);
    await shot(ctx, 't1-5-dashboard-desktop-light.png');

    // ── 8. DARK MODE ──
    console.log('\n  ── 8. Dark mode (mobile 375) ──');
    await V(375, 812, true);
    await evaljs(ctx.send, `(() => { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: 'dark' })); return true; })()`);
    await admin.from('user_preferences').upsert({ user_id: uid, theme: 'dark' }, { onConflict: 'user_id' });
    await navigate(ctx, APP + '/dashboard');
    // Attend que la bascule sombre soit effective (la BDD prime sur le cache)
    let isDark = false;
    for (let i = 0; i < 25 && !isDark; i++) {
      await sleep(400);
      try { isDark = await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")'); } catch { /* rechargement */ }
    }
    await sleep(800);
    m = JSON.parse(await evaljs(ctx.send, `(() => {
      const bn = document.querySelector('[data-bottom-nav]');
      const act = bn && bn.querySelector('a[aria-current="page"]');
      const cap = act && act.querySelector('span');
      const inact = bn ? [...bn.querySelectorAll('a')].find(a => a.getAttribute('aria-current') !== 'page') : null;
      return JSON.stringify({
        dark: document.documentElement.classList.contains('dark'),
        bar: !!bn,
        barBg: bn ? getComputedStyle(bn).backgroundColor : null,
        activeColor: act ? getComputedStyle(act).color : null,
        capBg: cap ? getComputedStyle(cap).backgroundColor : null,
        inactiveColor: inact ? getComputedStyle(inact).color : null,
      });
    })()`));
    check('Thème sombre appliqué', m.dark);
    check('Barre présente en dark', m.bar, `bg=${m.barBg}`);
    check('Actif lisible en dark (#7EA6FF)', m.activeColor === 'rgb(126, 166, 255)', m.activeColor);
    check('Capsule active visible en dark', m.capBg === 'rgba(30, 91, 248, 0.16)', m.capBg);
    check('Inactif lisible en dark', !!m.inactiveColor && m.inactiveColor !== 'rgb(0, 0, 0)', m.inactiveColor);
    await shot(ctx, 't1-6-dashboard-mobile-dark.png');
  } catch (e) {
    console.log('\n  ⚠️  ' + e.message);
    check('Exécution sans erreur fatale', false, e.message);
  } finally {
    try { ctx?.close(); } catch { /* fermé */ }
    try { edge.kill(); } catch { /* mort */ }
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* verrouillé */ }
    try { await admin.auth.admin.deleteUser(uid); } catch { /* déjà supprimé */ }
  }

  const failed = checks.filter((c) => !c.ok);
  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${checks.length - failed.length}/${checks.length} contrôles OK`);
  if (failed.length) {
    console.log('  ÉCHECS :');
    failed.forEach((f) => console.log(`    ❌ ${f.name}`));
  }
  console.log(`  📸 Captures : ${SHOTS}/t1-*.png`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
