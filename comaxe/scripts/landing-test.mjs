// COMAXE — Vérification de la LANDING PAGE & de la page TARIFS
//   • thème clair / sombre (3 modes via prefs)
//   • i18n FR / EN
//   • responsive 375 (mobile) / 768 (tablette) / 1440 (desktop) — pas de débordement
//   • captures d'écran pour contrôle visuel
// Edge headless + CDP. Usage : node scripts/landing-test.mjs  (serveur requis sur :3000)
import { spawn } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = 'http://localhost:3000';
const CDP_PORT = 9233;
const SHOTS = join(__dirname, '_shots_landing');

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

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

async function goto(send, path) {
  await send('Page.navigate', { url: APP + path });
  await sleep(1000);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try {
      const ready = await evaljs(send, 'document.readyState');
      const len = await evaljs(send, 'document.body.innerText.length');
      if (ready === 'complete' && len > 300) break;
    } catch { /* compilation */ }
    await sleep(400);
  }
  await sleep(1200);
}

async function shot(send, name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
}

/** Écrit les préférences COMAXE puis recharge la page */
async function setPrefs(send, prefs) {
  await evaljs(
    send,
    `localStorage.setItem('comaxe.preferences', ${JSON.stringify(JSON.stringify(prefs))}); 'ok'`
  );
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
}

