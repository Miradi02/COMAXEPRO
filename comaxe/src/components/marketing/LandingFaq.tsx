'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { SectionHeading } from './ui';

const FAQ: { qFr: string; qEn: string; aFr: string; aEn: string }[] = [
  {
    qFr: 'Qu’est-ce que COMAXE ?',
    qEn: 'What is COMAXE?',
    aFr:
      'COMAXE est un outil de gestion de commerce qui aide les commerçants à mieux gérer leurs ventes, leur stock, leurs clients, leurs dépenses, leurs dettes et leurs bénéfices.',
    aEn:
      'COMAXE is a business management tool that helps merchants better handle their sales, inventory, customers, expenses, debts and profits.',
  },
  {
    qFr: 'COMAXE est-il gratuit ?',
    qEn: 'Is COMAXE free?',
    aFr:
      'Oui. L’offre Essential est gratuite : 15 ventes, 10 produits et 15 clients par mois pour démarrer. Les offres Pro (5 $/mois ou 49 $/an) et Max (14 $/mois ou 149 $/an) offrent davantage de capacité, Ultime (24 $/mois, bientôt disponible) ajoute l’intelligence artificielle, et les offres Business (59 $/mois et 99 $/mois, bientôt disponibles) gèrent plusieurs boutiques et équipes.',
    aEn:
      'Yes. The Essential plan is free: 50 sales, 30 products and 30 customers per month to get started. Pro ($5/month or $49/year) and Max ($14/month or $149/year) offer more capacity, Ultime ($24/month, coming soon) adds artificial intelligence, and the Business plans ($59/month and $99/month, coming soon) manage multiple shops and teams.',
  },
  {
    qFr: 'Dois-je installer quelque chose ?',
    qEn: 'Do I need to install anything?',
    aFr:
      'Non. COMAXE fonctionne dans votre navigateur, sur ordinateur comme sur téléphone, sans téléchargement.',
    aEn:
      'No. COMAXE runs in your browser, on desktop and phone, with no download.',
  },
  {
    qFr: 'Comment choisir mon offre ?',
    qEn: 'How do I choose my plan?',
    aFr:
      'Créez gratuitement votre compte, connectez-vous : vous arriverez sur la page Tarifs pour découvrir les six offres, réparties entre gestion d’un commerce et gestion d’entreprise. Aucun paiement n’est encaissé pour le moment.',
    aEn:
      'Create your account for free and sign in: you land on the Pricing page with the six plans, split between shop management and business management. No payment is processed for now.',
  },
  {
    qFr: 'Mes données sont-elles en sécurité ?',
    qEn: 'Is my data safe?',
    aFr:
      'Vos données appartiennent à votre commerce. Vous pouvez supprimer votre compte et vos données à tout moment depuis les Paramètres.',
    aEn:
      'Your data belongs to your business. You can delete your account and data at any time from Settings.',
  },
  {
    qFr: 'Puis-je utiliser COMAXE en français ?',
    qEn: 'Can I use COMAXE in French?',
    aFr:
      'Oui, l’interface est disponible en français et en anglais, avec le thème clair ou sombre selon votre préférence.',
    aEn:
      'Yes, the interface is available in French and English, with light or dark theme to your preference.',
  },
];

/**
 * Section FAQ (ancre #faq) — accordéon natif <details> (accessible, sans JS).
 */
export function LandingFaq() {
  const { t } = useI18n();

  return (
    <section id="faq" className="scroll-mt-24 py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto">
        <SectionHeading
          eyebrow={['FAQ', 'FAQ']}
          title={['Questions', 'Questions']}
          accent={['fréquentes', 'answered']}
          subtitle={[
            'Tout ce qu’il faut savoir avant de commencer.',
            'Everything you need to know before getting started.',
          ]}
        />

        <div className="mt-10 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.qEn}
              className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 cursor-pointer list-none select-none">
                <span className="text-sm sm:text-base font-bold text-slate-900">
                  {t(item.qFr, item.qEn)}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 sm:px-6 pb-5 text-sm text-slate-500 leading-relaxed">
                {t(item.aFr, item.aEn)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
