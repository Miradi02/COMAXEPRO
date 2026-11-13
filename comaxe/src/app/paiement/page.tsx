'use client';

/**
 * COMAXE — /paiement : choix du moyen de paiement puis redirection
 * vers le Checkout Stripe hébergé (Payment Link de l'offre demandée).
 *
 * Page DÉDIÉE hors groupe (app) : SANS sidebar ni en-tête — un parcours
 * de paiement pleine largeur, seul élément = la carte centrale.
 *
 * • `?plan=pro|max` + `?interval=month|year` (défaut month) — paramètres
 *   absents ou invalides → retour /tarifs ;
 * • Carte / Google Pay / Apple Pay → un SEUL Checkout Stripe (le lien
 *   emballé identifie l'offre et la période, le webhook en déduit
 *   l'abonnement — jamais le frontend) ;
 * • Mobile Money → « Bientôt disponible » (désactivé, jamais simulé) ;
 * • la route /api/billing/checkout enregistre la DEMANDE puis renvoie
 *   l'URL : un clic n'est jamais un paiement (le webhook = vérité).
 *
 * Design system COMAXE : canvas #F8F9FD, cartes blanches rounded-2xl/
 * sm:rounded-3xl border-slate-200/80 shadow-xs, accent #1E5BF8,
 * icônes lucide-react, montants en USD via formatUSD().
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Apple,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { BillingApiError, startCheckout } from '@/lib/billing/client';
import { getPlan, isPayablePlan } from '@/lib/billing/plans.config';
import { formatUSD } from '@/lib/utils';
import type { BillingInterval, PlanId } from '@/lib/billing/types';

/* ── Moyens de paiement ───────────────────────────────────────────── */

type PayMethod = 'card' | 'google_pay' | 'apple_pay';

const METHODS: {
  id: PayMethod;
  icon: typeof CreditCard;
  fr: string;
  en: string;
  subFr: string;
  subEn: string;
}[] = [
  {
    id: 'card',
    icon: CreditCard,
    fr: 'Carte bancaire',
    en: 'Credit card',
    subFr: 'Visa, Mastercard et autres cartes',
    subEn: 'Visa, Mastercard and other cards',
  },
  {
    id: 'google_pay',
    icon: Wallet,
    fr: 'Google Pay',
    en: 'Google Pay',
    subFr: 'Depuis votre compte Google',
    subEn: 'From your Google account',
  },
  {
    id: 'apple_pay',
    icon: Apple,
    fr: 'Apple Pay',
    en: 'Apple Pay',
    subFr: 'Touch ID ou Face ID',
    subEn: 'Touch ID or Face ID',
  },
];

/* ── Page ──────────────────────────────────────────────────────────── */

