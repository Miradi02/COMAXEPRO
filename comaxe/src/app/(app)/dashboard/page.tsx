'use client';

import React from 'react';
import { KPICards } from '@/components/dashboard/KPICards';
import { SalesEvolutionChart } from '@/components/dashboard/SalesEvolutionChart';
import { SalesGoalCard } from '@/components/dashboard/SalesGoalCard';
import { StockAlerts } from '@/components/dashboard/StockAlerts';
import { TopSellingProducts } from '@/components/dashboard/TopSellingProducts';
import { RecentCustomers } from '@/components/dashboard/RecentCustomers';
import { RecentSalesTable } from '@/components/dashboard/RecentSalesTable';

/**
 * Tableau de bord — route app : /dashboard
 * (la racine `/` est désormais la landing page publique de COMAXE)
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6 sm:space-y-7">
      {/* 1. VENTES & RÉSULTATS : Les 4 Cartes KPI Principales */}
      <section>
        <KPICards />
      </section>

      {/* 2. ANALYSE & OBJECTIF : Évolution des Ventes + Objectif Journalier */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-8">
          <SalesEvolutionChart />
        </div>
        <div className="lg:col-span-4">
          <SalesGoalCard />
        </div>
      </section>

      {/* 3. STOCK & CLIENTS : Alertes Stock + Produits les Plus Vendus + Clients Récents */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-4">
          <StockAlerts />
        </div>
        <div className="lg:col-span-4">
          <TopSellingProducts />
        </div>
        <div className="md:col-span-2 lg:col-span-4">
          <RecentCustomers />
        </div>
      </section>

      {/* 4. VENTES RÉCENTES : Consultation des opérations (l'enregistrement se fait sur la page Ventes) */}
      <section className="pt-2">
        <RecentSalesTable showAddButton={false} />
      </section>
    </div>
  );
}
