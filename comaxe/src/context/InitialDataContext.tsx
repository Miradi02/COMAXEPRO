'use client';

import React, { createContext, useContext } from 'react';
import { StoreBusinessProfile } from '@/types';

interface InitialData {
  /**
   * Profil boutique résolu côté serveur (layout racine, lecture RLS).
   * Évite tout clignotement : devise et nom de boutique corrects
   * dès le tout premier rendu, avant même le chargement client.
   */
  initialStoreProfile: StoreBusinessProfile | null;
}

const InitialDataContext = createContext<InitialData>({ initialStoreProfile: null });

export function InitialDataProvider({
  value,
  children,
}: {
  value: InitialData;
  children: React.ReactNode;
}) {
  return (
    <InitialDataContext.Provider value={value}>{children}</InitialDataContext.Provider>
  );
}

export function useInitialData(): InitialData {
  return useContext(InitialDataContext);
}
