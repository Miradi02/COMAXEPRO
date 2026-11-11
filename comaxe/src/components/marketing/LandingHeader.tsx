'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useI18n } from '@/context/I18nContext';

const NAV: { href: string; fr: string; en: string }[] = [
  { href: '#fonctionnalites', fr: 'Fonctionnalités', en: 'Features' },
  { href: '#tarifs', fr: 'Tarifs', en: 'Pricing' },
  { href: '#faq', fr: 'FAQ', en: 'FAQ' },
  { href: '#contact', fr: 'Contact', en: 'Contact' },
];

/**
 * En-tête sticky de la landing (calé sur la barre flottante de la référence) :
 * logo → accueil, navigation vers les sections, connexion et CTA « Commencer ».
 */
export function LandingHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 bg-[#F8F9FD]/90 backdrop-blur-md border-b border-slate-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <BrandLogo size={34} className="group-hover:scale-105 transition-transform" />
          <span className="text-xl font-extrabold tracking-tight text-slate-900">comaxe</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-[#1E5BF8] hover:bg-blue-50/60 transition-colors"
            >
              {t(item.fr, item.en)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/login"
            className="px-3 sm:px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('Connexion', 'Sign in')}
          </Link>
          <Link
            href="#tarifs"
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-sm font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
          >
            {t('Commencer', 'Get started')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
