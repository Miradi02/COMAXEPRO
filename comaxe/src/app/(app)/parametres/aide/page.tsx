'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  Info,
  Mail,
  Send,
  Sparkles,
  Bug,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { supabase } from '@/lib/supabase/client';
import { SettingsButton, SettingsLayout, SettingsSection } from '@/components/settings/SettingsLayout';
import packageJson from '../../../../../package.json';

const inputStyle =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]';

const FAQ_KEYS = [
  {
    q: 'Comment enregistrer une vente ?',
    e: 'How do I record a sale?',
    a: 'Ouvrez la page Ventes, puis utilisez le bouton « Nouvelle Vente » dans l’en-tête ou le bouton présent dans le tableau. Renseignez le client, les articles, le montant et validez : la vente apparaît immédiatement dans votre historique.',
    aEn: 'Open the Sales page, then use the “New Sale” button in the header or the button in the table. Fill in the customer, items and amount, then save: the sale appears immediately in your history.',
  },
  {
    q: 'Comment suivre mon stock ?',
    e: 'How do I track my stock?',
    a: 'La page Produits & Stock liste tous vos articles avec leur quantité, leur seuil d’alerte et leur valeur. Les produits en rupture ou en stock faible sont signalés automatiquement.',
    aEn: 'The Products & Stock page lists every item with its quantity, alert threshold and value. Out-of-stock and low-stock items are flagged automatically.',
  },
  {
    q: 'COMAXE est-il payant ?',
    e: 'Is COMAXE paid?',
    a: 'Non. L’offre Essential est gratuite (0 $/mois) : 15 ventes, 10 produits et 15 clients par mois. Les offres Pro (5 $/mois ou 49 $/an) et Max (14 $/mois ou 149 $/an) offrent davantage de capacité ; les offres Ultime et Business seront disponibles prochainement.',
    aEn: 'No. The Essential plan is free ($0/month): 50 sales, 30 products and 30 customers per month. The Pro plan ($5/month or $49/year) and Max ($14/month or $149/year) offer more capacity; the Ultime and Business plans will be available soon.',
  },
  {
    q: 'Comment changer la langue ou le thème ?',
    e: 'How do I change the language or theme?',
    a: 'Allez dans Paramètres : la catégorie Affichage gère le thème (Système, Clair, Sombre), la police, la taille du texte et la langue. La devise d’affichage s’affiche en lecture seule dans Compte. Tout est appliqué immédiatement.',
    aEn: 'Go to Settings: Appearance handles the theme (System, Light, Dark), font, text size and language. The display currency is shown read-only under Account. Everything applies immediately.',
  },
  {
    q: 'Mes données sont-elles protégées ?',
    e: 'Is my data protected?',
    a: 'Oui. Chaque compte n’accède qu’à ses propres données : l’isolation est appliquée au niveau de la base de données, pas seulement dans l’interface.',
    aEn: 'Yes. Each account only accesses its own data: isolation is enforced at the database level, not just in the interface.',
  },
  {
    q: 'Comment exporter mes données ?',
    e: 'How do I export my data?',
    a: 'Paramètres → Données → « Exporter en JSON ». Vous récupérez un fichier complet contenant vos ventes, produits, clients, dépenses, dettes et rapports.',
    aEn: 'Settings → Data → “Export as JSON”. You get a complete file with your sales, products, customers, expenses, debts and reports.',
  },
];

