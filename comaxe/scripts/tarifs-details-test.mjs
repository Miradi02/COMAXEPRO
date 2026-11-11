// COMAXE — Vérification finale des TARIFS : panneau « Voir les fonctionnalités »
//   • panneau dépliés sur les 6 offres (clairs, featured, dégradés)
//   • thèmes clair / sombre / système (matchMedia)
//   • responsive 375 / 768 / 1440 avec panneaux ouverts — pas de débordement
//   • captures pour contrôle visuel
// Edge headless + CDP. Usage : node scripts/tarifs-details-test.mjs (serveur requis sur :3000)
import { spawn } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = 'http://localhost:3000';
const CDP_PORT = 9234;
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

/** Écrit les préférences COMAXE puis recharge la page */
async function setPrefs(send, prefs) {
  await evaljs(
    send,
    `localStorage.setItem('comaxe.preferences', ${JSON.stringify(JSON.stringify(prefs))}); 'ok'`
  );
  await send('Page.reload', { ignoreCache: true });
  await sleep(2500);
}

/** Capture pleine page (hauteur plafonnée) */
async function shotPage(send, name) {
  const clip = await evaljs(
    send,
    `(() => ({ x: 0, y: 0, width: document.documentElement.clientWidth, height: Math.min(document.documentElement.scrollHeight, 8000) }))()`
  );
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: true,
  });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
  return true;
}

/** Déplie tous les panneaux « Voir les fonctionnalités » */
async function expandAll(send) {
  await evaljs(
    send,
    `[...document.querySelectorAll('button')]
      .filter(b => (b.textContent || '').includes('Voir les fonctionnalités'))
      .forEach(b => b.click()); 'ok'`
  );
  await sleep(700);
}

const EXPANDED_COUNT = `(() => [...document.querySelectorAll('button')]
  .filter(b => /fonctionnalités|détails|features|details/i.test(b.textContent || ''))
  .filter(b => b.getAttribute('aria-expanded') === 'true').length)()`;

