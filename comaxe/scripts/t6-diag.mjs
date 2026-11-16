// COMAXE — Diag T6 : lisibilité des champs de recherche en thème SOMBRE.
// Mesure les styles calculés des inputs de recherche sur /dashboard (dark).
// Usage : node scripts/t6-diag.mjs
import { spawn } from 'child_process';
import { readFileSync, mkdirSync } from 'fs';
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
const PORT = 9231;
const EMAIL = `t6-diag-${Date.now()}@comaxe.test`;
const PASSWORD = 'ComaxeTest!2026';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

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
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'Diag', last_name: 'T6', store_name: 'Boutique Diag', store_currency: 'USD', store_country: 'CD' },
  });
  const uid = created?.user?.id;
  if (!uid) { console.log('🔴 createUser échoue : ' + (createErr?.message || 'inconnu')); process.exit(1); }
  await admin.from('user_preferences').upsert({ user_id: uid, theme: 'dark' }, { onConflict: 'user_id' });

  const jar = new Map();
  const ssr = createServerClient(URL_SB, ANON, {
    cookies: { get: (n) => jar.get(n), set: (n, v) => jar.set(n, v), remove: (n) => jar.delete(n) },
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await ssr.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookies = [...jar.entries()].map(([name, value]) => ({ name, value, domain: 'localhost', path: '/' }));

  const EDGE = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!EDGE) { console.log('🔴 Edge introuvable'); process.exit(1); }

  const profile = join(tmpdir(), `comaxe-edge-t6diag-${Date.now()}`);
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
    await ctx.send('Page.navigate', { url: APP + '/dashboard', timeoutMs: 120000 });
    for (let i = 0; i < 30; i++) {
      try { if ((await evaljs(ctx.send, 'document.querySelectorAll("main input").length')) > 0) break; } catch { /* hydratation */ }
      await sleep(600);
    }
    await sleep(1500);

    const diag = await evaljs(ctx.send, `(() => {
      const out = { path: location.pathname, dark: document.documentElement.classList.contains('dark'), inputs: [] };
      for (const el of document.querySelectorAll('main input')) {
        const cs = getComputedStyle(el);
        const ph = getComputedStyle(el, '::placeholder');
        out.inputs.push({
          ph: (el.placeholder || '').slice(0, 45),
          cls: el.className,
          color: cs.color, bg: cs.backgroundColor, border: cs.borderColor, placeholder: ph.color,
        });
      }
      return JSON.stringify(out, null, 1);
    })()`);
    console.log(diag);

    // Cœur du texte tapé (état focus) + capture
    const shot = await ctx.send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('fs');
    writeFileSync(join(__dirname, '_shots', 't6-diag-dark-search.png'), Buffer.from(shot.data, 'base64'));
    console.log('📸 scripts/_shots/t6-diag-dark-search.png');
  } finally {
    try { ctx?.close(); } catch { /* */ }
    edge.kill();
  }
}

main().catch((e) => { console.error('🔴', e.message); process.exit(1); });
