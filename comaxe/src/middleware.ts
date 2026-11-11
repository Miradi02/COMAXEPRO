import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveActivePlan, isFeatureUnlocked } from '@/lib/billing/entitlements';
import { mapSubscriptionRow, type SubscriptionRow } from '@/lib/billing/subscription';
import type { FeatureKey } from '@/lib/billing/types';

/**
 * Verrous de fonctionnalités selon l'abonnement RÉELLEMENT actif.
 * Le middleware interroge la table `subscriptions` (lecture de sa propre
 * ligne via RLS) : aucune page ne peut être ouverte en contournant le plan.
 */
const FEATURE_GATES: Record<string, FeatureKey> = {
  '/objectifs': 'goals',
  '/analytique': 'analytics',
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Récupérer la session utilisateur
  const { data: { session } } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  // Lien de confirmation email / retour d'authentification :
  // on laisse passer la requête (le client échangera le code contre une session).
  // Sans ça, la redirection vers /login supprimerait le code et bloquerait l'accès.
  const hasAuthParams =
    request.nextUrl.searchParams.has('code') ||
    request.nextUrl.searchParams.has('token_hash') ||
    request.nextUrl.searchParams.has('access_token') ||
    request.nextUrl.searchParams.has('refresh_token') ||
    request.nextUrl.searchParams.has('error_description');

  if (hasAuthParams) {
    return response;
  }

  // Routes publiques : landing (`/`), connexion (`/login`), tarifs (`/tarifs`).
  // Tout le reste de l'application reste protégé.
  const publicPaths = ['/', '/login', '/tarifs'];
  const isPublicRoute = publicPaths.includes(pathname);

  // Si pas de session et route protégée -> redirect /login
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si session et sur /login -> page Tarifs (choix de l'offre après connexion)
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/tarifs', request.url));
  }

  // Verrou de fonctionnalité : plan actif vérifié côté serveur.
  // En cas d'erreur de lecture, on laisse passer (fail-open) : le verrou
  // SQL + le gate client reprennent le relais, et un paiement en cours ne
  // doit pas fermer l'accès à un utilisateur légitime.
  const gateFeature = FEATURE_GATES[pathname];
  if (session && gateFeature) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id, plan_id, requested_plan_id, status')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) {
        console.error('[billing] gate subscription:', error.message);
      } else {
        const planId = resolveActivePlan(mapSubscriptionRow(data as SubscriptionRow | null));
        if (!isFeatureUnlocked(planId, gateFeature)) {
          return NextResponse.redirect(
            new URL(`/tarifs?locked=${gateFeature}`, request.url)
          );
        }
      }
    } catch (e) {
      console.error('[billing] gate error:', e);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
