'use client';

import React from 'react';
import { useI18n } from '@/context/I18nContext';

/** [fr, en] */
export type L = [string, string];

/**
 * Titre de section standard de la landing (eyebrow + titre + accent + sous-titre).
 * Style calé sur la référence `photo/acceuil.webp` : titre gras centré avec
 * segment accentué en bleu COMAXE.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  subtitle,
  accentClass = 'text-[#1E5BF8]',
  eyebrowClass = 'bg-blue-50 text-[#1E5BF8] border-blue-200/80',
}: {
  eyebrow?: L;
  title: L;
  accent?: L;
  subtitle?: L;
  /** Classes du mot accentué (couleur de section) */
  accentClass?: string;
  /** Classes du badge eyebrow (couleur de section) */
  eyebrowClass?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="text-center max-w-2xl mx-auto">
      {eyebrow && (
        <span
          className={`inline-block px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${eyebrowClass}`}
        >
          {t(eyebrow[0], eyebrow[1])}
        </span>
      )}
      <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
        {t(title[0], title[1])}{' '}
        {accent && <span className={accentClass}>{t(accent[0], accent[1])}</span>}
      </h2>
      {subtitle && (
        <p className="mt-4 text-slate-500 text-sm sm:text-base leading-relaxed">
          {t(subtitle[0], subtitle[1])}
        </p>
      )}
    </div>
  );
}
