// Diagnostic rapide events.ts
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function test() {
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email: `debug-${Date.now()}@comaxe.test`, password: 'ComaxeTest!2026', email_confirm: true });
  if (ue) { console.error('createUser:', ue); return; }
  const uid = u.user.id;
  console.log('user:', uid);

  // Attendre le trigger
  await new Promise(r => setTimeout(r, 500));

  const { data: sub, error: se } = await admin.from('subscriptions').select('*').eq('user_id', uid).single();
  console.log('subscription après trigger:', { sub, se });

  // Simuler un événement
  const { data: j1, error: je1 } = await admin.from('subscription_events').insert({
    user_id: uid, event_id: 'debug_evt_1', event_type: 'checkout.completed',
    payload: { simulated: true }
  });
  console.log('journal insert 1:', { j1, je1 });

  // Upsert comme dans events.ts
  const upd = {
    user_id: uid,
    plan_id: 'pro',
    requested_plan_id: null,
    status: 'active',
    updated_at: new Date().toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30*86400000).toISOString(),
    started_at: new Date().toISOString(),
    stripe_subscription_id: 'sim_sub_xxx',
  };
  const { data: ups, error: ue2 } = await admin.from('subscriptions').upsert(upd, { onConflict: 'user_id' }).select('*').single();
  console.log('upsert:', { ups, ue2 });

  // Relire
  const { data: sub2 } = await admin.from('subscriptions').select('*').eq('user_id', uid).single();
  console.log('subscription après upsert:', sub2);

  // Nettoyage
  await admin.from('subscription_events').delete().eq('user_id', uid);
  await admin.from('subscriptions').delete().eq('user_id', uid);
  await admin.auth.admin.deleteUser(uid);
}

test();