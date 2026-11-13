'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AppShellProvider } from '@/context/AppShellContext';
import { CommerceProvider } from '@/context/CommerceContext';
import { MaxPromoAd } from '@/components/billing/MaxPromoAd';

// NOTE : BillingProvider est monté au layout RACINE (src/app/layout.tsx)
// pour être disponible sur la landing, /tarifs et /login aussi bien que
// dans le groupe (app). CommerceProvider consomme useBilling() : il reste
// un descendant, donc le contexte est bien résolu ici.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShellProvider>
      <CommerceProvider>
        <div className="min-h-screen bg-[#F8F9FD] flex">
          {/* Persistent Sidebar Navigation */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
            {/* Persistent Top Header with Global Date Picker */}
            <Header />

            {/* Dynamic Page Content Shell */}
            <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1600px] w-full mx-auto">
              {children}
            </main>
          </div>

          {/* Mini-publicité Max — uniquement pour les comptes Essential
              (fermeture × → réapparition après 1 min ; clic → /tarifs sans Essential) */}
          <MaxPromoAd />
        </div>
      </CommerceProvider>
    </AppShellProvider>
  );
}
