/**
 * COMAXE — /api/onboarding
 * GET  : état de l'onboarding (flag `onboarding_completed` + dernière
 *        progression) lu dans les métadonnées utilisateur.
 * POST : progression { state } et/ou finalisation { complete, goals }.
 *
 * Les objectifs renseignés pendant le questionnaire sont écrits dans la
 * table `goals` EXISTANTE (UPDATE des 4 seeds mensuels + INSERT éventuel
 * de l'objectif annuel) — aucune logique d'objectifs parallèle.
 *
 * Écritures via service role : le trigger `billing_feature_goals` saute
 * quand `auth.uid()` IS NULL → aucun impact sur les verrous d'abonnement.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, unauthorized } from '@/lib/billing/api';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Objectifs réellement renseignés (valeurs absentes = jamais inventées). */
interface OnboardingGoals {
  sales?: number;
  profit?: number;
  pieces?: number;
  expenses?: number;
  annualSales?: number;
}

/** État de progression du questionnaire (reprise exacte de l'étape). */
interface OnboardingState {
  answers?: Record<string, unknown>;
  step?: number;
  phase?: string;
  qIndex?: number;
  objectives?: Record<string, string>;
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      completed: meta.onboarding_completed === true,
      state: (meta.onboarding_state as OnboardingState | undefined) ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur lecture onboarding.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as {
      state?: OnboardingState;
      complete?: boolean;
      goals?: OnboardingGoals;
    };

    // On fusionne : updateUserById REMPLACE user_metadata en entier.
    const meta = { ...((user.user_metadata ?? {}) as Record<string, unknown>) };

    if (body.state && typeof body.state === 'object') {
      meta.onboarding_state = body.state;
    }

    let goalsWritten = 0;
    if (body.complete === true) {
      meta.onboarding_completed = true;
      meta.onboarding_completed_at = new Date().toISOString();
      if (body.goals && typeof body.goals === 'object') {
        goalsWritten = await writeGoals(user.id, body.goals);
      }
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: meta,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      completed: meta.onboarding_completed === true,
      goalsWritten,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur enregistrement onboarding.' },
      { status: 500 }
    );
  }
}

/**
 * Écrit les objectifs renseignés dans la table `goals` existante :
 *  - mensuels (sales / profit / pieces / expenses) → UPDATE du seed déjà
 *    créé au moment de l'inscription (aucun doublon) ;
 *  - annuel (sales, period='annee') → INSERT seulement s'il est renseigné.
 * Seules les valeurs fournes sont écrites : jamais de valeur inventée.
 */
async function writeGoals(userId: string, goals: OnboardingGoals): Promise<number> {
  const { data: rows, error } = await supabaseAdmin
    .from('goals')
    .select('id, metric, period')
    .eq('user_id', userId);
  if (error) throw new Error(`goals (lecture) : ${error.message}`);

  const wanted: Array<{
    metric: string;
    period: string;
    value?: number;
    title?: string;
    category?: string;
    unit?: string | null;
    sortOrder?: number;
  }> = [
    // Titrés comme les seeds de goals.sql (fallback si un seed manque).
    { metric: 'sales', period: 'mois', value: goals.sales, title: 'Objectif de Ventes Mensuel', category: "Chiffre d'affaires", sortOrder: 0 },
    { metric: 'profit', period: 'mois', value: goals.profit, title: 'Objectif de Bénéfice Net', category: 'Rentabilité', sortOrder: 1 },
    { metric: 'pieces', period: 'mois', value: goals.pieces, title: 'Volume de Pièces Vendues', category: 'Volume de Stock', unit: 'articles', sortOrder: 2 },
    { metric: 'expenses', period: 'mois', value: goals.expenses, title: 'Plafond des Dépenses Récurrentes', category: 'Contrôle des Coûts', sortOrder: 3 },
    {
      metric: 'sales',
      period: 'annee',
      value: goals.annualSales,
      title: 'Objectif de Ventes Annuel',
      category: "Chiffre d'affaires",
      unit: null,
      sortOrder: 4,
    },
  ];

  let written = 0;
  for (const w of wanted) {
    // Une valeur non renseignée (undefined) n'est JAMAIS écrite.
    if (typeof w.value !== 'number' || !Number.isFinite(w.value) || w.value < 0) continue;

    const existing = (rows ?? []).find((r) => r.metric === w.metric && r.period === w.period);
    if (existing) {
      const { error: upErr } = await supabaseAdmin
        .from('goals')
        .update({ target: w.value })
        .eq('id', existing.id);
      if (upErr) throw new Error(`goals (update ${w.metric}/${w.period}) : ${upErr.message}`);
    } else {
      const { error: insErr } = await supabaseAdmin.from('goals').insert({
        user_id: userId,
        metric: w.metric,
        period: w.period,
        target: w.value,
        title: w.title ?? '',
        category: w.category ?? '',
        unit: w.unit ?? null,
        sort_order: w.sortOrder ?? 0,
      });
      if (insErr) throw new Error(`goals (insert ${w.metric}/${w.period}) : ${insErr.message}`);
    }
    written++;
  }
  return written;
}
