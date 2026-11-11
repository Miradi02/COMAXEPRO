// COMAXE — Test E2E navigateur réel (Edge headless + CDP) sur /stock.
// Vérifie ce que le SSR ne peut pas voir :
//   1. le tableau de l'historique s'alimente après chargement client ;
//   2. la modale s'ouvre avec ses 2 onglets ;
//   3. un nom déjà existant affiche le message exact et bloque le bouton ;
//   4. l'onglet « Produit existant » propose le réapprovisionnement.
// Usage : node scripts/stock-e2e-browser.mjs   (serveur dev requis sur :3000)
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
const PORT = 9223;
const EMAIL = `stock-e2e-${Date.now()}@example.com`;
const PASSWORD = 'ComaxeTest!2026';
const DUP = 'Article Preuve';
const MSG = 'Produit existant, veuillez réapprovisionner dans l’onglet produit existant.';

const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

let pass = 0, fail = 0;
const check = (l, ok, d = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✅' : '❌'} ${l}${d ? ' — ' + d : ''}`); };

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForCDP(url, deadlineMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* pas encore prêt */ }
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
        setTimeout(() => {
          if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); }
        }, 20000);
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

async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'exception JS');
  return r.result.value;
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  E2E NAVIGATEUR — Page Produits & Stock (Edge headless)');
  console.log('════════════════════════════════════════════════════════\n');
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Compte de test + produit dupliqué ──
  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'E2E', last_name: 'Tester', store_name: 'Boutique E2E', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }

  // Session réelle pour les cookies
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: loginErr } = await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (loginErr) { console.log('  🔴 login ' + loginErr.message); process.exit(1); }
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  // Produit existant (celui qu'on va saisir en doublon) + un mouvement d'historique
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const today = new Date().toISOString().slice(0, 10);
  const { data: prod } = await anon.from('products').insert({
    user_id: uid, name: DUP, category: 'Test', quantity: 7, min_threshold: 2,
    selling_price: 120, purchase_price: 70, created_at: today, status: 'en_stock', total_sales_count: 0,
  }).select('id').maybeSingle();
  const { error: mErr } = await anon.from('stock_movements').insert({
    user_id: uid, product_id: prod?.id ?? null, product_name: DUP, movement_type: 'entree',
    quantity: 7, note: 'Réapprovisionnement', date: today,
  });
  if (mErr) console.log('  ⚠️  insert mouvement: ' + mErr.message);

  // ── Edge ──
  const profile = join(tmpdir(), `comaxe-edge-${Date.now()}`);
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
    const targets = await waitForCDP(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('aucune cible page');
    ctx = await connect(page.webSocketDebuggerUrl);

    await ctx.send('Network.enable');
    for (const c of cookies) await ctx.send('Network.setCookie', c);
    await ctx.send('Page.enable');

    console.log('1️⃣  Rendu post-hydration (données chargées côté client)');
    await ctx.send('Page.navigate', { url: `${APP}/stock` });
    await sleep(9000); // hydratation + 11 requêtes Supabase

    const state = await evaluate(ctx.send, `(() => {
      const t = document.body.innerText;
      return JSON.stringify({
        len: t.length,
        history: t.includes('Historique du Stock'),
        row: t.includes(${JSON.stringify(DUP)}),
        qty: t.includes('+7'),
        badge: t.includes('Entrée'),
        note: t.includes('Réapprovisionnement'),
        empty: t.includes('Aucun mouvement'),
        undef: t.includes('undefined'),
        obj: t.includes('[object Object]'),
        err: t.includes('Unhandled Runtime') || t.includes('Application error'),
      });
    })()`);
    const s = JSON.parse(state);
    check('Page rendue (JS exécuté)', s.len > 1000, `len=${s.len}`);
    check('Section « Historique du Stock » présente', s.history);
    check('Mouvement réel affiché (Article Preuve)', s.row);
    check('Quantité +7 affichée', s.qty);
    check('Badge type « Entrée » affiché', s.badge);
    check('Détail « Réapprovisionnement » affiché', s.note);
    check('État vide absent (données chargées)', !s.empty);
    check('Aucun « undefined » dans le texte visible', !s.undef);
    check('Aucun « [object Object] »', !s.obj);
    check('Aucune erreur runtime bloquante', !s.err);

    console.log('\n2️⃣  Modale : les deux onglets');
    const opened = await evaluate(ctx.send, `(() => {
      const b = document.querySelector('[data-add-product-btn]');
      if (!b) return JSON.stringify({ ok:false, why:'bouton absent' });
      b.click();
      return JSON.stringify({ ok:true });
    })()`);
    await sleep(1200);
    check('Bouton « Ajouter Produit » cliqué', JSON.parse(opened).ok, JSON.parse(opened).why || '');

    const tabs = await evaluate(ctx.send, `(() => {
      const t = document.body.innerText;
      const btns = [...document.querySelectorAll('button')];
      const hasNouveau = btns.some(b => b.innerText.includes('Nouveau produit'));
      const hasExistant = btns.some(b => b.innerText.includes('Produit existant'));
      const hasForm = !!document.querySelector('input[placeholder*="Coque"]');
      return JSON.stringify({ hasNouveau, hasExistant, hasForm, modal: t.includes('Nouveau Produit au Catalogue') });
    })()`);
    const tb = JSON.parse(tabs);
    check('Modale ouverte', tb.modal);
    check('Onglet « Nouveau produit » visible', tb.hasNouveau);
    check('Onglet « Produit existant » visible', tb.hasExistant);
    check('Formulaire nouveau produit affiché par défaut', tb.hasForm);

    console.log('\n3️⃣  Saisie d’un nom déjà existant → message + blocage');
    await evaluate(ctx.send, `(() => {
      const input = document.querySelector('input[placeholder*="Coque"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(DUP)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'ok';
    })()`);
    await sleep(900);

    const dup = await evaluate(ctx.send, `(() => {
      const t = document.body.innerText;
      const btns = [...document.querySelectorAll('button')];
      const submit = btns.find(b => b.innerText.includes('Réapprovisionner ce produit') || b.innerText.includes("Enregistrer l'Article"));
      const alert = document.querySelector('[role="alert"]');
      const input = document.querySelector('input[placeholder*="Coque"]');
      return JSON.stringify({
        msg: t.includes(${JSON.stringify(MSG)}),
        detail: t.includes('est déjà au catalogue'),
        alert: !!alert,
        disabled: submit ? submit.disabled : null,
        red: input ? (input.className.includes('border-rose-400')) : false,
        label: submit ? submit.innerText : null,
      });
    })()`);
    const d = JSON.parse(dup);
    check('Message exact affiché', d.msg);
    check('Détail « est déjà au catalogue » affiché', d.detail);
    check('Bandeau role="alert" présent', d.alert);
    check('Champ de saisie passe en rouge', d.red);
    check('Bouton de soumission désactivé', d.disabled === true, `disabled=${d.disabled}`);
    check('Libellé du bouton propose le réappro', d.label === 'Réapprovisionner ce produit', `libellé=${d.label}`);

    console.log('\n4️⃣  Onglet « Produit existant » → réapprovisionnement');
    await evaluate(ctx.send, `(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('Produit existant'));
      if (b) b.click();
      return 'ok';
    })()`);
    await sleep(900);

    const restock = await evaluate(ctx.send, `(() => {
      const sel = document.querySelector('select');
      const opts = sel ? [...sel.options].map(o => o.text) : [];
      const btn = [...document.querySelectorAll('button')].find(b => b.innerText.includes('Ajouter les articles au stock'));
      return JSON.stringify({
        select: !!sel,
        hasProduct: opts.some(o => o.includes(${JSON.stringify(DUP)})),
        hasStock: opts.some(o => o.includes('stock 7')),
        btn: !!btn,
        btnDisabled: btn ? btn.disabled : null,
        noForm: !document.querySelector('input[placeholder*="Coque"]'),
      });
    })()`);
    const r = JSON.parse(restock);
    check('Formulaire de réappro affiché', r.select);
    check('Le produit existant est proposé', r.hasProduct);
    check('Le stock actuel est indiqué dans l’option', r.hasStock);
    check('Formulaire nouveau produit masqué', r.noForm);
    check('Bouton « Ajouter les articles au stock » présent', r.btn);

    // Choix du produit + quantité, puis soumission réelle
    const pick = await evaluate(ctx.send, `(() => {
      try {
        const sels = [...document.querySelectorAll('select')];
        const sel = sels.find(s => [...s.options].some(o => o.text.includes(${JSON.stringify(DUP)})));
        if (!sel) return JSON.stringify({ ok:false, why:'aucun select contenant le produit', n:sels.length });
        const opt = [...sel.options].find(o => o.text.includes(${JSON.stringify(DUP)}));
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));

        const inputs = [...document.querySelectorAll('input[type="number"]')];
        if (!inputs.length) return JSON.stringify({ ok:false, why:'aucun input number' });
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inputs[inputs.length - 1], '5');
        inputs[inputs.length - 1].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[inputs.length - 1].dispatchEvent(new Event('change', { bubbles: true }));
        return JSON.stringify({ ok:true, opt: opt.text, nInputs: inputs.length });
      } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
    })()`);
    const pk = JSON.parse(pick);
    check('Produit sélectionné dans le réappro', pk.ok, pk.why || `${pk.opt}`);

    await sleep(700);

    const preview = await evaluate(ctx.send, `(() => {
      try {
        const t = document.body.innerText;
        const has = (s) => t.includes(s);
        return JSON.stringify({
          p1: has('Stock actuel'),
          p2: has('→'),
          p3: has('12'),
          raw: t.split('\\n').filter(l => l.includes('Stock actuel') || l.includes('12')).slice(0,4),
        });
      } catch (e) { return JSON.stringify({ err:String(e) }); }
    })()`);
    const pv = JSON.parse(preview);
    check('Aperçu « Stock actuel 7 → 12 » affiché', pv.p1 && pv.p2 && pv.p3, JSON.stringify(pv.raw ?? pv));

    const clicked = await evaluate(ctx.send, `(() => {
      try {
        const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('Ajouter les articles au stock'));
        if (!b) return 'absent';
        if (b.disabled) return 'désactivé';
        b.click(); return 'ok';
      } catch (e) { return String(e); }
    })()`);
    check('Clic sur « Ajouter les articles au stock »', clicked === 'ok', clicked);
    await sleep(5000); // updateProduct + loadAllData (11 requêtes)

    const after = await evaluate(ctx.send, `(() => {
      try {
        const t = document.body.innerText;
        return JSON.stringify({
          modalClosed: !t.includes('Réapprovisionner un Produit'),
          stock12: t.includes('12'),
          newEntry: t.includes('+5'),
          note: t.includes('Réapprovisionnement'),
        });
      } catch (e) { return JSON.stringify({ err:String(e) }); }
    })()`);
    const a = JSON.parse(after);
    check('Modale refermée après soumission', a.modalClosed);
    check('Stock du produit passé à 12', a.stock12);
    check('Nouvelle entrée « +5 » dans l’historique', a.newEntry);

    // Vérification en base : le stock a bien bougé
    const { data: now } = await admin.from('products').select('quantity, status').eq('id', prod?.id).maybeSingle();
    check('Base : quantité = 12', now?.quantity === 12, `q=${now?.quantity}`);
    check('Base : statut recalculé', Boolean(now?.status), `status=${now?.status}`);
    const { data: movs } = await admin.from('stock_movements').select('*').eq('user_id', uid);
    check('Base : 2 mouvements enregistrés', (movs?.length ?? 0) === 2, `n=${movs?.length}`);
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
  console.log(`  ${fail === 0 ? '✅ E2E NAVIGATEUR RÉUSSI' : '❌ ÉCHECS'} — ${pass} réussis / ${fail} échoués`);
  console.log('════════════════════════════════════════════════════════');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Erreur:', e.message); process.exit(1); });
