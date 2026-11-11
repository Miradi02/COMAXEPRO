'use client';

/**
 * COMAXE — Abonnement : état RÉEL du compte (source = moteur billing).
 *
 * Remplace l'ancienne page statique (« illimité, gratuit à vie ») :
 *   • offre réellement active vs offre demandée (un clic ≠ un paiement) ;
 *   • statut, période, identifiants Stripe le cas échéant ;
 *   • consommation des limites (compteurs du moteur) ;
 *   • fonctionnalités verrouillées / déverrouillées ;
 *   • journal des événements d'abonnement ;
 *   • simulateur de cycle de vie (phase de préparation Stripe).
 *
 * Aucune règle de plan n'est écrite ici : la page affiche ce que le
 * moteur (plans.config / entitlements / usage) décide.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  History,
  Info,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useBilling } from '@/context/BillingContext';
import { useCommerce } from '@/context/CommerceContext';
import { supabase } from '@/lib/supabase/client';
import { getPlan } from '@/lib/billing/plans.config';
import type { FeatureKey, ResourceKey, SubscriptionStatus } from '@/lib/billing/types';
import { SubscriptionSimulator } from '@/components/billing/SubscriptionSimulator';
import {
  InfoRow,
  SettingsButton,
  SettingsLayout,
  SettingsSection,
} from '@/components/settings/SettingsLayout';

/* ── Données d'affichage (libellés, pas des règles) ────────────────── */

type StatusKey = SubscriptionStatus | 'none';

