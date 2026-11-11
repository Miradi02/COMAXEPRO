'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

/**
 * Bandeau CTA final (calé sur le bloc dégradé de la référence) :
 * dernière relance avant le footer, tout en bleu COMAXE.
 */
export function LandingCta() {
  const { t } = useI18n();

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-[#1E5BF8] to-[#1548CF] px-6 sm:px-14 py-14 sm:py-16 text-center shadow-2xl shadow-blue-500/30">
          {/* Décor */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-white/10 blur-2xl"
          />

          <h2 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {t('Prêt à mieux gérer ', 'Ready to run ')}
            <span className="text-blue-100">{t('votre commerce ?', 'your business better?')}</span>
          </h2>
          <p className="relative mt-4 text-blue-100 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {t(
              'Créez votre compte gratuitement, choisissez votre offre et commencez à enregistrer vos ventes aujourd’hui.',
              'Create your account for free, choose your plan and start recording sales today.'
            )}
          </p>

          <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="#tarifs"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white text-[#1548CF] text-sm font-bold shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
            >
              {t('Commencer gratuitement', 'Start for free')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/40 text-white text-sm font-bold hover:bg-white/10 transition-all"
            >
              {t('Nous contacter', 'Contact us')}
            </Link>
          </div>

          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {[t('Gratuit pour commencer', 'Free to start'), t('Sans installation', 'No installation')].map(
              (chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-100"
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  {chip}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
