// COMAXE — Recette des demandes (tâches 3–6).
//
// Partie A — HTTP/SSR :
//   • /paiement  : SANS sidebar (<aside>) ni en-tête app ;
//   • /dashboard : sidebar + en-tête présents (contrôle) ;
//   • /tarifs            : Essential visible (défaut, post-inscription) ;
//   • /tarifs?offres=payer: Essential MASQUÉ (boutons S'abonner / pub Max) ;
//   • / (landing)        : Essential visible.
//
// Partie B — CDP (Edge headless, compte Essential réel) :
//   • pub Max affichée pour un compte Essential ;
//   • croix × → disparition (horodatage localStorage) ;
//   • réapparition après 60 s ;
//   • clic sur la pub → /tarifs?offres=payer SANS carte Essential ;
//   • plan passé à Pro → la pub disparaît (jamais pour les offres payantes).
//
// Usage : node scripts/verify-promo-paiement.mjs   (serveur :3000 requis)
import { spawn } from 'child_process';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const env = {};
readFileSync(join(ROOT, '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
});

const APP = 'http://localhost:3000';
const RUN = Date.now();
const PASSWORD = 'ComaxeTest!2026';
const SHOTS = join(process.env.TEMP || '.', `comaxe-promo-shots-${RUN}`);
const CDP_PORT = 9235;
const PROFILE = join(process.env.TEMP || '.', `comaxe-promo-profile-${RUN}`);

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/* ── Helpers ───────────────────────────────────────────────────────── */

/** Compte de test → { id, cookie } */
async function makeAccount(tag) {
  const email = `promo-${tag}-${RUN}@comaxe.test`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error || !created?.user) throw new Error('createUser: ' + error?.message);
  const jar = new Map();
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get: (n) => jar.get(n),
      set: (n, v) => { jar.set(n, v); },
      remove: (n) => { jar.delete(n); },
    },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: loginErr } = await ssr.auth.signInWithPassword({ email, password: PASSWORD });
  if (loginErr) throw new Error('login: ' + loginErr.message);
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
  return { id: created.user.id, email, cookie };
}

async function getText(path, cookie) {
  const res = await fetch(APP + path, {
    headers: { ...(cookie ? { Cookie: cookie } : {}), 'Accept-Language': 'fr' },
    signal: AbortSignal.timeout(20000),
    redirect: 'manual',
  });
  return { status: res.status, html: await res.text() };
}

/* ── Helpers CDP ───────────────────────────────────────────────────── */

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

async function waitFor(send, expr, timeoutMs = 30000, label = expr) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evaljs(send, expr)) return true; } catch { /* page en chargement */ }
    await sleep(500);
  }
  return false;
}

async function nav(send, url, waitExpr = `document.readyState==='complete'`, timeoutMs = 30000) {
  await send('Page.navigate', { url });
  await waitFor(send, waitExpr, timeoutMs, url);
  await sleep(600);
}

async function shot(send, name) {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
  } catch { /* capture facultative */ }
}

function rectExpr(selector) {
  return `(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((e) => { try { return e.offsetParent !== null || getComputedStyle(e).position === 'fixed'; } catch { return false; } });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(r.width / 2, 60), y: r.top + r.height / 2 };
  })()`;
}

