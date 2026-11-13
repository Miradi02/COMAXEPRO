-- ============================================
-- COMAXE — SYSTÈME D'ABONNEMENT (phase 1 : Essential / Pro / Max)
--
--   • tables subscriptions + subscription_events (journal idempotent)
--   • abonnement par défaut = Essential, à l'inscription ET pour les comptes existants
--   • ENFORCEMENT SERVEUR : triggers BEFORE INSERT sur products / customers /
--     sales / debts → la limite est refusée même en contournant le frontend
--   • ENFORCEMENT SERVEUR : trigger sur goals (Objectifs verrouillé en Essential)
--
-- Source des valeurs : src/lib/billing/plans.config.ts
-- (cohérence contrôlée par scripts/billing-verify.mjs §11)
-- Miroir TS ↔ SQL à maintenir ENSEMBLE quand un futur plan est ajouté :
--   1. src/lib/billing/types.ts (PlanId) + plans.config.ts (entrée)
--   2. les CASE p_plan ci-dessous + contraintes CHECK plan_id
--
-- Idempotent : réappliquable via scripts/apply-billing.mjs
-- ============================================

-- ============================================
-- 1. TABLE : subscriptions (1 ligne par utilisateur)
--    plan_id          = plan RÉELLEMENT actif
--    requested_plan_id= plan DEMANDÉ (clic « S'abonner ») — distinct du plan
--                      actif tant que le paiement n'est pas confirmé
--    billing_period   = période du plan payant (monthly/yearly), dérivée
--                      du Price ID Stripe par le webhook ; NULL = offre
--                      gratuite (Essential) ou période inconnue
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'essential'
    CHECK (plan_id IN ('essential','pro','max')),
  requested_plan_id TEXT
    CHECK (requested_plan_id IS NULL OR requested_plan_id IN ('essential','pro','max')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','unpaid','pending','canceled','expired')),
  billing_period TEXT
    CHECK (billing_period IS NULL OR billing_period IN ('monthly','yearly')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration idempotente : colonne absente des bases créées avant
-- l'intégration Stripe (réappliquable via scripts/apply-billing.mjs).
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_period TEXT
  CHECK (billing_period IS NULL OR billing_period IN ('monthly','yearly'));

-- ============================================
-- 2. TABLE : subscription_events (journal + idempotence webhooks/simulation)
--    event_id UNIQUE → un événement Stripe ne peut être traité qu'une fois
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. RLS : lecture seule pour l'utilisateur.
--    AUCUNE policy INSERT/UPDATE/DELETE → seuls les services serveur
--    (API billing avec service role) peuvent faire évoluer l'abonnement.
-- ============================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subscription_events" ON subscription_events;
CREATE POLICY "Users can view own subscription_events"
  ON subscription_events FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;

-- updated_at automatique
CREATE OR REPLACE FUNCTION billing_touch_subscription() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS subscriptions_touch ON subscriptions;
CREATE TRIGGER subscriptions_touch
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION billing_touch_subscription();

-- ============================================
-- 4. ABONNEMENT PAR DÉFAUT : Essential (gratuit)
-- ============================================
-- Comptes existants
INSERT INTO subscriptions (user_id, plan_id, status, started_at, current_period_start)
SELECT u.id, 'essential', 'active', NOW(), NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Nouveaux comptes (trigger d'inscription — indépendant de handle_new_user)
CREATE OR REPLACE FUNCTION billing_handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan_id, status, started_at, current_period_start)
  VALUES (NEW.id, 'essential', 'active', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_billing ON auth.users;
CREATE TRIGGER on_auth_user_created_billing
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION billing_handle_new_user();

-- ============================================
-- 5. HELPERS : plan actif + limites + fonctionnalités (miroir du moteur TS)
-- ============================================

-- Plan réellement accordé. Miroir strict de resolveActivePlan()
-- (src/lib/billing/entitlements.ts) : past_due/pending conservent le plan,
-- canceled/expired/unpaid → gratuit. Sans ligne → gratuit.
CREATE OR REPLACE FUNCTION billing_active_plan(p_user UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN s.status IN ('active','past_due','pending') THEN s.plan_id
    ELSE 'essential'
  END
  FROM subscriptions s
  WHERE s.user_id = p_user;
$$;

-- Limites par plan (miroir SQL de PLANS_CONFIG — billing-verify §11)
CREATE OR REPLACE FUNCTION billing_plan_limit(p_plan TEXT, p_resource TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_resource
    WHEN 'sales' THEN CASE p_plan WHEN 'essential' THEN 15 WHEN 'pro' THEN 200 WHEN 'max' THEN 1000 END
    WHEN 'products' THEN CASE p_plan WHEN 'essential' THEN 10 WHEN 'pro' THEN 70 WHEN 'max' THEN 600 END
    WHEN 'customers' THEN CASE p_plan WHEN 'essential' THEN 15 WHEN 'pro' THEN 200 WHEN 'max' THEN 1000 END
    WHEN 'debts' THEN CASE p_plan WHEN 'essential' THEN 5 WHEN 'pro' THEN 50 WHEN 'max' THEN 400 END
  END;
$$;

-- Fonctionnalités par plan (miroir SQL de PLANS_CONFIG — billing-verify §11)
CREATE OR REPLACE FUNCTION billing_feature_enabled(p_plan TEXT, p_feature TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_feature
    WHEN 'goals' THEN CASE p_plan WHEN 'essential' THEN FALSE WHEN 'pro' THEN TRUE WHEN 'max' THEN TRUE END
    WHEN 'analytics' THEN CASE p_plan WHEN 'essential' THEN FALSE WHEN 'pro' THEN TRUE WHEN 'max' THEN TRUE END
    WHEN 'ads' THEN CASE p_plan WHEN 'essential' THEN TRUE WHEN 'pro' THEN FALSE WHEN 'max' THEN FALSE END
  END;
$$;

-- ============================================
-- 6. TRIGGER : limites de création (serveur)
--    products / customers / sales / debts.
--    • auth.uid() IS NULL → opération système (service role, seeds) : ignorée.
--    • Ventes : comptage sur created_at_ts du mois civil en cours
--      (la colonne `date` est une chaîne d'affichage non fiable).
--    • Dettes : seules les dettes ouvertes (solde > 0) comptent.
-- ============================================
CREATE OR REPLACE FUNCTION billing_enforce_limit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_plan TEXT;
  v_next TEXT;
  v_limit INTEGER;
  v_used INTEGER := 0;
  v_unit TEXT;
  v_hit BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := COALESCE(billing_active_plan(NEW.user_id), 'essential');
  v_next := CASE v_plan WHEN 'essential' THEN 'Pro' WHEN 'pro' THEN 'Max' END;

  IF TG_TABLE_NAME = 'sales' THEN
    v_limit := billing_plan_limit(v_plan, 'sales');
    v_unit := 'ventes par mois';
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used
      FROM sales
      WHERE user_id = NEW.user_id
        AND created_at_ts >= date_trunc('month', NOW());
      v_hit := v_used >= v_limit;
    END IF;

  ELSIF TG_TABLE_NAME = 'products' THEN
    v_limit := billing_plan_limit(v_plan, 'products');
    v_unit := 'produits';
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used FROM products WHERE user_id = NEW.user_id;
      v_hit := v_used >= v_limit;
    END IF;

  ELSIF TG_TABLE_NAME = 'customers' THEN
    v_limit := billing_plan_limit(v_plan, 'customers');
    v_unit := 'clients';
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_used FROM customers WHERE user_id = NEW.user_id;
      v_hit := v_used >= v_limit;
    END IF;

  ELSIF TG_TABLE_NAME = 'debts' THEN
    IF NEW.remaining_amount > 0 THEN
      v_limit := billing_plan_limit(v_plan, 'debts');
      v_unit := 'dettes actives';
      IF v_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_used
        FROM debts WHERE user_id = NEW.user_id AND remaining_amount > 0;
        v_hit := v_used >= v_limit;
      END IF;
    END IF;
  END IF;

  IF v_hit THEN
    IF v_next IS NOT NULL THEN
      RAISE EXCEPTION
        'Vous avez atteint la limite de % % de votre offre %. Passez à % pour continuer.',
        v_limit, v_unit, initcap(v_plan), v_next
        USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION
        'Vous avez atteint la limite de % % de votre offre %.',
        v_limit, v_unit, initcap(v_plan)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_limits_products ON products;
CREATE TRIGGER billing_limits_products
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_limit();

DROP TRIGGER IF EXISTS billing_limits_customers ON customers;
CREATE TRIGGER billing_limits_customers
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_limit();

DROP TRIGGER IF EXISTS billing_limits_sales ON sales;
CREATE TRIGGER billing_limits_sales
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_limit();

DROP TRIGGER IF EXISTS billing_limits_debts ON debts;
CREATE TRIGGER billing_limits_debts
  BEFORE INSERT ON debts
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_limit();

-- ============================================
-- 7. TRIGGER : fonctionnalité « Objectifs » verrouillée (Essential)
--    • INSERT / UPDATE bloqués si le plan n'a pas goals.
--    • DELETE toujours autorisé (nettoyage, suppression de compte).
--    • Seeds d'inscription : auth.uid() NULL → ignorés (les 4 objectifs
--      par défaut restent créés pour tous, inertes tant que verrouillé).
-- ============================================
CREATE OR REPLACE FUNCTION billing_enforce_feature() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_plan TEXT;
  v_next TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_plan := COALESCE(billing_active_plan(NEW.user_id), 'essential');

  IF billing_feature_enabled(v_plan, 'goals') IS DISTINCT FROM TRUE THEN
    v_next := CASE v_plan WHEN 'essential' THEN 'Pro' WHEN 'pro' THEN 'Max' END;
    IF v_next IS NOT NULL THEN
      RAISE EXCEPTION
        'La fonctionnalité « Objectifs » est verrouillée avec votre offre %. Passez à % pour l''activer.',
        initcap(v_plan), v_next
        USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION
        'La fonctionnalité « Objectifs » est verrouillée avec votre offre %.',
        initcap(v_plan)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_feature_goals ON goals;
CREATE TRIGGER billing_feature_goals
  BEFORE INSERT OR UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_feature();

-- ============================================
-- 8. INDEX (perf des compteurs de limites)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON subscription_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_created ON sales(user_id, created_at_ts);
CREATE INDEX IF NOT EXISTS idx_debts_user_remaining ON debts(user_id) WHERE remaining_amount > 0;
