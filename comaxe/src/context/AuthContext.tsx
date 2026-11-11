'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { StoreSignupInfo } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    storeInfo: StoreSignupInfo
  ) => Promise<{ error: any }>;
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Le lien de confirmation email revient sur /login : le middleware
        // laisse passer le paramètre ?code que le client échange en session.
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
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
    return { error };
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
