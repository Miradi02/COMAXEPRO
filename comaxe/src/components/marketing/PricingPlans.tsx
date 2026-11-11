'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Lock,
  Megaphone,
  Sparkles,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  Users,
  Crown,
  X,
  Star,
  ShoppingBag,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { PlanCtaButton } from '@/components/billing/PlanCtaButton';
import type { PlanId } from '@/lib/billing/types';
import {
  BUSINESS_RULES,
  CATEGORIES,
  CTA_LABELS,
  HIDE_FEATURES_LABEL,
  VIEW_FEATURES_LABEL,
  plansOf,
  type L,
  type Plan,
  type PlanCategoryId,
} from './plans';

/* ─────────────────────────────────────────────────────────────
   GRILLE TARIFAIRE COMAXE — composant partagé :
     • la page publique /tarifs
     • la section « Tarifs » de la landing page (ancre #tarifs)
   6 offres réparties en 2 catégories :
     • Gestion d'un commerce : Essential, Pro, Max, Ultime
     • Gestion d'entreprise  : Business Max, Business Ultime
   Cartes synthétiques + bouton « Voir les fonctionnalités ».
   AUCUN paiement ni abonnement réel : Essential / Pro / Max
   dirigent vers l'authentification, les 3 autres sont
   désactivées (« Bientôt disponible »).
   ───────────────────────────────────────────────────────────── */

type Billing = 'monthly' | 'annual';

/* ── Qualification visuelle d'une ligne ── */
type LineKind = 'ok' | 'locked' | 'ads' | 'off';

