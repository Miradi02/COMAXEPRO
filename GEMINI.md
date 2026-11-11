# GEMINI.md — Guide du Projet COMAXE

> **Document de référence pour toute IA ou développeur intervenant sur ce codebase.**
> Lire aussi : `AGENTS.md` (racine), `comaxe/AGENTS.md`, et surtout `.agents/rules/comaxe-design-system.md` (règles **obligatoires**).

---

## 1. Que fait l'application ?

**COMAXE** est un **SaaS de gestion commerciale** destiné aux commerçants de boutique physique (marché, électronique, retail). Ce n'est **PAS** un logiciel de facturation, ni un CRM de salon, ni un outil de rendez-vous.

**Mission** : permettre au commerçant d'**ENREGISTRER, CONSERVER, ORGANISER et ANALYSER** les données **réelles** de son commerce :

| Domaine | Ce que saisit / calcule COMAXE |
|---|---|
| **Ventes** | Opérations d'encaissement : client, articles, quantités, prix unitaire, total, mode de paiement (Espèces / Mobile Money / Carte) |
| **Produits & Stock** | Catalogue, quantités physiques, valeur marchande, seuils d'alerte, ruptures |
| **Clients** | Coordonnées, nombre d'achats réels, total dépensé, indice de fidélité, historique |
| **Dépenses** | Charges réelles (approvisionnement, transport, loyer, électricité, internet, salaires, autres) |
| **Bénéfice** | Marge nette calculée : `Ventes − COGS − Dépenses`, par produit et par période |
| **Dettes (Créances)** | Créances clients, règlements partiels/totaux, historique des opérations, taux de recouvrement |
| **Analytique & Rapports** | Évolution de l'activité, répartition des paiements, catégories rentables, 7 rapports de synthèse |
| **Objectifs** | Cibles mensuelles (ventes, bénéfice, volume, plafond de dépenses) avec jauges de progression |
| **Paramètres** | Fiche boutique éditable, identité compte en lecture seule, abonnement, réinitialisation des données |

**Périmètre fonctionnel** : application **100 % frontend**, **sans backend ni base de données**. Toutes les données vivent en mémoire (`useState`) initialisées depuis des données de seed. Les données sont perdues au rechargement (sauf action de reset qui les restaure). La "date du jour" de l'application est **figée au 08 octobre 2026** (`REFERENCE_TODAY_KEY`).

---

## 2. Technologies utilisées

