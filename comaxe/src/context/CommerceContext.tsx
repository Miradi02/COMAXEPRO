'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback, ReactNode } from 'react';
import {
  Sale,
  SaleItem,
  Product,
  Customer,
  Expense,
  Debt,
  DebtPayment,
  DebtHistoryOperation,
  DebtStatus,
  GoalItem,
  ProtectedUserProfile,
  StoreBusinessProfile,
  PeriodProfitData,
  ProfitProductStat,
  StockMovement,
  StockMovementType,
  Report,
  ReportType,
  GoalRecord,
  GoalMetric,
  GoalPeriod,
} from '@/types';
import {
  isDateMatching,
  getDisplayDateLabel,
  isWithinPeriodRange,
  getCurrentMonthLabel,
  getLastNDaysKeys,
  REFERENCE_TODAY_KEY,
} from '@/lib/dateUtils';
import { supabase } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useInitialData } from '@/context/InitialDataContext';
import { useI18n } from '@/context/I18nContext';
import { useBilling } from '@/context/BillingContext';
import {
  checkCanCreate,
  isFeatureUnlocked,
  isWithinHistory,
  type CreateCheck,
} from '@/lib/billing/entitlements';
import { buildUsageCounts, getAllUsage, type ResourceUsage } from '@/lib/billing/usage';
import { featureLockedMessage, formatMessage, limitReachedMessage } from '@/lib/billing/messages';
import type { FeatureKey, ResourceKey } from '@/lib/billing/types';
import { ConfirmModal } from '@/components/common/ConfirmModal';

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export interface SaleOperationResult {
  success: boolean;
  error?: string;
  sale?: Sale;
}

/**
 * Résultat standard d'une mutation du funnel.
 * Les gates d'abonnement (limites/fonctionnalités) refusent avec
 * `{ success: false, error: <message centralisé> }` AVANT tout appel serveur.
 */
export interface MutationResult {
  success: boolean;
  error?: string;
}

interface GoalTargets {
  monthlySalesTarget: number;
  monthlyProfitTarget: number;
  monthlyPiecesTarget: number;
  monthlyExpenseCeiling: number;
  dailySalesTarget: number;
}

interface CommerceContextType {
  // 1. Date Globale Active
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  displayDateText: string;
  isDateMatching: (itemDate: string) => boolean;

  // 2. Ensembles de Données Complets (Single Source of Truth)
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  debts: Debt[];
  debtOperations: DebtHistoryOperation[];
  stockMovements: StockMovement[];
  /** Mouvements de stock limités à la date globale active */
  filteredStockMovements: StockMovement[];
  /** Rapports réellement générés et conservés par le commerçant */
  reports: Report[];
  userProfile: ProtectedUserProfile;
  storeProfile: StoreBusinessProfile;
  goalTargets: GoalTargets;
  /** Objectifs enregistrés (créés / modifiés / supprimés par le commerçant) */
  goalRecords: GoalRecord[];

  // 3. Ensembles Filtrés par la Date Globale Active
  filteredSales: Sale[];
  filteredExpenses: Expense[];
  filteredDebts: Debt[];
  filteredDebtOperations: DebtHistoryOperation[];

  // 4. Métriques Métier Calculées en Temps Réel
  todaySalesTotal: number;
  todaySalesCount: number;
  todayExpensesTotal: number;
  todayGrossProfitTotal: number;
  todayProfitTotal: number;
  totalStockValue: number;
  totalStockCount: number;
  activeDebtsCount: number;
  totalDebtRemaining: number;
  totalDebtRecovered: number;
  totalDebtInitial: number;
  debtRecoveryRate: number;

  // 5. Objectifs Dynamiques
  goals: GoalItem[];

  // 6. Moteur de Calcul Financier par Période
  getPeriodMetrics: (
    period: '7j' | '30j' | '3m' | '6m' | '12m' | 'semaine' | 'mois' | '3mois' | 'annee' | 'personnalise'
  ) => PeriodProfitData;

  // 7. Actions & Transactions Métier
  addSale: (sale: Omit<Sale, 'id' | 'code' | 'status'> & { id?: string; code?: string }) => Promise<SaleOperationResult>;
  updateSale: (oldSale: Sale, updated: Partial<Sale>) => Promise<SaleOperationResult>;
  deleteSale: (saleId: string) => Promise<void>;

  addProduct: (prod: Omit<Product, 'id' | 'status' | 'totalSalesCount'> & { id?: string }) => Promise<MutationResult>;
  updateProduct: (id: string, updated: Partial<Product>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;

  addCustomer: (customer: Omit<Customer, 'id' | 'purchasesCount' | 'totalSpent' | 'lastPurchaseDate' | 'avatar'> & { id?: string; avatar?: string }) => Promise<MutationResult>;
  updateCustomer: (id: string, updated: Partial<Customer>) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;

  addExpense: (expense: Omit<Expense, 'id'> & { id?: string }) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;

  addReport: (report: {
    reportType: ReportType;
    title: string;
    periodLabel: string;
    metrics: string;
    description?: string;
  }) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;

  addDebt: (debt: Omit<Debt, 'id' | 'paidAmount' | 'remainingAmount' | 'status' | 'payments'> & { id?: string }) => Promise<MutationResult>;
  recordDebtPayment: (debtId: string, amount: number, note?: string, paymentDate?: string) => Promise<void>;
  deleteDebt: (debtId: string) => Promise<void>;

  updateStoreProfile: (updated: Partial<StoreBusinessProfile>) => Promise<void>;

  addGoal: (goal: {
    metric: GoalMetric;
    title: string;
    category: string;
    target: number;
    unit?: string;
    period: GoalPeriod;
  }) => Promise<MutationResult>;
  updateGoal: (
    goalId: string,
    updated: { metric: GoalMetric; title: string; category: string; target: number; unit?: string; period: GoalPeriod }
  ) => Promise<MutationResult>;
  deleteGoal: (goalId: string) => Promise<void>;

  // 7 bis. Compteurs d'abonnement — réutilisables par les pages
  // (limite / utilisé / reste / % / autorisé), source unique du moteur.
  /** État d'utilisation de chaque ressource pour le plan actif — null tant que l'abonnement n'est pas résolu */
  usage: Record<ResourceKey, ResourceUsage> | null;
  /** Une création est-elle autorisée sur le plan actif ? null = indéterminé (le serveur tranche) */
  checkCreate: (resource: ResourceKey) => CreateCheck | null;

  /** Formate un montant dans la devise du commerce (ex: 1500 → « 1 500 FC ») */
  formatAmount: (amount: number) => string;

  // 8. Déclencheur Global de Confirmation
  requestConfirmation: (params: { title?: string; message: string; onConfirm: () => void }) => void;

  // 9. État de chargement (données Supabase)
  isLoading: boolean;
}

const CommerceContext = createContext<CommerceContextType | null>(null);

// ============================================
// Mappers : DB (snake_case) -> App (camelCase)
// ============================================
const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

function mapProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: r.quantity,
    minThreshold: r.min_threshold,
    sellingPrice: Number(r.selling_price),
    purchasePrice: Number(r.purchase_price),
    description: r.description ?? undefined,
    createdAt: r.created_at || undefined,
    status: r.status,
    totalSalesCount: r.total_sales_count,
  };
}

