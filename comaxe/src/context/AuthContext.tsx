'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { StoreSignupInfo } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; user?: User | null }>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    storeInfo: StoreSignupInfo
  ) => Promise<{ error: any; session?: Session | null }>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  resendConfirmation: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  /** Utilisateur déjà résolu côté serveur (layout racine) — évite tout clignotement */
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialUser);

  useEffect(() => {
    // Récupérer la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    // `user` renvoyé pour que la page login choisisse la destination
    // (/onboarding pour un nouveau compte) sans état périmé.
    return { error, user: data.user };
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    storeInfo: StoreSignupInfo
  ) => {
    // Les informations du commerce sont transmises comme métadonnées protégées :
    // le trigger serveur "handle_new_user" les enregistre dans store_profiles
    // (table sécurisée RLS) au moment exact de la création du compte.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Le lien de confirmation email revient sur /login : le middleware
        // laisse passer le paramètre ?code que le client échange en session.
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          // Onboarding : les NOUVEAUX comptes ont `onboarding_completed: false`
          // → redirection vers /onboarding après inscription. Les comptes
          // existants (sans cette clé) ne déclenchent JAMAIS l'onboarding.
          onboarding_completed: false,
          first_name: firstName,
          last_name: lastName,
          store_name: storeInfo.storeName,
          store_phone: storeInfo.phone,
          store_address: storeInfo.address,
          store_category: storeInfo.category,
          store_currency: storeInfo.currency,
          store_country: storeInfo.country,
        },
      },
    });
    // `session` est fournie si la confirmation email est inutile (auto-confirm) :
    // la page login s'en sert pour choisir la destination (/onboarding ou /login).
    return { error, session: data.session };
  };

  // Renvoi de l'email de confirmation (si l'utilisateur ne l'a pas reçu)
  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Purge LOCALE immédiate (cookies + état) : aucune attente réseau,
    // la déconnexion est instantanée même si Supabase est lent ou hors ligne.
    // Le middleware revoque l'accès dès la requête suivante (cookie supprimé).
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Dernier recours : purge forcée sans jeter d'erreur vers l'UI
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* la redirection vers /login fera le reste */
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, resendConfirmation, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