async function clickXY(send, x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function fillSelector(send, selector, text) {
  const rect = await evaljs(send, rectExpr(selector));
  if (!rect) return false;
  await clickXY(send, rect.x, rect.y);
  await sleep(250);
  await send('Input.insertText', { text });
  await sleep(150);
  return true;
}

/** La pub Max est-elle dans le DOM ? (FR ou EN) */
const PROMO_VISIBLE = `(() => {
  const txt = document.body.innerText || '';
  return txt.includes('Passez à COMAXE Max') || txt.includes('Upgrade to COMAXE Max');
})()`;

/* ── Scénario ──────────────────────────────────────────────────────── */

async function main() {
  console.log('\n━━━ Partie A : HTTP/SSR (chrome, Essential) ━━━');
  const user = await makeAccount('a');

  const pay = await getText('/paiement?plan=pro&interval=month', user.cookie);
  check('/paiement : 200', pay.status === 200, `status=${pay.status}`);
  check('/paiement : SANS sidebar (<aside>)', !/<aside/.test(pay.html));
  check('/paiement : SANS en-tête app (<header>)', !/<header/.test(pay.html));

  const dash = await getText('/dashboard', user.cookie);
  check('/dashboard : sidebar + en-tête présents (contrôle)',
    /<aside/.test(dash.html) && dash.html.includes('sticky top-0 z-30'),
    `aside=/<aside/.test(dash.html)}`);

  const tarifs = await getText('/tarifs');
  check('/tarifs : Essential VISIBLE (défaut — visiteur / après inscription)',
    tarifs.html.includes('Essential'), `n=${(tarifs.html.match(/Essential/g) || []).length}`);

  const paid = await getText('/tarifs?offres=payer');
  check('/tarifs?offres=payer : Essential MASQUÉ + compteur « 3 offres »',
    !paid.html.includes('Essential') && paid.html.includes('3 offres'),
    `Essential=${paid.html.includes('Essential')} 3offres=${paid.html.includes('3 offres')}`);

  const landing = await getText('/');
  check('/ (landing) : Essential VISIBLE (section tarifs)',
    landing.html.includes('Essential'), `n=${(landing.html.match(/Essential/g) || []).length}`);

  console.log('\n━━━ Partie B : pub Max (CDP, compte Essential) ━━━');
  if (!EDGE) throw new Error('Edge introuvable');
  mkdirSync(SHOTS, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=' + PROFILE,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1440,900', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });

  let conn = null;
  try {
    const targets = await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    conn = await connect(page.webSocketDebuggerUrl);
    const { send } = conn;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // Connexion (locale fr de l'app : Accept-Language du serveur → fr)
    await nav(send, `${APP}/login`, `!!document.querySelector('input[type="email"]')`, 30000);
    await fillSelector(send, 'input[type="email"]', user.email);
    await fillSelector(send, 'input[type="password"]', PASSWORD);
    await evaljs(send, `(() => { const b = [...document.querySelectorAll('button[type="submit"]')].find((x) => x.offsetParent); if (!b) return false; b.click(); return true; })()`).catch(() => false);
    await waitFor(send, `!location.pathname.startsWith('/login')`, 20000, 'redirection');
    check('Connecté (compte Essential)', !(await evaljs(send, 'location.pathname')).startsWith('/login'));

    // 1. La pub s'affiche pour un compte Essential
    await nav(send, `${APP}/dashboard`, `document.readyState==='complete'`, 30000);
    const shown = await waitFor(send, PROMO_VISIBLE, 25000, 'pub Max');
    check('Pub Max AFFICHÉE (compte Essential)', !!shown);
    const promoTxt = shown ? await evaljs(send, 'document.body.innerText') : '';
    check('Pub Max : contenu Max + prix USD (14 $)',
      promoTxt.includes('COMAXE Max') && promoTxt.includes('14 $'));
    await shot(send, '01-pub-visible');

    // 2. Croix × → disparition + horodatage
    const closeBtn = await evaljs(send,
      `(() => { const b = [...document.querySelectorAll('button[aria-label]')].find((x) => /Fermer la publicité|Close the advertisement/.test(x.getAttribute('aria-label') || '')); if (!b) return false; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    check('Croix × de fermeture présente', !!closeBtn);
    if (closeBtn) {
      const before = Date.now();
      await clickXY(send, closeBtn.x, closeBtn.y);
      const gone = await waitFor(send, `!(${PROMO_VISIBLE})`, 4000, 'disparition');
      check('Croix × → pub DISPARAÎT', !!gone);
      const at = await evaljs(send, `Number(localStorage.getItem('comaxe:max-promo-dismissed-at')) || 0`);
      check('Horodatage de fermeture enregistré (localStorage)',
        at >= before - 2000 && at <= Date.now() + 2000, `at=${at}`);
      await shot(send, '02-apres-croix');

      // 3. Réapparition après 60 s
      console.log('   attente de la réapparition (62 s)…');
      const back = await waitFor(send, PROMO_VISIBLE, 70000, 'réapparition');
      check('Pub RÉAPPARAÎT après 1 minute', !!back);
      await shot(send, '03-reapparition');

      // 4. Clic sur la pub → /tarifs?offres=payer SANS Essential
      const promoRect = await evaljs(send, `(() => {
        const a = document.querySelector('a[href="/tarifs?offres=payer"]');
        if (!a) return null;
        const r = a.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
      if (promoRect) {
        await clickXY(send, promoRect.x, promoRect.y);
        await waitFor(send, `location.search.includes('offres=payer')`, 15000, 'navigation pub');
      }
      const onPaidTarifs = await evaljs(send, `location.pathname === '/tarifs' && location.search.includes('offres=payer')`);
      check('Clic pub → /tarifs?offres=payer', !!onPaidTarifs,
        `url=${await evaljs(send, 'location.pathname + location.search')}`);
      const bodyAfter = onPaidTarifs ? await evaljs(send, 'document.body.innerText') : '';
      check('Grille SANS carte Essential après clic pub',
        onPaidTarifs && !bodyAfter.includes('Essential'),
        `Essential=${bodyAfter.includes('Essential')}`);
      await shot(send, '04-tarifs-sans-essential');
    }

    // 5. Plan payant → jamais de pub
    await admin.from('subscriptions').update({ plan_id: 'pro', status: 'active' }).eq('user_id', user.id);
    await nav(send, `${APP}/dashboard`, `document.readyState==='complete'`, 30000);
    let proShown = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      if (await evaljs(send, PROMO_VISIBLE).catch(() => false)) { proShown = true; break; }
      await sleep(700);
    }
    check('Plan Pro → pub JAMAIS affichée', !proShown);
    await shot(send, '05-plan-pro-sans-pub');
    // Remise à zéro (Essential) : état neutre du compte de test
    await admin.from('subscriptions').update({ plan_id: 'essential', status: 'active', billing_period: null }).eq('user_id', user.id);
  } finally {
    try { conn?.close(); } catch { /* déjà fermé */ }
    try { edge.kill(); } catch { /* déjà tué */ }
    await sleep(500);
    try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* profil à nettoyer plus tard */ }
  }

  console.log('\n==================================================');
  console.log(`  RESULTAT : ${pass} réussi(s) / ${fail} échoué(s)`);
  console.log(`  Captures : ${SHOTS}`);
  console.log('==================================================');
  process.exitCode = fail ? 1 : 0;
}

main().catch((err) => {
  console.error('\nERREUR FATALE :', err.message);
  process.exit(1);
});
