# Règle Générale Workspace COMAXE

Tous les développements, créations de composants et modifications d'interfaces dans ce projet doivent respecter la règle de design system & métier définie dans [.agents/rules/comaxe-design-system.md](file:///c:/Users/manga/Videos/COMAXEPRO/.agents/rules/comaxe-design-system.md).

## Principes Directeurs
1. **Concept Métier COMAXE** :
   - COMAXE est un SaaS permettant à un commerçant d'ENREGISTRER, CONSERVER, ORGANISER ET ANALYSER les données réelles de son commerce (Ventes, Stock, Clients, Dépenses, Bénéfices, Objectifs). Menu GENERAL : Dashboard, Ventes, Produits & Stock, Clients, Dépenses, Bénéfice.
   - Ne JAMAIS utiliser de termes ou de logiques de facturation, de rendez-vous ou de services.
2. **Design System COMAXE** :
   - Fond canvas : `#F8F9FD`
   - Cartes : `bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs`
   - Accent primaire : Bleu royal `#1E5BF8` (hover `#1548CF`, soft container `bg-blue-50 text-[#1E5BF8]`)
   - Typographie : `Plus Jakarta Sans` / `Inter`, titres `text-slate-900 font-extrabold tracking-tight`
   - Monnaie : Montants commerciaux en USD ($) formatés via `formatUSD()`.
   - Icônes : Exclusivement `lucide-react` avec boîte d'icône `p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]` pour les en-têtes de cartes.
