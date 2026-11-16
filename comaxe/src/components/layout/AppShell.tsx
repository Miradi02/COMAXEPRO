'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { AppShellProvider } from '@/context/AppShellContext';
import { CommerceProvider } from '@/context/CommerceContext';
import { MaxPromoAd } from '@/components/billing/MaxPromoAd';

// NOTE : BillingProvider est monté au layout RACINE (src/app/layout.tsx)
// pour être disponible sur la landing, /tarifs et /login aussi bien que
// dans le groupe (app). CommerceProvider consomme useBilling() : il reste
// un descendant, donc le contexte est bien résolu ici.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Pages Paramètres = page dédiée (sans barre inférieure) : le contenu
  // reprend un padding bas normal, sans réservation inutile.
  const isSettingsRoute =
    pathname === '/parametres' || pathname.startsWith('/parametres/');

  return (
    <AppShellProvider>
      <CommerceProvider>
        <div className="min-h-screen bg-[#F8F9FD] flex">
          {/* Mini-publicité Max — rendue AVANT le tiroir : son z-40 est
              alors couvert par le voile du menu (z-40, plus tard dans le
              DOM) quand le tiroir est ouvert, mais elle reste au-dessus
              du contenu et sous les modales (z-50). */}
          <MaxPromoAd />

          {/* Persistent Sidebar Navigation */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
            {/* Persistent Top Header with Global Date Picker */}
            <Header />

            {/* Dynamic Page Content Shell — pb-28 réserve la place de la
                barre inférieure (mobile/tablette) : aucun contenu caché ;
                lg:pb-6 = padding desktop d'origine, strictement inchangé. */}
            <main
              className={`flex-1 px-4 sm:px-8 pt-6 max-w-[1600px] w-full mx-auto ${
                isSettingsRoute ? 'pb-6' : 'pb-28 lg:pb-6'
              }`}
            >
              {children}
            </main>
          </div>

          {/* Barre de navigation inférieure — mobile & tablette UNIQUEMENT
              (lg:hidden : desktop = sidebar seule, aucune modification) */}
          <BottomNav />
        </div>
      </CommerceProvider>
    </AppShellProvider>
  );
}
