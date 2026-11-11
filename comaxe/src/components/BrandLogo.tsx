import React from 'react';

/**
 * Logo officiel COMAXE — bascule automatiquement selon le thème actif :
 *   THÈME CLAIR → logo C   |   THÈME SOMBRE → logo S
 * (« Système » suit les préférences du système d'exploitation.)
 *
 * Le fichier est choisi par la variable CSS `--comaxe-logo`, redéfinie dans
 * le bloc `.dark` de globals.css. La classe `dark` est posée sur <html> par
 * le script inline du layout AVANT le premier rendu : le logo est donc
 * correct dès la première image, sans clignotement. La chaîne rendue est
 * par ailleurs identique côté serveur et côté client — aucune divergence
 * d'hydratation possible.
 *
 * Utilisé partout où la marque apparaît : barre latérale, page de connexion,
 * en-tête, identité du compte.
 */
export function BrandLogo({
  size = 36,
  className = '',
  alt = 'COMAXE',
}: {
  /** Côté du carré en pixels */
  size?: number;
  className?: string;
  /** Libellé accessible (le logo est un fond CSS, pas une balise <img>) */
  alt?: string;
}) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={`brand-logo inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
