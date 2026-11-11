/**
 * COMAXE — Données des 6 offres tarifaires.
 * Source unique de vérité : section #tarifs de la landing + page /tarifs.
 *
 * Deux catégories :
 *   • Gestion d'un commerce : Essential, Pro, Max, Ultime
 *   • Gestion d'entreprise  : Business Max, Business Ultime
 *
 * Boutons : 'free' / 'subscribe' → authentification (ou dashboard selon la page),
 *           'soon' → désactivé « Bientôt disponible ».
 * Aucun paiement, aucun abonnement réel : présentation uniquement.
 */

export type L = { fr: string; en: string };

export type PlanCtaKey = 'free' | 'subscribe' | 'soon';

export type PlanCategoryId = 'commerce' | 'entreprise';

export interface PlanGroup {
  title: L;
  items: L[];
}

export interface Plan {
  id: 'essential' | 'pro' | 'max' | 'ultime' | 'business-max' | 'business-ultime';
  category: PlanCategoryId;
  name: string;
  /** Description courte (sous le nom) */
  tagline: L;
  /** Badge affiché en haut de la carte */
  badge?: L;
  /** Prix mensuel en $ ; null = gratuit */
  priceMonthly: number | null;
  /** Prix annuel en $ (sélecteur Mensuel | Annuel) ; null = gratuit */
  priceAnnual: number | null;
  /** Note d'économie affichée en mode annuel */
  annualNote?: L;
  cta: PlanCtaKey;
  /** Carte synthétique : points visibles sans surcharger */
  highlight: L[];
  /** Détails dépliés par « Voir les fonctionnalités » */
  details: PlanGroup[];
  /** Petit label premium affiché sous le nom */
  chip?: L;
  /** Accent visuel de la carte */
  accent?: 'popular' | 'ai' | 'business' | 'ultimate';
}

/* ── Libellés communs ─────────────────────────────────────────────── */

export const CTA_LABELS: Record<PlanCtaKey, L> = {
  free: { fr: 'Commencer gratuitement', en: 'Start for free' },
  subscribe: { fr: 'S’abonner', en: 'Subscribe' },
  soon: { fr: 'Bientôt disponible', en: 'Coming soon' },
};

export const VIEW_FEATURES_LABEL: L = {
  fr: 'Voir les fonctionnalités',
  en: 'See features',
};

export const HIDE_FEATURES_LABEL: L = {
  fr: 'Masquer les détails',
  en: 'Hide details',
};

export const CATEGORIES: {
  id: PlanCategoryId;
  title: L;
  intro: L;
}[] = [
  {
    id: 'commerce',
    title: { fr: 'Gestion d’un commerce', en: 'Shop management' },
    intro: {
      fr: 'Pour un commerce unique : ventes, stock, clients, dettes, dépenses et bénéfices.',
      en: 'For a single shop: sales, stock, customers, debts, expenses and profits.',
    },
  },
  {
    id: 'entreprise',
    title: { fr: 'Gestion d’entreprise', en: 'Business management' },
    intro: {
      fr: 'Pour plusieurs boutiques, dépôts, points de vente et équipes — centralisez toute la gestion de votre entreprise dans un seul environnement COMAXE.',
      en: 'For multiple shops, warehouses, points of sale and teams — centralize your whole company in a single COMAXE environment.',
    },
  },
];

/* ── Les 6 offres ─────────────────────────────────────────────────── */

