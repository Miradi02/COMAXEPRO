'use client';

import React from 'react';
import Link from 'next/link';
import { Facebook, MessageCircle, Mail } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useI18n } from '@/context/I18nContext';

const NAV_LINKS = [
  { href: '/', fr: 'Accueil', en: 'Home' },
  { href: '#fonctionnalites', fr: 'Fonctionnalités', en: 'Features' },
  { href: '#tarifs', fr: 'Tarifs', en: 'Pricing' },
  { href: '#faq', fr: 'FAQ', en: 'FAQ' },
  { href: '#contact', fr: 'Contact', en: 'Contact' },
];

const ACCOUNT_LINKS = [
  { href: '/login', fr: 'Connexion', en: 'Sign in' },
  { href: '/login', fr: 'Créer un compte', en: 'Create account' },
  { href: '/tarifs', fr: 'Page Tarifs', en: 'Pricing page' },
  { href: '/dashboard', fr: 'Ouvrir l’application', en: 'Open the app' },
];

const CONTACT_LINKS = [
  {
    icon: Facebook,
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61596291806797',
  },
  { icon: MessageCircle, label: '+243 835 863 8382', href: 'https://wa.me/243835868382' },
  { icon: Mail, label: 'comaxesupport@gmail.com', href: 'mailto:comaxesupport@gmail.com' },
];

/**
 * Footer de la landing — logo + tagline, colonnes Navigation / Compte /
 * Contact (coordonnées officielles uniquement), barre de copyright.
 */
export function LandingFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Marque */}
        <div>
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <BrandLogo size={34} className="group-hover:scale-105 transition-transform" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900">comaxe</span>
          </Link>
          <p className="mt-4 text-sm text-slate-500 leading-relaxed">
            {t(
              'L’outil de gestion de commerce qui aide les commerçants à enregistrer, conserver, organiser et analyser leurs données.',
              'The business management tool that helps merchants record, keep, organize and analyze their data.'
            )}
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('Navigation', 'Navigation')}
          </p>
          <ul className="mt-4 space-y-2.5">
            {NAV_LINKS.map((item) => (
              <li key={item.fr}>
                <Link
                  href={item.href}
                  className="text-sm font-semibold text-slate-500 hover:text-[#1E5BF8] transition-colors"
                >
                  {t(item.fr, item.en)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Compte */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('Compte', 'Account')}
          </p>
          <ul className="mt-4 space-y-2.5">
            {ACCOUNT_LINKS.map((item) => (
              <li key={item.fr}>
                <Link
                  href={item.href}
                  className="text-sm font-semibold text-slate-500 hover:text-[#1E5BF8] transition-colors"
                >
                  {t(item.fr, item.en)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('Contact', 'Contact')}
          </p>
          <ul className="mt-4 space-y-3">
            {CONTACT_LINKS.map(({ icon: Icon, label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-2.5 text-sm font-semibold text-slate-500 hover:text-[#1E5BF8] transition-colors break-all"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Barre de copyright */}
      <div className="border-t border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            © 2026 COMAXE — {t('Tous droits réservés', 'All rights reserved')}
          </p>
          <p className="text-xs text-slate-400">
            {t(
              'Conçu pour les commerçants.',
              'Designed for merchants.'
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
