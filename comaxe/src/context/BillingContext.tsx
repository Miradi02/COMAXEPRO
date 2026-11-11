'use client';

/**
 * COMAXE — Contexte ABONNEMENT (source unique côté client).
 *
 * Expose l'abonnement réel de l'utilisateur (jamais le plan « demandé »
 * comme preuve de paiement) et les décisions d'entitlements associées.
 * Aucune règle de plan n'est écrite dans les pages : elles appellent
 * `isUnlocked()` / lisent `planId` et laissent le moteur décider.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase/client';
import { mapSubscriptionRow, type SubscriptionRow } from '@/lib/billing/subscription';
import {
  getEntitlements,
  isFeatureUnlocked,
  resolveActivePlan,
  type Entitlements,
} from '@/lib/billing/entitlements';
import type {
  FeatureKey,
  PlanId,
  Subscription,
  SubscriptionStatus,
} from '@/lib/billing/types';

export interface BillingContextValue {
  /** Abonnement brut (null tant que non résolu ou absent) */
  subscription: Subscription | null;
  /** Plan ACTIF — null pendant le chargement (jamais le plan demandé) */
  planId: PlanId | null;
  /** Plan demandé par l'utilisateur (clic « S'abonner »), le cas échéant */
  requestedPlanId: PlanId | null;
  status: SubscriptionStatus | null;
  /** Entitlements complets (null pendant le chargement) */
  entitlements: Entitlements | null;
  loading: boolean;
  error: string | null;
  /**
   * Une fonctionnalité est-elle débloquée ?
   * Tant que l'abonnement n'est pas résolu → true (aucun blocage au
   * chargement ; les verrouillages serveur restent eux actifs en SQL).
   */
  isUnlocked: (feature: FeatureKey) => boolean;
  /** Recharger l'abonnement (après un changement de plan, par ex.) */
  refresh: () => Promise<void>;
}

const BillingContext = createContext<BillingContextValue | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSubscription(null);
        setError(null);
        return;
      }
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      setSubscription(mapSubscriptionRow(data as SubscriptionRow | null));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh();
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const planId = useMemo(
    () => (loading ? null : resolveActivePlan(subscription)),
    [loading, subscription]
  );

  const entitlements = useMemo(
    () => (loading ? null : getEntitlements(subscription)),
    [loading, subscription]
  );

  const isUnlocked = useCallback(
    (feature: FeatureKey) => {
      if (loading || !planId) return true;
      return isFeatureUnlocked(planId, feature);
    },
    [loading, planId]
  );

  const value = useMemo<BillingContextValue>(
    () => ({
      subscription,
      planId,
      requestedPlanId: loading ? null : (subscription?.requestedPlanId ?? null),
      status: loading ? null : (subscription?.status ?? null),
      entitlements,
      loading,
      error,
      isUnlocked,
      refresh,
    }),
    [subscription, planId, entitlements, loading, error, isUnlocked, refresh]
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be used within a BillingProvider');
  return ctx;
}
