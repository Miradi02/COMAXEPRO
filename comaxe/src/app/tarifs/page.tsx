'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ArrowLeft, Mail, X, Sparkles, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useI18n } from '@/context/I18nContext';
import { useAuth } from '@/context/AuthContext';
import { useBilling } from '@/context/BillingContext';
import { requestPlan } from '@/lib/billing/client';
import { featureLockedMessage, formatMessage } from '@/lib/billing/messages';
import { getPlan, isPlanId } from '@/lib/billing/plans.config';
import type { FeatureKey, PlanId } from '@/lib/billing/types';
import { PricingPlans, PricingNote } from '@/components/marketing/PricingPlans';

/* ─────────────────────────────────────────────────────────────
   PAGE TARIFS COMAXE (route publique /tarifs)

   Présentation des 6 offres (2 catégories : gestion d'un commerce
   et gestion d'entreprise) — AUCUN paiement ni abonnement réel :
   sur cette page, Essential / Pro / Max dirigent vers le tableau
   de bord (post-connexion), Ultime et les offres Business restent
   désactivées (« Bientôt disponible »).
   La grille tarifaire est partagée avec la section #tarifs de la
   landing (composant PricingPlans), où les boutons mènent à la
   Connexion.
   ───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   Grille tarifaire selon l'arrivée :
   • /tarifs (défaut — visiteur, après inscription ou connexion) :
     les 4 offres, Essential compris ;
   • /tarifs?offres=payer (boutons « S'abonner » / « Changer de plan »
     et pub Max) : grille SANS l'offre gratuite.
   ───────────────────────────────────────────────────────────── */
function PricingGrid() {
  const searchParams = useSearchParams();
  const paidOnly = searchParams.get('offres') === 'payer';
  return <PricingPlans ctaHref="/dashboard" paidOnly={paidOnly} />;
}