function mapCustomer(r: any): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    purchasesCount: r.purchases_count,
    totalSpent: Number(r.total_spent),
    lastPurchaseDate: r.last_purchase_date || 'Nouveau client',
    avatar: r.avatar || DEFAULT_AVATAR,
  };
}

function mapSale(r: any, items: SaleItem[]): Sale {
  return {
    id: r.id,
    code: r.code,
    date: r.date,
    customerId: r.customer_id ?? undefined,
    client: {
      id: r.customer_id ?? undefined,
      name: r.client_name,
      phone: r.client_phone || '',
      avatar: r.client_avatar ?? undefined,
    },
    items,
    totalAmount: Number(r.total_amount),
    totalProfit: r.total_profit != null ? Number(r.total_profit) : undefined,
    paymentMethod: r.payment_method,
    status: r.status,
    debtId: r.debt_id ?? undefined,
    createdAt: r.created_at_ts ?? '',
  };
}

function mapExpense(r: any): Expense {
  return {
    id: r.id,
    date: r.date,
    category: r.category,
    description: r.description,
    amount: Number(r.amount),
    createdAt: r.created_at_ts ?? '',
  };
}

function mapDebt(r: any, payments: DebtPayment[]): Debt {
  return {
    id: r.id,
    personName: r.person_name,
    phone: r.phone,
    email: r.email ?? undefined,
    initialAmount: Number(r.initial_amount),
    paidAmount: Number(r.paid_amount),
    remainingAmount: Number(r.remaining_amount),
    date: r.date,
    status: r.status,
    payments,
    lastPaymentDate: r.last_payment_date ?? undefined,
    productId: r.product_id ?? undefined,
    productName: r.product_name ?? undefined,
    quantity: r.quantity != null ? Number(r.quantity) : undefined,
  };
}

function mapDebtPayment(r: any): DebtPayment {
  return {
    id: r.id,
    debtId: r.debt_id,
    date: r.date,
    amount: Number(r.amount),
    remainingAfter: Number(r.remaining_after),
    note: r.note ?? undefined,
  };
}

function mapDebtHistory(r: any): DebtHistoryOperation {
  return {
    id: r.id,
    date: r.date,
    debtId: r.debt_id,
    personName: r.person_name,
    phone: r.phone || '',
    email: r.email ?? undefined,
    type: r.type,
    initialAmount: r.initial_amount != null ? Number(r.initial_amount) : 0,
    paymentAmount: r.payment_amount != null ? Number(r.payment_amount) : 0,
    totalPaid: r.total_paid != null ? Number(r.total_paid) : 0,
    remainingAmount: r.remaining_amount != null ? Number(r.remaining_amount) : 0,
    status: r.status,
    productName: r.product_name ?? undefined,
    quantity: r.quantity != null ? Number(r.quantity) : undefined,
  };
}

function mapStockMovement(r: any): StockMovement {
  return {
    id: r.id,
    productId: r.product_id ?? undefined,
    productName: r.product_name,
    type: r.type ?? r.movement_type,
    quantity: r.quantity != null ? Number(r.quantity) : 0,
    reference: r.reference ?? undefined,
    note: r.note ?? undefined,
    date: r.date,
    createdAt: r.created_at_ts ?? '',
  };
}

function mapReport(r: any): Report {
  return {
    id: r.id,
    reportType: r.report_type,
    title: r.title,
    periodLabel: r.period_label ?? '',
    metrics: r.metrics ?? '',
    description: r.description ?? undefined,
    createdAt: r.created_at_ts ?? '',
  };
}

function mapGoalRecord(r: any): GoalRecord {
  return {
    id: r.id,
    metric: r.metric,
    title: r.title,
    category: r.category ?? '',
    target: Number(r.target),
    unit: r.unit ?? undefined,
    period: r.period ?? 'mois',
    sortOrder: r.sort_order != null ? Number(r.sort_order) : 0,
    createdAt: r.created_at_ts ?? '',
  };
}

const DEFAULT_GOALS: GoalTargets = {
  monthlySalesTarget: 10000,
  monthlyProfitTarget: 4000,
  monthlyPiecesTarget: 200,
  monthlyExpenseCeiling: 1500,
  dailySalesTarget: 1000,
};

// Libellés par défaut déjà stockés en base (FR) : re-traduits à l'affichage
// tant que le commerçant n'a pas renommé l'objectif ou sa catégorie.
const STORED_GOAL_LABELS: Record<string, [string, string]> = {
  'Objectif de Ventes Mensuel': ['Objectif de Ventes Mensuel', 'Monthly Sales Target'],
  'Objectif de Bénéfice Net': ['Objectif de Bénéfice Net', 'Net Profit Target'],
  'Volume de Pièces Vendues': ['Volume de Pièces Vendues', 'Units Sold Volume'],
  'Plafond des Dépenses Récurrentes': ['Plafond des Dépenses Récurrentes', 'Recurring Expenses Ceiling'],
  "Chiffre d'affaires": ["Chiffre d'affaires", 'Revenue'],
  'Rentabilité': ['Rentabilité', 'Profitability'],
  'Volume de Stock': ['Volume de Stock', 'Stock Volume'],
  'Contrôle des Coûts': ['Contrôle des Coûts', 'Cost Control'],
};

