// COMAXE — Test fonctionnel T6 : Dashboard & données.
// Valide sur le build de production (localhost:3000), compte ESSENTIAL (défaut) :
//   1. Libellé KPI « Ventes du jour » (non filtré) → « Ventes (date) » (filtré)
//   2. Graphique : vues Jour / Mois / Année (défaut Mois), objectif par vue,
//      pied de carte « Réalisé · Objectif · Restant » + barre remplie = réalisé
//   3. Vues Année : objectif annuel AFFICHÉ seulement s'il existe en BDD
//   4. Verrous Bénéfice / Dépenses hors fenêtre d'historique Essential (3 j) :
//      message centralisé + lien offres, AUCUN montant exposé
//   5. Recherche du dashboard lisible en thème sombre (fond de saisie non blanc)
// Captures : scripts/_shots/t6-*.png
// Usage : node scripts/t6-dashboard-test.mjs
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
const PORT = 9232;
const EMAIL = `t6-dashboard-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

const SHOTS = join(__dirname, '_shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
// Normalise les espaces insécables de formatUSD (U+202F / U+00A0)
const norm = (s) => String(s || '').replace(/[\u202f\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();

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

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T6 — TEST DASHBOARD & DONNÉES');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── Compte ESSENTIAL (défaut : aucun upsert d'abonnement) ──
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Test', last_name: 'Dashboard', store_name: 'Boutique T6', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoue : ' + (createErr?.message || 'inconnu')); process.exit(1); }
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });

  const { data: subRow } = await admin.from('subscriptions').select('plan_id').eq('user_id', uid).maybeSingle();
  check('Compte Essential par défaut (déclencheur SQL)', subRow?.plan_id === 'essential', `plan=${subRow?.plan_id}`);

  // Objectifs seedés (BDD) : mensuel obligatoire, annuel variable
  const { data: goalRows } = await admin.from('goals').select('metric, period, target').eq('user_id', uid);
  const monthlyGoal = (goalRows || []).find((g) => g.metric === 'sales' && g.period === 'mois');
  const annualGoal = (goalRows || []).find((g) => g.metric === 'sales' && g.period === 'annee');
  check('Objectif de ventes mensuel seedé', !!monthlyGoal, `cible=${monthlyGoal?.target ?? '-'}`);

  // ── Données réelles ──
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const today = new Date().toISOString().slice(0, 10);
  const errs = [];
  const put = async (table, payload) => {
    const { error } = await anon.from(table).insert(payload);
    if (error) errs.push(`${table}: ${error.message}`);
    return !error;
  };
  const s1 = await anon.from('sales').insert({
    user_id: uid, date: today, code: `VNT-T6${Date.now().toString().slice(-6)}`,
    client_name: 'Jean Mukendi', client_phone: '+243 81 123 4567',
    payment_method: 'especes', total_amount: 775, total_profit: 205,
  }).select('id').maybeSingle();
  if (s1.data) await put('sale_items', [
    { sale_id: s1.data.id, product_id: null, product_name: 'Iphone 15 Pro Max', quantity: 1, unit_price: 750, purchase_price: 520, total: 750 },
    { sale_id: s1.data.id, product_id: null, product_name: 'Coque Silicone', quantity: 1, unit_price: 25, purchase_price: 8, total: 25 },
  ]);
  await put('expenses', [{ user_id: uid, date: today, category: 'loyer', description: 'Loyer boutique', amount: 120 }]);
  if (errs.length) console.log('  ⚠️  erreurs seed : ' + errs.join(' | '));

  // ── Session cookies ──
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `comaxe-edge-t6-${Date.now()}`);
  mkdirSync(profile, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1440,900', 'about:blank',
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
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const goto = async (url) => {
      await ctx.send('Page.navigate', { url, timeoutMs: 120000 });
      // Hydratation + données réelles (vente seedée 775 $)
      for (let i = 0; i < 40; i++) {
        try {
          const ready = await evaljs(ctx.send, `(() => {
            const txt = document.body ? document.body.innerText : '';
            return txt.includes('Ventes du jour') && txt.includes('775');
          })()`);
          if (ready) break;
        } catch { /* hydratation */ }
        await sleep(500);
      }
      // Objectifs chargés : le graphique affiche l'objectif mensuel
      // (sinon état transitoire « sans objectif enregistré »)
      for (let i = 0; i < 25; i++) {
        try {
          const goalsReady = await evaljs(ctx.send, `(() => {
            const h3 = [...document.querySelectorAll('main h3')].find(h => (h.innerText || '').includes('Évolution des Ventes'));
            const card = h3 && h3.closest('div[class*="rounded-2xl"]');
            return !!card && !card.innerText.includes('sans objectif enregistré');
          })()`);
          if (goalsReady) break;
        } catch { /* chargement */ }
        await sleep(400);
      }
      await sleep(600);
    };
    const shot = async (name) => {
      try {
        const s = await ctx.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(SHOTS, name), Buffer.from(s.data, 'base64'));
      } catch { /* capture non bloquante */ }
    };
    // Carte KPI du dashboard (1er match de la grille principale)
    const kpiCard = (label) =>
      evaljs(ctx.send, `(() => {
        const d = [...document.querySelectorAll('main .grid > div')].find(x => (x.innerText || '').includes(${JSON.stringify(label)}));
        return d ? d.innerText : null;
      })()`);
    const chartCard = () =>
      evaljs(ctx.send, `(() => {
        const h3 = [...document.querySelectorAll('main h3')].find(h => (h.innerText || '').includes('Évolution des Ventes'));
        const card = h3 && h3.closest('div[class*="rounded-2xl"]');
        return card ? { text: card.innerText, html: card.innerHTML } : null;
      })()`);
    const clickView = async (label) => {
      await evaljs(ctx.send, `(() => {
        const h3 = [...document.querySelectorAll('main h3')].find(h => (h.innerText || '').includes('Évolution des Ventes'));
        const card = h3 && h3.closest('div[class*="rounded-2xl"]');
        const b = card && [...card.querySelectorAll('button')].find(x => x.innerText.trim() === ${JSON.stringify(label)});
        if (b) b.click();
        return !!b;
      })()`);
      await sleep(900);
    };
    const setDate = async (value) => {
      await evaljs(ctx.send, `(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('📅')); if (b) b.click(); return !!b; })()`);
      await sleep(500);
      return evaljs(ctx.send, `(() => {
        const inp = document.querySelector('input[type="date"]');
        if (!inp) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, ${JSON.stringify(value)});
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
    };

    // ── 1. DASHBOARD (light) — KPI + graphique ──
    console.log('  ── 1. KPI & graphique (light) ──');
    await goto(APP + '/dashboard');

    const kpi1 = norm(await kpiCard('Ventes'));
    check('Libellé KPI = « Ventes du jour » (non filtré)', kpi1.includes('Ventes du jour'), kpi1.split('\n')[0] || '');

    let chart = await chartCard();
    const chartBtns = await evaljs(ctx.send, `(() => {
      const h3 = [...document.querySelectorAll('main h3')].find(h => (h.innerText || '').includes('Évolution des Ventes'));
      const card = h3 && h3.closest('div[class*="rounded-2xl"]');
      if (!card) return null;
      const btns = [...card.querySelectorAll('button')].filter(b => ['Jour','Mois','Année'].includes(b.innerText.trim()));
      return { labels: btns.map(b => b.innerText.trim()), active: (btns.find(b => b.className.includes('bg-white')) || {}).innerText || '' };
    })()`);
    check('3 vues Jour / Mois / Année', !!chartBtns && chartBtns.labels.join(',') === 'Jour,Mois,Année', chartBtns ? chartBtns.labels.join(',') : 'carte absente');
    check('Vue active par défaut = Mois', chartBtns?.active === 'Mois', `actif=${chartBtns?.active}`);
    check('Sous-titre « Jours du mois · objectif du mois »', norm(chart?.text).includes('Jours du mois · objectif du mois'));
    check('Ligne d’objectif (pointillés émeraude)', await evaljs(ctx.send, `(() => {
      const h3 = [...document.querySelectorAll('main h3')].find(h => (h.innerText || '').includes('Évolution des Ventes'));
      const card = h3 && h3.closest('div[class*="rounded-2xl"]');
      return !!(card && card.querySelector('svg line[stroke="#10B981"]'));
    })()`));
    const foot = norm(chart?.text);
    check('Pied : « Réalisé … $ »', /Réalisé\s+\d/.test(foot), (foot.match(/Réalisé[^·\n]*/) || [''])[0].slice(0, 40));
    check('Pied : « Objectif … $ »', /Objectif\s+\d/.test(foot), (foot.match(/Objectif[^·\n]*/) || [''])[0].slice(0, 40));
    check('Pied : « Restant … $ »', /Restant\s+\d/.test(foot), (foot.match(/Restant[^·\n]*/) || [''])[0].slice(0, 40));
    check('Barre de progression (rempli = réalisé)', await evaljs(ctx.send, `(() => {
      const h3 = [...document.querySelectorAll('main h3')].find(h => (h.innerText || '').includes('Évolution des Ventes'));
      const card = h3 && h3.closest('div[class*="rounded-2xl"]');
      const bar = card && card.querySelector('[role="img"][aria-label*="objectif"]');
      return !!(bar && /width:\\s*\\d/.test(bar.firstElementChild?.getAttribute('style') || ''));
    })()`));
    await shot('t6-1-dashboard-light.png');

    // ── 2. Vue JOUR ──
    console.log('\n  ── 2. Vue Jour ──');
    await clickView('Jour');
    chart = await chartCard();
    const jourTxt = norm(chart?.text);
    check('Sous-titre « 7 derniers jours · objectif du jour »', jourTxt.includes('7 derniers jours · objectif du jour'));
    check('Réalisé = ventes du jour (775 $)', jourTxt.includes('Réalisé 775'), (jourTxt.match(/Réalisé[^·\n]*/) || [''])[0].slice(0, 40));
    check('Objectif journalier affiché', /Objectif\s+\d/.test(jourTxt));

    // ── 3. Vue ANNÉE (objectif annuel seulement s'il existe) ──
    console.log('\n  ── 3. Vue Année ──');
    await clickView('Année');
    chart = await chartCard();
    const anneeTxt = norm(chart?.text);
    check('Sous-titre « 12 mois de l’année »', anneeTxt.includes('12 mois de l'));
    if (annualGoal) {
      check('Objectif annuel AFFICHÉ (ligne enregistrée)', anneeTxt.includes('sans objectif enregistré') === false && /Objectif\s+\d/.test(anneeTxt), `cible=${annualGoal.target}`);
    } else {
      check('Aucun objectif inventé (« sans objectif enregistré »)', anneeTxt.includes('sans objectif enregistré') && !/Objectif\s+\d/.test(anneeTxt));
    }
    // Retour sur la vue Mois pour la suite
    await clickView('Mois');

    // ── 4. Date ancienne → verrous Bénéfice / Dépenses (Essential 3 j) ──
    console.log('\n  ── 4. Verrous hors fenêtre d’historique ──');
    const oldDate = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const picked = await setDate(oldDate);
    check('Sélecteur de date global ouvert', picked);
    let profitTxt = '';
    for (let i = 0; i < 20; i++) {
      profitTxt = norm(await kpiCard('Bénéfice Net'));
      if (profitTxt.includes('historique')) break;
      await sleep(400);
    }
    const expenseTxt = norm(await kpiCard('Dépenses ('));
    const kpi1Filtered = norm(await kpiCard('Ventes ('));

    check('KPI ventes filtré = « Ventes (date) »', kpi1Filtered.includes('Ventes ('), kpi1Filtered.split('\n')[0] || '');
    check('Bénéfice : verrou historique (message centralisé)', profitTxt.includes('historique de 3 jours'), (profitTxt.match(/historique[^.]*3 jours/) || [''])[0]);
    check('Bénéfice : AUCUN montant exposé', !/\$/.test(profitTxt), '');
    check('Bénéfice : lien « Voir les offres » → /tarifs', await evaljs(ctx.send, `(() => {
      const d = [...document.querySelectorAll('main .grid > div')].find(x => (x.innerText || '').includes('Bénéfice Net'));
      return !!(d && d.querySelector('a[href="/tarifs"]') && (d.innerText || '').includes('Voir les offres'));
    })()`));
    check('Dépenses : verrou historique', expenseTxt.includes('historique de 3 jours'), (expenseTxt.match(/historique[^.]*3 jours/) || [''])[0]);
    check('Dépenses : AUCUN montant exposé', !/\$/.test(expenseTxt), '');
    await shot('t6-2-dashboard-locked.png');

    // ── 5. Retour aujourd’hui → totaux réaffichés ──
    console.log('\n  ── 5. Retour « Aujourd’hui » ──');
    await evaljs(ctx.send, `(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('📅')); if (b) b.click(); return !!b; })()`);
    await sleep(500);
    await evaljs(ctx.send, `(() => {
      const d = [...document.querySelectorAll('div.w-72 button')].find(x => x.innerText.includes('Aujourd'));
      if (d) d.click();
      return !!d;
    })()`);
    let backKpi1 = '';
    for (let i = 0; i < 20; i++) {
      backKpi1 = norm(await kpiCard('Ventes'));
      if (backKpi1.includes('Ventes du jour')) break;
      await sleep(400);
    }
    const backProfit = norm(await kpiCard('Bénéfice Net'));
    check('KPI ventes = « Ventes du jour » après retour', backKpi1.includes('Ventes du jour'));
    check('Bénéfice réaffiché (montant $)', /\$/.test(backProfit), (backProfit.match(/[\d ,.]+ ?\$/) || [''])[0]);

    // ── 6. DARK : recherche lisible (fond de saisie non blanc) ──
    console.log('\n  ── 6. Recherche en thème sombre ──');
    await admin.from('user_preferences').upsert({ user_id: uid, theme: 'dark' }, { onConflict: 'user_id' });
    try { await evaljs(ctx.send, `(() => { try { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: 'dark' })); } catch { /* */ } return true; })()`); } catch { /* non bloquant */ }
    await ctx.send('Page.reload', { ignoreCache: false });
    for (let i = 0; i < 30; i++) {
      try { if ((await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")'))) break; } catch { /* rechargement */ }
      await sleep(500);
    }
    for (let i = 0; i < 30; i++) {
      try { if ((await evaljs(ctx.send, 'document.querySelectorAll("main input").length')) > 0) break; } catch { /* hydratation */ }
      await sleep(500);
    }
    await sleep(1200);
    const inputDiag = JSON.parse(await evaljs(ctx.send, `(() => {
      const el = [...document.querySelectorAll('main input')].find(i => /Recherch/i.test(i.placeholder || ''));
      if (!el) return JSON.stringify(null);
      const cs = getComputedStyle(el);
      return JSON.stringify({ bg: cs.backgroundColor, color: cs.color });
    })()`));
    check('Champ de recherche présent en dark', !!inputDiag, JSON.stringify(inputDiag));
    check('Fond de saisie NON blanc en dark', !!inputDiag && inputDiag.bg !== 'rgb(255, 255, 255)', `bg=${inputDiag?.bg}`);
    check('Texte clair en dark', !!inputDiag && inputDiag.color === 'rgb(233, 238, 248)', `color=${inputDiag?.color}`);
    await shot('t6-3-dashboard-dark.png');
  } finally {
    try { ctx?.close(); } catch { /* */ }
    edge.kill();
  }

  const failed = checks.filter((c) => !c.ok).length;
  console.log('\n════════════════════════════════════════════════════════');
  console.log(`  RÉSULTAT : ${checks.length - failed}/${checks.length} contrôles OK`);
  console.log('  📸 Captures : scripts/_shots/t6-*.png');
  console.log('════════════════════════════════════════════════════════');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('🔴', e.message); process.exit(1); });
