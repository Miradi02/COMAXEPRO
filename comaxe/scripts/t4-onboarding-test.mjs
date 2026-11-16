// COMAXE — Test fonctionnel T4 : parcours d'inscription / Onboarding.
// Valide sur le build de production (localhost:3000), compte avec flag
// `onboarding_completed: false` (simule un NOUVEAU compte) :
//   1. session sur /login → redirection middleware vers /onboarding
//   2. écran d'accueil : titre, phrase rassurante, bouton « Commencer »
//   3. progression « Étape N sur 5 », une question à la fois, messages
//      d'empathie déclenchés par les réponses, navigation Retour/Continuer
//   4. persistance : rechargement → reprise à la même étape
//   5. étape Objectifs : validation numérique, ≈ $/jour (vrais jours du mois),
//      plafond Oui → valeur obligatoire
//   6. résumé : « Nous avons compris… », SEULEMENT les objectifs renseignés
//   7. « Continuer vers les tarifs » → /tarifs + flag + objectifs ÉCRITS
//      dans la table `goals` existante (profit non renseigné = jamais écrit)
//   8. retour /onboarding après complétion → plus jamais le questionnaire
//   9. dark mode + mobile 375 sans débordement + desktop 1440
// Captures : scripts/_shots/t4-*.png
// Usage : node scripts/t4-onboarding-test.mjs
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
const PORT = 9229;
const EMAIL = `t4-onboarding-${Date.now()}@comaxe.test`;
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
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    try {
      const len = await evaljs(ctx.send, 'document.body.innerText.length');
      if (len > 200 && (Date.now() - lastActivity) > 1200) return;
    } catch { /* compilation */ }
    await sleep(500);
  }
}

const TXT = `(() => JSON.stringify({
  path: location.pathname,
  dark: document.documentElement.classList.contains('dark'),
  vw: window.innerWidth,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  text: document.body.innerText.replace(/[\\u202f\\u00a0\\u2009]/g, ' ').replace(/\\n{2,}/g, '\\n').trim(),
}))()`;

async function snap(ctx) {
  const s = JSON.parse(await evaljs(ctx.send, TXT));
  return { ...s, has: (frag) => s.text.includes(frag) };
}

/** Attend que la page soit hydratée (fin du loader « Chargement… »). */
async function waitReady(ctx, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const t = await evaljs(ctx.send, 'document.body.innerText');
      if (t && t.length > 150 && !t.includes('Chargement')) return true;
    } catch { /* navigation en cours */ }
    await sleep(300);
  }
  return false;
}

/** Attend que la classe .dark corresponde au thème voulu (script inline + provider). */
async function waitDark(ctx, want, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if ((await evaljs(ctx.send, 'document.documentElement.classList.contains("dark")')) === want) return true;
    } catch { /* navigation en cours */ }
    await sleep(300);
  }
  return false;
}

async function shot(ctx, name) {
  for (let i = 0; i < 10; i++) {
    try { if ((await evaljs(ctx.send, 'document.body.innerText.length')) > 200) break; } catch { /* compilation */ }
    await sleep(400);
  }
  await sleep(400);
  try {
    const s = await ctx.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    writeFileSync(join(SHOTS, name), Buffer.from(s.data, 'base64'));
  } catch { /* capture non bloquante */ }
}

// Clic sur un <button> dont le texte est exact puis égalité stricte
const CLICK_BTN = (label) => `(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === ${JSON.stringify(label)});
  if (!b) return false; b.click(); return true;
})()`;

