// Debug : capture les erreurs console/exceptions sur la landing (FR puis EN)
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = 'http://localhost:3000';
const CDP_PORT = 9234;
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => { try { readFileSync(p); return true; } catch { return false; } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForJson(url, deadlineMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* */ }
    await sleep(500);
  }
  throw new Error('CDP indisponible');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let msgId = 0;
    const pending = new Map();
    const events = [];
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
        } else if (m.method) {
          events.push(m);
        }
      };
      resolve({ ws, send, events, close: () => ws.close() });
    };
    ws.onerror = () => reject(new Error('WS fail'));
  });
}

async function evaljs(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=' + join(process.env.TEMP, 'comaxe-debug-' + Date.now()),
  '--no-first-run', '--disable-gpu', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });

try {
  const targets = await waitForJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  const { send, events, close } = await connect(page.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  await send('Page.navigate', { url: APP + '/' });
  await sleep(6000);

  // pose la locale EN + recharge
  await evaljs(send, `localStorage.setItem('comaxe.preferences', ${JSON.stringify(JSON.stringify({ theme: 'light', locale: 'en' }))}); 'ok'`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(7000);

  const text = await evaljs(send, 'document.body.innerText');
  const hasEn = (text || '').includes('Start for free');
  console.log('Page contient "Start for free" :', hasEn);
  console.log('Extraits FR détectés :', ['Commencer gratuitement', 'Fonctionnalités', 'Voir les fonctionnalités']
    .filter((s) => (text || '').includes(s)));

  const errs = events.filter((e) =>
    e.method === 'Runtime.exceptionThrown' ||
    (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level))
  );
  console.log('\nÉvénements console/erreur :', errs.length);
  for (const e of errs.slice(0, 10)) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails;
      console.log('  [exception]', d.text, '|', (d.exception?.description || '').split('\n')[0]);
    } else {
      const d = e.params.entry;
      console.log(`  [${d.level}]`, d.text.slice(0, 300));
    }
  }
  close();
} catch (err) {
  console.error('DEBUG FATAL:', err.message);
} finally {
  try { edge.kill(); } catch { /* */ }
}
