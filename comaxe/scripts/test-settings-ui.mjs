// COMAXE — Vérification UI des Paramètres (thème, logos, navigation, titre)
// Edge headless + CDP, compte de test créé puis supprimé.
// Usage : node scripts/test-settings-ui.mjs   (serveur requis sur :3000)
import { spawn } from 'child_process';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'http://localhost:3000';
const CDP_PORT = 9231;
const EMAIL = `ui-settings-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

const SHOTS = join(__dirname, '_shots_settings');
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
  await sleep(1200);
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    try {
      const ready = await evaljs(send, 'document.readyState');
      const len = await evaljs(send, 'document.body.innerText.length');
      if (ready === 'complete' && len > 300) break;
    } catch { /* compilation */ }
    await sleep(400);
  }
  await sleep(1500);
}

async function shot(send, name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFileSync } = await import('fs');
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
}

const CLICK = (text) => `(() => {
  const want = ${JSON.stringify(text)};
  const els = [...document.querySelectorAll('button')];
  const el = els.find(b => b.textContent.trim().toLowerCase() === want.toLowerCase())
        || els.find(b => b.textContent.trim().toLowerCase().includes(want.toLowerCase()));
  if (!el) return false;
  el.click();
  return true;
})()`;

// Logo officiel : fond CSS piloté par la variable --comaxe-logo
const LOGO_BG = `(() => {
  const el = document.querySelector('[role="img"][aria-label="COMAXE"]');
  return el ? getComputedStyle(el).backgroundImage : 'absent';
})()`;

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  console.log('════════════════════════════════════════════');
  console.log('  TEST UI — PARAMÈTRES, THÈME & LOGOS');
  console.log('════════════════════════════════════════════\n');

  let userId = null;
  let edge = null;
  let conn = null;

  try {
    // ── 1. Compte de test ──
    console.log('1️⃣  Compte de test');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Test', last_name: 'Settings', store_name: 'Boutique UI Test' },
    });
    check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    // ── 2. Navigateur ──
    console.log('\n2️⃣  Edge headless');
    const profile = join(process.env.TEMP || '/tmp', 'comaxe-ui-profile-' + Date.now());
    edge = spawn(EDGE, [
      '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
      '--no-first-run', '--no-default-browser-check', '--disable-gpu',
      '--window-size=1440,900', '--hide-scrollbars', 'about:blank',
    ], { stdio: 'ignore' });

    const targets = await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    conn = await connect(page.webSocketDebuggerUrl);
    const { send, close } = conn;
    await send('Page.enable');
    await send('Runtime.enable');
    check('CDP connecté', true);

    // Thème système forcé en CLAIR : la préférence « Système » de COMAXE
    // suit réellement l'OS — on simule donc un OS clair pour ce scénario.
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });

    // ── 3. Connexion ──
    console.log('\n3️⃣  Connexion');
    await goto(send, '/login');
    await evaljs(send, `(() => {
      const set = (sel, v) => { const el = document.querySelector(sel); if (!el) return false;
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return true; };
      set('input[type=email]', ${JSON.stringify(EMAIL)});
      set('input[type=password]', ${JSON.stringify(PASSWORD)});
      return true;
    })()`);
    await sleep(300);
    await evaljs(send, `document.querySelector('button[type=submit]').click(); true`);
    await sleep(4000);
    const urlAfterLogin = await evaljs(send, 'location.pathname');
    check('Redirection après connexion', urlAfterLogin !== '/login', `pathname=${urlAfterLogin}`);

    // ── 4. Titre + favicon ──
    console.log('\n4️⃣  Identité navigateur');
    const title = await evaljs(send, 'document.title');
    check('Titre du site = COMAXE', title.trim() === 'COMAXE', `"${title}"`);
    const icons = await evaljs(send, `[...document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')].map(l => l.href).join(' | ')`);
    check('Favicon présent (logo S)', icons.includes('logoS1.png') || icons.includes('icon.png'), icons || 'aucun');
    const genericIcon = await evaljs(send, `[...document.querySelectorAll('link[rel~="icon"]')].some(l => l.href.endsWith('/favicon.ico'))`);
    check('Aucune icône générique de template', genericIcon === false);

    // ── 5. Page Paramètres : hub ──
    console.log('\n5️⃣  Hub /parametres');
    await goto(send, '/parametres');
    const catCount = await evaljs(send, `document.querySelectorAll('a[href^="/parametres/"]').length`);
    check('7 catégories affichées', catCount === 7, `trouvées=${catCount}`);
    const hasSaveBtn = await evaljs(send, `!![...document.querySelectorAll('header button')].find(b => /sauvegarder/i.test(b.textContent))`);
    check('Aucun bouton « Sauvegarder » dans l’en-tête', hasSaveBtn === false);
    const headerSearch = await evaljs(send, `document.querySelectorAll('header input[type="text"], header input[type="search"]').length`);
    check('Aucune barre de recherche dans l’en-tête', headerSearch === 0, `inputs=${headerSearch}`);
    const quickLinks = await evaljs(send, `[...document.querySelectorAll('header a[href="/stock"], header a[href="/depenses"]')].length`);
    check('Raccourcis masqués sur les paramètres', quickLinks === 0, `liens=${quickLinks}`);

    // ── 6. Navigation des sous-pages ──
    console.log('\n6️⃣  Sous-pages');
    const SUB = [
      ['/parametres/compte', 'Identité du compte'],
      ['/parametres/abonnement', 'Abonnement'],
      ['/parametres/affichage', 'Affichage'],
      ['/parametres/notifications', 'Notifications'],
      ['/parametres/securite', 'Sécurité'],
      ['/parametres/donnees', 'Données'],
      ['/parametres/aide', 'Aide'],
    ];
    for (const [path, expected] of SUB) {
      await goto(send, path);
      const h1 = await evaljs(send, 'document.querySelector("h1")?.textContent?.trim() || ""');
      const len = await evaljs(send, 'document.body.innerText.length');
      check(`${path} s’ouvre`, h1.includes(expected) && len > 400, `h1="${h1}" len=${len}`);
    }

    // ── 7. Thème clair → logo C ──
    console.log('\n7️⃣  Thème et logos');
    await goto(send, '/tarifs');
    const lightDark = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    const lightLogo = await evaljs(send, LOGO_BG);
    check('Thème clair actif', lightDark === false, `dark=${lightDark}`);
    check('Logo C en thème clair', lightLogo.includes('logoC1.png'), lightLogo);
    await shot(send, '01-tarifs-clair');

    // ── 8. Passage en thème sombre ──
    console.log('\n8️⃣  Bascule sombre');
    await goto(send, '/parametres/affichage');
    const clickedSombre = await evaljs(send, CLICK('Sombre'));
    check('Option « Sombre » cliquable', clickedSombre === true);
    await sleep(1200);
    const darkOn = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    check('Classe `dark` posée sur <html>', darkOn === true);
    const darkLogo = await evaljs(send, LOGO_BG);
    check('Logo S en thème sombre', darkLogo.includes('logoS1.png'), darkLogo);
    await shot(send, '02-affichage-sombre');

    // Taille du texte
    await evaljs(send, CLICK('Grande'));
    await sleep(800);
    const htmlSize = await evaljs(send, 'getComputedStyle(document.documentElement).fontSize');
    check('Taille « Grande » appliquée (18px)', htmlSize === '18px', htmlSize);

    // Police Inter
    await evaljs(send, CLICK('Inter'));
    await sleep(800);
    const fontVar = await evaljs(send, `getComputedStyle(document.documentElement).getPropertyValue('--comaxe-font').trim()`);
    check('Police Inter appliquée', fontVar.startsWith("'Inter'"), fontVar.slice(0, 80));

    // ── 9. Persistance (reload + base) ──
    console.log('\n9️⃣  Persistance');
    await goto(send, '/parametres/affichage');
    const persistedDark = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    const persistedSize = await evaljs(send, 'getComputedStyle(document.documentElement).fontSize');
    check('Thème sombre conservé après rechargement', persistedDark === true);
    check('Taille conservée après rechargement', persistedSize === '18px', persistedSize);
    const cached = await evaljs(send, `localStorage.getItem('comaxe.preferences') || ''`);
    check('Préférences en cache local', cached.includes('"theme":"dark"'), cached.slice(0, 140));

    const { data: dbRow, error: dbErr } = await admin
      .from('user_preferences')
      .select('theme, text_size, font_family, locale')
      .eq('user_id', userId)
      .maybeSingle();
    check('Préférences enregistrées en base (fullstack)', !dbErr && !!dbRow, JSON.stringify(dbRow));
    check('  → theme = dark', dbRow?.theme === 'dark', String(dbRow?.theme));
    check('  → text_size = large', dbRow?.text_size === 'large', String(dbRow?.text_size));
    check('  → font_family = inter', dbRow?.font_family === 'inter', String(dbRow?.font_family));

    // ── 🔟 Déconnexion → page de connexion en sombre ──
    console.log('\n🔟  Page de connexion en thème sombre');
    await send('Network.enable');
    await send('Network.clearBrowserCookies');
    await goto(send, '/login');
    const loginDark = await evaljs(send, 'document.documentElement.classList.contains("dark")');
    const loginLogo = await evaljs(send, LOGO_BG);
    check('Connexion en thème sombre', loginDark === true, `dark=${loginDark}`);
    check('Connexion affiche le logo S', loginLogo.includes('logoS1.png'), loginLogo);
    await shot(send, '03-connexion-sombre');

    close();
  } catch (e) {
    fail++;
    console.log(`\n❌ ERREUR FATALE: ${e.message}`);
  } finally {
    if (conn) { try { conn.close(); } catch { /* déjà fermé */ } }
    if (edge) { try { edge.kill(); } catch { /* déjà tué */ } }

    console.log('\n🧹 NETTOYAGE');
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      console.log(`  ${error ? '⚠️ ' + error.message : '✅ Compte de test supprimé'}`);
    }
    console.log('\n════════════════════════════════════════════');
    console.log(`  RÉSULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
    console.log(`  Captures : ${SHOTS}`);
    console.log('════════════════════════════════════════════');
    process.exit(fail > 0 ? 1 : 0);
  }
}

main();