export default function TarifsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { planId: activePlan, loading: billingLoading, refresh } = useBilling();
  const router = useRouter();
  const [justCreated, setJustCreated] = useState(false);
  /** Fonctionnalité verrouillée détectée (?locked=goals|analytics) */
  const [lockedFeature, setLockedFeature] = useState<FeatureKey | null>(null);
  /** Offre demandée capturée depuis l'URL (?plan=pro|max) */
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  /** Résultat de la reprise automatique de demande (bandeau) */
  const [planRequest, setPlanRequest] = useState<{ plan: PlanId; ok: boolean } | null>(null);
  const planRequestSent = useRef(false);

  // Arrivée sur la page : ?created=1 (rappel confirmation email),
  // ?locked=… (redirection middleware) et ?plan=… (reprise après connexion).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const created = params.get('created') === '1';
    const locked = params.get('locked');
    const plan = params.get('plan');
    if (created) setJustCreated(true);
    if (locked === 'goals' || locked === 'analytics' || locked === 'ads') {
      setLockedFeature(locked);
    }
    if (plan !== null && plan !== 'essential' && isPlanId(plan)) {
      setPendingPlan(plan);
    }
    if (created) window.history.replaceState({}, '', '/tarifs');
  }, []);

  // Reprise du flux « S'abonner » après connexion : enregistrer la DEMANDE
  // (≠ paiement) puis nettoyer l'URL. Une seule fois par chargement.
  useEffect(() => {
    if (!pendingPlan || !user || billingLoading || planRequestSent.current) return;
    planRequestSent.current = true;
    (async () => {
      try {
        await requestPlan(pendingPlan);
        await refresh();
        setPlanRequest({ plan: pendingPlan, ok: true });
      } catch {
        setPlanRequest({ plan: pendingPlan, ok: false });
      } finally {
        window.history.replaceState({}, '', '/tarifs');
      }
    })();
  }, [pendingPlan, user, billingLoading, refresh]);

  return (
    <div className="min-h-screen bg-[#F8F9FD] relative overflow-x-hidden">
      {/* Halos décoratifs (identité COMAXE) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-40 w-[480px] h-[480px] rounded-full bg-blue-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-64 -right-40 w-[420px] h-[420px] rounded-full bg-violet-500/10 blur-3xl"
      />

      {/* ── Barre supérieure ── */}
      <header className="sticky top-0 z-30 bg-[#F8F9FD]/90 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandLogo size={34} className="group-hover:scale-105 transition-transform" />
            <span className="text-lg font-extrabold tracking-tight text-slate-900">comaxe</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Croix « fermer » : retour direct au tableau de bord */}
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              aria-label={t('Fermer et aller au tableau de bord', 'Close and go to the dashboard')}
              title={t('Aller au tableau de bord', 'Go to the dashboard')}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 shadow-xs transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 px-3 py-2 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('Accueil', 'Home')}
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-sm font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
              >
                {t('Ouvrir l’application', 'Open the app')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-sm font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
              >
                {t('Connexion', 'Sign in')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* ── Bandeau « Compte créé » (après inscription) ── */}
        {justCreated && (
          <div
            role="status"
            className="mb-8 flex items-start gap-3 px-5 py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700"
          >
            <Mail className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium flex-1">
              {t(
                'Compte créé ! Vérifiez votre boîte de mail pour confirmer votre inscription, puis connectez-vous pour choisir votre offre.',
                'Account created! Check your inbox to confirm your registration, then sign in to choose your plan.'
              )}
            </p>
            <button
              type="button"
              aria-label={t('Fermer', 'Close')}
              onClick={() => setJustCreated(false)}
              className="p-1 rounded-lg hover:bg-emerald-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Bandeau « Fonctionnalité verrouillée » (redirection middleware) ── */}
        {lockedFeature && (
          <div
            role="status"
            className="mb-8 flex items-start gap-3 px-5 py-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800"
          >
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium flex-1">
              {formatMessage(featureLockedMessage(activePlan ?? 'essential', lockedFeature), locale)}
            </p>
            <button
              type="button"
              aria-label={t('Fermer', 'Close')}
              onClick={() => setLockedFeature(null)}
              className="p-1 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Bandeau « Demande d'offre enregistrée » (reprise après connexion) ── */}
        {planRequest && (
          <div
            role="status"
            className={`mb-8 flex items-start gap-3 px-5 py-4 rounded-2xl border ${
              planRequest.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {planRequest.ok ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <p className="text-sm font-medium flex-1">
              {planRequest.ok
                ? t(
                    `Demande ${getPlan(planRequest.plan).name} enregistrée. Finalisez l’activation dans votre page Abonnement.`,
                    `${getPlan(planRequest.plan).name} request recorded. Complete the activation on your Subscription page.`
                  )
                : t(
                    'Impossible d’enregistrer votre demande. Réessayez.',
                    'Could not save your request. Please try again.'
                  )}
            </p>
            {planRequest.ok && (
              <Link
                href="/parametres/abonnement"
                className="shrink-0 inline-flex items-center gap-1 text-sm font-bold underline hover:no-underline"
              >
                {t('Ouvrir', 'Open')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <button
              type="button"
              aria-label={t('Fermer', 'Close')}
              onClick={() => setPlanRequest(null)}
              className={`p-1 rounded-lg transition-colors shrink-0 ${
                planRequest.ok ? 'hover:bg-emerald-100' : 'hover:bg-rose-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Titre ── */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-200/80 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            {t('Tarifs COMAXE', 'COMAXE Pricing')}
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            {t('Une offre adaptée à ', 'A plan for ')}
            <span className="text-[#1E5BF8]">{t('chaque activité', 'every business')}</span>
          </h1>
          <p className="mt-4 text-slate-500 text-sm sm:text-base">
            {t(
              'Du commerce à toute une entreprise : commencez gratuitement et évoluez quand vous le souhaitez. Sans engagement, sans installation.',
              'From a shop to a whole company: start for free and upgrade whenever you want. No commitment, no installation.'
            )}
          </p>
        </div>

        {/* ── Grille tarifaire (partagée avec la landing) ──
            Post-connexion/inscription : les boutons mènent au Dashboard ── */}
        <div className="mt-8">
          <Suspense fallback={null}>
            <PricingGrid />
          </Suspense>
        </div>

        {/* ── Note informative ── */}
        <PricingNote />
      </main>

      {/* ── Footer ── */}
      <footer className="relative border-t border-slate-200/70 mt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo size={26} />
            <span className="text-sm font-extrabold text-slate-900">comaxe</span>
          </div>
          <p className="text-xs text-slate-400">© 2026 COMAXE — {t('Tous droits réservés', 'All rights reserved')}</p>
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-[#1E5BF8] transition-colors"
          >
            {t('Retour à l’accueil', 'Back to home')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