/** Capture de la section #tarifs (hauteur entière, hors viewport) */
async function shotTarifs(send, name) {
  const clip = await evaljs(
    send,
    `(() => { const el = document.getElementById('tarifs'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + window.scrollY), width: document.documentElement.clientWidth, height: Math.min(r.height, 8000) }; })()`
  );
  if (!clip) return false;
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: true,
  });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
  return true;
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  console.log('════════════════════════════════════════════');
  console.log('  TEST LANDING — thème, i18n, responsive');
  console.log('════════════════════════════════════════════\n');

  let edge = null;
  let conn = null;

  try {
    // ── 1. Navigateur (desktop 1440) ──
    console.log('1️⃣  Edge headless');
    const profile = join(process.env.TEMP || '/tmp', 'comaxe-landing-profile-' + Date.now());
    edge = spawn(EDGE, [
      '--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=' + profile,
      '--no-first-run', '--no-default-browser-check', '--disable-gpu',
      '--window-size=1440,900', '--hide-scrollbars', 'about:blank',
    ], { stdio: 'ignore' });

    const targets = await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    conn = await connect(page.webSocketDebuggerUrl);
    const { send, close } = conn;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    check('CDP connecté', true);

    // ── 2. Landing — thème clair (desktop) ──
    console.log('\n2️⃣  Landing — thème clair');
    await goto(send, '/');
    await setPrefs(send, { theme: 'light', locale: 'fr' });

    const bodyBg = await evaljs(send, 'getComputedStyle(document.body).backgroundColor');
    check('Fond clair #F8F9FD', bodyBg === 'rgb(248, 249, 253)', bodyBg);

    const headerBg = await evaljs(send, 'getComputedStyle(document.querySelector("header")).backgroundColor');
    check('En-tête translucide clair', headerBg.replace(/\s/g, '').includes('248,249,253'), headerBg);

    const cardBg = await evaljs(
      send,
      '(() => { const c = document.querySelector("#fonctionnalites .bg-white"); return c ? getComputedStyle(c).backgroundColor : "absent"; })()'
    );
    check('Carte features blanche', cardBg === 'rgb(255, 255, 255)', cardBg);

    const h1Color = await evaljs(send, 'getComputedStyle(document.querySelector("h1")).color');
    check('Titre Hero sombre', h1Color === 'rgb(15, 23, 42)', h1Color);

    const anchors = await evaljs(
      send,
      '["fonctionnalites","tarifs","faq","contact"].every(id => document.getElementById(id))'
    );
    check('Ancres #fonctionnalites/#tarifs/#faq/#contact', anchors === true);

    await shot(send, '01-landing-clair-desktop');

    // ── 3. Landing — thème sombre ──
    console.log('\n3️⃣  Landing — thème sombre');
    await setPrefs(send, { theme: 'dark', locale: 'fr' });
    await goto(send, '/');

    const darkOn = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    check('Classe `dark` sur <html>', darkOn === true);

    const bodyBgD = await evaljs(send, 'getComputedStyle(document.body).backgroundColor');
    check('Fond sombre #0B1220', bodyBgD === 'rgb(11, 18, 32)', bodyBgD);

    const headerBgD = await evaljs(send, 'getComputedStyle(document.querySelector("header")).backgroundColor');
    check('En-tête sombre translucide', headerBgD.replace(/\s/g, '').includes('11,18,32'), headerBgD);

    const cardBgD = await evaljs(
      send,
      '(() => { const c = document.querySelector("#fonctionnalites .bg-white"); return c ? getComputedStyle(c).backgroundColor : "absent"; })()'
    );
    check('Carte features non blanche en sombre', cardBgD !== 'rgb(255, 255, 255)' && cardBgD !== 'absent', cardBgD);

    const h1ColorD = await evaljs(send, 'getComputedStyle(document.querySelector("h1")).color');
    check('Titre Hero clair en sombre', h1ColorD !== 'rgb(15, 23, 42)' && h1ColorD !== 'absent', h1ColorD);

    const whiteText = await evaljs(
      send,
      `(() => {
        const els = [...document.querySelectorAll('h2, h3, p, span, a')].slice(0, 400);
        const light = els.filter(e => {
          const c = getComputedStyle(e);
          const bg = c.backgroundColor;
          return c.color === 'rgb(15, 23, 42)' && bg === 'rgba(0, 0, 0, 0)';
        });
        return light.length;
      })()`
    );
    check('Aucun texte noir « fantôme » sur fond transparent (échantillon)', whiteText === 0, `trouvés=${whiteText}`);

    await shot(send, '02-landing-sombre-desktop');

    // ── 4. Landing — anglais ──
    console.log('\n4️⃣  Landing — i18n anglais');
    await goto(send, '/');
    await setPrefs(send, { theme: 'light', locale: 'en' });

    // Attente active : la bascule EN se fait à l'hydratation (page plus lourde)
    let textEn = '';
    const tEn = Date.now();
    while (Date.now() - tEn < 12000) {
      textEn = await evaljs(send, 'document.body.innerText');
      if ((textEn || '').includes('Start for free')) break;
      await sleep(500);
    }
    check('Textes en anglais (Start for free)', textEn.includes('Start for free'));
    check('Pas de libellés FR résiduels', !textEn.includes('Fonctionnalités') && !textEn.includes('Commencer gratuitement'));

    // ── 5. Responsive mobile 375 ──
    console.log('\n5️⃣  Responsive mobile (375 px)');
    await goto(send, '/');
    await setPrefs(send, { theme: 'light', locale: 'fr' });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 812, deviceScaleFactor: 2, mobile: true,
    });
    await goto(send, '/');

    const overflow = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Landing sans débordement horizontal', overflow <= 377, `scrollWidth=${overflow}`);

    const navHidden = await evaljs(
      send,
      '(() => { const n = document.querySelector("header nav"); return n ? getComputedStyle(n).display : "absent"; })()'
    );
    check('Nav masquée sur mobile', navHidden === 'none', navHidden);

    const heroVisible = await evaljs(
      send,
      '(() => { const h = document.querySelector("h1"); return h ? h.getBoundingClientRect().width <= 375 : false; })()'
    );
    check('Hero tient dans l’écran', heroVisible === true);

    await shot(send, '03-landing-mobile');

    // ── 5b. Responsive tablette 768 ──
    console.log('\n5️⃣b  Responsive tablette (768 px)');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768, height: 1024, deviceScaleFactor: 2, mobile: true,
    });
    await goto(send, '/');

    const overflowTab = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Landing sans débordement (tablette)', overflowTab <= 770, `scrollWidth=${overflowTab}`);

    const navTab = await evaljs(
      send,
      '(() => { const n = document.querySelector("header nav"); return n ? getComputedStyle(n).display : "absent"; })()'
    );
    check('Nav visible sur tablette', navTab === 'flex', navTab);

    await shot(send, '03b-landing-tablette');

    // ── 6. Tarifs — mobile puis desktop ──
    console.log('\n6️⃣  Page /tarifs — mobile puis desktop');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 812, deviceScaleFactor: 2, mobile: true,
    });
    await goto(send, '/tarifs');

    const overflowT = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Tarifs sans débordement horizontal (mobile)', overflowT <= 377, `scrollWidth=${overflowT}`);

    const xBtn = await evaljs(
      send,
      `(() => {
        const b = [...document.querySelectorAll('button')].find(x =>
          (x.getAttribute('aria-label') || '').includes('tableau de bord'));
        return !!b;
      })()`
    );
    check('Croix « aller au dashboard » présente', xBtn === true);

    await shot(send, '04-tarifs-mobile');

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await goto(send, '/tarifs');

    const overflowTd = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Tarifs sans débordement (desktop)', overflowTd <= 1442, `scrollWidth=${overflowTd}`);

    await goto(send, '/tarifs');
    await setPrefs(send, { theme: 'dark', locale: 'fr' });
    await goto(send, '/tarifs');
    const bodyBgTd = await evaljs(send, 'getComputedStyle(document.body).backgroundColor');
    check('Tarifs en thème sombre', bodyBgTd === 'rgb(11, 18, 32)', bodyBgTd);
    await shot(send, '05-tarifs-sombre-desktop');

    // ── 7. Parcours visiteur : nav → #tarifs → bouton Essential → /login ──
    console.log('\n7️⃣  Parcours visiteur (nav → #tarifs → /login)');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await goto(send, '/');
    await setPrefs(send, { theme: 'light', locale: 'fr' });

    const shotLight = await shotTarifs(send, '06-tarifs-section-clair');
    check('Capture section tarifs (clair)', shotLight === true);

    await evaljs(send, 'document.querySelector(\'header a[href="#tarifs"]\')?.click(); true');
    await sleep(900);
    const hash = await evaljs(send, 'location.hash');
    check('Nav « Tarifs » → ancre #tarifs', hash === '#tarifs', hash);

    await evaljs(send, 'document.querySelector(\'#tarifs a[href^="/login"]\')?.click(); true');
    let path1 = '';
    const tJ = Date.now();
    while (Date.now() - tJ < 10000) {
      path1 = await evaljs(send, 'location.pathname');
      if (path1 === '/login') break;
      await sleep(500);
    }
    check('Bouton Essential (#tarifs) → /login', path1 === '/login', path1);

    await goto(send, '/');
    await setPrefs(send, { theme: 'dark', locale: 'fr' });
    const shotDark = await shotTarifs(send, '07-tarifs-section-sombre');
    check('Capture section tarifs (sombre)', shotDark === true);
  } catch (err) {
    console.error('\n❌ ERREUR FATALE:', err.message);
    fail++;
  } finally {
    try { conn?.close(); } catch { /* déjà fermé */ }
    try { edge?.kill(); } catch { /* déjà tué */ }
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
  console.log(`  Captures : ${SHOTS}`);
  console.log('════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

main();