function kindOf(item: L): LineKind {
  // « bloqués » ET « débloqués » contiennent « bloqu » : on exclut le préfixe « dé- »
  const frBlocked = /bloqu/i.test(item.fr) && !/débloqu/i.test(item.fr);
  const enBlocked = /locked/i.test(item.en) && !/unlocked/i.test(item.en);
  if (frBlocked || enBlocked) return 'locked';
  if (
    /publicités activées|avec publicité/i.test(item.fr) ||
    /ads enabled|with ads/i.test(item.en)
  )
    return 'ads';
  if (/^pas (d’|d'|de |des )/i.test(item.fr) || /^aucun/i.test(item.fr) || /^no /i.test(item.en))
    return 'off';
  return 'ok';
}

/* ── Ligne de caractéristique (synthèse ou détail) ── */
function Line({ item, featured = false }: { item: L; featured?: boolean }) {
  const { t } = useI18n();
  const label = t(item.fr, item.en);
  const kind = kindOf(item);

  if (kind === 'locked') {
    return (
      <li className={`flex items-start gap-2.5 text-sm ${featured ? 'text-white/70' : 'text-slate-400'}`}>
        <span
          className={`mt-0.5 p-0.5 rounded-md shrink-0 ${
            featured ? 'bg-white/15 text-white/70' : 'bg-slate-100 text-slate-400'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
        </span>
        <span className="line-through decoration-slate-300">{label}</span>
      </li>
    );
  }

  if (kind === 'ads') {
    return (
      <li
        className={`flex items-start gap-2.5 text-sm ${
          featured ? 'text-amber-200' : 'text-amber-700'
        }`}
      >
        <span
          className={`mt-0.5 p-0.5 rounded-md shrink-0 ${
            featured ? 'bg-white/15 text-amber-200' : 'bg-amber-50 text-amber-600'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
        </span>
        <span>{label}</span>
      </li>
    );
  }

  if (kind === 'off') {
    return (
      <li className={`flex items-start gap-2.5 text-sm ${featured ? 'text-blue-100/80' : 'text-slate-400'}`}>
        <span
          className={`mt-0.5 p-0.5 rounded-md shrink-0 ${
            featured ? 'bg-white/15 text-blue-100/80' : 'bg-slate-100 text-slate-400'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </span>
        <span>{label}</span>
      </li>
    );
  }

  if (featured) {
    return (
      <li className="flex items-start gap-2.5 text-sm text-white">
        <span className="mt-0.5 p-0.5 rounded-md bg-white/20 text-white shrink-0">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
        <span>{label}</span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2.5 text-sm text-slate-700">
      <span className="mt-0.5 p-0.5 rounded-md bg-emerald-50 text-emerald-600 shrink-0">
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </span>
      <span>{label}</span>
    </li>
  );
}

/* ── Icône d'accent en haut à droite de la carte ── */
function PlanAccentIcon({ plan, featured }: { plan: Plan; featured: boolean }) {
  const { t } = useI18n();
  if (plan.accent === 'ai') {
    return <Sparkles className="w-4 h-4 text-violet-500" aria-label={t('Intelligence artificielle', 'Artificial intelligence')} />;
  }
  if (plan.accent === 'business') {
    return <Users className="w-4 h-4 text-sky-500" aria-label={t('Équipes et boutiques', 'Teams and shops')} />;
  }
  if (plan.accent === 'ultimate') {
    return <Crown className="w-4 h-4 text-amber-500" aria-label={t('Offre la plus complète', 'Most complete plan')} />;
  }
  if (featured) {
    return <Sparkles className="w-4 h-4 text-blue-100" />;
  }
  return null;
}

/* ── Carte d'offre ── */

/** Offres gérées par le moteur d'abonnement → CTA connecté (PlanCtaButton) */
const isEnginePlan = (id: Plan['id']): id is PlanId =>
  id === 'essential' || id === 'pro' || id === 'max';

function PlanCard({
  plan,
  ctaHref,
  isAnnual,
}: {
  plan: Plan;
  ctaHref: string;
  isAnnual: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const featured = plan.accent === 'popular';
  const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
  const period = isAnnual ? t(' / an', ' / year') : t(' / mois', ' / month');

  const ctaBase =
    'w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap';
  const freeCls = `${ctaBase} px-3.5 text-[13px]`;
  const subCls = `${ctaBase} px-5 text-sm`;

  return (
    <div
      className={`group relative flex flex-col transition-all duration-300 ${
        featured
          ? 'rounded-3xl p-6 sm:p-7 bg-gradient-to-b from-[#1E5BF8] to-[#1548CF] text-white shadow-xl shadow-blue-500/25 ring-1 ring-[#1E5BF8] xl:-translate-y-3 hover:shadow-2xl hover:shadow-blue-500/40'
          : plan.accent === 'ai'
            ? 'rounded-3xl p-6 sm:p-7 border-2 border-transparent shadow-xs hover:shadow-lg hover:-translate-y-1 [background:linear-gradient(var(--comaxe-surface),var(--comaxe-surface))_padding-box,linear-gradient(135deg,#8B5CF6,#D946EF,#1E5BF8)_border-box]'
            : plan.accent === 'ultimate'
              ? 'rounded-3xl p-6 sm:p-7 border-2 border-transparent shadow-xs hover:shadow-lg hover:-translate-y-1 [background:linear-gradient(var(--comaxe-surface),var(--comaxe-surface))_padding-box,linear-gradient(135deg,#0F172A,#1E5BF8,#7C3AED)_border-box]'
              : 'rounded-3xl p-6 sm:p-7 bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-lg hover:-translate-y-1'
      }`}
    >
      {/* Liseré d'accent (Business Max) */}
      {plan.accent === 'business' && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 rounded-t-3xl transition-all group-hover:h-1.5 bg-gradient-to-r from-[#1E5BF8] to-[#38BDF8]"
        />
      )}

      {/* Badge « Le plus populaire » */}
      {plan.badge && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 rounded-full bg-[#FFFFFF] text-[#1548CF] text-[11px] sm:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-blue-500/25 whitespace-nowrap">
          <Star className="w-3 h-3 fill-current" />
          {t(plan.badge.fr, plan.badge.en)}
        </span>
      )}

      {/* Nom + accent */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-sm font-extrabold uppercase tracking-wider ${
            featured ? 'text-blue-100' : 'text-slate-500'
          }`}
        >
          {plan.name}
        </span>
        <PlanAccentIcon plan={plan} featured={featured} />
      </div>

      {/* Chip premium */}
      {plan.chip && (
        <span
          className={`mt-2.5 self-start inline-flex px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide ${
            plan.accent === 'ai'
              ? 'bg-violet-50 text-violet-600 border border-violet-200/80'
              : plan.accent === 'business'
                ? 'bg-blue-50 text-[#1E5BF8]'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          {t(plan.chip.fr, plan.chip.en)}
        </span>
      )}

      {/* Prix */}
      <div className="mt-4 flex items-end gap-1">
        <span
          className={`text-4xl font-extrabold tracking-tight ${
            featured ? 'text-white' : 'text-slate-900'
          }`}
        >
          {price === null ? '$0' : `$${price}`}
        </span>
        <span
          className={`text-sm font-medium mb-1.5 ${
            featured ? 'text-blue-100' : 'text-slate-400'
          }`}
        >
          {period}
        </span>
      </div>
      <div className="mt-2 min-h-[22px]">
        {price === null ? (
          <span className="inline-flex px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            {t('Gratuit', 'Free')}
          </span>
        ) : (
          isAnnual &&
          plan.annualNote && (
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                featured
                  ? 'bg-white/15 text-white'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {t(plan.annualNote.fr, plan.annualNote.en)}
            </span>
          )
        )}
      </div>

      {/* Description */}
      <p className={`mt-3 text-sm ${featured ? 'text-blue-100' : 'text-slate-500'}`}>
        {t(plan.tagline.fr, plan.tagline.en)}
      </p>

      {/* Points synthétiques */}
      <ul className="mt-6 space-y-2.5 flex-1">
        {plan.highlight.map((item) => (
          <Line key={item.en} item={item} featured={featured} />
        ))}
      </ul>

      {/* Bouton « Voir les fonctionnalités » */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`mt-5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-colors ${
          featured
            ? 'border-white/40 text-white hover:border-white/70'
            : 'border-slate-200 text-slate-500 hover:text-[#1E5BF8] hover:border-blue-300'
        }`}
      >
        {open ? t(HIDE_FEATURES_LABEL.fr, HIDE_FEATURES_LABEL.en) : t(VIEW_FEATURES_LABEL.fr, VIEW_FEATURES_LABEL.en)}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Détails dépliés */}
      {open && (
        <div
          className={`mt-4 rounded-2xl p-4 sm:p-5 ${
            featured ? 'bg-white/10' : 'bg-blue-50 border border-blue-100'
          }`}
        >
          {plan.details.map((group, i) => (
            <div
              key={group.title.en}
              className={
                i > 0
                  ? `mt-4 pt-4 border-t ${featured ? 'border-white/15' : 'border-blue-100'}`
                  : ''
              }
            >
              <p
                className={`text-[11px] font-extrabold uppercase tracking-wider ${
                  featured ? 'text-blue-100' : 'text-[#1E5BF8]'
                }`}
              >
                {t(group.title.fr, group.title.en)}
              </p>
              <ul className="mt-2 space-y-2">
                {group.items.map((item) => (
                  <Line key={item.en} item={item} featured={featured} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Bouton d'action */}
      {plan.cta === 'soon' ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t(
            'Offre en préparation — le paiement sera disponible prochainement.',
            'Plan coming soon — payments will be available later.'
          )}
          className={`${subCls} mt-6 bg-slate-100 text-slate-500 cursor-not-allowed`}
        >
          <Lock className="w-4 h-4" />
          {t(CTA_LABELS.soon.fr, CTA_LABELS.soon.en)}
        </button>
      ) : isEnginePlan(plan.id) ? (
        /* Offres du moteur : CTA connecté (login → demande → simulateur) */
        <PlanCtaButton
          planId={plan.id}
          label={
            plan.cta === 'free'
              ? t(CTA_LABELS.free.fr, CTA_LABELS.free.en)
              : t(CTA_LABELS.subscribe.fr, CTA_LABELS.subscribe.en)
          }
          className={`${plan.cta === 'free' ? freeCls : subCls} mt-6 ${
            plan.cta === 'free'
              ? 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-[#1E5BF8]'
              : featured
                ? 'bg-[#FFFFFF] text-[#1548CF] hover:bg-[#EDF1F8] shadow-md'
                : 'bg-[#1E5BF8] text-white hover:bg-[#1548CF] shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35'
          }`}
        />
      ) : (
        <Link
          href={ctaHref}
          className={`${plan.cta === 'free' ? freeCls : subCls} mt-6 ${
            plan.cta === 'free'
              ? 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-[#1E5BF8]'
              : featured
                ? 'bg-[#FFFFFF] text-[#1548CF] hover:bg-[#EDF1F8] shadow-md'
                : 'bg-[#1E5BF8] text-white hover:bg-[#1548CF] shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35'
          }`}
        >
          {plan.cta === 'free'
            ? t(CTA_LABELS.free.fr, CTA_LABELS.free.en)
            : t(CTA_LABELS.subscribe.fr, CTA_LABELS.subscribe.en)}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

/* ── Rappel des règles du système Business ── */
function BusinessRules() {
  const { t } = useI18n();
  return (
    <div className="mt-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-6">
      <div className="flex items-center gap-2.5">
        <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
          <ShieldCheck className="w-4 h-4" />
        </span>
        <h4 className="text-base font-bold text-slate-900">
          {t('Règles du système Business', 'Business system rules')}
        </h4>
      </div>
      <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {BUSINESS_RULES.map((rule) => (
          <li key={rule.en} className="flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
            <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
            <span>{t(rule.fr, rule.en)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Bloc de catégorie (titre + grille d'offres) ── */
function CategoryBlock({
  category,
  ctaHref,
  isAnnual,
}: {
  category: PlanCategoryId;
  ctaHref: string;
  isAnnual: boolean;
}) {
  const { t } = useI18n();
  const meta = CATEGORIES.find((c) => c.id === category)!;
  const plans = plansOf(category);

  return (
    <div className={category === 'entreprise' ? 'mt-14' : undefined}>
      <div className="flex items-start gap-3">
        <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8] shrink-0">
          {category === 'commerce' ? (
            <ShoppingBag className="w-4 h-4" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900 shrink-0">
              {t(meta.title.fr, meta.title.en)}
            </h3>
            <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-extrabold">
              {t(`${plans.length} offres`, `${plans.length} plans`)}
            </span>
            <span
              aria-hidden
              className="hidden sm:block flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"
            />
          </div>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            {t(meta.intro.fr, meta.intro.en)}
          </p>
        </div>
      </div>

      <div
        className={
          category === 'commerce'
            ? 'mt-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-6'
            : 'mt-7 grid grid-cols-1 md:grid-cols-2 gap-6'
        }
      >
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} ctaHref={ctaHref} isAnnual={isAnnual} />
        ))}
      </div>

      {category === 'entreprise' && <BusinessRules />}
    </div>
  );
}

export function PricingPlans({
  id,
  ctaHref = '/login',
}: {
  id?: string;
  /** Destination des boutons Essential / Pro / Max : '/login' (visiteur) ou '/dashboard' (après connexion) */
  ctaHref?: string;
}) {
  const { t } = useI18n();
  const [billing, setBilling] = useState<Billing>('monthly');
  const isAnnual = billing === 'annual';

  return (
    <div id={id} className={id ? 'scroll-mt-24' : undefined}>
      {/* ── Sélecteur Mensuel | Annuel ── */}
      <div className="flex flex-col items-center gap-2">
        <div
          role="group"
          aria-label={t('Périodicité de facturation', 'Billing period')}
          className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80"
        >
          <button
            type="button"
            aria-pressed={!isAnnual}
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              !isAnnual ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t('Mensuel', 'Monthly')}
          </button>
          <button
            type="button"
            aria-pressed={isAnnual}
            onClick={() => setBilling('annual')}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
              isAnnual ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t('Annuel', 'Yearly')}
          </button>
        </div>
        <p className="text-xs font-semibold text-emerald-700">
          {isAnnual
            ? t('Jusqu’à 20 % d’économie avec l’offre annuelle', 'Save up to 20% with yearly billing')
            : t('Passez à l’annuel pour économiser', 'Switch to yearly to save')}
        </p>
      </div>

      {/* ── Catégorie 1 : gestion d'un commerce ── */}
      <div className="mt-12">
        <CategoryBlock category="commerce" ctaHref={ctaHref} isAnnual={isAnnual} />
      </div>

      {/* ── Catégorie 2 : gestion d'entreprise ── */}
      <CategoryBlock category="entreprise" ctaHref={ctaHref} isAnnual={isAnnual} />
    </div>
  );
}

/** Note informative réutilisable sous la grille tarifaire */
export function PricingNote() {
  const { t } = useI18n();
  return (
    <div className="mt-10 max-w-3xl mx-auto text-center">
      <div className="inline-flex items-start gap-2.5 px-5 py-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-left">
        <HelpCircle className="w-4 h-4 text-[#1E5BF8] mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          {t(
            'Comment ça marche : vos ventes, produits, clients et dettes sont limités selon l’offre choisie, et les offres Business ajoutent la gestion multi-boutiques, les collaborateurs et leurs permissions. Aucun paiement n’est encaissé pour le moment — après la création de votre compte, vous arrivez sur la page Tarifs pour choisir votre offre.',
            'How it works: sales, products, customers and debts follow your chosen plan’s limits, and the Business plans add multi-shop management, team members and their permissions. No payment is processed right now — after creating your account, you land on the Pricing page to pick your plan.'
          )}
        </p>
      </div>
    </div>
  );
}