export function CommerceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Profil boutique résolu côté serveur : devise/nom corrects dès le premier rendu
  const { initialStoreProfile } = useInitialData();
  // Plan actif (abonnement) — pilotent l'historique 7 jours ci-dessous
  const { planId } = useBilling();

  // 1. État Date Globale Active
  const [selectedDate, setSelectedDate] = useState<string | null>('today');

  // 2. Ensembles de Données Métier Locaux (initialisés vides, remplis par Supabase)
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  // Historique des dépenses selon l'abonnement : fenêtre glissante
  // (7 jours en Essential, illimité sinon). Décision centrale — réévaluée
  // dès que le plan actif change (upgrade → historique complet réapparaît).
  const expenses = useMemo(() => {
    if (planId === null) return allExpenses; // abonnement pas encore résolu
    return allExpenses.filter((e) => isWithinHistory(planId, 'expense', e.createdAt));
  }, [allExpenses, planId]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtOperations, setDebtOperations] = useState<DebtHistoryOperation[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [goalRecords, setGoalRecords] = useState<GoalRecord[]>([]);

  // Compteurs d'abonnement (limite / utilisé / reste / %) — recalculés à
  // chaque changement de données, bornés par le plan actif.
  const usageCounts = useMemo(
    () => buildUsageCounts({ sales, products, customers, debts }),
    [sales, products, customers, debts]
  );
  const usage = useMemo(
    () => (planId === null ? null : getAllUsage(planId, usageCounts)),
    [planId, usageCounts]
  );

  const [storeProfile, setStoreProfile] = useState<StoreBusinessProfile>(
    initialStoreProfile ?? {
      storeName: 'Ma Boutique',
      phone: '',
      email: '',
      address: '',
      category: 'Général',
      currency: 'USD',
      country: '',
    }
  );
  const [goalTargets, setGoalTargets] = useState<GoalTargets>(DEFAULT_GOALS);

  const { t, locale } = useI18n();

  // ── Gates d'abonnement AVANT mutation (messages centralisés) ──────
  // Retour `null` = autorisé, ou abonnement pas encore résolu (le déclencheur
  // SQL serveur reste le juge de paix quel que soit le cas).
  const guardResource = (resource: ResourceKey): string | null => {
    if (planId === null) return null;
    const check = checkCanCreate(planId, resource, usageCounts);
    if (check.ok) return null;
    return formatMessage(
      limitReachedMessage({
        planId: check.planId,
        resource: check.resource,
        used: check.used,
        limit: check.limit,
      }),
      locale
    );
  };

  const guardFeature = (feature: FeatureKey): string | null => {
    if (planId === null) return null;
    if (isFeatureUnlocked(planId, feature)) return null;
    return formatMessage(featureLockedMessage(planId, feature), locale);
  };

  const checkCreate = useCallback(
    (resource: ResourceKey): CreateCheck | null =>
      planId === null ? null : checkCanCreate(planId, resource, usageCounts),
    [planId, usageCounts]
  );

  const [isLoading, setIsLoading] = useState(true);

  // 3. Modale de confirmation globale
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: t('Confirmation de suppression', 'Confirm deletion'),
    message: '',
    onConfirm: () => {},
  });

  const requestConfirmation = ({
    title = t('Confirmation de suppression', 'Confirm deletion'),
    message,
    onConfirm,
  }: {
    title?: string;
    message: string;
    onConfirm: () => void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ============================================
  // CHARGEMENT INITIAL DES DONNÉES DEPUIS SUPABASE
  // ============================================
  const loadAllData = useCallback(async () => {
    if (!user) {
      // Pas d'utilisateur : on vide tout
      setProducts([]);
      setSales([]);
      setCustomers([]);
      setAllExpenses([]);
      setDebts([]);
      setDebtOperations([]);
      setStockMovements([]);
      setReports([]);
      setGoalRecords([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [prodRes, custRes, saleRes, itemRes, expRes, debtRes, payRes, histRes, storeRes, goalRes, movRes, repRes, gRecRes] =
        await Promise.all([
          supabase.from('products').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('customers').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('sales').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('sale_items').select('*'),
          supabase.from('expenses').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('debts').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('debt_payments').select('*'),
          supabase.from('debt_history').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('store_profiles').select('*').maybeSingle(),
          supabase.from('goal_targets').select('*').maybeSingle(),
          supabase.from('stock_movements').select('*').order('created_at_ts', { ascending: false }),
          supabase.from('reports').select('*').order('created_at_ts', { ascending: false }),
          supabase
            .from('goals')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at_ts', { ascending: true }),
        ]);

      // Produits
      setProducts(prodRes.data ? prodRes.data.map(mapProduct) : []);

      // Clients
      setCustomers(
        custRes.data
          ? custRes.data.map((c: any) => {
              const mapped = mapCustomer(c);
              return {
                ...mapped,
                lastPurchaseDate:
                  !mapped.lastPurchaseDate || mapped.lastPurchaseDate === 'Nouveau client'
                    ? t('Nouveau client', 'New customer')
                    : mapped.lastPurchaseDate,
              };
            })
          : []
      );

      // Ventes + lignes de vente
      const itemsBySale = new Map<string, SaleItem[]>();
      (itemRes.data || []).forEach((it: any) => {
        const arr = itemsBySale.get(it.sale_id) || [];
        arr.push({
          productId: it.product_id ?? undefined,
          productName: it.product_name,
          quantity: it.quantity,
          unitPrice: Number(it.unit_price),
          purchasePrice: it.purchase_price != null ? Number(it.purchase_price) : undefined,
          total: Number(it.total),
        });
        itemsBySale.set(it.sale_id, arr);
      });
      setSales(
        saleRes.data
          ? saleRes.data.map((s: any) => mapSale(s, itemsBySale.get(s.id) || []))
          : []
      );

      // Dépenses
      setAllExpenses(expRes.data ? expRes.data.map(mapExpense) : []);

      // Dettes + paiements
      const paysByDebt = new Map<string, DebtPayment[]>();
      (payRes.data || []).forEach((p: any) => {
        const arr = paysByDebt.get(p.debt_id) || [];
        arr.push(mapDebtPayment(p));
        paysByDebt.set(p.debt_id, arr);
      });
      setDebts(debtRes.data ? debtRes.data.map((d: any) => mapDebt(d, paysByDebt.get(d.id) || [])) : []);

      // Historique dettes
      setDebtOperations(histRes.data ? histRes.data.map(mapDebtHistory) : []);

      // Historique du stock
      setStockMovements(movRes.data ? movRes.data.map(mapStockMovement) : []);

      // Rapports enregistrés
      setReports(repRes.data ? repRes.data.map(mapReport) : []);

      // Objectifs enregistrés (modifiables / supprimables)
      setGoalRecords(gRecRes.data ? gRecRes.data.map(mapGoalRecord) : []);

      // Profil boutique
      if (storeRes.data) {
        setStoreProfile({
          storeName: storeRes.data.store_name,
          phone: storeRes.data.phone || '',
          email: storeRes.data.email || '',
          address: storeRes.data.address || '',
          category: storeRes.data.category || 'Général',
          currency: storeRes.data.currency || 'USD',
          country: storeRes.data.country || '',
        });
      }

      // Objectifs
      if (goalRes.data) {
        setGoalTargets({
          monthlySalesTarget: Number(goalRes.data.monthly_sales_target),
          monthlyProfitTarget: Number(goalRes.data.monthly_profit_target),
          monthlyPiecesTarget: goalRes.data.monthly_pieces_target,
          monthlyExpenseCeiling: Number(goalRes.data.monthly_expense_ceiling),
          dailySalesTarget: Number(goalRes.data.daily_sales_target),
        });
      }
    } catch (e) {
      console.error('Erreur de chargement des données:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Profil utilisateur dérivé de Supabase Auth (lecture seule)
  const userProfile: ProtectedUserProfile = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as any;
    const email = user?.email ?? '';
    return {
      firstName: meta.first_name || email.split('@')[0] || t('Utilisateur', 'User'),
      lastName: meta.last_name || '',
      email,
      role: t('Propriétaire & Administrateur', 'Owner & Administrator'),
    };
  }, [user, t]);

  // Formatage monétaire aligné sur la devise du commerce
  const formatAmount = useCallback(
    (amount: number) => formatMoney(amount, storeProfile.currency),
    [storeProfile.currency]
  );

  // Helper date matching lié au contexte
  const checkDateMatch = (itemDate: string): boolean => {
    return isDateMatching(itemDate, selectedDate);
  };

  const displayDateText = useMemo(() => {
    return getDisplayDateLabel(selectedDate, locale);
  }, [selectedDate, locale]);

  // ==========================================
  // 4. DONNÉES FILTRÉES SELON LA DATE ACTIVE
  // ==========================================
  const filteredSales = useMemo(() => {
    return sales.filter((s) => checkDateMatch(s.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, selectedDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => checkDateMatch(e.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, selectedDate]);

  const filteredDebts = useMemo(() => {
    if (!selectedDate || selectedDate === 'today') return debts;
    return debts.filter(
      (d) =>
        checkDateMatch(d.date) ||
        (d.lastPaymentDate && checkDateMatch(d.lastPaymentDate)) ||
        d.payments.some((p) => checkDateMatch(p.date))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, selectedDate]);

  const filteredDebtOperations = useMemo(() => {
    return debtOperations.filter((op) => checkDateMatch(op.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtOperations, selectedDate]);

  const filteredStockMovements = useMemo(() => {
    return stockMovements.filter((m) => checkDateMatch(m.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockMovements, selectedDate]);

  // ==========================================
  // 5. CALCULS MÉTIER EN TEMPS RÉEL
  // ==========================================
  // Helper COGS : retrouve le coût d'achat d'un article de vente
  const computeItemCost = useCallback(
    (item: SaleItem): number => {
      const prod = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.toLowerCase() === item.productName.toLowerCase()
      );
      return prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
    },
    [products]
  );

  const todaySalesTotal = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [filteredSales]);

  const todaySalesCount = useMemo(() => {
    return filteredSales.length;
  }, [filteredSales]);

  const todayExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  const todayCOGS = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => acc + sale.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0),
      0
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSales, products]);

  const todayGrossProfitTotal = todaySalesTotal - todayCOGS;
  const todayProfitTotal = Math.max(0, todayGrossProfitTotal - todayExpensesTotal);

  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + p.quantity * p.purchasePrice, 0);
  }, [products]);

  const totalStockCount = useMemo(() => {
    return products.reduce((acc, p) => acc + p.quantity, 0);
  }, [products]);

  const activeDebts = useMemo(() => {
    return debts.filter((d) => d.remainingAmount > 0 && d.status !== 'payee');
  }, [debts]);

  const activeDebtsCount = activeDebts.length;

  const totalDebtRemaining = useMemo(() => {
    return activeDebts.reduce((acc, d) => acc + d.remainingAmount, 0);
  }, [activeDebts]);

  const totalDebtRecovered = useMemo(() => {
    return debts.reduce((acc, d) => acc + d.paidAmount, 0);
  }, [debts]);

  const totalDebtInitial = useMemo(() => {
    return debts.reduce((acc, d) => acc + d.initialAmount, 0);
  }, [debts]);

  const debtRecoveryRate =
    totalDebtInitial > 0 ? Math.round((totalDebtRecovered / totalDebtInitial) * 100) : 0;

  // ==========================================
  // 6. OBJECTIFS DYNAMIQUES (mois en cours)
  // ==========================================
  const monthlySalesTotal = useMemo(() => {
    return sales.filter((s) => isWithinPeriodRange(s.date, 'mois')).reduce((acc, s) => acc + s.totalAmount, 0);
  }, [sales]);

  const monthlyCOGS = useMemo(() => {
    return sales
      .filter((s) => isWithinPeriodRange(s.date, 'mois'))
      .reduce((acc, sale) => acc + sale.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, products]);

  const monthlyExpensesTotal = useMemo(() => {
    return expenses.filter((e) => isWithinPeriodRange(e.date, 'mois')).reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const monthlyNetProfit = Math.max(0, monthlySalesTotal - monthlyCOGS - monthlyExpensesTotal);

  const monthlyPiecesSold = useMemo(() => {
    return sales
      .filter((s) => isWithinPeriodRange(s.date, 'mois'))
      .reduce((acc, s) => acc + s.items.reduce((iAcc, it) => iAcc + it.quantity, 0), 0);
  }, [sales]);

  const monthLabel = useMemo(() => getCurrentMonthLabel(locale), [locale]);

  const goals: GoalItem[] = useMemo(() => {
    // Valeur ATTEINTE recalculée en direct selon la grandeur et la période
    const computeCurrent = (metric: GoalMetric, period: GoalPeriod): number => {
      if (period === 'mois') {
        // Chemin rapide : agrégats mensuels déjà mémorisés
        if (metric === 'sales') return monthlySalesTotal;
        if (metric === 'profit') return monthlyNetProfit;
        if (metric === 'pieces') return monthlyPiecesSold;
        return monthlyExpensesTotal;
      }
      const pSales = sales.filter((s) => isWithinPeriodRange(s.date, period));
      const pExpenses = expenses.filter((e) => isWithinPeriodRange(e.date, period));
      if (metric === 'pieces') {
        return pSales.reduce((acc, s) => acc + s.items.reduce((iAcc, it) => iAcc + it.quantity, 0), 0);
      }
      const totalSalesUSD = pSales.reduce((acc, s) => acc + s.totalAmount, 0);
      const cogsUSD = pSales.reduce(
        (acc, s) => acc + s.items.reduce((iAcc, it) => iAcc + computeItemCost(it) * it.quantity, 0),
        0
      );
      const expensesUSD = pExpenses.reduce((acc, e) => acc + e.amount, 0);
      if (metric === 'sales') return totalSalesUSD;
      if (metric === 'profit') return Math.max(0, totalSalesUSD - cogsUSD - expensesUSD);
      return expensesUSD;
    };

    const periodLabelFor = (p: GoalPeriod) =>
      p === 'mois'
        ? monthLabel
        : p === 'semaine'
          ? t('Cette semaine', 'This week')
          : t('Année {y}', 'Year {y}', { y: new Date().getFullYear() });

    const statusFor = (metric: GoalMetric, current: number, target: number, pct: number) => {
      if (metric === 'expenses') {
        return current <= target
          ? t('Sous le plafond (Optimal)', 'Under the ceiling (Optimal)')
          : t('Dépassement de budget', 'Budget overrun');
      }
      if (metric === 'profit') {
        return pct >= 75
          ? t('Très rentable', 'Very profitable')
          : pct >= 50
            ? t('Performant', 'Performing')
            : t('Marge à surveiller', 'Margin to watch');
      }
      if (metric === 'pieces') return t('{p}% atteint', '{p}% reached', { p: pct });
      return pct >= 80
        ? t('Très performant', 'Highly performant')
        : pct >= 50
          ? t('En bonne voie', 'On track')
          : t('À accélérer', 'Needs boost');
    };

    const tr = (value: string): string => {
      const hit = value ? STORED_GOAL_LABELS[value] : undefined;
      return hit ? t(hit[0], hit[1]) : value;
    };

    return goalRecords.map((rec) => {
      const current = computeCurrent(rec.metric, rec.period);
      const pct = rec.target > 0 ? Math.round((current / rec.target) * 100 * 10) / 10 : 0;
      const isCount = rec.metric === 'pieces';

      return {
        id: rec.id,
        title: tr(rec.title),
        category: tr(rec.category),
        targetUSD: rec.target,
        currentUSD: current,
        percentage: pct, // non plafonné : l'UI affiche le dépassement réel
        period: periodLabelFor(rec.period),
        isCount,
        unit: isCount ? rec.unit || t('articles', 'items') : undefined,
        status: statusFor(rec.metric, current, rec.target, pct),
        metric: rec.metric,
      };
    });
  }, [
    goalRecords,
    sales,
    expenses,
    computeItemCost,
    monthlySalesTotal,
    monthlyNetProfit,
    monthlyPiecesSold,
    monthlyExpensesTotal,
    monthLabel,
    t,
  ]);

  // ==========================================
  // 7. MOTEUR DE CALCUL PAR PÉRIODE
  // ==========================================
  const getPeriodMetrics = (
    period: '7j' | '30j' | '3m' | '6m' | '12m' | 'semaine' | 'mois' | '3mois' | 'annee' | 'personnalise'
  ): PeriodProfitData => {
    const periodSalesRaw =
      period === 'personnalise' ? filteredSales : sales.filter((s) => isWithinPeriodRange(s.date, period));

    // Historique des bénéfices selon l'abonnement (7 jours en Essential) :
    // la fenêtre s'applique aux lignes analysées, pas aux ventes stockées.
    const periodSales =
      planId === null
        ? periodSalesRaw
        : periodSalesRaw.filter((s) => isWithinHistory(planId, 'profit', s.createdAt));

    const periodExpenses =
      period === 'personnalise' ? filteredExpenses : expenses.filter((e) => isWithinPeriodRange(e.date, period));

    const totalSalesUSD = periodSales.reduce((acc, s) => acc + s.totalAmount, 0);

    const cogsUSD = periodSales.reduce(
      (acc, sale) => acc + sale.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0),
      0
    );

    const grossProfitUSD = totalSalesUSD - cogsUSD;
    const expensesUSD = periodExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfitUSD = Math.max(0, grossProfitUSD - expensesUSD);
    const netMarginPercentage = totalSalesUSD > 0 ? Math.round((netProfitUSD / totalSalesUSD) * 100) : 0;

    // Produits vendus durant la période
    const productMap = new Map<string, ProfitProductStat>();

    periodSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const prod = products.find(
          (p) =>
            (item.productId && p.id === item.productId) ||
            p.name.toLowerCase() === item.productName.toLowerCase()
        );
        const prodName = prod ? prod.name : item.productName;
        const category = prod ? prod.category : t('Général', 'General');
        const purchasePrice = computeItemCost(item);
        const sellingPrice = item.unitPrice;
        const unitProfit = sellingPrice - purchasePrice;
        const itemGrossProfit = unitProfit * item.quantity;

        const existing = productMap.get(prodName);
        if (existing) {
          existing.quantitySold += item.quantity;
          existing.revenueUSD += item.total;
          existing.totalProfitUSD += itemGrossProfit;
          existing.marginPercentage =
            existing.revenueUSD > 0 ? Math.round((existing.totalProfitUSD / existing.revenueUSD) * 100) : 0;
        } else {
          productMap.set(prodName, {
            id: prod ? prod.id : `P-temp-${item.productName}`,
            productName: prodName,
            category,
            purchasePrice,
            sellingPrice,
            unitProfit,
            quantitySold: item.quantity,
            revenueUSD: item.total,
            totalProfitUSD: itemGrossProfit,
            marginPercentage: item.total > 0 ? Math.round((itemGrossProfit / item.total) * 100) : 0,
          });
        }
      });
    });

    const productsSold = Array.from(productMap.values()).sort((a, b) => b.totalProfitUSD - a.totalProfitUSD);

    const topProfitableProducts = productsSold.slice(0, 4).map((p) => ({
      name: p.productName,
      totalProfitUSD: p.totalProfitUSD,
      quantitySold: p.quantitySold,
    }));

    // Graphique d'évolution : 4 derniers jours (dynamique)
    const days = getLastNDaysKeys(4, locale);

    const evolutionChart = days.map((day) => {
      const dSales = sales.filter((s) => isDateMatching(s.date, day.key));
      const dExp = expenses.filter((e) => isDateMatching(e.date, day.key));

      const sTotal = dSales.reduce((a, s) => a + s.totalAmount, 0);
      const eTotal = dExp.reduce((a, e) => a + e.amount, 0);

      const dCOGS = dSales.reduce(
        (acc, sale) => acc + sale.items.reduce((iAcc, item) => iAcc + computeItemCost(item) * item.quantity, 0),
        0
      );

      const net = Math.max(0, sTotal - dCOGS - eTotal);
      const pct =
        sTotal > 0 && totalSalesUSD > 0
          ? Math.min(100, Math.max(15, Math.round((sTotal / totalSalesUSD) * 100)))
          : 0;

      return {
        label: day.label,
        salesUSD: sTotal,
        profitUSD: net,
        percentage: pct,
      };
    });

    const labels: Record<string, string> = {
      '7j': t('7 derniers jours', 'Last 7 days'),
      semaine: t('Cette semaine', 'This week'),
      '30j': t('30 derniers jours', 'Last 30 days'),
      mois: t('Ce mois ({m})', 'This month ({m})', { m: monthLabel }),
      '3m': t('3 derniers mois', 'Last 3 months'),
      '3mois': t('3 derniers mois', 'Last 3 months'),
      '6m': t('6 derniers mois', 'Last 6 months'),
      '12m': t('12 derniers mois', 'Last 12 months'),
      annee: t('Cette année', 'This year'),
      personnalise: displayDateText,
    };

    return {
      periodKey: period,
      periodLabel: labels[period] || period,
      totalSalesUSD,
      cogsUSD,
      grossProfitUSD,
      expensesUSD,
      netProfitUSD,
      netMarginPercentage,
      productsSold,
      topProfitableProducts,
      evolutionChart,
    };
  };

  // ==========================================
  // 8. ACTIONS MÉTIER (Supabase)
  // ==========================================

  // --- VENTES ---
  /**
   * Enregistre un mouvement dans l'historique du stock.
   * Best-effort : une échec d'écriture ne doit jamais casser l'opération
   * métier principale (vente, dette, produit…).
   */
  const recordStockMovement = async (m: {
    productId?: string;
    productName: string;
    type: StockMovementType;
    quantity: number;
    reference?: string;
    note?: string;
    date: string;
  }) => {
    if (!user || !m.productName || !m.quantity) return;
    const { error } = await supabase.from('stock_movements').insert({
      user_id: user.id,
      product_id: m.productId ?? null,
      product_name: m.productName,
      movement_type: m.type,
      quantity: m.quantity,
      reference: m.reference ?? null,
      note: m.note ?? null,
      date: m.date,
    });
    if (error) console.warn('[stock_movements]', error.message);
  };

  const addSale = async (
    saleData: Omit<Sale, 'id' | 'code' | 'status'> & { id?: string; code?: string }
  ): Promise<SaleOperationResult> => {
    // Garde abonnement : ventes du mois, puis client si la vente en crée un
    // (même ordre que `process_sale` côté serveur : vente → customer).
    const blockedSale = guardResource('sale');
    if (blockedSale) return { success: false, error: blockedSale };
    if (!saleData.customerId && saleData.client.name?.trim()) {
      const nameExists = customers.some(
        (c) => c.name.trim().toLowerCase() === saleData.client.name.trim().toLowerCase()
      );
      if (!nameExists) {
        const blockedCustomer = guardResource('customer');
        if (blockedCustomer) return { success: false, error: blockedCustomer };
      }
    }

    // Validation stock côté client (feedback immédiat)
    for (const item of saleData.items) {
      const prod = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.toLowerCase() === item.productName.toLowerCase()
      );

      if (!prod) {
        return {
          success: false,
          error: t(`Le produit "{n}" n'existe pas dans le catalogue.`, 'The product "{n}" does not exist in the catalogue.', { n: item.productName }),
        };
      }
      if (item.quantity > prod.quantity) {
        return {
          success: false,
          error: t(
            'Stock insuffisant pour "{n}". Quantité disponible : {a} (demandée : {b}).',
            'Insufficient stock for "{n}". Available quantity: {a} (requested: {b}).',
            { n: prod.name, a: prod.quantity, b: item.quantity }
          ),
        };
      }
    }

    // Calculs de rentabilité et enrichissement des items
    let saleGrossProfit = 0;
    const enrichedItems = saleData.items.map((item) => {
      const prod = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.toLowerCase() === item.productName.toLowerCase()
      );
      const purchasePrice = prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
      saleGrossProfit += (item.unitPrice - purchasePrice) * item.quantity;

      return {
        ...item,
        productId: prod ? prod.id : item.productId,
        productName: prod ? prod.name : item.productName,
        purchasePrice,
        total: item.quantity * item.unitPrice,
      };
    });

    const calculatedTotal = enrichedItems.reduce((acc, it) => acc + it.total, 0);
    const code = saleData.code || `VNT-${Date.now().toString().slice(-8)}`;

    // Appel transactionnel atomique côté base
    const { data, error } = await supabase.rpc('process_sale', {
      p_code: code,
      p_date: saleData.date,
      p_customer_id: saleData.customerId ?? null,
      p_client_name: saleData.client.name,
      p_client_phone: saleData.client.phone ?? null,
      p_client_avatar: saleData.client.avatar ?? null,
      p_payment_method: saleData.paymentMethod,
      p_items: enrichedItems.map((it) => ({
        product_id: it.productId ?? null,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        purchase_price: it.purchasePrice ?? null,
        total: it.total,
      })),
      p_total_amount: calculatedTotal,
      p_total_profit: saleGrossProfit,
    });

    if (error) {
      return { success: false, error: t(`Erreur d'enregistrement : {e}`, 'Save error: {e}', { e: error.message }) };
    }

    const newSale: Sale = {
      ...saleData,
      id: data?.sale_id || '',
      code,
      items: enrichedItems,
      totalAmount: calculatedTotal,
      totalProfit: saleGrossProfit,
      status: 'validee',
    };

    // Recharger pour refléter stock + client mis à jour par la fonction
    // + journaliser les sorties de stock de cette vente
    for (const it of enrichedItems) {
      await recordStockMovement({
        productId: it.productId,
        productName: it.productName,
        type: 'sortie',
        quantity: it.quantity,
        reference: code,
        note: t('Vente enregistrée', 'Sale recorded'),
        date: saleData.date,
      });
    }
    await loadAllData();

    return { success: true, sale: newSale };
  };

  const updateSale = async (oldSale: Sale, updated: Partial<Sale>): Promise<SaleOperationResult> => {
    const newItems = updated.items || oldSale.items;

    // Validation : simuler la restitution de l'ancien stock
    const restoredProducts = products.map((prod) => {
      const oldItem = oldSale.items.find(
        (it) => it.productId === prod.id || it.productName.toLowerCase() === prod.name.toLowerCase()
      );
      if (!oldItem) return prod;
      return { ...prod, quantity: prod.quantity + oldItem.quantity };
    });

    for (const item of newItems) {
      const prod = restoredProducts.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          p.name.toLowerCase() === item.productName.toLowerCase()
      );

      if (!prod) {
        return {
          success: false,
          error: t(`Le produit "{n}" n'existe pas dans le stock.`, 'The product "{n}" does not exist in the stock.', { n: item.productName }),
        };
      }
      if (item.quantity > prod.quantity) {
        return {
          success: false,
          error: t(
            'Stock insuffisant pour "{n}". Stock disponible après restitution : {a} (demandée : {b}).',
            'Insufficient stock for "{n}". Stock available after return: {a} (requested: {b}).',
            { n: prod.name, a: prod.quantity, b: item.quantity }
          ),
        };
      }
    }

    // Appliquer le nouveau stock
    const finalProducts = restoredProducts.map((prod) => {
      const newItem = newItems.find(
        (it) => it.productId === prod.id || it.productName.toLowerCase() === prod.name.toLowerCase()
      );
      if (!newItem) return prod;

      const finalQty = Math.max(0, prod.quantity - newItem.quantity);
      let newStatus: Product['status'] = 'en_stock';
      if (finalQty <= 0) newStatus = 'rupture';
      else if (finalQty <= prod.minThreshold) newStatus = 'stock_faible';

      return { ...prod, quantity: finalQty, status: newStatus };
    });

    const newTotal = newItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
    const amountDifference = newTotal - oldSale.totalAmount;

    // Nouveau bénéfice
    let newProfit = 0;
    newItems.forEach((item) => {
      const prod = finalProducts.find(
        (p) => (item.productId && p.id === item.productId) || p.name.toLowerCase() === p.name.toLowerCase()
      );
      const purchasePrice = prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
      newProfit += (item.unitPrice - purchasePrice) * item.quantity;
    });

    // 1. Mettre à jour la vente + ses items
    const { error: saleErr } = await supabase
      .from('sales')
      .update({
        date: updated.date ?? oldSale.date,
        client_name: updated.client?.name ?? oldSale.client.name,
        client_phone: updated.client?.phone ?? oldSale.client.phone,
        payment_method: updated.paymentMethod ?? oldSale.paymentMethod,
        total_amount: newTotal,
        total_profit: newProfit,
      })
      .eq('id', oldSale.id);

    if (saleErr) return { success: false, error: saleErr.message };

    // 2. Remplacer les items
    await supabase.from('sale_items').delete().eq('sale_id', oldSale.id);
    const { error: itemsErr } = await supabase.from('sale_items').insert(
      newItems.map((it) => ({
        sale_id: oldSale.id,
        product_id: it.productId ?? null,
        product_name: it.productName,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        purchase_price: it.purchasePrice ?? null,
        total: it.quantity * it.unitPrice,
      }))
    );
    if (itemsErr) return { success: false, error: itemsErr.message };

    // 3. Appliquer le nouveau stock en base
    for (const prod of finalProducts) {
      const before = products.find((p) => p.id === prod.id);
      if (before && (before.quantity !== prod.quantity || before.status !== prod.status || before.totalSalesCount !== prod.totalSalesCount)) {
        await supabase
          .from('products')
          .update({ quantity: prod.quantity, status: prod.status })
          .eq('id', prod.id);
      }
    }

    // 4. Ajuster le total dépensé du client
    if (amountDifference !== 0) {
      const custId = updated.customerId ?? oldSale.customerId;
      if (custId) {
        const cust = customers.find((c) => c.id === custId);
        if (cust) {
          await supabase
            .from('customers')
            .update({ total_spent: Math.max(0, cust.totalSpent + amountDifference) })
            .eq('id', custId);
        }
      }
    }

    // 5. Journaliser la variation nette de stock (anciens items → nouveaux items)
    const deltaByKey = new Map<string, { name: string; productId?: string; delta: number }>();
    const bump = (it: { productId?: string; productName: string; quantity: number }, sign: number) => {
      const key = it.productId || it.productName.toLowerCase();
      const entry = deltaByKey.get(key) ?? { name: it.productName, productId: it.productId, delta: 0 };
      entry.delta += sign * it.quantity;
      deltaByKey.set(key, entry);
    };
    oldSale.items.forEach((it) => bump(it, -1));
    newItems.forEach((it) => bump(it, +1));
    const movementPromises: Promise<void>[] = [];
    deltaByKey.forEach((entry) => {
      if (entry.delta === 0) return;
      movementPromises.push(
        recordStockMovement({
          productId: entry.productId,
          productName: entry.name,
          type: entry.delta > 0 ? 'sortie' : 'annulation',
          quantity: Math.abs(entry.delta),
          reference: oldSale.code,
          note:
            entry.delta > 0
              ? t('Vente modifiée', 'Sale edited')
              : t('Vente modifiée — stock restitué', 'Sale edited — stock restored'),
          date: updated.date ?? oldSale.date,
        })
      );
    });
    await Promise.all(movementPromises);

    await loadAllData();
    return { success: true };
  };

  const deleteSale = async (saleId: string) => {
    const sale = sales.find((s) => s.id === saleId);
    await supabase.rpc('delete_sale_data', { p_sale_id: saleId });

    // Le stock est restitué par le RPC : on le journalise
    if (sale) {
      for (const item of sale.items) {
        await recordStockMovement({
          productId: item.productId,
          productName: item.productName,
          type: 'annulation',
          quantity: item.quantity,
          reference: sale.code,
          note: t('Vente supprimée — stock restitué', 'Sale deleted — stock restored'),
          date: sale.date,
        });
      }
    }
    await loadAllData();
  };

  // --- PRODUITS ---
  const addProduct = async (
    prodData: Omit<Product, 'id' | 'status' | 'totalSalesCount'> & { id?: string }
  ): Promise<MutationResult> => {
    if (!user) return { success: false };
    // Garde abonnement : limite de produits du plan actif
    const blocked = guardResource('product');
    if (blocked) return { success: false, error: blocked };
    let status: Product['status'] = 'en_stock';
    if (prodData.quantity <= 0) status = 'rupture';
    else if (prodData.quantity <= prodData.minThreshold) status = 'stock_faible';

    const { data: inserted, error: insErr } = await supabase
      .from('products')
      .insert({
        user_id: user.id,
        name: prodData.name,
        category: prodData.category,
        quantity: prodData.quantity,
        min_threshold: prodData.minThreshold,
        selling_price: prodData.sellingPrice,
        purchase_price: prodData.purchasePrice,
        description: prodData.description ?? null,
        created_at: prodData.createdAt || REFERENCE_TODAY_KEY,
        status,
        total_sales_count: 0,
      })
      .select('id')
      .maybeSingle();

    if (insErr) {
      // Filet serveur : déclencheur SQL (limite) — message FR centralisé
      return { success: false, error: insErr.message };
    }

    // Journalise la création du produit dans l'historique du stock
    await recordStockMovement({
      productId: inserted?.id,
      productName: prodData.name,
      type: 'creation',
      quantity: prodData.quantity,
      note: t('Produit ajouté au catalogue', 'Product added to catalogue'),
      date: prodData.createdAt || REFERENCE_TODAY_KEY,
    });

    await loadAllData();
    return { success: true };
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    const current = products.find((p) => p.id === id);
    if (!current) return;

    const merged = { ...current, ...updated };
    let status: Product['status'] = 'en_stock';
    if (merged.quantity <= 0) status = 'rupture';
    else if (merged.quantity <= merged.minThreshold) status = 'stock_faible';

    await supabase
      .from('products')
      .update({
        name: merged.name,
        category: merged.category,
        quantity: merged.quantity,
        min_threshold: merged.minThreshold,
        selling_price: merged.sellingPrice,
        purchase_price: merged.purchasePrice,
        description: merged.description ?? null,
        status,
      })
      .eq('id', id);

    // Journalise la variation de stock (réappro ou ajustement manuel)
    const delta = merged.quantity - current.quantity;
    if (delta !== 0) {
      await recordStockMovement({
        productId: id,
        productName: current.name,
        type: delta > 0 ? 'entree' : 'sortie',
        quantity: Math.abs(delta),
        note:
          delta > 0
            ? t('Réapprovisionnement', 'Restock')
            : t('Ajustement manuel du stock', 'Manual stock adjustment'),
        date: REFERENCE_TODAY_KEY,
      });
    }

    await loadAllData();
  };

  const deleteProduct = async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    await loadAllData();
  };

  // --- CLIENTS ---
  const addCustomer = async (
    custData: Omit<Customer, 'id' | 'purchasesCount' | 'totalSpent' | 'lastPurchaseDate' | 'avatar'> & {
      id?: string;
      avatar?: string;
    }
  ): Promise<MutationResult> => {
    if (!user) return { success: false };
    // Garde abonnement : limite de clients du plan actif
    const blocked = guardResource('customer');
    if (blocked) return { success: false, error: blocked };
    const { error: insErr } = await supabase.from('customers').insert({
      user_id: user.id,
      name: custData.name,
      phone: custData.phone,
      email: custData.email ?? null,
      purchases_count: 0,
      total_spent: 0,
      last_purchase_date: 'Nouveau client',
      avatar: custData.avatar || DEFAULT_AVATAR,
    });
    // Filet serveur : déclencheur SQL (limite) — message FR centralisé
    if (insErr) return { success: false, error: insErr.message };
    await loadAllData();
    return { success: true };
  };

  const updateCustomer = async (id: string, updated: Partial<Customer>) => {
    const payload: any = {};
    if (updated.name !== undefined) payload.name = updated.name;
    if (updated.phone !== undefined) payload.phone = updated.phone;
    if (updated.email !== undefined) payload.email = updated.email;
    if (updated.avatar !== undefined) payload.avatar = updated.avatar;
    if (updated.purchasesCount !== undefined) payload.purchases_count = updated.purchasesCount;
    if (updated.totalSpent !== undefined) payload.total_spent = updated.totalSpent;
    if (updated.lastPurchaseDate !== undefined) payload.last_purchase_date = updated.lastPurchaseDate;

    await supabase.from('customers').update(payload).eq('id', id);
    await loadAllData();
  };

  const deleteCustomer = async (customerId: string) => {
    await supabase.from('customers').delete().eq('id', customerId);
    await loadAllData();
  };

  // --- DÉPENSES ---
  const addExpense = async (expenseData: Omit<Expense, 'id'> & { id?: string }) => {
    if (!user) return;
    await supabase.from('expenses').insert({
      user_id: user.id,
      date: expenseData.date,
      category: expenseData.category,
      description: expenseData.description,
      amount: expenseData.amount,
    });
    await loadAllData();
  };

  const deleteExpense = async (expenseId: string) => {
    await supabase.from('expenses').delete().eq('id', expenseId);
    await loadAllData();
  };

  // --- RAPPORTS ---
  const addReport = async (reportData: {
    reportType: ReportType;
    title: string;
    periodLabel: string;
    metrics: string;
    description?: string;
  }) => {
    if (!user) return;
    await supabase.from('reports').insert({
      user_id: user.id,
      report_type: reportData.reportType,
      title: reportData.title,
      period_label: reportData.periodLabel,
      metrics: reportData.metrics,
      description: reportData.description ?? null,
    });
    await loadAllData();
  };

  const deleteReport = async (reportId: string) => {
    await supabase.from('reports').delete().eq('id', reportId);
    await loadAllData();
  };

  // --- OBJECTIFS ---
  const addGoal = async (goalData: {
    metric: GoalMetric;
    title: string;
    category: string;
    target: number;
    unit?: string;
    period: GoalPeriod;
  }): Promise<MutationResult> => {
    if (!user) return { success: false };
    // Garde abonnement : Objectifs verrouillés hors Pro/Max
    const blocked = guardFeature('goals');
    if (blocked) return { success: false, error: blocked };
    const { error: insErr } = await supabase.from('goals').insert({
      user_id: user.id,
      metric: goalData.metric,
      title: goalData.title,
      category: goalData.category,
      target: goalData.target,
      unit: goalData.unit ?? null,
      period: goalData.period,
      sort_order: goalRecords.length,
    });
    // Filet serveur : déclencheur SQL (fonctionnalité verrouillée)
    if (insErr) return { success: false, error: insErr.message };
    await loadAllData();
    return { success: true };
  };

  const updateGoal = async (
    goalId: string,
    updated: {
      metric: GoalMetric;
      title: string;
      category: string;
      target: number;
      unit?: string;
      period: GoalPeriod;
    }
  ): Promise<MutationResult> => {
    // Garde abonnement : UPDATE bloqué aussi hors Pro/Max (miroir serveur)
    const blocked = guardFeature('goals');
    if (blocked) return { success: false, error: blocked };
    const { error: updErr } = await supabase
      .from('goals')
      .update({
        metric: updated.metric,
        title: updated.title,
        category: updated.category,
        target: updated.target,
        unit: updated.unit ?? null,
        period: updated.period,
      })
      .eq('id', goalId);
    // Filet serveur : déclencheur SQL (fonctionnalité verrouillée)
    if (updErr) return { success: false, error: updErr.message };
    await loadAllData();
    return { success: true };
  };

  const deleteGoal = async (goalId: string) => {
    await supabase.from('goals').delete().eq('id', goalId);
    await loadAllData();
  };

  // --- DETTES ---
  // Enregistre la dette ET crée automatiquement la vente liée (produit endetté,
  // ligne de vente, décrément du stock, client) — tout dans un seul RPC atomique.
  const addDebt = async (
    debtData: Omit<Debt, 'id' | 'paidAmount' | 'remainingAmount' | 'status' | 'payments'> & { id?: string }
  ): Promise<MutationResult> => {
    // Garde abonnement : dettes actives → vente liée → client si nouveau
    // (même ordre que `create_debt_with_history` côté serveur).
    const blockedDebt = guardResource('debt');
    if (blockedDebt) return { success: false, error: blockedDebt };
    const blockedSale = guardResource('sale');
    if (blockedSale) return { success: false, error: blockedSale };
    if (debtData.personName?.trim()) {
      const nameExists = customers.some(
        (c) => c.name.trim().toLowerCase() === debtData.personName.trim().toLowerCase()
      );
      if (!nameExists) {
        const blockedCustomer = guardResource('customer');
        if (blockedCustomer) return { success: false, error: blockedCustomer };
      }
    }

    const code = `VNT-${Date.now().toString().slice(-8)}`;
    const { data, error } = await supabase.rpc('create_debt_with_history', {
      p_person_name: debtData.personName,
      p_phone: debtData.phone,
      p_email: debtData.email ?? null,
      p_initial_amount: debtData.initialAmount,
      p_date: debtData.date,
      p_product_id: debtData.productId ?? null,
      p_product_name: debtData.productName ?? t('Vente à crédit', 'Credit sale'),
      p_quantity: debtData.quantity ?? 1,
      p_code: code,
    });

    if (error) return { success: false, error: error.message };
    if (data && data.success === false) {
      return { success: false, error: data.error || "Échec de l'enregistrement de la dette" };
    }

    // La vente liée consomme du stock : journalise la sortie
    const debtProductName = debtData.productName || t('Vente à crédit', 'Credit sale');
    await recordStockMovement({
      productId: debtData.productId,
      productName: debtProductName,
      type: 'sortie',
      quantity: debtData.quantity ?? 1,
      reference: code,
      note: t('Vente liée à une dette', 'Sale linked to a debt'),
      date: debtData.date,
    });

    await loadAllData();
    return { success: true };
  };

  const recordDebtPayment = async (
    debtId: string,
    amount: number,
    note?: string,
    paymentDate: string = "Aujourd'hui, 14:00"
  ) => {
    await supabase.rpc('record_debt_payment_rpc', {
      p_debt_id: debtId,
      p_amount: amount,
      p_note: note ?? null,
      p_date: paymentDate,
    });
    await loadAllData();
  };

  const deleteDebt = async (debtId: string) => {
    // Vente automatique liée : restaure stock + client via le RPC dédié,
    // puis suppression de la dette (paiements + historique en cascade).
    const debt = debts.find((d) => d.id === debtId);
    const { data: linked } = await supabase.from('sales').select('id').eq('debt_id', debtId).maybeSingle();
    if (linked?.id) {
      await supabase.rpc('delete_sale_data', { p_sale_id: linked.id });

      // Le stock est restitué : journalise l'annulation
      if (debt && (debt.productId || debt.productName)) {
        await recordStockMovement({
          productId: debt.productId,
          productName: debt.productName || t('Vente à crédit', 'Credit sale'),
          type: 'annulation',
          quantity: debt.quantity ?? 1,
          note: t('Dette supprimée — stock restitué', 'Debt deleted — stock restored'),
          date: debt.date,
        });
      }
    }
    await supabase.from('debts').delete().eq('id', debtId);
    await loadAllData();
  };

  // --- PROFIL BOUTIQUE ---
  const updateStoreProfile = async (updated: Partial<StoreBusinessProfile>) => {
    const merged = { ...storeProfile, ...updated };
    if (!user) return;

    await supabase
      .from('store_profiles')
      .upsert(
        {
          user_id: user.id,
          store_name: merged.storeName,
          phone: merged.phone,
          email: merged.email,
          address: merged.address,
          category: merged.category,
          currency: merged.currency,
          country: merged.country,
        },
        { onConflict: 'user_id' }
      );
    setStoreProfile(merged);
  };

  return (
    <CommerceContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        displayDateText,
        isDateMatching: checkDateMatch,

        products,
        sales,
        customers,
        expenses,
        debts,
        debtOperations,
        stockMovements,
        reports,
        userProfile,
        storeProfile,
        goalTargets,
        goalRecords,

        filteredSales,
        filteredExpenses,
        filteredDebts,
        filteredDebtOperations,
        filteredStockMovements,

        todaySalesTotal,
        todaySalesCount,
        todayExpensesTotal,
        todayGrossProfitTotal,
        todayProfitTotal,
        totalStockValue,
        totalStockCount,
        activeDebtsCount,
        totalDebtRemaining,
        totalDebtRecovered,
        totalDebtInitial,
        debtRecoveryRate,

        goals,
        getPeriodMetrics,
        usage,
        checkCreate,

        addSale,
        updateSale,
        deleteSale,

        addProduct,
        updateProduct,
        deleteProduct,

        addCustomer,
        updateCustomer,
        deleteCustomer,

        addExpense,
        deleteExpense,

        addReport,
        deleteReport,

        addDebt,
        recordDebtPayment,
        deleteDebt,

        updateStoreProfile,
        addGoal,
        updateGoal,
        deleteGoal,
        formatAmount,

        requestConfirmation,
        isLoading,
      }}
    >
      {children}

      {/* Modale globale de confirmation */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </CommerceContext.Provider>
  );
}

export function useCommerce() {
  const context = useContext(CommerceContext);
  if (!context) {
    throw new Error('useCommerce must be used within a CommerceProvider');
  }
  return context;
}