| Couche | Technologie | Version |
|---|---|---|
| Framework | **Next.js** (App Router, App-dir `src/app`) | 14.2.24 |
| UI | **React** (App Router, majoritairement Client Components `'use client'`) | 18.3.1 |
| Langage | **TypeScript** (mode `strict`) | 5.7.3 |
| Styles | **Tailwind CSS** (+ `tailwind-merge`, `clsx` via helper `cn()`) | 3.4.17 |
| Icônes | **lucide-react** (exclusivement — aucune autre lib d'icônes autorisée) | 0.475.0 |
| Graphiques | **Aucune lib** — graphiques en barres faits main en **divs HTML/CSS** (pas de Recharts/D3) | — |
| Police | **Plus Jakarta Sans** + **Inter** (chargées via Google Fonts dans `layout.tsx`) | — |
| Monnaie | **USD ($)** via `formatUSD()` (`Intl.NumberFormat`) — `formatFCFA()` disponible | — |
| Persistance | **Aucune** (état en mémoire, seed data) | — |
| Tests | Scripts de vérification Node dans `comaxe/scripts/` (`verify-comaxe.mjs` teste les 13 routes HTTP) | — |

> ⚠️ **Pas** de lib de state management (Redux/Zustand), **pas** de lib de formulaires (React Hook Form), **pas** de lib de graphiques, **pas** de base de données, **pas** d'API. Tout est fait à la main avec React natif.

---

## 3. Structure des fichiers

```
COMAXEPRO/                          # Racine du monorepo (workspace)
├── AGENTS.md                       # Règles générales du workspace (design system + concept métier)
├── GEMINI.md                       # ← Ce fichier
├── package.json                    # Scripts racine : dev/build/start/lint délèguent à comaxe/
├── tsconfig.json                   # TS racine (baseUrl → ./comaxe, alias @/* → comaxe/src/*)
├── .agents/rules/
│   ├── comaxe-design-system.md     # ⭐ RÈGLES OBLIGATOIRE de design & de concept métier
│   └── design.md                   # Déclencheur always_on (vide)
└── comaxe/                         # 🔧 Application Next.js
    ├── package.json                # Dépendances & scripts Next.js
    ├── next.config.js              # reactStrictMode, images.domains=[unsplash], redirects /produits → /stock
    ├── tailwind.config.ts          # Tokens : brand.* (#1E5BF8 primary), canvas (#F8F9FD), shadows card
    ├── scripts/                    # verify-comaxe.mjs (test routes), verify_logic.mjs/.ts
    └── src/
        ├── app/                    # 📄 Routes (App Router)
        │   ├── layout.tsx          # Layout racine : fonts, <AppShell>, body bg #F8F9FD
        │   ├── page.tsx            # Dashboard (= /dashboard, re-exporté)
        │   ├── loading.tsx         # Skeleton de chargement global
        │   ├── globals.css         # Scrollbars custom, .card-clean, .card-hover-lift
        │   ├── dashboard/page.tsx  # → re-export de ../page
        │   ├── ventes/page.tsx     # Liste des ventes (KPIs + RecentSalesTable)
        │   ├── stock/page.tsx      # Produits & Stock (CRUD, filtres, alertes)
        │   ├── clients/page.tsx    # Répertoire clients (CRUD, recherche)
        │   ├── clients/[id]/page.tsx # Fiche client détaillée (édition, historique ventes)
        │   ├── depenses/page.tsx   # Journal des dépenses (CRUD, filtres)
        │   ├── benefice/page.tsx   # Rentabilité par période (cascade CA→COGS→Brut→Net)
        │   ├── dettes/page.tsx     # Créances clients (CRUD complet, règlements, historique)
        │   ├── analytique/page.tsx # KPIs périodes, graphiques, paiements, top catégories
        │   ├── rapports/page.tsx   # Catalogue des 7 rapports (export PDF/CSV = placeholder)
        │   ├── objectifs/page.tsx  # Jauges objectifs mensuels (lecture seule)
        │   └── parametres/page.tsx # 4 onglets : commerce / profil / abonnement / données
        ├── components/
        │   ├── common/
        │   │   └── ConfirmModal.tsx    # Modale de confirmation globale (suppressions)
        │   ├── layout/
        │   │   ├── AppShell.tsx        # Gabarit : Sidebar + Header + <main>, enveloppe les providers
        │   │   ├── Sidebar.tsx         # Nav persistante (sections Général/Analyse/Gestion/Autre)
        │   │   └── Header.tsx          # Header sticky : recherche, CTA global, date picker global
        │   ├── dashboard/
        │   │   ├── KPICards.tsx            # 5 cartes KPI du dashboard (ventes, profit, dépenses, stock, dettes)
        │   │   ├── SalesEvolutionChart.tsx # Graphique barres (filtres 7j/30j/12m, tooltips)
        │   │   ├── SalesGoalCard.tsx       # Objectif journalier (jauge)
        │   │   ├── StockAlerts.tsx         # Alertes stock faible / rupture
        │   │   ├── TopSellingProducts.tsx  # Top produits vendus
        │   │   ├── RecentCustomers.tsx     # Clients récents
        │   │   ├── RecentSalesTable.tsx    # ⭐ Tableau des ventes + CRUD complet (3 modales)
        │   │   └── InvoicesTable.tsx       # ⚠️ ORPHELIN (legacy "factures", non importé — voir §8)
        │   └── sales/                      # (vide/legacy)
        ├── context/
        │   ├── CommerceContext.tsx    # ⭐ MÉTIER CENTRAL : données + calculs + actions + ConfirmModal
        │   └── AppShellContext.tsx    # UI shell : menu mobile + headerAction injectable par page
        ├── data/
        │   ├── seedData.ts            # ⭐ Données d'amorce (produits, ventes, clients, dépenses, dettes, objectifs, profils)
        │   └── mock.ts                # ⚠️ Legacy (KPIs/factures mock) — uniquement utilisé par InvoicesTable orphelin
        ├── lib/
        │   ├── utils.ts               # cn(), formatUSD(), formatFCFA()
        │   └── dateUtils.ts           # ⭐ Normalisation dates, isDateMatching, isWithinPeriodRange, labels
        └── types/
            └── index.ts               # ⭐ Tous les types métier (Sale, Product, Customer, Expense, Debt, GoalItem…)
```

**Routes majeures** : `/` = `/dashboard`, `/ventes`, `/stock`, `/clients`, `/clients/[id]`, `/depenses`, `/benefice`, `/dettes`, `/analytique`, `/rapports`, `/objectifs`, `/parametres`. (Les dossiers vides `app/produits*`, `app/ventes/nouvelle`, `app/ventes/[id]` sont des reliquats ; `/produits` et `/produits-stock` redirigent vers `/stock`.)

---

## 4. Fonctionnalités implémentées

### 4.1 Dashboard (`/` et `/dashboard`)
- 5 cartes KPI temps réel : Ventes du jour (carte hero bleue), Bénéfice net, Dépenses, Valeur du stock, Reste à récupérer (dettes).
- Graphique d'évolution des ventes (barres capsules HTML, filtres 7 jours / 30 jours / 12 mois, tooltips au survol).
- Carte objectif journalier (jauge de progression).
- Alertes stock (faible / rupture), Top produits vendus, Clients récents.
- Tableau des ventes récentes (accès complet à la CRUD ventes — voir 4.2).

### 4.2 Ventes (`/ventes` + `RecentSalesTable`)
- **CRUD complet** : `addSale`, `updateSale`, `deleteSale` via `CommerceContext`.
- **3 modales** : Enregistrer une vente / Modifier une vente / Ticket de vente (lecture seule, style reçu).
- Filtres : pills par mode de paiement (Espèces, Mobile Money, Carte), recherche (code, client, produit), bascule "toutes les dates".
- **Validations** : nom client obligatoire, produit existant, **stock suffisant** (contrôle `quantity` avant validation).
- **Intégrité transactionnelle** : une vente décrémente le stock, incrémente les stats client, calcule le bénéfice brut (`totalProfit`) ; une suppression **restaure** le stock et ajuste le client ; une modification **restitue l'ancien stock → vérifie → réapplique** le nouveau.
- Client inconnu → **création automatique** dans le répertoire.
- KPIs : total des ventes, panier moyen, total de la date active.

### 4.3 Produits & Stock (`/stock`)
- **CRUD** : création (modale : nom, catégorie, quantité, seuil, prix vente/achat), suppression avec confirmation. *L'édition UI n'est pas câblée (mais `updateProduct` existe dans le contexte).*
- Recherche (nom + catégorie), filtres pills par statut (Tous / En stock / Faible / Rupture) avec compteurs.
- Statut calculé automatiquement : `rupture` si qty ≤ 0, `stock_faible` si qty ≤ seuil, sinon `en_stock`.
- KPIs : valeur du stock (prix d'achat × quantité), articles en stock, nb faibles, nb ruptures.
- Bouton d'action injecté dans le Header global via `setHeaderAction`.

### 4.4 Clients (`/clients` et `/clients/[id]`)
- **CRUD** : création, modification, suppression (confirmation ; l'historique des ventes est **préservé** — règle métier).
- Recherche multi-champs (nom, téléphone, email).
- Fiche détail : KPIs (achats, panier moyen, **indice de fidélité** : ≥5 = "Très Fidèle", >1 = "Régulier", sinon "Nouveau"), historique des ventes du client (associé par nom insensible à la casse **ou** téléphone).

### 4.5 Dépenses (`/depenses`)
- **CRUD** : création (catégorie parmi 7, description, montant), suppression avec confirmation.
- Recherche + filtre par catégorie + bascule "toutes les dates / date active".
- KPIs : dépenses de la date active, dépenses totales, approvisionnement & transport (+ % du budget).
- Icône par catégorie (Package, Truck, Zap, Home, Wifi, Users, Receipt).

### 4.6 Bénéfice (`/benefice`) — lecture seule
- Filtre par période : 6 onglets (aujourd'hui, semaine, mois, 3 mois, année, personnalisé).
- Cascade financière : `CA → COGS → Bénéfice brut → Dépenses → Bénéfice net` (planchonné à 0) + marge nette %.
- Top 4 produits rentables + tableau détaillé par produit (prix achat/vente, bénéfice unitaire, quantité, CA, bénéfice total).
- Graphique en barres capsules avec tooltip au survol.

### 4.7 Dettes / Créances (`/dettes`) — CRUD complet
- **Actions** : `addDebt`, `recordDebtPayment` (partiel ou total), `deleteDebt`.
- **Machine à états** : `non_payee` → `partiellement_payee` → `payee` (calcul automatique de `remainingAmount`).
- 4 modales : nouvelle dette, régler (radio partiel/total avec aperçu en direct du calcul), détails + timeline des paiements, confirmation de suppression.
- Filtres : statut (segmented control), recherche (nom, tél, email), filtre par date active.
- **Historique des opérations** (`DebtHistoryOperation`) : toutes les créations etpaiements conservés même après solde.
- KPIs : dossiers en cours, reste à récupérer, montant recouvré, **taux de recouvrement** (barre).
- Menu contextuel ⋮ par ligne (Régler / Voir détails / Supprimer).

### 4.8 Analytique (`/analytique`) — lecture seule
- Filtre période (7j / 30j / 3m / 6m / 12m / personnalisé).
- 4 KPIs : Ventes totales, Bénéfice net (+ marge), Dépenses, **Rotation du stock** (COGS / valeur stock).
- Réutilise `SalesEvolutionChart` et `TopSellingProducts`.
- Répartition des modes de paiement (montant + %), Top 3 catégories rentables.

### 4.9 Rapports (`/rapports`) — lecture seule
- Catalogue déclaratif des **7 rapports** : Ventes, Bénéfices & Marges, Dépenses & Charges, Inventaire & Stock, Activité Clients, Dettes & Recouvrement, Performance globale.
- Chaque carte affiche ses métriques consolidées en temps réel.
- ⚠️ Bouton "Exporter (PDF/CSV)" = **placeholder** (`alert()`), export non implémenté.

### 4.10 Objectifs (`/objectifs`) — lecture seule
- 4 objectifs mensuels calculés en temps réel depuis `CommerceContext` (ventes, bénéfice net, volume de pièces, plafond de dépenses) avec jauges.
- Barre du plafond de dépenses passe en **rouge au-delà de 100 %** (dépassement).

### 4.11 Paramètres (`/parametres`) — 4 onglets
- **Commerce** (éditable) : nom, catégorie, téléphone, email, adresse, devise (USD/FCFA/CDF) → `updateStoreProfile`, feedback "Enregistré !" 3 s.
- **Profil** (verrouillé lecture seule, `readOnly disabled`) : identité compte + mot de passe masqué "chiffré".
- **Abonnement** : carte statique "COMAXE Pro Illimité — 29 $/mois".
- **Données** : réinitialisation aux données de seed avec confirmation.

### 4.12 Transverse
- **Date globale active** (Header) : sélecteur qui filtre l'ensemble de l'app (`filteredSales`, `filteredExpenses`, `filteredDebts`…), badge "Filtre actif" dans le Header.
- **Modale de confirmation globale** (`requestConfirmation`) pour toutes les suppressions.
- **Sidebar responsive** : persistante sur desktop (lg:), drawer mobile avec backdrop.
- **Header** : recherche globale (visuelle), CTA principal contextuel par route, raccourcis Stock/Dépenses.
- **Skeleton de chargement** (`loading.tsx`).

---

## 5. Architecture & flux de données

### 5.1 Providers (dans `AppShell.tsx`)
```
<AppShellProvider>        → UI : isMobileMenuOpen, headerAction
  <CommerceProvider>      → MÉTIER : données + calculs + actions
    Sidebar + Header + <main>{children}</main>
```

### 5.2 `CommerceContext` — le cœur métier (`src/context/CommerceContext.tsx`)
**Single source of truth** pour : `products`, `sales`, `customers`, `expenses`, `debts`, `debtOperations`, `userProfile`, `storeProfile`, `goalTargets`.

Expose notamment :
- **Date globale** : `selectedDate`, `setSelectedDate`, `displayDateText`, `isDateMatching()`.
- **Données filtrées** (mémoïsées) : `filteredSales`, `filteredExpenses`, `filteredDebts`, `filteredDebtOperations`.
- **Métriques calculées** : `todaySalesTotal/Count`, `todayExpensesTotal`, `todayGrossProfitTotal`, `todayProfitTotal` (net), `totalStockValue/Count`, `activeDebtsCount`, `totalDebtRemaining/Recovered/Initial`, `debtRecoveryRate`.
- **Objectifs dynamiques** : `goals` (calculés sur le mois en cours).
- **Moteur par période** : `getPeriodMetrics(period)` → `PeriodProfitData` (CA, COGS, brut, dépenses, net, marge, produits vendus, top rentables, série d'évolution).
- **Actions transactionnelles** : `addSale/updateSale/deleteSale`, `addProduct/updateProduct/deleteProduct`, `addCustomer/updateCustomer/deleteCustomer`, `addExpense/deleteExpense`, `addDebt/recordDebtPayment/deleteDebt`, `updateStoreProfile`, `resetToSeedData`, `requestConfirmation`.

**Règle d'or** : toute écriture métier passe par une action du contexte. Les pages sont des **vues dérivées** (`useMemo`/calculs inline) — aucune page ne doit dupliquer l'état source.

### 5.3 Règles de calcul métier (invariants)
- **COGS** (coût des marchandises vendues) : `purchasePrice` du catalogue → sinon `item.purchasePrice` → sinon fallback `unitPrice * 0.7` (heuristique 30 % de marge).
- **Bénéfice brut** = `Ventes − COGS` ; **Bénéfice net** = `max(0, Brut − Dépenses)` (jamais négatif).
- **Valeur du stock** = `Σ (quantity × purchasePrice)` (prix d'achat, réalité physique actuelle).
- **Rattachement produit/vente** : par `productId` si dispo, sinon par nom en minuscules.
- **Rattachement client/vente** : par `customerId`/id, sinon nom (insensible casse) ou téléphone.

### 5.4 Modèle de données (`src/types/index.ts`)
Types clés : `Sale` (+ `SaleItem`), `Product`, `Customer`, `Expense` (+ `ExpenseCategory`), `Debt` (+ `DebtPayment`, `DebtStatus`), `DebtHistoryOperation`, `GoalItem`, `PeriodProfitData`, `ProfitProductStat`, `ProtectedUserProfile`, `StoreBusinessProfile`, `PaymentMethod` (`especes|mobile_money|carte`).
> Les types `Invoice`/`InvoiceStatus` existent encore mais sont **legacy** (voir §8).
> IDs normalisés : `P-001` (produit), `V-001`/`VNT-2026-090` (vente), `C-001` (client), `D-001` (dépense), `DET-001`/`PAY-…`/`OP-…` (dettes).

### 5.5 Gestion des dates (`src/lib/dateUtils.ts`)
- **Date de référence figée** : `REFERENCE_TODAY_KEY = '2026-10-08'` (l'app simule une session au 08/10/2026).
- `normalizeDateToKey()` accepte "Aujourd'hui", ISO `YYYY-MM-DD`, FR `DD/MM/YYYY`, texte "05 oct".
- `isDateMatching(itemDate, selectedDate)` : correspondance exacte avec la date globale.
- `isWithinPeriodRange(itemDate, period)` : fenêtres 7j/30j/3m/6m/12m/année par rapport à la date de référence.
- `getDisplayDateLabel()` : libellé lisible ("Aujourd'hui", "7 octobre 2026"…).

---

## 6. Décisions de design

### 6.1 Concept métier (non négociable)
- COMAXE = **enregistrer/conserver/organiser/analyser** les données réelles d'une boutique.
- **INTERDIT** d'introduire : factures/facturation, rendez-vous, salon, staff, services, CRM de prestation. La navigation doit suivre la hiérarchie : **Général** (Dashboard, Ventes, Produits & Stock, Clients, Dépenses, Bénéfice, Dettes) / **Analyse** (Analytique, Rapports) / **Gestion** (Objectifs, Paramètres) / **Autre** (Fintech — désactivé "Bientôt").

### 6.2 Design system (tokens imposés — `.agents/rules/comaxe-design-system.md`)
- **Canvas** : `#F8F9FD` (jamais blanc pur en fond de page). **Surfaces** : `bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs`.
- **Bleu signature** : `#1E5BF8` (hover `#1548CF`), soft `bg-blue-50 text-[#1E5BF8]`.
- **En-tête de carte standard** : icône Lucide dans `p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]` + titre `text-base font-bold text-slate-900`.
- **Statuts sémantiques** avec pastille ronde `w-1.5 h-1.5 rounded-full` :
  - ✅ En stock / Validée / Payée → `emerald` ; ⚠️ Stock faible / Mobile Money / En attente → `amber` ; 🔴 Rupture / En retard → `rose` ; ℹ️ Carte bancaire → `blue`.
- **Rayons** : cartes `rounded-2xl sm:rounded-3xl`, boutons/sélecteurs `rounded-xl`, badges `rounded-full`.
- **Micro-interactions** : bouton primaire `shadow-md shadow-blue-500/25 active:scale-95 transition-all` ; cartes interactives `transition-transform hover:-translate-y-1 duration-200` ; lignes de tableau `hover:bg-slate-50/60`.
- **Typo** : titres `text-slate-900 font-extrabold tracking-tight` (Plus Jakarta Sans / Inter).
- **Monnaie** : toujours `formatUSD()` (ou `formatFCFA()` selon config). **Icônes** : uniquement `lucide-react`.

### 6.3 Décisions d'architecture
1. **Client Components partout** : l'app est interactive (filtres, modales, état) → quasi tous les fichiers portent `'use client'`. Pas de Server Components de données (pas de backend).
2. **Un seul contexte métier** (`CommerceContext`) centralise données + calculs + actions : évite la duplication et garantit la cohérence (stock ↔ ventes ↔ clients ↔ bénéfice).
3. **Séparation UI/Métier** : `AppShellContext` (shell : menu mobile, CTA header) ≠ `CommerceContext` (données).
4. **Graphiques faits main** (divs + tailles en %) plutôt qu'une lib : zéro dépendance lourde, contrôle total du style, aligné sur le design system.
5. **Intégrité transactionnelle simulée** : les actions ventes gèrent en cascade le stock, les stats client et le bénéfice, avec restitution/pré-vérification en cas de modification (pas de "double dépense" de stock).
6. **Données de seed** (`seedData.ts`) cohérentes et réalistes (boutique "Tech Express", produits électronique) + `resetToSeedData()` pour repartir d'un état propre (utile pour les demos/tests).
7. **Filtre de date global** propagé par le contexte plutôt que par URL : une seule source, tous les modules réagissent.
8. **Confirmation systématique** des suppressions via modale globale (règle métier 19).
9. **Responsive mobile-first** : sidebar en drawer, grilles `grid-cols-1 sm: lg:`, tableaux scrollables.

---

## 7. Instructions pour un futur modèle IA

### 7.1 Avant de coder — lis dans cet ordre
1. `.agents/rules/comaxe-design-system.md` (règles **obligatoires** : concept + tokens).
2. `AGENTS.md` (racine) et `comaxe/AGENTS.md`.
3. Ce fichier `GEMINI.md`.
4. Le fichier existant le plus proche de ta tâche (ex. une autre page du même module) pour reproduire les patterns.

### 7.2 Règles absolues
- ❌ **Jamais** de vocabulaire ni de logique de facturation, rendez-vous, salon, staff ou services. Menu et libellés strictement commerçant (Ventes, Stock, Clients, Dépenses, Bénéfice, Dettes…).
- 🎨 **Respecter scrupuleusement le design system** (canvas `#F8F9FD`, cartes blanches `rounded-2xl sm:rounded-3xl border-slate-200/80 shadow-xs`, bleu `#1E5BF8`, en-tête de carte à icône `bg-blue-50`, badges à pastille, `formatUSD()`, icônes `lucide-react` uniquement).
- 💰 Tous les montants passent par `formatUSD()` (`@/lib/utils`). Ne jamais afficher de nombre brut.
- 🧠 Toute donnée métier provient de `useCommerce()` — **ne jamais dupliquer l'état** dans une page ; calcule en `useMemo`/dérivé.
- 🔁 Toute écriture passe par une action du contexte (`addSale`, `deleteProduct`…). Si une action manque, **ajoute-la dans `CommerceContext`** (et dans le type `CommerceContextType`) plutôt que de la logique locale par page.
- 🗑️ Toute suppression passe par `requestConfirmation()` (modale globale).
- 🧾 Une vente touche **toujours** le stock et les stats client de façon cohérente (création = décrément, suppression = restauration, modification = restitution → vérif → réapplique). Ne casse jamais cet invariant.
- 📅 Conscience de la **date de référence figée au 08/10/2026** (`REFERENCE_TODAY_KEY`) — n'utilise pas `new Date()` pour la logique métier ; utilise `dateUtils`.
- 🚫 **Pas de nouvelle dépendance** sans validation explicite (pas de lib de graphiques, de state management ou de formulaires).
- 🔤 Interface **en français**, montants en USD.

### 7.3 Patterns à reproduire quand tu crées une page
- `'use client'` en tête ; imports depuis `@/context/CommerceContext`, `@/lib/utils`, `lucide-react`.
- Structure : cartes KPI en haut (grille responsive) → barre de filtres/recherche → tableau ou grille → modales de création/édition.
- Bouton d'action principal de la page : `setHeaderAction({ label, onClick })` (nettoyer au démontage dans un `useEffect`).
- Tableaux : en-têtes `text-xs font-semibold text-slate-400 uppercase`, lignes `hover:bg-slate-50/60`, état vide géré (`colSpan`).
- Modales : `fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs`, conteneur `bg-white rounded-3xl p-6 max-w-md shadow-2xl`, fermeture au clic extérieur + bouton X.
- Valider les formulaires côté JS (champs requis, montants > 0, stock suffisant) avant d'appeler le contexte ; afficher les erreurs (`formError`) en rose.

### 7.4 Champs piégés / à surveiller
- **Ne pas casser** la logique d'intégrité des ventes (stock/client/bénéfice) ni le filtrage par date globale.
- Les IDs sont générés par index (`P-00${products.length + 1}`) — sensible aux suppressions (doublons potentiels) ; ne pas "améliorer" à la légère sans ajuster partout.
- `getPeriodMetrics` et le calcul COGS sont **dupliqués** dans `benefice`, `analytique` et `rapports` (fallback `unitPrice * 0.7`) — si tu touches au calcul, refactore en helper partagé dans le contexte ou `lib/`.
- La page `/benefice` contient encore des **valeurs hardcodées** (`* 0.4 || 840`, `+ 2450`, badge "+14.2 %") et `/objectifs` affiche "Octobre 2026" en dur — à remplacer par des calculs si tu interviens dessus.
- `/rapports` : l'export PDF/CSV est un placeholder (`alert`) — à implémenter si demandé.
- L'app n'a **aucune persistance** : si on te demande de "sauvegarder", il faudra envisager `localStorage` ou un backend (hors périmètre actuel).

### 7.5 Vérification avant de conclure
- `npm run lint` puis `npm run build` depuis la racine (délèguent à `comaxe/`).
- Vérifier le rendu responsive et la conformité visuelle aux tokens du design system.
- S'assurer qu'aucun terme interdit (facture, rendez-vous…) n'a été introduit.

---

## 8. Dette technique / points connus (pour info)

- `src/components/dashboard/InvoicesTable.tsx` et `src/data/mock.ts` sont des **reliquats** du concept "factures" abandonné : `InvoicesTable` n'est **importé nulle part**, `mock.ts` n'est utilisé que par lui. Les types `Invoice`/`InvoiceStatus` et `KPIStat`, `StockAlertItem`, `TopProductItem`, `SalesChartPoint` dans `types/index.ts` sont majoritairement inutilisés par l'UI active. Candidats au nettoyage.
- Dossiers vides : `app/produits`, `app/produits-stock`, `app/ventes/nouvelle`, `app/ventes/[id]`, `components/sales/`.
- Le champ de recherche du Header est **visuel** (pas de logique de recherche globale branchée).
- L'édition de produit n'a pas de modale UI (la fonction `updateProduct` existe).
- Toutes les données sont en mémoire : **rechargement = retour au seed**.
