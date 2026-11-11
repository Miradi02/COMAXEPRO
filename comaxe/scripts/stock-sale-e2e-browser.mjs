// COMAXE — E2E navigateur : une vente enregistrée depuis l'interface
// doit apparaître dans l'historique du stock (hook addSale) et décrémenter
// réellement le stock. Vérifie aussi la suppression → mouvement d'annulation.
// Usage : node scripts/stock-sale-e2e-browser.mjs  (serveur dev requis sur :3000)
import { spawn } from 'child_process';
import { readFileSync, rmSync, mkdirSync } from 'fs';
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
const PORT = 9224;
const EMAIL = `stock-sale-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const PROD = 'Produit Vente E2E';
const QTY = 3;

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

let pass = 0, fail = 0;
const check = (l, ok, d = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`); };
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, deadlineMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* pas encore prêt */ }
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
      const send = (method, params = {}) => new Promise((res, rej) => {
        const id = ++msgId;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 20000);
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

// Attend que l'expression renvoie { ok:true } (tolère le temps de compilation
// du dev server et le chargement client — un sleep fixe ne suffit pas).
async function waitFor(send, expression, timeoutMs = 45000, interval = 600) {
  const t0 = Date.now();
  let last = null;
  let lastErr = null;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const raw = await evaljs(send, expression);
      const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
      lastErr = null;
      if (v && (v.ok === true || v.ready === true)) return v;
      if (v === true) return { ok: true };
      last = v;
    } catch (e) { lastErr = e.message; } // page en cours de compilation/rendu
    await sleep(interval);
  }
  if (lastErr) return { ok: false, why: `erreur JS persistante : ${lastErr}` };
  return last ?? { ok: false, why: 'délai dépassé sans réponse exploitable' };
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  E2E NAVIGATEUR — Vente → Historique du stock');
  console.log('════════════════════════════════════════════════════════\n');
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Compte + produit de 10 unités ──
  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Sale', last_name: 'Tester', store_name: 'Boutique Vente', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }

  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: loginErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (loginErr) { console.log('  🔴 login ' + loginErr.message); process.exit(1); }
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const today = new Date().toISOString().slice(0, 10);
  const { data: prod } = await anon.from('products').insert({
    user_id: uid, name: PROD, category: 'Test', quantity: 10, min_threshold: 2,
    selling_price: 100, purchase_price: 60, created_at: today, status: 'en_stock', total_sales_count: 0,
  }).select('id').maybeSingle();
  if (!prod) { console.log('  🔴 insertion produit échouée'); process.exit(1); }

  const profile = join(tmpdir(), `comaxe-edge-sale-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1440,1000', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  let ctx;
  try {
    await sleep(2500);
    const targets = await waitForJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('aucune cible page');
    ctx = await connect(page.webSocketDebuggerUrl);

    await ctx.send('Network.enable');
    for (const c of cookies) await ctx.send('Network.setCookie', c);
    await ctx.send('Page.enable');

    console.log('1️⃣  Ouverture du formulaire « Enregistrer une Vente » (page /ventes)');
    await ctx.send('Page.navigate', { url: `${APP}/ventes` });

    // Attends que le dashboard soit réellement hydraté ET connecté
    const ready = await waitFor(ctx.send, `(() => {
      const href = location.pathname;
      const b = document.querySelector('[data-add-sale-btn]');
      return JSON.stringify({ ok: !!b, href, title: document.title, len: document.body.innerText.length });
    })()`);
    check('Page /ventes rendue et connectée (bouton de vente présent)', ready.ok,
      `chemin=${ready.href ?? '?'} len=${ready.len ?? '?'}`);

    if (!ready.ok) {
      const diag = await evaljs(ctx.send, `JSON.stringify({ href: location.href,
        text: document.body.innerText.slice(0, 400) })`);
      console.log('      🔍 diagnostic : ' + diag);
      throw new Error('abandon : le bouton de vente est introuvable');
    }

    // Le HTML SSR contient le bouton AVANT l'hydratation : un clic trop tôt
    // n'atteint aucun handler React. On réessaie jusqu'à ce que la modale s'ouvre.
    let clickedBtn = false;
    let formState = { ok: false };
    for (let attempt = 1; attempt <= 5 && !formState.ok; attempt++) {
      const r = await evaljs(ctx.send, `(() => {
        try {
          const b = document.querySelector('[data-add-sale-btn]');
          if (!b) return JSON.stringify({ ok:false, why:'bouton absent' });
          b.click();
          return JSON.stringify({ ok:true });
        } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
      })()`);
      const parsed = JSON.parse(r);
      clickedBtn = clickedBtn || parsed.ok;
      if (!parsed.ok) { await sleep(3000); continue; }
      formState = await waitFor(ctx.send, `(() => {
        try {
          const vis = (el) => el && el.offsetParent !== null;
          const submit = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
            .find(b => b.innerText.includes('Valider'));
          return JSON.stringify({ ok: !!submit, label: submit ? submit.innerText.trim() : null });
        } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
      })()`, 9000);
      if (!formState.ok) {
        console.log(`      ⏳ tentative ${attempt} : modale pas encore ouverte (hydratation)`);
        await sleep(3500);
      }
    }
    check('Bouton « Enregistrer une Vente » cliqué', clickedBtn);
    check('Modale de vente ouverte', formState.ok, formState.label || formState.why || '');

    console.log(`\n2️⃣  Saisie : ${QTY} × ${PROD} à 100 $`);
    // Attend que le champ de saisie client soit monté (compte peu de produits)
    const formReady = await waitFor(ctx.send, `(() => {
      try {
        const vis = (el) => el && el.offsetParent !== null;
        const sel = [...document.querySelectorAll('select')].find(vis);
        const nums = [...document.querySelectorAll('input[type="number"]')].filter(vis);
        const client = [...document.querySelectorAll('input[placeholder*="Jean"]')].filter(vis);
        return JSON.stringify({ ok: !!sel && nums.length === 2 && client.length > 0,
          sel: !!sel, nNum: nums.length, hasClient: client.length > 0 });
      } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
    })()`);
    check('Formulaire complet monté (produit + client + quantité + prix)', formReady.ok,
      `select=${formReady.sel} nums=${formReady.nNum} client=${formReady.hasClient} ${formReady.why || ''}`);

    const filled = await evaljs(ctx.send, `(() => {
      try {
        const vis = (el) => el && el.offsetParent !== null;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const set = (el, v) => { setter.call(el, String(v)); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };

        const client = [...document.querySelectorAll('input[placeholder*="Jean"]')].filter(vis)[0];
        if (client) set(client, 'Client E2E');

        const sel = [...document.querySelectorAll('select')].find(vis);
        if (!sel) return JSON.stringify({ ok:false, why:'aucun select visible' });
        const opt = [...sel.options].find(o => o.text.includes(${JSON.stringify(PROD)}));
        if (!opt) return JSON.stringify({ ok:false, why:'produit absent des options', opts:[...sel.options].map(o=>o.text) });
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change',{bubbles:true}));

        const nums = [...document.querySelectorAll('input[type="number"]')].filter(vis);
        set(nums[0], ${QTY});
        set(nums[1], 100);
        return JSON.stringify({ ok:true, opt: opt.text, nNum: nums.length });
      } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
    })()`);
    const fl = JSON.parse(filled);
    check('Produit sélectionné + quantité/prix saisis', fl.ok, fl.why || fl.opt);

    const totalLine = await waitFor(ctx.send, `(() => {
      const t = document.body.innerText;
      return JSON.stringify({ ok: t.includes('300') && t.includes('Valider et Déduire du Stock') });
    })()`, 15000);
    check('Total du formulaire à 300 $ + libellé de soumission', totalLine.ok);

    console.log('\n3️⃣  Soumission → addSale → mouvement de stock');
    const clicked = await evaljs(ctx.send, `(() => {
      try {
        const vis = (el) => el && el.offsetParent !== null;
        const b = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
          .find(x => x.innerText.includes('Valider'));
        if (!b) return JSON.stringify({ ok:false, why:'absent' });
        if (b.disabled) return JSON.stringify({ ok:false, why:'désactivé' });
        b.click(); return JSON.stringify({ ok:true });
      } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
    })()`);
    const ck = JSON.parse(clicked);
    check('Clic sur « Valider et Déduire du Stock »', ck.ok, ck.why || '');

    // Attend soit la vente dans le tableau (succès), soit une erreur métier
    const afterSubmit = await waitFor(ctx.send, `(() => {
      try {
        const vis = (el) => el && el.offsetParent !== null;
        const t = document.body.innerText;
        const modalOpen = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
          .some(b => b.innerText.includes('Valider'));
        const err = [...document.querySelectorAll('[role="alert"]')].filter(vis)
          .map(e => e.innerText).join(' | ');
        const hasSale = t.includes('Client E2E');
        return JSON.stringify({ ok: hasSale || !!err, hasSale, modalOpen, err });
      } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
    })()`);
    const as = afterSubmit ?? { hasSale: false, err: '' };
    check('Vente acceptée et affichée dans le tableau', as.hasSale, as.err || (as.why || ''));
    check('Modale refermée après soumission', as.hasSale ? !as.modalOpen : false);

    // ── Contrôles en base ──
    const { data: pNow } = await admin.from('products').select('quantity, status, total_sales_count').eq('id', prod.id).maybeSingle();
    check('Base : stock décrémenté 10 → 7', pNow?.quantity === 7, `q=${pNow?.quantity}`);
    check('Base : ventes du produit mises à jour', (pNow?.total_sales_count ?? 0) === QTY, `ventes=${pNow?.total_sales_count}`);

    const { data: sale } = await admin.from('sales').select('id, code').eq('user_id', uid).maybeSingle();
    check('Base : vente créée avec code VNT', Boolean(sale?.code), `code=${sale?.code ?? '—'}`);

    const { data: movs } = await admin.from('stock_movements').select('*').eq('user_id', uid);
    const sortie = (movs ?? []).find((m) => m.movement_type === 'sortie' && m.reference === sale?.code);
    check('Base : mouvement de sortie rattaché à la vente', Boolean(sortie), `n=${movs?.length}`);
    check('Base : note du hook « Vente enregistrée »', sortie?.note === 'Vente enregistrée', `note=${sortie?.note ?? 'NULL'}`);
    check('Base : quantité du mouvement = 3', sortie?.quantity === QTY, `q=${sortie?.quantity}`);
    check('Base : produit rattaché au mouvement', sortie?.product_name === PROD, `produit=${sortie?.product_name}`);

    console.log('\n4️⃣  Rendu dans la page Produits & Stock');
    await ctx.send('Page.navigate', { url: `${APP}/stock` });
    const rr = await waitFor(ctx.send, `(() => {
      try {
        const t = document.body.innerText;
        const code = ${JSON.stringify(sale?.code ?? 'ZZZZZZ')};
        return JSON.stringify({
          ok: t.includes('Historique du Stock') && t.includes(${JSON.stringify(PROD)}),
          history: t.includes('Historique du Stock'),
          row: t.includes(${JSON.stringify(PROD)}),
          out: t.includes('Sortie'),
          minus3: t.includes('−3'),
          ref: t.includes(code),
          note: t.includes('Vente enregistrée'),
          len: t.length,
        });
      } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
    })()`);
    check('Section historique rendue', rr?.history ?? false, rr?.why ?? `len=${rr?.len ?? '?'}`);
    check('Ligne de mouvement de vente affichée', rr?.row ?? false);
    check('Badge « Sortie » affiché', rr?.out ?? false);
    check('Quantité −3 affichée', rr?.minus3 ?? false);
    check('Référence de vente (code) affichée', rr?.ref ?? false, sale?.code ?? '');
    check('Détail « Vente enregistrée » affiché', rr?.note ?? false);

    console.log('\n5️⃣  Suppression de la vente via l’interface → annulation du stock');
    await ctx.send('Page.navigate', { url: `${APP}/ventes` });

    const dashReady = await waitFor(ctx.send, `(() => {
      const btn = document.querySelector('[data-add-sale-btn]');
      const vis = (el) => el && el.offsetParent !== null;
      const icons = [...document.querySelectorAll('svg')].filter(vis)
        .filter(s => (s.getAttribute('class') || '').includes('trash'));
      return JSON.stringify({ ok: !!btn && icons.length > 0, hasBtn: !!btn, nTrash: icons.length });
    })()`);
    check('Tableau des ventes rendu (corbeille visible)', dashReady?.ok ?? false,
      `bouton=${dashReady?.hasBtn} corbeilles=${dashReady?.nTrash}`);

    // Même garde anti-préclic (hydratation) que pour l'ouverture de modale
    let delClicked = false;
    let confirmVisible = { ok: false };
    for (let attempt = 1; attempt <= 5 && !confirmVisible.ok; attempt++) {
      const r = await evaljs(ctx.send, `(() => {
        try {
          const vis = (el) => el && el.offsetParent !== null;
          const icons = [...document.querySelectorAll('svg')].filter(vis)
            .filter(s => (s.getAttribute('class') || '').includes('trash'));
          const btns = icons.map(s => s.closest('button')).filter(Boolean);
          if (!btns.length) return JSON.stringify({ ok:false, why:'aucun bouton corbeille visible' });
          btns[btns.length - 1].click();
          return JSON.stringify({ ok:true, n: btns.length });
        } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
      })()`);
      const parsed = JSON.parse(r);
      delClicked = delClicked || parsed.ok;
      if (!parsed.ok) { await sleep(3000); continue; }
      confirmVisible = await waitFor(ctx.send, `(() => {
        try {
          const vis = (el) => el && el.offsetParent !== null;
          const b = [...document.querySelectorAll('button')].filter(vis)
            .find(x => x.innerText.includes('Oui, supprimer'));
          return JSON.stringify({ ok: !!b });
        } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
      })()`, 9000);
      if (!confirmVisible.ok) {
        console.log(`      ⏳ tentative ${attempt} : confirmation pas encore affichée`);
        await sleep(3500);
      }
    }
    check('Bouton corbeille de la vente cliqué', delClicked);
    check('Modal de confirmation affiché', confirmVisible.ok, confirmVisible.why || '');

    await evaljs(ctx.send, `(() => {
      const vis = (el) => el && el.offsetParent !== null;
      const b = [...document.querySelectorAll('button')].filter(vis)
        .find(x => x.innerText.includes('Oui, supprimer'));
      b.click();
      return 'ok';
    })()`);

    const undoDone = await waitFor(ctx.send, `(() => {
      const vis = (el) => el && el.offsetParent !== null;
      const stillOpen = [...document.querySelectorAll('button')].filter(vis)
        .some(x => x.innerText.includes('Oui, supprimer'));
      return JSON.stringify({ ok: !stillOpen });
    })()`, 25000);
    check('Confirmation prise en compte (modal refermé)', undoDone?.ok ?? false);

    const { data: p2 } = await admin.from('products').select('quantity').eq('id', prod.id).maybeSingle();
    check('Base : stock restitué 7 → 10', p2?.quantity === 10, `q=${p2?.quantity}`);

    const { data: saleGone } = await admin.from('sales').select('id').eq('user_id', uid).maybeSingle();
    check('Base : vente supprimée', !saleGone);

    const { data: m2 } = await admin.from('stock_movements').select('*').eq('user_id', uid);
    const undo = (m2 ?? []).find((m) => m.movement_type === 'annulation');
    check('Base : mouvement d’annulation journalisé', Boolean(undo), `n=${m2?.length}`);
    check('Base : note du hook « Vente supprimée — stock restitué »',
      undo?.note === 'Vente supprimée — stock restitué', `note=${undo?.note ?? 'NULL'}`);
    check('Base : annulation rattachée au code de la vente', undo?.reference === sale?.code,
      `ref=${undo?.reference ?? 'NULL'} / attendu=${sale?.code ?? 'NULL'}`);
    check('Base : quantité annulée = 3', undo?.quantity === QTY, `q=${undo?.quantity}`);
  } catch (e) {
    console.log('\n  ⚠️  ' + e.message);
  } finally {
    try { ctx?.close(); } catch { /* déjà fermé */ }
    try { edge.kill(); } catch { /* déjà mort */ }
    await sleep(800);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* profil verrouillé */ }
    try { await admin.auth.admin.deleteUser(uid); console.log('\n  🧹 compte de test supprimé'); } catch { /* déjà supprimé */ }
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  ${fail === 0 ? '✅ E2E VENTE → STOCK RÉUSSI' : '❌ ÉCHECS'} — ${pass} réussis / ${fail} échoués`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
