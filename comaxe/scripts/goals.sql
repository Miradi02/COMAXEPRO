-- ============================================
-- COMAXE — Objectifs commerciaux
-- Chaque ligne = un objectif réel du commerçant.
-- La VALEUR ATTEINTE est recalculée en direct par l'application
-- selon `metric` (ventes / bénéfice / pièces / dépenses)
-- et `period` (semaine / mois / année) ; la cible est modifiable.
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('sales','profit','pieces','expenses')),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  target NUMERIC(12,2) NOT NULL CHECK (target >= 0),
  unit TEXT,
  period TEXT NOT NULL DEFAULT 'mois' CHECK (period IN ('semaine','mois','annee')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Politiques nommées comme dans schema.sql (exécution idempotente)
DROP POLICY IF EXISTS "Users can view own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON goals;
DROP POLICY IF EXISTS "Users can update own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON goals;

CREATE POLICY "Users can view own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id
  ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_sort
  ON goals(user_id, sort_order, created_at_ts);

-- ============================================
-- AMORÇAGE : les 4 objectifs mensuels par défaut
-- (uniquement pour les comptes qui en ont encore aucun —
--  exécution unique : une fois supprimés, ils ne reviennent pas)
-- ============================================
INSERT INTO goals (user_id, metric, title, category, target, unit, period, sort_order)
SELECT
  gt.user_id, v.metric, v.title, v.category, v.target, v.unit, 'mois', v.ord
FROM goal_targets gt
CROSS JOIN LATERAL (VALUES
  ('sales',   'Objectif de Ventes Mensuel',        'Chiffre d''affaires', gt.monthly_sales_target,    NULL::TEXT, 0),
  ('profit',  'Objectif de Bénéfice Net',          'Rentabilité',         gt.monthly_profit_target,   NULL::TEXT, 1),
  ('pieces',  'Volume de Pièces Vendues',          'Volume de Stock',     gt.monthly_pieces_target,   'articles', 2),
  ('expenses','Plafond des Dépenses Récurrentes',  'Contrôle des Coûts',  gt.monthly_expense_ceiling, NULL::TEXT, 3)
) AS v(metric, title, category, target, unit, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM goals g WHERE g.user_id = gt.user_id
);

-- ============================================
-- TRIGGER : créer les objectifs par défaut à l'inscription
-- (recréation identique de handle_new_user() + INSERT goals)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.store_profiles (
    user_id, store_name, phone, email, address, category, currency, country
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(v_meta->>'store_name', ''), 'Ma Boutique'),
    COALESCE(v_meta->>'store_phone', ''),
    COALESCE(NEW.email, ''),
    COALESCE(v_meta->>'store_address', ''),
    COALESCE(NULLIF(v_meta->>'store_category', ''), 'Général'),
    COALESCE(NULLIF(v_meta->>'store_currency', ''), 'USD'),
    COALESCE(v_meta->>'store_country', '')
  );

  INSERT INTO public.goal_targets (user_id)
  VALUES (NEW.id);

  INSERT INTO public.goals (user_id, metric, title, category, target, unit, period, sort_order)
  VALUES
    (NEW.id, 'sales',   'Objectif de Ventes Mensuel',       'Chiffre d''affaires', 10000, NULL,     'mois', 0),
    (NEW.id, 'profit',  'Objectif de Bénéfice Net',         'Rentabilité',         4000,  NULL,     'mois', 1),
    (NEW.id, 'pieces',  'Volume de Pièces Vendues',         'Volume de Stock',     200,   'articles','mois', 2),
    (NEW.id, 'expenses','Plafond des Dépenses Récurrentes', 'Contrôle des Coûts',  1500,  NULL,     'mois', 3);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
