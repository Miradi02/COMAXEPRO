export type PaymentMethod = 'especes' | 'mobile_money' | 'carte';

export interface SaleItem {
  productId?: string; // ID unique du produit (ex: P-001)
  productName: string;
  quantity: number;
  unitPrice: number;
  purchasePrice?: number; // Coût d'achat unitaire pour calcul exact de rentabilité
  total: number;
}

export interface Sale {
  id: string; // ID unique (ex: V-001)
  code: string; // Code lisible (ex: VNT-2026-089)
  date: string; // Date ISO ou formattée
  /** Horodatage ISO réel (created_at_ts) — base des fenêtres d'historique */
  createdAt?: string;
  customerId?: string; // ID unique du client (ex: C-001)
  client: {
    id?: string;
    name: string;
    phone: string;
    avatar?: string;
  };
  items: SaleItem[];
  totalAmount: number; // en USD ($)
  totalProfit?: number; // Bénéfice brut de la vente en USD ($)
  paymentMethod: PaymentMethod;
  status: 'validee' | 'en_cours' | 'annulee';
  debtId?: string; // Dette liée (vente créée automatiquement à l'enregistrement d'une dette)
}

export interface Product {
  id: string; // ID unique (ex: P-001)
  name: string;
  category: string;
  quantity: number;
  minThreshold: number;
  sellingPrice: number;
  purchasePrice: number;
  description?: string;
  createdAt?: string;
  status: 'en_stock' | 'stock_faible' | 'rupture';
  totalSalesCount: number;
}

/** Type de mouvement de stock enregistré dans l'historique */
export type StockMovementType =
  | 'creation' // produit ajouté au catalogue
  | 'entree' // réapprovisionnement / ajout d'articles
  | 'sortie' // vente ou vente liée à une dette
  | 'annulation'; // vente ou dette supprimée → stock restitué

/** Un mouvement réel de stock (base : stock_movements) */
export interface StockMovement {
  id: string;
  productId?: string;
  productName: string;
  type: StockMovementType;
  quantity: number; // nombre d'unités concernées (toujours > 0)
  reference?: string; // code vente (VNT-…)
  note?: string;
  date: string;
  createdAt: string;
}

/** Type des 7 rapports métier fondamentaux de COMAXE */
export type ReportType =
  | 'rep-sales'
  | 'rep-profit'
  | 'rep-expenses'
  | 'rep-stock'
  | 'rep-customers'
  | 'rep-debts'
  | 'rep-performance';

/** Un rapport réellement généré et conservé (base : reports) */
export interface Report {
  id: string;
  reportType: ReportType;
  title: string;
  periodLabel: string;
  metrics: string;
  description?: string;
  createdAt: string;
}

export interface Customer {
  id: string; // ID unique (ex: C-001)
  name: string;
  phone: string;
  email?: string;
  purchasesCount: number;
  totalSpent: number; // en USD ($)
  lastPurchaseDate: string;
  avatar: string;
}

export type ExpenseCategory =
  | 'approvisionnement'
  | 'transport'
  | 'loyer'
  | 'electricite'
  | 'internet'
  | 'salaires'
  | 'autres';

export interface Expense {
  id: string; // ID unique (ex: D-001)
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number; // en USD ($)
  /** Horodatage ISO réel (created_at_ts) — base de la fenêtre 7 jours */
  createdAt?: string;
}

export interface GoalItem {
  id: string;
  title: string;
  category?: string;
  targetUSD: number;
  currentUSD: number;
  percentage: number;
  period: string;
  isCount?: boolean;
  unit?: string;
  status?: string;
  /** Grandeur suivie (permet à l'UI de traiter spécifiquement les plafonds de dépenses) */
  metric?: GoalMetric;
}

/** Grandeur suivie par un objectif (la valeur atteinte est recalculée en direct) */
export type GoalMetric = 'sales' | 'profit' | 'pieces' | 'expenses';

/** Période de réalisation d'un objectif */
export type GoalPeriod = 'semaine' | 'mois' | 'annee';

/** Un objectif réellement enregistré et modifiable (base : goals) */
export interface GoalRecord {
  id: string;
  metric: GoalMetric;
  title: string;
  category: string;
  target: number;
  unit?: string;
  period: GoalPeriod;
  sortOrder: number;
  createdAt: string;
}

export interface ProfitProductStat {
  id: string;
  productName: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  unitProfit: number;
  quantitySold: number;
  revenueUSD: number;
  totalProfitUSD: number;
  marginPercentage: number;
}

export interface PeriodProfitData {
  periodKey: string;
  periodLabel: string;
  totalSalesUSD: number;
  cogsUSD: number;
  grossProfitUSD: number;
  expensesUSD: number;
  netProfitUSD: number;
  netMarginPercentage: number;
  productsSold: ProfitProductStat[];
  topProfitableProducts: { name: string; totalProfitUSD: number; quantitySold: number }[];
  evolutionChart: { label: string; profitUSD: number; salesUSD: number; percentage: number }[];
}

export type DebtStatus = 'non_payee' | 'partiellement_payee' | 'payee';

export interface DebtPayment {
  id: string; // ID unique (ex: PAY-001)
  debtId: string; // ID dette parente (ex: DET-001)
  date: string;
  amount: number; // en USD ($)
  remainingAfter: number; // en USD ($)
  note?: string;
}

export interface Debt {
  id: string; // ID unique (ex: DET-001)
  personName: string;
  phone: string;
  email?: string;
  initialAmount: number; // dette initiale en USD ($)
  paidAmount: number; // total payé en USD ($)
  remainingAmount: number; // initialAmount - paidAmount
  date: string; // date d'enregistrement
  status: DebtStatus;
  payments: DebtPayment[];
  lastPaymentDate?: string;
  productId?: string; // Produit endetté (pris à crédit)
  productName?: string; // Instantané du nom du produit
  quantity?: number; // Quantité du produit endetté
}

export interface DebtHistoryOperation {
  id: string; // ID unique (ex: OP-001)
  date: string;
  debtId: string;
  personName: string;
  phone: string;
  email?: string;
  type: 'creation' | 'paiement';
  initialAmount: number;
  paymentAmount: number; // montant de ce paiement (0 si création)
  totalPaid: number;
  remainingAmount: number;
  status: DebtStatus;
  productName?: string; // Produit endetté concerné par l'événement
  quantity?: number; // Quantité endettée
}

// User Profile & Store Configuration (Section 29 - 33)
export interface ProtectedUserProfile {
  firstName: string; // LECTURE SEULE
  lastName: string;  // LECTURE SEULE
  email: string;     // LECTURE SEULE
  role: string;      // LECTURE SEULE
}

export interface StoreBusinessProfile {
  storeName: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  currency: string;
  /** Pays d'implantation du commerce (code ISO 3166-1 alpha-2, ex: 'CD') */
  country: string;
}

/** Informations du commerce saisies à la création du compte */
export interface StoreSignupInfo {
  storeName: string;
  phone: string;
  address: string;
  category: string;
  currency: string;
  country: string;
}
