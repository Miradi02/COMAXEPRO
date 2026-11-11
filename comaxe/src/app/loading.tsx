import { Loader2 } from 'lucide-react';

// Feedback de navigation INSTANTANÉ : affiché dès le clic sur un lien,
// pendant le rendu de la page demandée (perception de navigation rapide).
export default function Loading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center" aria-busy="true" aria-live="polite">
      <Loader2 className="w-8 h-8 animate-spin text-[#1E5BF8]" aria-label="Chargement" />
    </div>
  );
}
