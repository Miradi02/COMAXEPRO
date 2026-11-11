/**
 * COMAXE — Helpers des routes API billing (côté serveur).
 * Authentification par cookies de la requête ; écritures via service role
 * (la RLS de `subscriptions`/`subscription_events` est lecture seule).
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { mapSubscriptionRow, type SubscriptionRow } from './subscription';
import type { Subscription } from './types';

/** Utilisateur authentifié via les cookies de la requête (null sinon). */
export async function getSessionUser() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (_name: string, _value: string, _options: CookieOptions) => {},
        remove: (_name: string, _options: CookieOptions) => {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Réponse standard « non authentifié ». */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
}

/** Lit l'abonnement actuel (service role, indépendant de la RLS). */
export async function readSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`subscriptions (lecture) : ${error.message}`);
  return mapSubscriptionRow(data as SubscriptionRow | null);
}

/**
 * Enregistre une DEMANDE de plan (clic « S'abonner »).
 *
 * RÈGLE FONDAMENTALE : un clic n'est jamais une preuve de paiement —
 * on écrit UNIQUEMENT `requested_plan_id` + statut `pending`.
 * `plan_id` (le plan réellement actif) n'est modifié que par un événement
 * de paiement passé à `applySubscriptionEvent` (events.ts).
 */
export async function markPlanRequested(userId: string, plan: 'pro' | 'max'): Promise<void> {
  const { error } = await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      requested_plan_id: plan,
      status: 'pending',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(`markPlanRequested : ${error.message}`);
}
