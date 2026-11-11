# Règle Frontend COMAXE

Chaque composant créé ou modifié dans ce dossier `src/` doit respecter scrupuleusement le concept métier et le design system établi :

- **Règle complète** : [.agents/rules/comaxe-design-system.md](file:///c:/Users/manga/Videos/COMAXEPRO/.agents/rules/comaxe-design-system.md)
- **Concept** : Logiciel pour commerçant (Enregistrer, Conserver, Organiser, Analyser les ventes, stocks, clients, dépenses, bénéfices). Menu GENERAL : Dashboard, Ventes, Produits & Stock, Clients, Dépenses, Bénéfice. Pas de facturation ou de salon.
- **Palette** : Canvas `#F8F9FD`, Surfaces `#FFFFFF`, Bleu Primaire `#1E5BF8`, Hover `#1548CF`.
- **Cartes** : `rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs`.
- **En-tête de carte standard** : icône dans `p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]` + titre `text-base font-bold text-slate-900`.
- **Monnaie** : Formatée en USD ($) via `formatUSD(montant)` depuis `@/lib/utils`.
- **Icônes** : Uniquement `lucide-react`.
