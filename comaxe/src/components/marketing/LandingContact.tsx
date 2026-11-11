'use client';

import React from 'react';
import { Facebook, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

/* Coordonnées officielles COMAXE — aucune autre information de contact. */
const CHANNELS = [
  {
    icon: Facebook,
    label: 'Facebook',
    value: 'COMAXE',
    href: 'https://www.facebook.com/profile.php?id=61596291806797',
    external: true,
    tone: 'bg-blue-50 text-[#1E5BF8]',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '+243 835 863 8382',
    href: 'https://wa.me/243835868382',
    external: true,
    tone: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'comaxesupport@gmail.com',
    href: 'mailto:comaxesupport@gmail.com',
    external: false,
    tone: 'bg-amber-50 text-amber-600',
  },
];

/**
 * Section Contact (ancre #contact) — uniquement les canaux officiels.
 */
export function LandingContact() {
  const { t } = useI18n();

  return (
    <section id="contact" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-8 bg-slate-50/60 border-y border-slate-200/60">
      <div className="max-w-5xl mx-auto">
        <SectionHeading
          eyebrow={['Contact', 'Contact']}
          title={['Une question ? Parlons-', 'A question? Let’s talk']}
          accent={['en ensemble', 'together']}
          subtitle={[
            'L’équipe COMAXE vous répond directement sur les canaux officiels ci-dessous.',
            'The COMAXE team answers you directly on the official channels below.',
          ]}
        />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {CHANNELS.map(({ icon: Icon, label, value, href, external, tone }) => (
            <a
              key={label}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all text-center"
            >
              <span className={`inline-flex p-2.5 rounded-xl ${tone}`}>
                <Icon className="w-5 h-5" />
              </span>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-sm font-extrabold text-slate-900 break-words">{value}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1E5BF8] opacity-0 group-hover:opacity-100 transition-opacity">
                {t('Ouvrir', 'Open')}
                <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