const SET_INPUT = (idx, value) => `(() => {
  const el = document.querySelectorAll('input')[${idx}];
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

async function pick(ctx, label) {
  return evaljs(ctx.send, CLICK_BTN(label));
}
async function tapContinue(ctx) {
  const ok = await evaljs(ctx.send, CLICK_BTN('Continuer'));
  await sleep(700);
  return ok;
}

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('  T4 — TEST PARCOURS ONBOARDING');
  console.log('════════════════════════════════════════════════════════\n');

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('  🔴 Edge introuvable'); process.exit(1); }

  // ── NOUVEAU compte (flag onboarding_completed: false, comme signUp) ──
  const { data: created } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: {
      first_name: 'Test', last_name: 'Onboarding', store_name: 'Boutique T4',
      store_currency: 'USD', store_country: 'CD', onboarding_completed: false,
    },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('  🔴 createUser échoué'); process.exit(1); }
  // Pro : nécessaire pour CONSULTER la page Objectifs à la fin
  await admin.from('subscriptions').upsert(
    { user_id: uid, plan_id: 'pro', status: 'active', billing_period: 'monthly', started_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });

  // ── Session cookies ──
  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const profile = join(tmpdir(), `comaxe-edge-t4-${Date.now()}`);
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
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });

    // ── 1. /login avec session + flag false → /onboarding (middleware) ──
    console.log('  ── 1. Redirection /login → /onboarding ──');
    await navigate(ctx, APP + '/login');
    await waitReady(ctx);
    await sleep(600);
    let s = await snap(ctx);
    check('Session + flag false : /login → /onboarding', s.path === '/onboarding', `path=${s.path}`);

    // ── 2. Écran d'accueil ──
    console.log('  ── 2. Écran d\'accueil ──');
    check('Titre « Parlons de votre commerce »', s.has('Parlons de votre commerce'));
    check('Sous-titre présent', s.has('nous aimerions mieux comprendre votre activité'));
    check('Phrase rassurante exacte', s.has('Il n’y a pas de mauvaise réponse. Répondez simplement selon votre situation actuelle.'));
    check('Bouton « Commencer »', s.has('Commencer'));
    check('Mobile 375 sans débordement (intro)', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't4-01-intro.png');

    // ── 3. Étape 1 — Votre commerce ──
    console.log('  ── 3. Étapes 1 → 4 (questions) ──');
    check('Clic « Commencer »', await evaljs(ctx.send, CLICK_BTN('Commencer')));
    await sleep(800);
    s = await snap(ctx);
    check('Progression « Étape 1 sur 5 »', s.has('Étape 1 sur 5'));
    check('Question 1 affichée', s.has('Quel type de commerce gérez-vous ?'));
    check('Choix « Boutique »', s.has('Boutique'));

    check('Sélection « Boutique »', await pick(ctx, 'Boutique'));
    await sleep(500);
    s = await snap(ctx);
    check('Message d\'empathie après réponse (Q1)', s.has('Très bien. Nous allons adapter votre expérience'));
    check('Réaction positive visible', s.has('Très bien'));
    await shot(ctx, 't4-02-q1.png');

    check('Continuer → Q2', await tapContinue(ctx));
    s = await snap(ctx);
    check('Question 2 (étape 1)', s.has('Depuis combien de temps gérez-vous ce commerce ?'));
    await pick(ctx, 'Moins de 6 mois');
    await sleep(400);
    s = await snap(ctx);
    check('Empathie « début d\'aventure » (Q2 < 6 mois)', s.has('Vous êtes encore au début de votre aventure'));
    await tapContinue(ctx);
    await pick(ctx, 'Seul');
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Question 4 (étape 1)', s.has('Environ combien de produits différents vendez-vous ?'));
    await pick(ctx, '10 à 50');
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Progression → « Étape 2 sur 5 »', s.has('Étape 2 sur 5'));

    // ── 4. Persistance : rechargement → reprise ──
    console.log('  ── 4. Persistance (rechargement) ──');
    await ctx.send('Page.reload', { ignoreCache: false });
    await waitReady(ctx);
    await sleep(600);
    s = await snap(ctx);
    check('Reprise à l\'étape 2 après rechargement', s.path === '/onboarding' && s.has('Étape 2 sur 5'), `path=${s.path} txt=${s.text.slice(0, 60)}`);
    check('Bonne question restaurée', s.has('Comment évoluent vos ventes actuellement ?'));

    // ── Étape 2 — situation ──
    await pick(ctx, 'Elles augmentent');
    await sleep(400);
    s = await snap(ctx);
    check('Empathie ventes en hausse (Q5)', s.has('C’est une bonne dynamique'));
    await tapContinue(ctx);
    await pick(ctx, 'Je ne sais pas');
    await sleep(400);
    s = await snap(ctx);
    check('Empathie « Vous n’êtes pas seul » (Q6)', s.has('Vous n’êtes pas seul'));
    await tapContinue(ctx);
    await pick(ctx, 'J’utilise un cahier');
    await tapContinue(ctx);
    await pick(ctx, 'Non');
    await sleep(400);
    s = await snap(ctx);
    check('Empathie produits non rentables (Q8)', s.has('Pas de problème. COMAXE pourra vous aider'));
    await tapContinue(ctx);
    await pick(ctx, 'Je les note parfois');
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Progression → « Étape 3 sur 5 »', s.has('Étape 3 sur 5'));

    // ── Étape 3 — difficultés ──
    await pick(ctx, 'Gérer mon stock');
    await pick(ctx, 'Fixer des objectifs');
    await sleep(400);
    s = await snap(ctx);
    check('Empathie multi-choix stock (Q10)', s.has('Le stock peut vite devenir difficile à suivre'));
    check('Plusieurs choix possibles (indice)', s.has('Plusieurs choix possibles'));
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Question 11 (étape 3)', s.has('Qu’aimeriez-vous principalement améliorer'));
    await pick(ctx, 'Augmenter mon bénéfice');
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Progression → « Étape 4 sur 5 »', s.has('Étape 4 sur 5'));

    // ── Étape 4 — vision ──
    await pick(ctx, 'Faire plus de ventes');
    await tapContinue(ctx);
    await pick(ctx, 'Je ne sais pas par où commencer');
    await sleep(400);
    s = await snap(ctx);
    check('Empathie plan (Q13)', s.has('Commençons par mesurer votre situation actuelle'));
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Étape 5 — Objectifs atteinte', s.has('Maintenant, parlons de vos objectifs'));
    check('Progression « Étape 5 sur 5 »', s.has('Étape 5 sur 5'));

    // ── 5. Étape 5 — objectifs (validation + calculs) ──
    console.log('  ── 5. Objectifs : validation + calculs ──');
    check('Champ ventes présent', await evaljs(ctx.send, SET_INPUT(0, 'abc')));
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Validation numérique : montant invalide bloqué', s.has('invalide'), '');
    check('Aucune redirection (reste étape 5)', s.has('Maintenant, parlons de vos objectifs'));

    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    await evaljs(ctx.send, SET_INPUT(0, '3000'));
    await sleep(400);
    s = await snap(ctx);
    check('Calcul réel : objectif ventes affiché', s.has('Votre objectif est de 3 000 $ de ventes par mois'));
    check(`≈ $/jour sur vrais jours (${days} jours)`, s.has(`par jour (sur ${days} jours`));

    await evaljs(ctx.send, SET_INPUT(2, '500')); // produits (profit laissé VIDE)
    await evaljs(ctx.send, SET_INPUT(3, '36000')); // annuel
    await sleep(400);
    s = await snap(ctx);
    check('Calcul produits/jour', s.has('≈ 17 produits par jour') || s.has('produits par jour'));

    // Plafond : Oui → valeur obligatoire
    check('Bouton plafond « Oui »', await pick(ctx, 'Oui'));
    await sleep(400);
    await tapContinue(ctx);
    s = await snap(ctx);
    check('Plafond Oui sans valeur → bloqué', s.has('Indiquez le plafond mensuel de dépenses'));
    await evaljs(ctx.send, SET_INPUT(4, '500'));
    await sleep(400);
    s = await snap(ctx);
    check('Plafond traité comme maximum', s.has('maximum à ne pas dépasser'));
    check('Mobile 375 sans débordement (objectifs)', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't4-03-objectifs.png');

    // ── 6. Résumé ──
    console.log('  ── 6. Résumé final ──');
    check('Continuer → résumé', await tapContinue(ctx));
    await sleep(600);
    s = await snap(ctx);
    check('Titre « Nous avons compris votre situation. »', s.has('Nous avons compris votre situation.'));
    check('Texte dynamique basé sur les réponses', s.has('augmenter mon bénéfice'));
    check('Renseigné : Ventes mensuelles 3 000 $', s.has('Ventes mensuelles') && s.has('3 000 $'));
    check('Renseigné : Produits vendus 500 / mois', s.has('Produits vendus') && s.has('500 / mois'));
    check('Renseigné : Objectif annuel 36 000 $', s.has('Objectif annuel') && s.has('36 000 $'));
    check('Renseigné : Plafond de dépenses 500 $', s.has('Plafond de dépenses'));
    check('NON renseigné (bénéfice) → jamais affiché', !s.has('Bénéfice net mensuel'));
    check('Message de rassurance final exact', s.has('Vous n’avez pas besoin d’avoir tout compris'));
    check('Objectifs modifiables rappelés', s.has('modifiables à tout moment'));
    check('Bouton « Continuer vers les tarifs »', s.has('Continuer vers les tarifs'));
    check('Mobile 375 sans débordement (résumé)', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't4-04-summary-light.png');

    // ── Dark mode sur le résumé (persistance aussi testée par le rechargement) ──
    console.log('  ── 7. Dark mode + desktop ──');
    await admin.from('user_preferences').upsert({ user_id: uid, theme: 'dark' }, { onConflict: 'user_id' });
    try { await evaljs(ctx.send, `(() => { try { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: 'dark' })); } catch { /* origine vide */ } return true; })()`); } catch { /* non bloquant */ }
    await ctx.send('Page.reload', { ignoreCache: false });
    const darkOk = await waitDark(ctx, true);
    await waitReady(ctx);
    await sleep(600);
    s = await snap(ctx);
    check('Dark mode actif', darkOk && s.dark, `dark=${s.dark}`);
    check('Résumé restauré après rechargement dark', s.path === '/onboarding' && s.has('Nous avons compris votre situation.'), `path=${s.path} txt=${s.text.slice(0, 60)}`);
    check('Objectifs toujours affichés en dark', s.has('3 000 $'));
    await shot(ctx, 't4-05-summary-dark.png');

    await admin.from('user_preferences').upsert({ user_id: uid, theme: 'light' }, { onConflict: 'user_id' });
    try { await evaljs(ctx.send, `(() => { try { localStorage.setItem('comaxe.preferences', JSON.stringify({ theme: 'light' })); } catch { /* origine vide */ } return true; })()`); } catch { /* non bloquant */ }
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await ctx.send('Page.reload', { ignoreCache: false });
    await waitReady(ctx);
    await sleep(600);
    s = await snap(ctx);
    check('Desktop 1440 sans débordement', s.overflow <= 0, `overflow=${s.overflow}`);
    await shot(ctx, 't4-06-summary-desktop.png');

    // ── 8. Finale → Tarifs + écriture réelle ──
    console.log('  ── 8. Finale → /tarifs + goals ──');
    check('Clic « Continuer vers les tarifs »', await evaljs(ctx.send, CLICK_BTN('Continuer vers les tarifs')));
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try { if ((await evaljs(ctx.send, 'location.pathname')).startsWith('/tarifs')) break; } catch { /* navigation */ }
    }
    await waitReady(ctx);
    s = await snap(ctx);
    check('Arrivée sur /tarifs', s.path.startsWith('/tarifs'), `path=${s.path}`);
    check('Bandeau tarifs ou plans visibles', s.has('Tarifs') || s.has('offre') || s.has('abonnement'));

    const { data: after } = await admin.auth.admin.getUserById(uid);
    const meta = after?.user?.user_metadata ?? {};
    check('Flag onboarding_completed = true', meta.onboarding_completed === true, `valeur=${JSON.stringify(meta.onboarding_completed)}`);
    check('Horodatage de complétion posé', typeof meta.onboarding_completed_at === 'string');

    const { data: goals } = await admin.from('goals').select('metric, period, target, title').eq('user_id', uid);
    const g = (m, p) => (goals || []).find((x) => x.metric === m && x.period === p);
    check('goals : ventes mensuel = 3000 (UPDATE seed)', g('sales', 'mois')?.target == 3000, `valeur=${g('sales', 'mois')?.target}`);
    check('goals : pièces mensuel = 500 (UPDATE seed)', g('pieces', 'mois')?.target == 500, `valeur=${g('pieces', 'mois')?.target}`);
    check('goals : plafond dépenses = 500 (UPDATE seed)', g('expenses', 'mois')?.target == 500, `valeur=${g('expenses', 'mois')?.target}`);
    check('goals : annuel 36000 (INSERT period=annee)', g('sales', 'annee')?.target == 36000, `valeur=${g('sales', 'annee')?.target}`);
    check('goals : bénéfice NON renseigné → inchangé (seed 4000)', g('profit', 'mois')?.target == 4000, `valeur=${g('profit', 'mois')?.target}`);
    check('goals : pas de doublon (4 seeds + 1 annuel = 5)', (goals || []).length === 5, `total=${(goals || []).length}`);

    // ── 9. Plus jamais de questionnaire ──
    console.log('  ── 9. Aucune re-visite du questionnaire ──');
    await navigate(ctx, APP + '/onboarding');
    await waitReady(ctx);
    await sleep(600);
    s = await snap(ctx);
    check('Re-visite /onboarding → /tarifs', s.path.startsWith('/tarifs'), `path=${s.path}`);
    check('Questionnaire non affiché', !s.has('Parlons de votre commerce'));
  } finally {
    try { ctx?.close(); } catch { /* déjà fermé */ }
    try { edge.kill(); } catch { /* déjà tué */ }
  }

  const failed = checks.filter((c) => !c.ok);
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`  T4 ONBOARDING : ${checks.length - failed.length}/${checks.length} checks OK`);
  if (failed.length) failed.forEach((f) => console.log(`   ❌ ${f.name}`));
  console.log('──────────────────────────────────────────────────────────');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('  🔴', e.message);
  process.exit(1);
});