export const PLANS: Plan[] = [
  /* ── 1. ESSENTIAL — Gratuit ── */
  {
    id: 'essential',
    category: 'commerce',
    name: 'Essential',
    tagline: {
      fr: 'Pour les commerçants qui souhaitent commencer à gérer leur commerce gratuitement.',
      en: 'For merchants who want to start managing their shop for free.',
    },
    priceMonthly: null,
    priceAnnual: null,
    cta: 'free',
    highlight: [
      { fr: '50 ventes par mois', en: '50 sales per month' },
      { fr: '30 produits · 30 clients', en: '30 products · 30 customers' },
      { fr: '20 dettes actives', en: '20 active debts' },
      { fr: 'Historique : 7 jours (dépenses & bénéfices)', en: 'History: 7 days (expenses & profits)' },
      { fr: 'Objectifs et Analytique bloqués', en: 'Goals and Analytics locked' },
      { fr: 'Avec publicité', en: 'With ads' },
    ],
    details: [
      {
        title: { fr: 'Limites', en: 'Limits' },
        items: [
          { fr: '50 ventes par mois', en: '50 sales per month' },
          { fr: '30 produits', en: '30 products' },
          { fr: '30 clients', en: '30 customers' },
          { fr: '20 dettes actives', en: '20 active debts' },
          { fr: '7 jours d’historique des dépenses', en: '7 days of expense history' },
          { fr: '7 jours d’historique des bénéfices', en: '7 days of profit history' },
          { fr: 'Objectifs bloqués', en: 'Goals locked' },
          { fr: 'Analytique bloquée', en: 'Analytics locked' },
          { fr: 'Publicités activées', en: 'Ads enabled' },
        ],
      },
    ],
  },

  /* ── 2. PRO — 5 $/mois · 49 $/an ── */
  {
    id: 'pro',
    category: 'commerce',
    name: 'Pro',
    tagline: {
      fr: 'Pour les commerçants qui souhaitent gérer leur commerce avec davantage de liberté.',
      en: 'For merchants who want to manage their shop with more freedom.',
    },
    priceMonthly: 5,
    priceAnnual: 49,
    annualNote: { fr: '18 % d’économie', en: 'Save 18%' },
    cta: 'subscribe',
    highlight: [
      { fr: '500 ventes par mois · 300 produits · 300 clients', en: '500 sales per month · 300 products · 300 customers' },
      { fr: '200 dettes actives', en: '200 active debts' },
      { fr: 'Dépenses et bénéfices illimités', en: 'Unlimited expenses and profits' },
      { fr: 'Objectifs et Analytique débloqués', en: 'Goals and Analytics unlocked' },
      { fr: 'Sans publicité', en: 'Ad-free' },
    ],
    details: [
      {
        title: { fr: 'Limites', en: 'Limits' },
        items: [
          { fr: '500 ventes par mois', en: '500 sales per month' },
          { fr: '300 produits', en: '300 products' },
          { fr: '300 clients', en: '300 customers' },
          { fr: '200 dettes actives', en: '200 active debts' },
          { fr: 'Dépenses illimitées', en: 'Unlimited expenses' },
          { fr: 'Bénéfices illimités', en: 'Unlimited profits' },
          { fr: 'Objectifs débloqués', en: 'Goals unlocked' },
          { fr: 'Analytique débloquée', en: 'Analytics unlocked' },
          { fr: 'Sans publicité', en: 'Ad-free' },
        ],
      },
      {
        title: { fr: 'Fonctionnalités', en: 'Features' },
        items: [
          { fr: 'Gestion des ventes', en: 'Sales management' },
          { fr: 'Gestion du stock', en: 'Inventory management' },
          { fr: 'Gestion des clients', en: 'Customer management' },
          { fr: 'Gestion des dettes', en: 'Debt management' },
          { fr: 'Suivi des dépenses', en: 'Expense tracking' },
          { fr: 'Suivi des bénéfices', en: 'Profit tracking' },
          { fr: 'Création et suivi des objectifs', en: 'Goal creation and tracking' },
          { fr: 'Analyse des performances commerciales', en: 'Business performance analysis' },
        ],
      },
    ],
  },

  /* ── 3. MAX — 14 $/mois · 149 $/an ── */
  {
    id: 'max',
    category: 'commerce',
    name: 'Max',
    tagline: {
      fr: 'Pour les commerçants qui souhaitent gérer une activité plus importante avec des capacités supérieures.',
      en: 'For merchants running a larger activity with higher capacities.',
    },
    badge: { fr: 'Le plus populaire', en: 'Most popular' },
    priceMonthly: 14,
    priceAnnual: 149,
    annualNote: { fr: '11 % d’économie', en: 'Save 11%' },
    cta: 'subscribe',
    accent: 'popular',
    highlight: [
      { fr: '1 000 ventes par mois · 600 produits · 600 clients', en: '1,000 sales per month · 600 products · 600 customers' },
      { fr: '400 dettes actives', en: '400 active debts' },
      { fr: 'Dépenses et bénéfices illimités', en: 'Unlimited expenses and profits' },
      { fr: 'Objectifs et Analytique débloqués', en: 'Goals and Analytics unlocked' },
      { fr: 'Sans publicité', en: 'Ad-free' },
    ],
    details: [
      {
        title: { fr: 'Limites', en: 'Limits' },
        items: [
          { fr: '1 000 ventes par mois', en: '1,000 sales per month' },
          { fr: '600 produits', en: '600 products' },
          { fr: '600 clients', en: '600 customers' },
          { fr: '400 dettes actives', en: '400 active debts' },
          { fr: 'Dépenses illimitées', en: 'Unlimited expenses' },
          { fr: 'Bénéfices illimités', en: 'Unlimited profits' },
          { fr: 'Objectifs débloqués', en: 'Goals unlocked' },
          { fr: 'Analytique débloquée', en: 'Analytics unlocked' },
          { fr: 'Sans publicité', en: 'Ad-free' },
        ],
      },
      {
        title: { fr: 'Tout le Pro inclus', en: 'Everything in Pro included' },
        items: [
          { fr: 'Toutes les fonctionnalités de Pro', en: 'All Pro features' },
        ],
      },
      {
        title: { fr: 'Pas inclus dans Max', en: 'Not included in Max' },
        items: [
          { fr: 'Pas d’intelligence artificielle', en: 'No artificial intelligence' },
          { fr: 'Pas de gestion multi-boutiques', en: 'No multi-shop management' },
          { fr: 'Pas de comptes collaborateurs', en: 'No team accounts' },
        ],
      },
    ],
  },

  /* ── 4. ULTIME — 24 $/mois · 249 $/an ── */
  {
    id: 'ultime',
    category: 'commerce',
    name: 'Ultime',
    tagline: {
      fr: 'Pour les commerçants qui souhaitent bénéficier d’une capacité supérieure et de l’intelligence artificielle.',
      en: 'For merchants who want higher capacity and artificial intelligence.',
    },
    priceMonthly: 24,
    priceAnnual: 249,
    annualNote: { fr: '14 % d’économie', en: 'Save 14%' },
    cta: 'soon',
    accent: 'ai',
    chip: { fr: 'Assistant IA inclus', en: 'AI assistant included' },
    highlight: [
      { fr: '4 000 ventes par mois · 2 400 produits · 2 400 clients', en: '4,000 sales per month · 2,400 products · 2,400 customers' },
      { fr: '1 600 dettes actives', en: '1,600 active debts' },
      { fr: 'Tout le Max inclus', en: 'Everything in Max included' },
      { fr: '+ Assistant IA et analyses intelligentes', en: '+ AI assistant and smart analyses' },
      { fr: 'Recommandations et actions assistées IA', en: 'Recommendations and AI-assisted actions' },
      { fr: 'Sans publicité', en: 'Ad-free' },
    ],
    details: [
      {
        title: { fr: 'Limites', en: 'Limits' },
        items: [
          { fr: '4 000 ventes par mois', en: '4,000 sales per month' },
          { fr: '2 400 produits', en: '2,400 products' },
          { fr: '2 400 clients', en: '2,400 customers' },
          { fr: '1 600 dettes actives', en: '1,600 active debts' },
          { fr: 'Dépenses illimitées', en: 'Unlimited expenses' },
          { fr: 'Bénéfices illimités', en: 'Unlimited profits' },
          { fr: 'Objectifs débloqués', en: 'Goals unlocked' },
          { fr: 'Analytique débloquée', en: 'Analytics unlocked' },
          { fr: 'Sans publicité', en: 'Ad-free' },
        ],
      },
      {
        title: { fr: 'Tout le Max inclus', en: 'Everything in Max included' },
        items: [
          { fr: 'Toutes les fonctionnalités de Max', en: 'All Max features' },
        ],
      },
      {
        title: { fr: 'Intelligence artificielle', en: 'Artificial intelligence' },
        items: [
          { fr: 'Assistant IA intégré', en: 'Built-in AI assistant' },
          { fr: 'Analyse intelligente des ventes', en: 'Smart sales analysis' },
          { fr: 'Analyse intelligente du stock', en: 'Smart inventory analysis' },
          { fr: 'Analyse des bénéfices et des dépenses', en: 'Profit and expense analysis' },
          { fr: 'Recommandations intelligentes', en: 'Smart recommendations' },
          { fr: 'Actions assistées par IA pour modifier certaines données plus rapidement', en: 'AI-assisted actions to edit some data faster' },
          { fr: 'Aide à la prise de décision basée sur les données du commerce', en: 'Data-driven decision support' },
          { fr: 'Accompagnement intelligent pour améliorer la gestion du commerce', en: 'Smart guidance to improve shop management' },
          { fr: 'Détection des anomalies commerciales', en: 'Business anomaly detection' },
          { fr: 'Suggestions d’amélioration des performances', en: 'Performance improvement suggestions' },
        ],
      },
      {
        title: { fr: 'Accès à l’IA', en: 'AI access' },
        items: [
          { fr: 'Le propriétaire possède automatiquement l’accès', en: 'The owner gets access automatically' },
          { fr: 'Aucun collaborateur supplémentaire dans cette offre individuelle', en: 'No additional team member in this individual plan' },
        ],
      },
    ],
  },

  /* ── 5. BUSINESS MAX — 59 $/mois · 599 $/an ── */
  {
    id: 'business-max',
    category: 'entreprise',
    name: 'Business Max',
    tagline: {
      fr: 'Pour les entrepreneurs qui souhaitent gérer plusieurs boutiques, dépôts et collaborateurs depuis un seul espace.',
      en: 'For entrepreneurs who want to manage several shops, warehouses and team members from a single space.',
    },
    priceMonthly: 59,
    priceAnnual: 599,
    annualNote: { fr: '15 % d’économie', en: 'Save 15%' },
    cta: 'soon',
    accent: 'business',
    chip: { fr: 'Multi-boutiques · Équipes', en: 'Multi-shop · Teams' },
    highlight: [
      { fr: '8 000 ventes par mois · 4 800 produits · 4 800 clients', en: '8,000 sales per month · 4,800 products · 4,800 customers' },
      { fr: '3 200 dettes actives', en: '3,200 active debts' },
      { fr: 'Multi-boutiques et multi-dépôts', en: 'Multi-shop and multi-warehouse' },
      { fr: '20 collaborateurs · 5 gérants · 1 IA supplémentaire', en: '20 team members · 5 managers · 1 extra AI user' },
      { fr: 'Permissions par page et traçabilité', en: 'Per-page permissions and traceability' },
      { fr: 'IA propriétaire + collaborateur', en: 'Owner + member AI access' },
    ],
    details: [
      {
        title: { fr: 'Limites commerciales', en: 'Commercial limits' },
        items: [
          { fr: '8 000 ventes par mois', en: '8,000 sales per month' },
          { fr: '4 800 produits', en: '4,800 products' },
          { fr: '4 800 clients', en: '4,800 customers' },
          { fr: '3 200 dettes actives', en: '3,200 active debts' },
          { fr: 'Dépenses illimitées', en: 'Unlimited expenses' },
          { fr: 'Bénéfices illimités', en: 'Unlimited profits' },
          { fr: 'Objectifs débloqués', en: 'Goals unlocked' },
          { fr: 'Analytique débloquée', en: 'Analytics unlocked' },
          { fr: 'Sans publicité', en: 'Ad-free' },
        ],
      },
      {
        title: { fr: 'Collaborateurs', en: 'Team members' },
        items: [
          { fr: '20 comptes collaborateurs actifs maximum', en: 'Up to 20 active team accounts' },
          { fr: '20 générations d’identifiants maximum', en: 'Up to 20 credential generations' },
          { fr: '5 collaborateurs maximum pouvant recevoir le rôle de gérant', en: 'Up to 5 members with the manager role' },
          { fr: '1 collaborateur supplémentaire maximum autorisé à utiliser l’IA', en: 'Up to 1 extra member allowed to use AI' },
          { fr: 'Le propriétaire possède automatiquement son propre accès à l’IA', en: 'The owner automatically gets their own AI access' },
        ],
      },
      {
        title: { fr: 'Multi-boutiques et multi-dépôts', en: 'Multi-shop and multi-warehouse' },
        items: [
          { fr: 'Création de plusieurs boutiques', en: 'Create multiple shops' },
          { fr: 'Gestion de plusieurs dépôts', en: 'Manage multiple warehouses' },
          { fr: 'Organisation des activités par établissement', en: 'Organize activities per location' },
          { fr: 'Consultation des données de chaque boutique', en: 'View each shop’s data' },
          { fr: 'Centralisation des informations', en: 'Centralized information' },
          { fr: 'Comparaison des performances des établissements', en: 'Compare location performance' },
          { fr: 'Suivi des ventes et des stocks par établissement', en: 'Track sales and stock per location' },
        ],
      },
      {
        title: { fr: 'Comptes collaborateurs', en: 'Team accounts' },
        items: [
          { fr: 'Générer un identifiant personnel et un mot de passe', en: 'Generate a personal ID and password' },
          { fr: 'Créer un compte pour chaque employé', en: 'Create an account for each employee' },
          { fr: 'Désactiver un compte', en: 'Disable an account' },
          { fr: 'Réinitialiser les identifiants', en: 'Reset credentials' },
          { fr: 'Modifier les autorisations', en: 'Change permissions' },
          { fr: 'Révoquer les accès', en: 'Revoke access' },
          { fr: 'Chaque collaborateur possède son propre compte', en: 'Each member has their own account' },
        ],
      },
      {
        title: { fr: 'Permissions', en: 'Permissions' },
        items: [
          { fr: 'Accès aux pages : Ventes, Stock, Clients, Dettes, Dépenses, Bénéfices, Objectifs, Analytique, Paramètres autorisés', en: 'Page access: Sales, Inventory, Customers, Debts, Expenses, Profits, Goals, Analytics, Allowed settings' },
          { fr: '4 actions indépendantes par page : Consulter · Ajouter · Modifier · Supprimer', en: '4 independent actions per page: View · Add · Edit · Delete' },
          { fr: 'Permissions personnalisées individuellement', en: 'Individually customized permissions' },
        ],
      },
      {
        title: { fr: 'Gérants', en: 'Managers' },
        items: [
          { fr: 'Jusqu’à 5 collaborateurs désignés gérants', en: 'Up to 5 members designated as managers' },
          { fr: 'Superviser une boutique et certains employés', en: 'Supervise a shop and some employees' },
          { fr: 'Gérer les ventes, le stock et consulter les performances', en: 'Manage sales, stock and view performance' },
          { fr: 'Un gérant reste un collaborateur : jamais propriétaire', en: 'A manager remains a member: never the owner' },
          { fr: 'Responsabilités modifiables ou retirables à tout moment', en: 'Duties can be changed or revoked anytime' },
        ],
      },
      {
        title: { fr: 'Paramètres des collaborateurs', en: 'Member settings' },
        items: [
          { fr: 'Accès uniquement aux paramètres autorisés', en: 'Access only to allowed settings' },
          { fr: 'Compte : informations, identifiant, origine du compte, Déconnexion', en: 'Account: info, ID, account origin, Sign out' },
          { fr: 'Aucun accès aux informations personnelles du propriétaire', en: 'No access to the owner’s personal information' },
        ],
      },
      {
        title: { fr: 'Traçabilité des activités', en: 'Activity traceability' },
        items: [
          { fr: 'Identité, action, date et heure', en: 'Identity, action, date and time' },
          { fr: 'Anciennes et nouvelles informations', en: 'Old and new values' },
          { fr: 'Suppressions effectuées', en: 'Deletions performed' },
          { fr: 'Boutique ou dépôt concerné', en: 'Shop or warehouse involved' },
          { fr: 'Recherche et filtres : collaborateur, date, opération, établissement', en: 'Search and filters: member, date, action, location' },
          { fr: 'Trace conservée même après suppression', en: 'Trace kept even after deletion' },
        ],
      },
      {
        title: { fr: 'Intelligence artificielle', en: 'Artificial intelligence' },
        items: [
          { fr: 'Accès automatique pour le propriétaire', en: 'Automatic access for the owner' },
          { fr: '1 collaborateur supplémentaire autorisé, remplaçable ou retirable', en: '1 extra member allowed, replaceable or revocable' },
          { fr: 'Analyse des ventes et des stocks des boutiques', en: 'Analyze shop sales and stock' },
          { fr: 'Comparaison des performances des établissements', en: 'Compare location performance' },
          { fr: 'Analyse des bénéfices, dépenses et anomalies', en: 'Analyze profits, expenses and anomalies' },
          { fr: 'Examen des activités des collaborateurs', en: 'Review member activity' },
          { fr: 'Recommandations et aide à la prise de décision', en: 'Recommendations and decision support' },
          { fr: 'L’IA respecte les permissions de l’utilisateur qui l’utilise', en: 'AI respects the permissions of the user using it' },
        ],
      },
    ],
  },

  /* ── 6. BUSINESS ULTIME — 99 $/mois · 999 $/an ── */
  {
    id: 'business-ultime',
    category: 'entreprise',
    name: 'Business Ultime',
    tagline: {
      fr: 'L’offre la plus avancée de COMAXE, destinée aux entreprises ayant des besoins importants en matière de gestion, de supervision et de centralisation.',
      en: 'COMAXE’s most advanced plan, for companies with heavy management, supervision and centralization needs.',
    },
    priceMonthly: 99,
    priceAnnual: 999,
    annualNote: { fr: '16 % d’économie', en: 'Save 16%' },
    cta: 'soon',
    accent: 'ultimate',
    chip: { fr: 'L’offre la plus complète', en: 'The most complete plan' },
    highlight: [
      { fr: '80 000 ventes par mois · 48 000 produits · 48 000 clients', en: '80,000 sales per month · 48,000 products · 48,000 customers' },
      { fr: '32 000 dettes actives', en: '32,000 active debts' },
      { fr: 'Tout le Business Max ×10', en: 'Everything in Business Max ×10' },
      { fr: '200 collaborateurs · 50 gérants · 5 IA', en: '200 team members · 50 managers · 5 AI users' },
      { fr: 'Supervision et permissions avancées', en: 'Advanced supervision and permissions' },
      { fr: 'L’offre la plus complète', en: 'The most complete plan' },
    ],
    details: [
      {
        title: { fr: 'Limites commerciales (×10)', en: 'Commercial limits (×10)' },
        items: [
          { fr: '80 000 ventes par mois', en: '80,000 sales per month' },
          { fr: '48 000 produits', en: '48,000 products' },
          { fr: '48 000 clients', en: '48,000 customers' },
          { fr: '32 000 dettes actives', en: '32,000 active debts' },
          { fr: 'Dépenses illimitées', en: 'Unlimited expenses' },
          { fr: 'Bénéfices illimités', en: 'Unlimited profits' },
          { fr: 'Objectifs débloqués', en: 'Goals unlocked' },
          { fr: 'Analytique débloquée', en: 'Analytics unlocked' },
          { fr: 'Sans publicité', en: 'Ad-free' },
        ],
      },
      {
        title: { fr: 'Collaborateurs (×10)', en: 'Team members (×10)' },
        items: [
          { fr: '200 comptes collaborateurs actifs maximum', en: 'Up to 200 active team accounts' },
          { fr: '200 générations d’identifiants maximum', en: 'Up to 200 credential generations' },
          { fr: '50 collaborateurs maximum pouvant recevoir le rôle de gérant', en: 'Up to 50 members with the manager role' },
          { fr: '5 collaborateurs supplémentaires maximum autorisés à utiliser l’IA', en: 'Up to 5 extra members allowed to use AI' },
          { fr: 'Le propriétaire possède automatiquement son propre accès à l’IA', en: 'The owner automatically gets their own AI access' },
        ],
      },
      {
        title: { fr: 'Gestion avancée de l’entreprise', en: 'Advanced company management' },
        items: [
          { fr: 'Toutes les fonctionnalités de Business Max', en: 'All Business Max features' },
          { fr: 'Gestion multi-boutiques et multi-dépôts', en: 'Multi-shop and multi-warehouse management' },
          { fr: 'Gestion centralisée des établissements', en: 'Centralized location management' },
          { fr: 'Supervision avancée des collaborateurs', en: 'Advanced member supervision' },
          { fr: 'Gestion avancée des responsabilités', en: 'Advanced duty management' },
          { fr: 'Contrôle approfondi des activités', en: 'Deep activity control' },
          { fr: 'Vision globale des performances de l’entreprise', en: 'Global company performance view' },
          { fr: 'Comparaison des performances entre établissements', en: 'Cross-location performance comparison' },
        ],
      },
      {
        title: { fr: 'Permissions avancées', en: 'Advanced permissions' },
        items: [
          { fr: 'Permissions personnalisées', en: 'Custom permissions' },
          { fr: 'Gestion des accès par boutique et par dépôt', en: 'Access management per shop and warehouse' },
          { fr: 'Attribution des responsabilités aux gérants', en: 'Assign duties to managers' },
          { fr: 'Gestion des collaborateurs à différents niveaux', en: 'Members managed at different levels' },
          { fr: 'Possibilité de modifier ou retirer les permissions à tout moment', en: 'Permissions can be changed or revoked anytime' },
        ],
      },
      {
        title: { fr: 'Intelligence artificielle avancée', en: 'Advanced artificial intelligence' },
        items: [
          { fr: 'Accès automatique pour le propriétaire', en: 'Automatic access for the owner' },
          { fr: 'Jusqu’à 5 collaborateurs supplémentaires autorisés à utiliser l’IA', en: 'Up to 5 extra members allowed to use AI' },
          { fr: 'Analyse de l’ensemble des activités de l’entreprise', en: 'Analyze all company activity' },
          { fr: 'Analyse des ventes et des stocks', en: 'Sales and stock analysis' },
          { fr: 'Analyse des dépenses et bénéfices', en: 'Expense and profit analysis' },
          { fr: 'Comparaison des boutiques', en: 'Shop comparison' },
          { fr: 'Détection des anomalies', en: 'Anomaly detection' },
          { fr: 'Analyse des performances des collaborateurs', en: 'Member performance analysis' },
          { fr: 'Recommandations stratégiques', en: 'Strategic recommendations' },
          { fr: 'Aide à la prise de décision', en: 'Decision support' },
          { fr: 'Actions assistées par IA', en: 'AI-assisted actions' },
          { fr: 'Le propriétaire conserve toujours le contrôle de l’IA et des autorisations', en: 'The owner always keeps control of AI and permissions' },
        ],
      },
    ],
  },
];

