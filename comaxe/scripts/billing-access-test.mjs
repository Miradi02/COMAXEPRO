// COMAXE — Test RÉEL d'accès selon l'abonnement (tâche 4)
//
// Phase A (HTTP + cookies, même mécanique que login-flow-test) :
//   • sans session → /login ; Essential → /objectifs et /analytique
//     redirigent vers /tarifs?locked=… ; Pro/Max passent ; canceled bloqué ;
//     les autres pages restent ouvertes.
// Phase B (Edge headless + CDP) : historique 3 jours RÉELLEMENT appliqué
//   • dépense de 10 j masquée en Essential (« Afficher toutes les dates »)
//   • dépense récente visible
//   • après upgrade Pro SANS reconnexion → la dépense ancienne réapparaît
// Phase C (Edge) : gate CLIENT — 11e produit refusé avec message centralisé,
//   modale conservée, produit réellement absent après rechargement.
// Usage : node scripts/billing-access-test.mjs (serveur requis sur :3000)
import { spawn } from 'child_process';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(join(__dirname, '..', '.env'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
});

const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'http://localhost:3000';
const CDP_PORT = 9235;

const EMAIL = `billing-access-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';
const OLD_DESC = 'HIST-ANCIENNE-XYZ';
const NEW_DESC = 'HIST-RECENTE-XYZ';

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0, userId = null;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

async function request(path, cookies) {
  const res = await fetch(`${APP}${path}`, {
    redirect: 'manual',
    headers: cookies ? { Cookie: cookies } : {},
  });
  return { status: res.status, location: res.headers.get('location') };
}

async function setPlan(plan, status) {
  await admin.from('subscriptions').update({ plan_id: plan, status, requested_plan_id: null }).eq('user_id', userId);
}

/* ── Harness CDP (Edge headless) ── */
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

/** Attend que le contenu soit rendu (readyState + corps non vide) */
async function waitReady(send) {
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

/**
 * Active « Afficher toutes les dates » et VÉRIFIE l'effet réel
 * (aria-pressed=true) — le premier clic peut être perdu si la page
 * n'est pas encore hydratée : on recommence jusqu'à effet confirmé.
 */
async function clickShowAll(send) {
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    try {
      const r = await evaljs(
        send,
        `(() => {
          const btns = [...document.querySelectorAll('button[aria-pressed]')];
          const b = btns.find((x) => /toutes les dates|show all dates|date active/i.test(x.textContent || ''))
            || (btns.length === 1 ? btns[0] : null);
          if (!b) return 'absent';
          if (b.getAttribute('aria-pressed') === 'true') return 'active';
          b.click();
          return 'clicked';
        })()`
      );
      if (r === 'active') return 'ok';
      await sleep(800);
    } catch { /* page en mutation */ }
    await sleep(600);
  }
  return 'echec';
}

/** Attend que le texte contienne (ou non) une marque, avec délai max */
async function waitForText(send, predicate, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const text = await evaljs(send, 'document.body.innerText');
      if (predicate(text)) return text;
    } catch { /* page en mutation */ }
    await sleep(500);
  }
  return null;
}

async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  TEST ACCÈS ABONNEMENT (middleware + historique)');
  console.log(`  Compte : ${EMAIL}`);
  console.log('════════════════════════════════════════════\n');

  let edge = null;
  let conn = null;

  try {
    // ── 1. Compte + connexion SSR (cookies navigateur) ──
    console.log('1️⃣  Compte de test + session cookies');
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true,
    });
    check('Compte créé', !cErr && !!created?.user, cErr?.message || `uid=${created?.user?.id?.slice(0, 8)}…`);
    userId = created?.user?.id;
    if (!userId) throw new Error('Abort');

    const jar = new Map();
    const supabaseSSR = createServerClient(URL_SB, ANON, {
      cookies: {
        get: (name) => jar.get(name),
        set: (name, value) => { jar.set(name, value); },
        remove: (name) => { jar.delete(name); },
      },
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: loginErr } = await supabaseSSR.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    check('signInWithPassword réussi', !loginErr, loginErr?.message || `${jar.size} cookie(s)`);
    const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');

    // ── 2. Phase A : middleware (Essential bloqué, Pro/Max ouverts) ──
    console.log('\n2️⃣  Phase A — middleware selon le plan actif');

    const anonObj = await request('/objectifs');
    check('sans session → /objectifs redirige vers /login',
      anonObj.status === 307 && (anonObj.location || '').includes('/login'),
      `status=${anonObj.status} → ${anonObj.location}`);

    await setPlan('essential', 'active');
    const eObj = await request('/objectifs', cookieHeader);
    check('Essential → /objectifs redirige vers /tarifs?locked=goals',
      eObj.status === 307 && (eObj.location || '').includes('/tarifs?locked=goals'),
      `status=${eObj.status} → ${eObj.location}`);
    const eAna = await request('/analytique', cookieHeader);
    check('Essential → /analytique redirige vers /tarifs?locked=analytics',
      eAna.status === 307 && (eAna.location || '').includes('/tarifs?locked=analytics'),
      `status=${eAna.status} → ${eAna.location}`);
    const eDash = await request('/dashboard', cookieHeader);
    check('Essential → /dashboard reste accessible (200)', eDash.status === 200, `status=${eDash.status}`);
    const eTar = await request('/tarifs', cookieHeader);
    check('Essential → /tarifs accessible (200)', eTar.status === 200, `status=${eTar.status}`);

    await setPlan('pro', 'active');
    const pObj = await request('/objectifs', cookieHeader);
    check('Pro → /objectifs ouvert (200)', pObj.status === 200, `status=${pObj.status}`);
    const pAna = await request('/analytique', cookieHeader);
    check('Pro → /analytique ouverte (200)', pAna.status === 200, `status=${pAna.status}`);

    await setPlan('max', 'active');
    const pObjMax = await request('/objectifs', cookieHeader);
    check('Max → /objectifs ouvert (200)', pObjMax.status === 200, `status=${pObjMax.status}`);

    await setPlan('max', 'canceled');
    const cObj = await request('/objectifs', cookieHeader);
    check('canceled → retour gratuit : /objectifs bloqué',
      cObj.status === 307 && (cObj.location || '').includes('/tarifs?locked=goals'),
      `status=${cObj.status} → ${cObj.location}`);

    // ── 3. Données d'historique : dépense ancienne + récente ──
    console.log('\n3️⃣  Phase B — historique 3 jours rendu (Edge headless)');
    const now = Date.now();
    const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
    const { error: seedErr } = await admin.from('expenses').insert([
      {
        user_id: userId, date: '2026/10/28', category: 'autres',
        description: OLD_DESC, amount: 5, created_at_ts: iso(10),
      },
      {
        user_id: userId, date: '2026/11/06', category: 'autres',
        description: NEW_DESC, amount: 3, created_at_ts: iso(1),
      },
    ]);
    check('Seed 2 dépenses (10 j + 1 j)', !seedErr, seedErr?.message || 'ok');
    await setPlan('essential', 'active');

    if (!EDGE) throw new Error('Edge introuvable');
    const profile = join(process.env.TEMP || '/tmp', 'comaxe-billing-access-' + Date.now());
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
    check('CDP connecté', true);

    // Injection des cookies de session (identiques à ceux de login-flow)
    for (const [name, value] of jar.entries()) {
      await send('Network.setCookie', { name, value, url: APP });
    }

    await goto(send, '/depenses');
    const clicked = await clickShowAll(send);
    check('Bouton « Afficher toutes les dates » cliqué', clicked === 'ok', clicked);

    const textNew = await waitForText(send, (t) => t.includes(NEW_DESC));
    check('Essential : dépense RÉCENTE (1 j) visible', !!textNew);
    await sleep(1500);
    const textAfter = await waitForText(send, () => true, 3000) ?? '';
    check('Essential : dépense ANCIENNE (10 j) MASQUÉE', !textAfter.includes(OLD_DESC),
      textAfter.includes(OLD_DESC) ? 'elle est visible !' : 'ok');

    // Upgrade Pro SANS reconnexion → l'historique complet doit réapparaître
    await setPlan('pro', 'active');
    await send('Page.reload', { ignoreCache: true });
    await waitReady(send);
    const clicked2 = await clickShowAll(send);
    check('Re-clic après upgrade', clicked2 === 'ok', clicked2);
    const textUp = await waitForText(send, (t) => t.includes(OLD_DESC));
    check('Pro (sans reconnexion) : dépense ancienne RÉAPPARAÎT', !!textUp);
    const textUpNew = textUp ?? '';
    check('Pro : dépense récente toujours visible', textUpNew.includes(NEW_DESC));

    // Le gate CLIENT ne doit pas bloquer un utilisateur Pro (repli inactif)
    await goto(send, '/objectifs');
    const objText = await waitForText(send, (t) => t.includes('Objectifs Mensuels') || t.includes('Monthly Business Goals'));
    check('Pro : page Objectifs rendue côté client (gate ouvert)', !!objText);

    // ── 4. Phase C : gate CLIENT — 11e produit refusé en UI ──
    console.log('\n4️⃣  Phase C — gate client (limite produits, Essential)');
    await setPlan('essential', 'active');
    const seed = Array.from({ length: 10 }, (_, i) => ({
      user_id: userId,
      name: `PROD-GATE-XYZ-${String(i + 1).padStart(2, '0')}`,
      category: 'Smartphones',
      quantity: 10,
      min_threshold: 5,
      selling_price: 50,
      purchase_price: 35,
      created_at: '2026/11/07',
      status: 'en_stock',
      total_sales_count: 0,
    }));
    const { error: seedProdErr } = await admin.from('products').insert(seed);
    check('Seed 10 produits (limite Essential atteinte)', !seedProdErr, seedProdErr?.message || 'ok');

    await goto(send, '/stock');
    const opened = await evaljs(send, `(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        (x.textContent || '').includes('Ajouter Produit') || (x.textContent || '').includes('Add Product'));
      if (!b) return 'absent';
      b.click();
      return 'ok';
    })()`);
    check('Modale « Ajouter Produit » ouverte', opened === 'ok', opened);
    await sleep(800);

    // Input contrôlé React : setter natif + event input
    const filled = await evaljs(send, `(() => {
      const input = [...document.querySelectorAll('input[type="text"]')].find((i) =>
        (i.placeholder || '').includes('Coque iPhone 15'));
      if (!input) return 'absent';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'PROD-REFUSE-XYZ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return 'ok';
    })()`);
    check('Champ « Nom du Produit » renseigné', filled === 'ok', filled);
    await sleep(400);

    const submitted = await evaljs(send, `(() => {
      const b = [...document.querySelectorAll('button[type="submit"]')].find((x) =>
        (x.textContent || '').includes("Enregistrer l'Article") || (x.textContent || '').includes('Save Item'));
      if (!b) return 'absent';
      b.click();
      return 'ok';
    })()`);
    check('Soumission du formulaire produit', submitted === 'ok', submitted);

    const limitText = await waitForText(send, (tx) =>
      tx.includes('limite de 10 produits') || tx.includes('10 products limit'));
    check('Gate client : message de limite centralisé AFFICHÉ', !!limitText);
    check('Modale toujours ouverte (formulaire conservé)',
      !!limitText && limitText.includes('Nouveau Produit au Catalogue'));

    await send('Page.reload', { ignoreCache: true });
    await waitReady(send);
    const afterText = await waitForText(send, (tx) => tx.includes('PROD-GATE-XYZ'), 20000) ?? '';
    check('Produit refusé réellement absent du catalogue (10 toujours)',
      afterText.includes('PROD-GATE-XYZ') && !afterText.includes('PROD-REFUSE-XYZ'));
  } finally {
    if (conn) { try { conn.close(); } catch { /* */ } }
    if (edge) { try { edge.kill(); } catch { /* */ } }
    if (userId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      console.log(`\n🧹 Nettoyage : ${delErr ? '⚠️ ' + delErr.message : 'compte supprimé (cascade)'}`);
    }
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${pass} OK / ${fail} ÉCHEC`);
  console.log('════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
