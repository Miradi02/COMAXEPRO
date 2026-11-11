# Règle de Design System & Concept Métier COMAXE — Antigravity

Cette règle est **OBLIGATOIRE** et s'applique à tous les composants, pages, vues et modules créés ou modifiés dans le projet COMAXE.
Tout nouveau composant frontend doit respecter strictement les tokens, l'architecture visuelle et le concept fonctionnel de gestion commerciale décrits ci-dessous.

---

## 1. Concept Fondateur & Mission de COMAXE

* **COMAXE n'est PAS un logiciel de facturation, ni un CRM de salon ou de rendez-vous.**
* **COMAXE est un SaaS permettant à un commerçant d'ENREGISTRER, CONSERVER, ORGANISER ET ANALYSER les données réelles de son commerce.**
* Le commerçant fait son commerce normalement en boutique physique. COMAXE lui sert à conserver l'historique et la structure de son activité :
  * **Ventes** : Enregistrement des opérations (client, article, quantité, prix unitaire, total, moyen de paiement).
  * **Produits & Stock** : Quantités en stock, valeur marchande, alertes de réapprovisionnement, ruptures.
  * **Clients** : Coordonnées, nombre d'achats réels, total dépensé, fidélité.
  * **Dépenses** : Enregistrement des charges réelles (loyer, transport, approvisionnement, électricité, salaires).
  * **Bénéfice & Rentabilité** : Marge commerciale nette calculée à partir des ventes et des coûts.
  * **Analytique & Rapports** : Analyse de l'évolution de l'activité, périodes rentables, rapports PDF.
  * **Objectifs** : Cibles mensuelles de vente et de marge avec jauges de progression.

---

## 2. Organisation Obligatoire de la Navigation (Sidebar)

La navigation doit TOUJOURS respecter strictement cette hiérarchie :

* **GÉNÉRAL** :
  * `Dashboard` (`/dashboard` ou `/`)
  * `Ventes` (`/ventes`)
  * `Produits & Stock` (`/stock`)
  * `Clients` (`/clients`)
  * `Dépenses` (`/depenses`)
  * `Bénéfice` (`/benefice`)
* **ANALYSE** :
  * `Analytique` (`/analytique`)
  * `Rapports` (`/rapports`)
* **GESTION** :
  * `Objectifs` (`/objectifs`)
  * `Paramètres` (`/parametres`)
* **AUTRE** :
  * `Fintech` — Bientôt (élément désactivé avec badge "Bientôt")

> ⛔ **INTERDICTION STRICTE** d'inclure des éléments tels que : Rendez-vous, Factures, Facturation, Salon, Staff, Services.

---

## 3. Identité Visuelle & Tokens de Design

* **Fond de page (Canvas)** : Blanc cassé froid très doux `#F8F9FD` (`bg-[#F8F9FD]`). Jamais de fond blanc pur pour l'arrière-plan de page.
* **Surfaces (Cards & Modales)** : Blanc pur `#FFFFFF` (`bg-white`) avec bordure fine `border border-slate-200/80` et ombre légère `shadow-xs`.
* **Couleur Signature (Hero Blue)** : Bleu royal vibrant `#1E5BF8` (hover : `#1548CF`).
* **Boîte d'icône d'en-tête standardisée** : `p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]` avec icône Lucide `w-4 h-4`.
* **Rayons de courbure (Border Radius)** :
  * Cartes : `rounded-2xl sm:rounded-3xl`
  * Boutons et sélecteurs : `rounded-xl`
  * Badges et capsules de progression : `rounded-full`
* **Devise Principale** : Montants commerciaux formatés en **USD ($)** via `formatUSD()` depuis `@/lib/utils` (ou FCFA via `formatFCFA()` selon configuration).

---

## 4. Statuts Sémantiques avec Pastille Ronde

Chaque badge d'état doit utiliser un fond doux, une bordure à 80% d'opacité, un texte contrasté et un point indicateur (`w-1.5 h-1.5 rounded-full`) :
* **En Stock / Validée / Payée** : `bg-emerald-50 text-emerald-700 border border-emerald-200/80` (pastille `bg-emerald-500`)
* **Stock Faible / Mobile Money / En attente** : `bg-amber-50 text-amber-700 border border-amber-200/80` (pastille `bg-amber-500`)
* **Rupture de Stock / En retard** : `bg-rose-50 text-rose-700 border border-rose-200/80` (pastille `bg-rose-500`)
* **Carte Bancaire / Info** : `bg-blue-50 text-[#1E5BF8] border border-blue-200/80`

---

## 5. Micro-Interactions & Qualité

* Tout bouton principal : `shadow-md shadow-blue-500/25 active:scale-95 transition-all`.
* Toute carte interactive : `transition-transform hover:-translate-y-1 duration-200`.
* Les listes et tableaux doivent posséder des états de survol doux (`hover:bg-slate-50/60`).