/** Règles du système business (rappelées sous les offres entreprise) */
export const BUSINESS_RULES: L[] = [
  {
    fr: 'Le propriétaire reste le chef : il conserve le contrôle général de l’entreprise, même après délégation.',
    en: 'The owner stays in charge: they keep overall control of the company, even after delegating.',
  },
  {
    fr: 'Permissions indépendantes : accès, modification, suppression et IA sont des autorisations distinctes.',
    en: 'Independent permissions: access, edit, delete and AI are separate authorizations.',
  },
  {
    fr: 'Limites sur les comptes actifs : un collaborateur désactivé libère sa place, sans connexion possible.',
    en: 'Limits count active accounts: disabling a member frees their slot and blocks sign-in.',
  },
  {
    fr: 'Traçabilité obligatoire : chaque opération importante est associée à son auteur.',
    en: 'Mandatory traceability: every important operation is tied to its author.',
  },
  {
    fr: 'Accès IA indépendant : l’IA respecte les permissions de chaque utilisateur.',
    en: 'Independent AI access: AI respects each user’s permissions.',
  },
];

/** Retourne les offres d'une catégorie, dans l'ordre d'affichage */
export function plansOf(category: PlanCategoryId): Plan[] {
  return PLANS.filter((p) => p.category === category);
}