export default function PaiementPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const planParam = searchParams.get('plan');
  const intervalParam = searchParams.get('interval');
  const plan: PlanId | null = isPayablePlan(planParam) ? planParam : null;
  const interval: BillingInterval = intervalParam === 'year' ? 'year' : 'month';
  const paramsValid =
    plan !== null &&
    (intervalParam === null || intervalParam === 'month' || intervalParam === 'year');

  const [method, setMethod] = useState<PayMethod>('card');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toute valeur hors périmètre renvoie aux offres plutôt que de payer
  // autre chose que ce qui a été choisi sur /tarifs.
  useEffect(() => {
    if (!paramsValid) router.replace('/tarifs');
  }, [paramsValid, router]);

  // Garde côté client (le middleware a déjà redirigé côté serveur).
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent('/paiement')}`);
    }
  }, [authLoading, user, router]);

  const planDef = plan ? getPlan(plan) : null;
  const price =
    planDef ? (interval === 'year' ? planDef.priceAnnual : planDef.priceMonthly) : null;

  /* ── Redirection vers le Checkout Stripe ── */
  const pay = async () => {
    if (!plan || paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await startCheckout(plan, interval);
      if (res?.url) {
        window.location.href = res.url; // Stripe héberge le paiement
        return;
      }
      throw new Error('url absente');
    } catch (e) {
      if (e instanceof BillingApiError) {
        if (e.status === 401) {
          router.replace(`/login?next=${encodeURIComponent('/paiement')}`);
          return;
        }
        if (e.status === 503 || e.configured) {
          setError(
            t(
              'Paiement en ligne indisponible pour le moment — réessayez plus tard.',
              'Online payment unavailable right now — please try again later.'
            )
          );
        } else {
          setError(e.message);
        }
      } else {
        setError(
          t(
            'Impossible de préparer le paiement. Réessayez.',
            'Could not prepare the payment. Please try again.'
          )
        );
      }
      setPaying(false);
    }
  };

  /* ── Chargement (URL en cours de lecture) ── */
  if (!planDef || price === null) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-[#1E5BF8]" />
        <p className="text-sm font-semibold">
          {t('Préparation du paiement…', 'Preparing payment…')}
        </p>
      </div>
    );
  }

  const periodLabel =
    interval === 'year' ? t('Annuel', 'Yearly') : t('Mensuel', 'Monthly');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ── En-tête + retour offres ── */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/tarifs"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('Retour aux offres', 'Back to plans')}
        </Link>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-[11px] font-bold text-[#1E5BF8]">
          <ShieldCheck className="w-3.5 h-3.5" />
          {t('Paiement sécurisé', 'Secure payment')}
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {t('Finaliser votre abonnement', 'Complete your subscription')}
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">
          {t(
            'Vous serez redirigé vers le paiement sécurisé Stripe.',
            'You will be redirected to Stripe’s secure payment.'
          )}
        </p>
      </div>

      {/* ── Récapitulatif de l'offre ── */}
      <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">
                COMAXE {planDef.name}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {t(
                `${planDef.limits.salesPerMonth} ventes/mois · ${planDef.limits.products} produits · ${planDef.limits.customers} clients`,
                `${planDef.limits.salesPerMonth} sales/month · ${planDef.limits.products} products · ${planDef.limits.customers} customers`
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-extrabold text-[#1E5BF8]">
              {formatUSD(price)}
              <span className="text-sm font-bold text-slate-400">
                {interval === 'year' ? t(' / an', ' / year') : t(' / mois', ' / month')}
              </span>
            </p>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">{periodLabel}</p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {t('Offre et période choisies sur la page tarifs', 'Plan and period chosen on the pricing page')}
          </span>
          <Link
            href="/tarifs"
            className="text-xs font-bold text-[#1E5BF8] hover:text-[#1548CF] transition-colors"
          >
            {t('Modifier', 'Change')}
          </Link>
        </div>
      </section>

      {/* ── Moyens de paiement ── */}
      <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
            <CreditCard className="w-4 h-4" />
          </span>
          <h2 className="text-base font-bold text-slate-900">
            {t('Moyen de paiement', 'Payment method')}
          </h2>
        </div>

        <div role="radiogroup" aria-label={t('Moyen de paiement', 'Payment method')} className="space-y-2.5">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const selected = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                  selected
                    ? 'border-[#1E5BF8] bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span
                  className={`p-2 rounded-lg shrink-0 ${
                    selected ? 'bg-[#1E5BF8] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">
                    {t(m.fr, m.en)}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {t(m.subFr, m.subEn)}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    selected ? 'border-[#1E5BF8] bg-[#1E5BF8]' : 'border-slate-300'
                  }`}
                >
                  {selected && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-white m-auto mt-[3px]" />
                  )}
                </span>
              </button>
            );
          })}

          {/* Mobile Money : jamais simulé, jamais développé */}
          <div
            aria-disabled="true"
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50/60 opacity-70 cursor-not-allowed"
          >
            <span className="p-2 rounded-lg bg-slate-200/70 text-slate-500 shrink-0">
              <Smartphone className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-600">Mobile Money</span>
              <span className="block text-xs text-slate-400 mt-0.5">
                {t(
                  'Paiement depuis votre numéro mobile',
                  'Payment from your mobile number'
                )}
              </span>
            </span>
            <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-700">
              {t('Bientôt disponible', 'Coming soon')}
            </span>
          </div>
        </div>

        {/* ── Erreur éventuelle ── */}
        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* ── Action : vers le Checkout Stripe ── */}
        <button
          type="button"
          onClick={pay}
          disabled={paying}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] disabled:opacity-60 text-white text-sm font-bold shadow-md shadow-blue-500/25 active:scale-[0.99] transition-all"
        >
          {paying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('Redirection vers Stripe…', 'Redirecting to Stripe…')}
            </>
          ) : (
            <>
              {t('Payer', 'Pay')} {formatUSD(price)}
              {interval === 'year' ? t(' / an', ' / year') : t(' / mois', ' / month')}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
          {t(
            'Paiement traité par Stripe : aucune donnée de carte n’est stockée par COMAXE. Votre abonnement n’activera qu’après confirmation du paiement.',
            'Payment processed by Stripe: no card data is stored by COMAXE. Your plan activates only after payment confirmation.'
          )}
        </p>
      </section>
    </div>
  );
}