/** Titre de groupe du premier panneau ouvert (classe uppercase) */
const FIRST_GROUP_TITLE = `[...document.querySelectorAll('p')].find(p => (p.className || '').includes('uppercase')) || null`;

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  console.log('════════════════════════════════════════════');
  console.log('  TEST TARIFS — panneau déplié, thèmes, formats');
  console.log('════════════════════════════════════════════\n');

  let edge = null;
  let conn = null;

  try {
    console.log('1️⃣  Edge headless');
    const profile = join(process.env.TEMP || '/tmp', 'comaxe-tarifs-profile-' + Date.now());
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

    // ── 2. Clair desktop : panneaux dépliés ──
    console.log('\n2️⃣  /tarifs — clair desktop, panneaux ouverts');
    await goto(send, '/tarifs');
    await setPrefs(send, { theme: 'light', locale: 'fr' });
    await goto(send, '/tarifs');

    const nbBtns = await evaljs(
      send,
      `[...document.querySelectorAll('button')].filter(b => (b.textContent || '').includes('Voir les fonctionnalités')).length`
    );
    check('6 boutons « Voir les fonctionnalités »', nbBtns === 6, `trouvés=${nbBtns}`);

    await expandAll(send);
    const expanded = await evaljs(send, EXPANDED_COUNT);
    check('6 panneaux dépliés (aria-expanded)', expanded === 6, `dépliés=${expanded}`);

    const titleColor = await evaljs(
      send,
      `(() => { const p = ${FIRST_GROUP_TITLE}; return p ? getComputedStyle(p).color : 'absent'; })()`
    );
    check('Titre de groupe bleu #1E5BF8', titleColor === 'rgb(30, 91, 248)', titleColor);

    const panelBorder = await evaljs(
      send,
      `(() => { const p = ${FIRST_GROUP_TITLE}; const d = p?.closest('.rounded-2xl'); return d ? getComputedStyle(d).borderTopColor : 'absent'; })()`
    );
    check('Panneau cerclé (border-blue-100)', panelBorder === 'rgb(219, 234, 254)', panelBorder);

    const overflowC = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Pas de débordement (desktop clair)', overflowC <= 1442, `scrollWidth=${overflowC}`);

    await shotPage(send, '08-tarifs-details-clair');

    // ── 3. Sombre desktop : panneaux dépliés ──
    console.log('\n3️⃣  /tarifs — sombre desktop, panneaux ouverts');
    await setPrefs(send, { theme: 'dark', locale: 'fr' });
    await goto(send, '/tarifs');
    await expandAll(send);

    const darkOn = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    check('Classe `dark` sur <html>', darkOn === true);

    const panelBgD = await evaljs(
      send,
      `(() => { const p = ${FIRST_GROUP_TITLE}; const d = p?.closest('.rounded-2xl'); return d ? getComputedStyle(d).backgroundColor : 'absent'; })()`
    );
    check(
      'Panneau remappé en sombre (pas de bleu clair)',
      panelBgD !== 'rgb(239, 246, 255)' && panelBgD !== 'absent',
      panelBgD
    );

    const ghostD = await evaljs(
      send,
      `(() => {
        const p = ${FIRST_GROUP_TITLE};
        const panel = p?.closest('.rounded-2xl');
        if (!panel) return -1;
        const els = [...panel.querySelectorAll('p, span, li')];
        return els.filter(e => getComputedStyle(e).color === 'rgb(15, 23, 42)').length;
      })()`
    );
    check('Aucun texte noir « fantôme » dans le panneau (sombre)', ghostD === 0, `trouvés=${ghostD}`);

    const overflowD = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Pas de débordement (desktop sombre)', overflowD <= 1442, `scrollWidth=${overflowD}`);

    await shotPage(send, '09-tarifs-details-sombre');

    // ── 4. Thème système (matchMedia) ──
    console.log('\n4️⃣  Thème système (clair/système)');
    await setPrefs(send, { theme: 'system', locale: 'fr' });

    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    });
    await send('Page.reload', { ignoreCache: true });
    await sleep(2500);
    const sysDark = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    check('Système sombre → mode sombre actif', sysDark === true);

    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    await send('Page.reload', { ignoreCache: true });
    await sleep(2500);
    const sysLight = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    check('Système clair → mode clair actif', sysLight === false);

    // ── 5. i18n du panneau (EN) ──
    console.log('\n5️⃣  i18n du panneau (anglais)');
    await setPrefs(send, { theme: 'light', locale: 'en' });
    await goto(send, '/tarifs');
    let txtEn = '';
    const tEn = Date.now();
    while (Date.now() - tEn < 12000) {
      txtEn = await evaljs(send, 'document.body.innerText');
      if ((txtEn || '').includes('See features')) break;
      await sleep(500);
    }
    check('Libellés EN (See features)', txtEn.includes('See features'));
    check('Pas de libellé FR résiduel', !txtEn.includes('Voir les fonctionnalités'));

    // ── 6. Mobile 375 avec panneaux ouverts ──
    console.log('\n6️⃣  Mobile 375 — panneaux ouverts');
    await setPrefs(send, { theme: 'light', locale: 'fr' });
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 812, deviceScaleFactor: 2, mobile: true,
    });
    await goto(send, '/tarifs');
    await expandAll(send);
    const overflowM = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Pas de débordement (mobile, panneaux ouverts)', overflowM <= 377, `scrollWidth=${overflowM}`);
    await shotPage(send, '10-tarifs-details-mobile');

    // ── 7. Tablette 768 avec panneaux ouverts ──
    console.log('\n7️⃣  Tablette 768 — panneaux ouverts');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768, height: 1024, deviceScaleFactor: 2, mobile: true,
    });
    await goto(send, '/tarifs');
    await expandAll(send);
    const overflowT = await evaljs(send, 'document.documentElement.scrollWidth');
    check('Pas de débordement (tablette, panneaux ouverts)', overflowT <= 770, `scrollWidth=${overflowT}`);
    await shotPage(send, '11-tarifs-details-tablette');
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