const STATUS_META: Record<StatusKey, { fr: string; en: string; cls: string }> = {
  none: { fr: 'Gratuit', en: 'Free', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  active: { fr: 'Actif', en: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: {
    fr: 'En attente de paiement',
    en: 'Awaiting payment',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  past_due: {
    fr: 'Paiement en retard',
    en: 'Payment past due',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  unpaid: { fr: 'Impayé', en: 'Unpaid', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  canceled: { fr: 'Annulé', en: 'Canceled', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  expired: { fr: 'Expiré', en: 'Expired', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const RESOURCE_ROWS: { key: ResourceKey; fr: string; en: string }[] = [
  { key: 'sale', fr: 'Ventes (mois en cours)', en: 'Sales (current month)' },
  { key: 'product', fr: 'Produits', en: 'Products' },
  { key: 'customer', fr: 'Clients', en: 'Customers' },
  { key: 'debt', fr: 'Dettes actives', en: 'Active debts' },
];

const FEATURE_ROWS: { key: FeatureKey; fr: string; en: string }[] = [
  { key: 'goals', fr: 'Objectifs', en: 'Goals' },
  { key: 'analytics', fr: 'Analytique', en: 'Analytics' },
  { key: 'ads', fr: 'Publicité', en: 'Ads' },
];

/** Repli d'affichage pendant le chargement de l'abonnement */
const DEFAULT_FEATURES = getPlan('essential').features;

/* ── Barre de consommation (présentation seule) ────────────────────── */

function UsageBar({
  label,
  used,
  limit,
  percent,
  canCreate,
}: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  canCreate: boolean;
}) {
  const color = !canCreate ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-500' : 'bg-[#1E5BF8]';
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className={`font-bold ${!canCreate ? 'text-rose-600' : 'text-slate-900'}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

interface EventRow {
  event_type: string;
  created_at: string;
}

export default function AbonnementPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const {
    subscription,
    planId,
    requestedPlanId,
    entitlements,
    refresh,
  } = useBilling();
  const { usage } = useCommerce();

  const [checkoutOk, setCheckoutOk] = useState(false);
  const [events, setEvents] = useState<EventRow[] | null>(null);

  const reloadEvents = useCallback(async () => {
    const { data } = await supabase
      .from('subscription_events')
      .select('event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    setEvents((data as EventRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    reloadEvents();
  }, [reloadEvents]);

  // Retour de paiement Stripe (?checkout=success) : recharger l'état réel.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setCheckoutOk(true);
      refresh();
      window.history.replaceState({}, '', '/parametres/abonnement');
    }
  }, [refresh]);

  const planDef = getPlan(planId ?? 'essential');
  const features = entitlements?.features ?? DEFAULT_FEATURES;
  const limits = entitlements?.limits;
  const statusKey: StatusKey = entitlements?.status ?? 'none';
  const statusMeta = STATUS_META[statusKey];

  const fmtDate = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium' });
  };

  const pendingRequest = requestedPlanId && requestedPlanId !== planId;

  return (
    <SettingsLayout>
      {/* ── Retour de paiement Stripe ── */}
      {checkoutOk && (
        <div
          role="status"
          className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700"
        >
          <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">
            {t(
              'Paiement confirmé — votre abonnement a été mis à jour.',
              'Payment confirmed — your subscription has been updated.'
            )}
          </p>
        </div>
      )}

      {/* ── OFFRE RÉELLEMENT ACTIVE ── */}
      <SettingsSection
        icon={Sparkles}
        title={t('Offre actuelle', 'Current plan')}
        description={t(
          'L’offre réellement active sur votre compte COMAXE.',
          'The plan actually active on your COMAXE account.'
        )}
        action={
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 ${statusMeta.cls}`}
          >
            <BadgeCheck className="w-3.5 h-3.5" />
            {t(statusMeta.fr, statusMeta.en)}
          </span>
        }
      >
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/60 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {t(`COMAXE ${planDef.name}`, `COMAXE ${planDef.name}`)}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t(
                `${planDef.limits.salesPerMonth} ventes/mois, ${planDef.limits.products} produits, ${planDef.limits.customers} clients.`,
                `${planDef.limits.salesPerMonth} sales/month, ${planDef.limits.products} products, ${planDef.limits.customers} customers.`
              )}
            </p>
          </div>
          <span className="text-2xl font-extrabold text-[#1E5BF8] shrink-0">
            {planDef.priceMonthly === 0
              ? t('Gratuit', 'Free')
              : `${planDef.priceMonthly} $ / mois · ${planDef.priceAnnual} $ / an`}
          </span>
        </div>

        {/* Demande en cours ≠ plan actif */}
        {pendingRequest && (
          <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              {t(
                `Offre ${getPlan(requestedPlanId!).name} demandée — elle ne deviendra active qu’après confirmation du paiement. En attendant, votre offre active reste ${planDef.name}.`,
                `${getPlan(requestedPlanId!).name} requested — it will only become active after the payment is confirmed. Until then, your active plan remains ${planDef.name}.`
              )}
            </p>
          </div>
        )}

        <div className="max-w-2xl mt-4">
          <InfoRow
            label={t('Statut', 'Status')}
            value={
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${statusMeta.cls}`}>
                {t(statusMeta.fr, statusMeta.en)}
              </span>
            }
          />
          <InfoRow
            label={t('Offre réellement active', 'Actually active plan')}
            value={planDef.name}
          />
          <InfoRow
            label={t('Offre demandée', 'Requested plan')}
            value={
              requestedPlanId
                ? `${getPlan(requestedPlanId).name} — ${t('paiement non confirmé', 'payment not confirmed')}`
                : t('Aucune', 'None')
            }
          />
          <InfoRow label={t('Début', 'Started')} value={fmtDate(subscription?.startedAt)} />
          <InfoRow
            label={t('Période actuelle', 'Current period')}
            value={
              subscription?.currentPeriodEnd
                ? `${fmtDate(subscription.currentPeriodStart)} → ${fmtDate(subscription.currentPeriodEnd)}`
                : t('Sans échéance (offre gratuite)', 'No end date (free plan)')
            }
          />
          <InfoRow
            label={t('Fin programmée', 'Scheduled end')}
            value={subscription?.endsAt ? fmtDate(subscription.endsAt) : t('Aucune', 'None')}
          />
          <InfoRow
            label={t('Abonnement Stripe', 'Stripe subscription')}
            value={
              subscription?.stripeSubscriptionId ? (
                <span className="font-mono text-xs">
                  {subscription.stripeSubscriptionId}
                </span>
              ) : (
                t('Non renseigné (intégration Stripe à venir)', 'Not set (Stripe integration pending)')
              )
            }
          />
          <InfoRow
            label={t('Client Stripe', 'Stripe customer')}
            value={
              subscription?.stripeCustomerId ? (
                <span className="font-mono text-xs">{subscription.stripeCustomerId}</span>
              ) : (
                t('Non renseigné (intégration Stripe à venir)', 'Not set (Stripe integration pending)')
              )
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <SettingsButton onClick={() => router.push('/tarifs')}>
            {t('Voir les offres', 'View plans')}
            <ArrowRight className="w-4 h-4" />
          </SettingsButton>
          <SettingsButton
            variant="secondary"
            onClick={() =>
              document.getElementById('simulateur')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            <FlaskConical className="w-4 h-4" />
            {t('Ouvrir le simulateur', 'Open the simulator')}
          </SettingsButton>
        </div>
      </SettingsSection>

      {/* ── CONSOMMATION DES LIMITES ── */}
      <SettingsSection
        icon={BarChart3}
        title={t('Consommation de l’offre', 'Plan usage')}
        description={t(
          'Limites utilisées en temps réel selon votre offre active.',
          'Limits used in real time according to your active plan.'
        )}
      >
        <div className="max-w-2xl">
          {usage === null || limits === undefined ? (
            <p className="py-4 text-sm text-slate-500">{t('Chargement…', 'Loading…')}</p>
          ) : (
            <>
              {RESOURCE_ROWS.map((row) => {
                const u = usage[row.key];
                return (
                  <UsageBar
                    key={row.key}
                    label={t(row.fr, row.en)}
                    used={u.used}
                    limit={u.limit}
                    percent={u.percent}
                    canCreate={u.canCreate}
                  />
                );
              })}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-t border-slate-100 mt-1 text-sm">
                <span className="font-bold text-slate-500 sm:w-56 shrink-0">
                  {t('Historique des dépenses', 'Expenses history')}
                </span>
                <span className="font-semibold text-slate-800">
                  {limits.expensesHistoryDays === null
                    ? t('Illimité', 'Unlimited')
                    : t(
                        `${limits.expensesHistoryDays} derniers jours`,
                        `Last ${limits.expensesHistoryDays} days`
                      )}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 text-sm">
                <span className="font-bold text-slate-500 sm:w-56 shrink-0">
                  {t('Historique des bénéfices', 'Profits history')}
                </span>
                <span className="font-semibold text-slate-800">
                  {limits.profitsHistoryDays === null
                    ? t('Illimité', 'Unlimited')
                    : t(
                        `${limits.profitsHistoryDays} derniers jours`,
                        `Last ${limits.profitsHistoryDays} days`
                      )}
                </span>
              </div>
            </>
          )}
        </div>
      </SettingsSection>

      {/* ── FONCTIONNALITÉS ── */}
      <SettingsSection
        icon={CheckCircle2}
        title={t('Fonctionnalités', 'Features')}
        description={t(
          'Accès selon votre offre active.',
          'Access according to your active plan.'
        )}
      >
        <div className="max-w-2xl">
          {FEATURE_ROWS.map((row) => {
            const on = features[row.key];
            const label =
              row.key === 'ads'
                ? on
                  ? t('Activée', 'Enabled')
                  : t('Désactivée', 'Disabled')
                : on
                  ? t('Disponible', 'Available')
                  : t('Verrouillée', 'Locked');
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0"
              >
                <span className="text-sm font-semibold text-slate-700">
                  {t(row.fr, row.en)}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                    on ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {on ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── JOURNAL DES ÉVÉNEMENTS ── */}
      <SettingsSection
        icon={History}
        title={t('Journal des événements', 'Event log')}
        description={t(
          'Derniers événements d’abonnement enregistrés (paiement, renouvellement, annulation…).',
          'Latest subscription events recorded (payment, renewal, cancellation…).'
        )}
      >
        {events === null ? (
          <p className="py-4 text-sm text-slate-500">{t('Chargement…', 'Loading…')}</p>
        ) : events.length === 0 ? (
          <div className="py-8 flex flex-col items-center text-center gap-2">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-400">
              <History className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">
              {t('Aucun événement enregistré', 'No events recorded')}
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              {t(
                'Les événements apparaîtront après une souscription ou une simulation.',
                'Events will appear after a subscription or a simulation.'
              )}
            </p>
          </div>
        ) : (
          <div className="max-w-2xl">
            {events.map((ev) => (
              <div
                key={ev.event_type + ev.created_at}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0"
              >
                <span className="font-mono text-xs font-semibold text-slate-700">
                  {ev.event_type}
                </span>
                <span className="text-xs text-slate-500">{fmtDate(ev.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {/* ── SIMULATEUR (préparation Stripe) ── */}
      <SettingsSection
        icon={FlaskConical}
        title={t('Simulateur d’abonnement', 'Subscription simulator')}
        description={t(
          'Phase de préparation Stripe : rejouez les scénarios sans paiement réel.',
          'Stripe preparation phase: replay scenarios without real payment.'
        )}
      >
        <div id="simulateur">
          <SubscriptionSimulator onApplied={reloadEvents} />
        </div>
      </SettingsSection>

      {/* ── PIED DE SECTION : rappel d'accès ── */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-slate-600 leading-relaxed">
        <CalendarClock className="w-4 h-4 shrink-0 mt-0.5 text-[#1E5BF8]" />
        <p>
          {t(
            'Les limites et fonctionnalités affichées sont appliquées automatiquement : elles viennent du moteur d’abonnement, pas de réglages manuels.',
            'The displayed limits and features are enforced automatically: they come from the subscription engine, not from manual settings.'
          )}
        </p>
      </div>
    </SettingsLayout>
  );
}