export default function AidePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();

  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [kind, setKind] = useState<'contact' | 'problem'>('contact');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (sending) return;
    setError(null);
    setSent(false);

    if (subject.trim().length < 3) {
      setError(t('Indiquez un objet (3 caractères minimum).', 'Enter a subject (3 characters minimum).'));
      return;
    }
    if (message.trim().length < 10) {
      setError(t('Votre message doit contenir au moins 10 caractères.', 'Your message must be at least 10 characters.'));
      return;
    }

    setSending(true);
    try {
      const { error: insertError } = await supabase.from('support_requests').insert({
        user_id: user?.id ?? null,
        subject: subject.trim(),
        message: message.trim(),
        kind,
      });
      if (insertError) throw new Error(insertError.message);
      setSubject('');
      setMessage('');
      setSent(true);
    } catch {
      setError(t('Impossible d’envoyer le message. Réessayez plus tard.', 'Could not send the message. Please try again later.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsLayout>
      {/* ── CENTRE D'AIDE ── */}
      <SettingsSection
        icon={BookOpen}
        title={t('Centre d’aide', 'Help centre')}
        description={t(
          'Les réponses aux questions les plus fréquentes sur COMAXE.',
          'Answers to the most common questions about COMAXE.'
        )}
      >
        <div className="divide-y divide-slate-100">
          {FAQ_KEYS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 py-3 text-left"
                >
                  <span className="text-sm font-bold text-slate-800">
                    {locale === 'en' ? item.e : item.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-4 pr-8 text-xs leading-relaxed text-slate-500">
                    {locale === 'en' ? item.aEn : item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── CONTACTER LE SUPPORT / SIGNALER UN PROBLÈME ── */}
      <SettingsSection
        icon={CircleHelp}
        title={kind === 'contact' ? t('Contacter le support', 'Contact support') : t('Signaler un problème', 'Report a problem')}
        description={t(
          'Votre message est enregistré et traité par l’équipe COMAXE.',
          'Your message is stored and handled by the COMAXE team.'
        )}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { key: 'contact', label: t('Contacter le support', 'Contact support'), icon: Mail },
              { key: 'problem', label: t('Signaler un problème', 'Report a problem'), icon: Bug },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = kind === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setKind(opt.key);
                  setSent(false);
                  setError(null);
                }}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                  active
                    ? 'bg-blue-50 text-[#1E5BF8] border-[#1E5BF8] ring-2 ring-[#1E5BF8]/15'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 max-w-2xl">
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t('Objet', 'Subject')}</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder={
                kind === 'contact'
                  ? t('Question sur mon compte', 'Question about my account')
                  : t('Description du problème', 'Description of the issue')
              }
              className={inputStyle}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t('Message', 'Message')}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder={t('Décrivez votre demande en quelques lignes…', 'Describe your request in a few lines…')}
              className={`${inputStyle} resize-y`}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <SettingsButton onClick={handleSubmit} disabled={sending}>
            <Send className="w-4 h-4" />
            {sending ? t('Envoi…', 'Sending…') : t('Envoyer le message', 'Send message')}
          </SettingsButton>
          {sent && (
            <span className="text-xs font-bold text-emerald-600">
              {t('Message enregistré. Merci !', 'Message stored. Thank you!')}
            </span>
          )}
          {error && <span className="text-xs font-bold text-rose-600">{error}</span>}
        </div>
      </SettingsSection>

      {/* ── À PROPOS ── */}
      <SettingsSection
        icon={Info}
        title={t('À propos de COMAXE', 'About COMAXE')}
        description={t('Le logiciel de gestion commerciale des commerçants.', 'Business management software for merchants.')}
      >
        <div className="max-w-2xl space-y-3 text-xs leading-relaxed text-slate-600">
          <p>
            {t(
              'COMAXE permet d’enregistrer, conserver, organiser et analyser les données réelles d’un commerce : ventes, stock, clients, dépenses, bénéfices et objectifs.',
              'COMAXE lets you record, keep, organise and analyse the real data of a business: sales, stock, customers, expenses, profits and goals.'
            )}
          </p>
          <p>
            {t(
              'Chaque commerçant dispose de son propre espace sécurisé : les données d’un compte ne sont jamais visibles par un autre.',
              'Every merchant gets their own secure space: one account’s data is never visible to another.'
            )}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-900">COMAXE</span>
          </div>
        </div>
      </SettingsSection>

      {/* ── VERSION ── */}
      <SettingsSection
        icon={Sparkles}
        title={t('Version de l’application', 'Application version')}
        description={t('Build actuellement déployé.', 'Currently deployed build.')}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm font-bold text-slate-700">
            COMAXE v{packageJson.version}
          </span>
          <span className="text-[11px] text-slate-400">
            {t('Mise à jour en continu des fonctionnalités commerciales.', 'Continuous updates to the business features.')}
          </span>
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
