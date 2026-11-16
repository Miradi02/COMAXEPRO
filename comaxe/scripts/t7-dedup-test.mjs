// COMAXE — Test fonctionnel T7 : anti-doublon clients à l'enregistrement
// d'une vente (page /ventes, addSale → process_sale).
//   A. Téléphone déjà utilisé sous un AUTRE nom → 1ᵉʳ clic = AVERTISSEMENT
//      (rien enregistré), 2ᵉ clic = enregistrement → fiche du numéro réutilisée
//   B. Nom existant (casse/espaces différents) → réutilise la même fiche
//   C. Vraiment un nouveau client → 1 seule fiche créée, aucune fusion
//   D. Même nom + numéro appartenant à une AUTRE fiche → enregistrement
//      DIRECT (sans avertissement), rattaché à la fiche du nom
// Compte ESSENTIAL (défaut), Edge headless CDP, serveur requis sur :3000.
// Captures : scripts/_shots/t7-*.png
// Usage : node scripts/t7-dedup-test.mjs
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
const PORT = 9233;
const EMAIL = `t7-dedup-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';
const PROD = 'Article T7';
const FID_NAME = 'T7 Fidèle Client';
const FID_PHONE = '+243 81 999 8877';

const SHOTS = join(__dirname, '_shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const checks = [];
const check = (name, ok, info = '') => {
  checks.push({ name, ok });
  console.log(`  ${ok ? '✅' : '❌'} ${name}${info ? ` — ${info}` : ''}`);
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
    } catch (e) { lastErr = e.message; }
    await sleep(interval);
  }
  if (lastErr) return { ok: false, why: `erreur JS persistante : ${lastErr}` };
  return last ?? { ok: false, why: 'délai dépassé sans réponse exploitable' };
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T7 — TEST ANTI-DOUBLON CLIENTS (ventes)');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Compte ESSENTIAL (défaut : aucun upsert d'abonnement) ──
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Dedup', store_name: 'Boutique T7', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoue : ' + (createErr?.message || 'inconnu')); process.exit(1); }
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });

  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

  // ── Seed : 1 produit + 1 fiche client fidèle ──
  const { data: prod, error: pErr } = await anon.from('products').insert({
    user_id: uid, name: PROD, category: 'Test', quantity: 100, min_threshold: 2,
    selling_price: 100, purchase_price: 60, status: 'en_stock', total_sales_count: 0,
  }).select('id').maybeSingle();
  if (!prod) { console.log('  🔴 seed produit échoue : ' + (pErr?.message || '?')); process.exit(1); }

  const { data: fid, error: cErr } = await anon.from('customers').insert({
    user_id: uid, name: FID_NAME, phone: FID_PHONE,
  }).select('id').maybeSingle();
  if (!fid) { console.log('  🔴 seed client échoue : ' + (cErr?.message || '?')); process.exit(1); }
  console.log(`  Compte ${EMAIL}\n  Fiche fidèle ${fid.id} · Produit ${prod.id}\n`);

  // ── Session cookies ──
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `comaxe-edge-t7-${Date.now()}`);
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
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    const shot = async (name) => {
      try {
        const s = await ctx.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(SHOTS, name), Buffer.from(s.data, 'base64'));
      } catch { /* capture non bloquante */ }
    };

    // ── Ouverture /ventes + modale de vente (retry hydratation) ──
    await ctx.send('Page.navigate', { url: `${APP}/ventes` });
    const ready = await waitFor(ctx.send, `(() => {
      const b = document.querySelector('[data-add-sale-btn]');
      return JSON.stringify({ ok: !!b, href: location.pathname });
    })()`);
    check('Page /ventes rendue (bouton de vente présent)', ready.ok, `chemin=${ready.href ?? '?'}`);

    const openModal = async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        await evaljs(ctx.send, `(() => { const b = document.querySelector('[data-add-sale-btn]'); if (b) b.click(); return !!b; })()`);
        const st = await waitFor(ctx.send, `(() => {
          const vis = (el) => el && el.offsetParent !== null;
          const submit = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
            .find(b => b.innerText.includes('Valider'));
          return JSON.stringify({ ok: !!submit });
        })()`, 9000);
        if (st.ok) return true;
        await sleep(2500);
      }
      return false;
    };

    const modalOk = await openModal();
    check('Modale « Enregistrer une Vente » ouverte', modalOk);
    if (!modalOk) throw new Error('abandon : modale de vente introuvable');

    // Formulaires montés + produits/clients chargés (Promise.all loadAllData)
    const formReady = await waitFor(ctx.send, `(() => {
      const vis = (el) => el && el.offsetParent !== null;
      const sel = [...document.querySelectorAll('select')].find(vis);
      const opt = sel && [...sel.options].find(o => o.text.includes(${JSON.stringify(PROD)}));
      const client = [...document.querySelectorAll('input[placeholder*="Jean"]')].filter(vis);
      return JSON.stringify({ ok: !!opt && client.length > 0, hasOpt: !!opt });
    })()`);
    check('Formulaire monté + produit/clients chargés', formReady.ok, formReady.why || '');
    await sleep(1200); // état customers disponible pour la résolution

    // ── Enregistre une vente via l'UI, attend la ligne en BDD ──
    // expectWarning = true : le 1ᵉʳ clic doit afficher l'avertissement T7
    // sans rien enregistrer ; le 2ᵉ clic confirme et enregistre.
    const recordSale = async (name, phone, expectWarning = false) => {
      const filled = await evaljs(ctx.send, `(() => {
        try {
          const vis = (el) => el && el.offsetParent !== null;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          const set = (el, v) => { setter.call(el, String(v)); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
          const client = [...document.querySelectorAll('input[placeholder*="Jean"]')].filter(vis)[0];
          if (!client) return JSON.stringify({ ok:false, why:'champ client absent' });
          set(client, ${JSON.stringify(name)});
          const phoneEl = [...document.querySelectorAll('input[placeholder*="+243"]')].filter(vis)[0];
          if (phoneEl) set(phoneEl, ${JSON.stringify(phone ?? '')});
          const sel = [...document.querySelectorAll('select')].find(vis);
          const opt = sel && [...sel.options].find(o => o.text.includes(${JSON.stringify(PROD)}));
          if (!opt) return JSON.stringify({ ok:false, why:'produit absent' });
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change',{bubbles:true}));
          const nums = [...document.querySelectorAll('input[type="number"]')].filter(vis);
          set(nums[0], 1);
          set(nums[1], 100);
          return JSON.stringify({ ok:true });
        } catch (e) { return JSON.stringify({ ok:false, why:String(e) }); }
      })()`);
      if (!JSON.parse(filled).ok) return { ok: false, why: JSON.parse(filled).why };

      const submitClick = `(() => {
        const vis = (el) => el && el.offsetParent !== null;
        const b = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
          .find(x => x.innerText.includes('Valider'));
        if (!b) return JSON.stringify({ ok:false, why:'bouton absent' });
        b.click(); return JSON.stringify({ ok:true });
      })()`;
      const clicked = await evaljs(ctx.send, submitClick);
      if (!JSON.parse(clicked).ok) return { ok: false, why: JSON.parse(clicked).why };

      // Issue du 1ᵉʳ clic : modale fermée (succès), avertissement T7, ou erreur
      const issue = await waitFor(ctx.send, `(() => {
        const vis = (el) => el && el.offsetParent !== null;
        const submit = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
          .find(b => b.innerText.includes('Valider'));
        const warn = document.querySelector('[data-form-warn]');
        const err = [...document.querySelectorAll('div')].filter(vis)
          .find(d => d.className.includes('bg-rose-50') && d.innerText.length > 0);
        return JSON.stringify({ ok: !submit || !!warn || !!err,
          closed: !submit,
          warn: warn ? warn.innerText.trim().slice(0,220) : null,
          err: err ? err.innerText.trim().slice(0,160) : null });
      })()`, 20000, 500);
      if (issue.err) return { ok: false, why: 'erreur formulaire : ' + issue.err, warn: issue.warn };

      if (expectWarning) {
        if (!issue.warn) {
          return { ok: false, warn: null,
            why: issue.closed ? 'avertissement absent : la vente a été enregistrée d\'emblée' : 'avertissement absent' };
        }
        // 2ᵉ clic = confirmation → enregistrement
        const again = await evaljs(ctx.send, submitClick);
        if (!JSON.parse(again).ok) return { ok: false, why: JSON.parse(again).why, warn: issue.warn };
        const after = await waitFor(ctx.send, `(() => {
          const vis = (el) => el && el.offsetParent !== null;
          const submit = [...document.querySelectorAll('button[type="submit"]')].filter(vis)
            .find(b => b.innerText.includes('Valider'));
          const err = [...document.querySelectorAll('div')].filter(vis)
            .find(d => d.className.includes('bg-rose-50') && d.innerText.length > 0);
          return JSON.stringify({ ok: !submit || !!err, closed: !submit,
            err: err ? err.innerText.trim().slice(0,160) : null });
        })()`, 20000, 500);
        if (after.err) return { ok: false, why: 'erreur formulaire : ' + after.err, warn: issue.warn };
        if (!after.closed) return { ok: false, why: 'modale toujours ouverte après confirmation', warn: issue.warn };
      } else {
        if (issue.warn) return { ok: false, why: 'avertissement inattendu : ' + issue.warn, warn: issue.warn };
        if (!issue.closed) return { ok: false, why: 'modale toujours ouverte', warn: issue.warn };
      }

      // Ligne en BDD
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        const { data } = await admin.from('sales')
          .select('id, client_name, customer_id, total_amount')
          .eq('user_id', uid).eq('client_name', name.trim())
          .limit(1).maybeSingle();
        if (data) return { ok: true, sale: data, warn: issue.warn };
        await sleep(500);
      }
      return { ok: false, why: 'vente absente de la BDD après 15 s', warn: issue.warn };
    };

    const countCustomers = async () => {
      const { count } = await admin.from('customers')
        .select('id', { count: 'exact', head: true }).eq('user_id', uid);
      return count ?? -1;
    };
    const getFiche = async () => {
      const { data } = await admin.from('customers')
        .select('name, phone, purchases_count, total_spent').eq('id', fid.id).maybeSingle();
      return data;
    };

    // ══ A. Numéro déjà utilisé sous un AUTRE nom → avertissement ══
    console.log('A️⃣  Vente : numéro existant sous un autre nom → avertissement puis 2ᵉ clic');
    const a = await recordSale('T7 Autre Nom', '+243819998877', true);
    check('A : avertissement affiché au 1ᵉʳ clic (rien enregistré)', !!a.warn,
      (a.warn || a.why || '').slice(0, 110));
    check('A : vente enregistrée après la 2ᵉ validation', a.ok, a.why || a.sale?.id || '');
    if (a.ok) {
      check('Vente A rattachée à la fiche existante (customer_id)', a.sale.customer_id === fid.id,
        `sale=${a.sale.customer_id} fiche=${fid.id}`);
      check('Aucun doublon créé (1 fiche)', (await countCustomers()) === 1, `count=${await countCustomers()}`);
    }

    // ══ B. Nom existant (casse différente) ══
    console.log('\nB️⃣  Vente avec nom existant (casse/espaces différents)');
    const modalB = await openModal();
    check('Modale rouverte pour la vente B', modalB);
    const b = await recordSale('  t7 FIDÈLE client  ', null);
    check('Vente B enregistrée via l\'UI', b.ok, b.why || b.sale?.id || '');
    if (b.ok) {
      check('Vente B rattachée à la même fiche', b.sale.customer_id === fid.id,
        `sale=${b.sale.customer_id} fiche=${fid.id}`);
      check('Toujours 1 seule fiche', (await countCustomers()) === 1, `count=${await countCustomers()}`);
      const fiche = await getFiche();
      check('Fiche fidèle : 2 achats cumulés', fiche?.purchases_count === 2, `purchases=${fiche?.purchases_count}`);
    }

    // ══ C. Vraiment un nouveau client (pas de fusion) ══
    console.log('\nC️⃣  Vente d\'un client totalement nouveau');
    const modalC = await openModal();
    check('Modale rouverte pour la vente C', modalC);
    const c = await recordSale('T7 Client Nouveau', '+243 82 111 2222');
    check('Vente C enregistrée via l\'UI', c.ok, c.why || c.sale?.id || '');
    if (c.ok) {
      const total = await countCustomers();
      check('Nouvelle fiche créée (2 fiches au total)', total === 2, `count=${total}`);
      check('Vente C sur sa propre fiche (aucune fusion)', !!c.sale.customer_id && c.sale.customer_id !== fid.id,
        `sale=${c.sale.customer_id} fiche=${fid.id}`);
      const { data: allCust } = await admin.from('customers')
        .select('id, purchases_count, total_spent').eq('user_id', uid);
      const newFiche = (allCust || []).find((x) => x.id !== fid.id);
      check('Nouvelle fiche créditée par la vente C (1 achat · 100 $)',
        newFiche?.id === c.sale.customer_id && newFiche?.purchases_count === 1 && Number(newFiche?.total_spent) === 100,
        `id=${newFiche?.id} purchases=${newFiche?.purchases_count} total=${newFiche?.total_spent}`);
      const fiche = await getFiche();
      check('Fiche d\'origine intacte (nom + téléphone + 2 achats)',
        fiche?.name === FID_NAME && fiche?.phone === FID_PHONE && fiche?.purchases_count === 2,
        `name=${fiche?.name} phone=${fiche?.phone} purchases=${fiche?.purchases_count}`);
    }

    // ══ D. Même nom + numéro d'UNE AUTRE fiche → enregistrement direct ══
    console.log('\nD️⃣  Vente : nom existant + numéro appartenant à une autre fiche');
    const modalD = await openModal();
    check('Modale rouverte pour la vente D', modalD);
    const d = await recordSale('T7 Fidèle Client', '+243821112222', false);
    check('D : aucun avertissement — enregistrement direct', d.ok && !d.warn, d.why || '');
    if (d.ok) {
      check('D rattachée à la fiche du NOM (pas du numéro d\'un autre)',
        d.sale.customer_id === fid.id, `sale=${d.sale.customer_id} fiche=${fid.id}`);
      check('Toujours 2 fiches (aucune fusion)', (await countCustomers()) === 2, `count=${await countCustomers()}`);
      const fiche = await getFiche();
      check('Fiche fidèle : 3 achats après D', fiche?.purchases_count === 3, `purchases=${fiche?.purchases_count}`);
      const { data: allCust } = await admin.from('customers')
        .select('id, purchases_count').eq('user_id', uid);
      const other = (allCust || []).find((x) => x.id !== fid.id);
      check('Fiche du scénario C intacte (1 achat)', other?.purchases_count === 1,
        `purchases=${other?.purchases_count}`);
    }

    await shot('t7-ventes-final.png');

  } finally {
    try { ctx?.close(); } catch { /* déjà fermé */ }
    try { edge.kill(); } catch { /* déjà tué */ }
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log('\n────────────────────────────────────────────────────────');
  console.log(`  RÉSULTAT T7 : ${checks.length - failed}/${checks.length} vérifications OK`);
  console.log('────────────────────────────────────────────────────────');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('  🔴 ' + e.message); process.exit(1); });
