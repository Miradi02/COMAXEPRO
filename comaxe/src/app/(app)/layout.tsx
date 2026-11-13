import { AppShell } from '@/components/layout/AppShell';

// Layout de l'espace de gestion (groupe de routes "(app)").
// Toutes les pages authentifiées passent par le AppShell (sidebar + header).
// Les pages /login, /tarifs et /paiement restent HORS de ce groupe :
// aucune navigation ne s'y affiche (paiement = page dédiée sans menu).
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
