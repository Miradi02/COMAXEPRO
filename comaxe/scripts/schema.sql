-- ============================================
-- COMAXE — Schéma de Base de Données Fullstack
-- Supabase / PostgreSQL
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE : products (Produits & Stock)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Autres',
  quantity INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 5,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'en_stock' CHECK (status IN ('en_stock', 'stock_faible', 'rupture')),
  total_sales_count INTEGER NOT NULL DEFAULT 0,
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : customers (Clients)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  purchases_count INTEGER NOT NULL DEFAULT 0,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_purchase_date TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : sales (Ventes)
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  date TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_avatar TEXT,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_profit DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'especes' CHECK (payment_method IN ('especes', 'mobile_money', 'carte')),
  status TEXT NOT NULL DEFAULT 'validee' CHECK (status IN ('validee', 'en_cours', 'annulee')),
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : sale_items (Lignes de Vente)
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  purchase_price DECIMAL(10,2),
  total DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- ============================================
-- TABLE : expenses (Dépenses)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('approvisionnement', 'transport', 'loyer', 'electricite', 'internet', 'salaires', 'autres')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : debts (Dettes / Créances)
-- ============================================
CREATE TABLE IF NOT EXISTS debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  initial_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'non_payee' CHECK (status IN ('non_payee', 'partiellement_payee', 'payee')),
  last_payment_date TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- produit endetté (pris à crédit)
  product_name TEXT, -- instantané du nom du produit
  quantity INTEGER NOT NULL DEFAULT 1, -- quantité endettée
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes produit absentes des anciennes bases (idempotent)
ALTER TABLE debts ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

-- Lien vente ↔ dette : la vente est créée automatiquement à la création de la dette
-- (placé APRÈS la table debts pour les installs fraîches)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES debts(id) ON DELETE CASCADE;

-- ============================================
-- TABLE : debt_payments (Paiements de Dettes)
-- ============================================
CREATE TABLE IF NOT EXISTS debt_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  remaining_after DECIMAL(10,2) NOT NULL DEFAULT 0,
  note TEXT
);

-- ============================================
-- TABLE : debt_history (Historique Opérations Dettes)
-- ============================================
CREATE TABLE IF NOT EXISTS debt_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type TEXT NOT NULL CHECK (type IN ('creation', 'paiement')),
  initial_amount DECIMAL(10,2),
  payment_amount DECIMAL(10,2),
  total_paid DECIMAL(10,2),
  remaining_amount DECIMAL(10,2),
  status TEXT,
  product_name TEXT, -- produit endetté concerné par l'événement
  quantity INTEGER, -- quantité endettée
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes d'ordre/produit absentes des anciennes bases (idempotent)
ALTER TABLE debt_history ADD COLUMN IF NOT EXISTS created_at_ts TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE debt_history ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE debt_history ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- ============================================
-- TABLE : store_profiles (Fiche Boutique)
-- ============================================
CREATE TABLE IF NOT EXISTS store_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL DEFAULT 'Ma Boutique',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  category TEXT DEFAULT 'Général',
  currency TEXT DEFAULT 'USD',
  country TEXT DEFAULT ''
);

-- ============================================
-- TABLE : goal_targets (Objectifs Mensuels)
-- ============================================
CREATE TABLE IF NOT EXISTS goal_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_sales_target DECIMAL(10,2) DEFAULT 10000,
  monthly_profit_target DECIMAL(10,2) DEFAULT 4000,
  monthly_pieces_target INTEGER DEFAULT 200,
  monthly_expense_ceiling DECIMAL(10,2) DEFAULT 1500,
  daily_sales_target DECIMAL(10,2) DEFAULT 1000
);

-- ============================================
-- TABLE : goals (Objectifs du commerçant)
-- 1 ligne = 1 objectif modifiable / supprimable.
-- La valeur atteinte est recalculée en direct par l'application
-- selon metric (sales|profit|pieces|expenses) et period.
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

-- ============================================
-- HISTORIQUE DU STOCK (mouvements réels)
-- 1 ligne = 1 événement : création, réappro, sortie
-- (vente ou vente liée à une dette), annulation.
-- Le nom du produit est dénormalisé pour rester
-- lisible même si le produit est supprimé.
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('creation','entree','sortie','annulation')),
  quantity INTEGER NOT NULL,
  reference TEXT,
  note TEXT,
  date TEXT NOT NULL DEFAULT '',
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CORRECTIFS (idempotents) : DEFAULT auth.uid()
-- sur les tables déjà existantes
-- ============================================
ALTER TABLE products ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE customers ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE sales ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE expenses ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE debts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE debt_history ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Colonne pays (fiche boutique) — idempotent
ALTER TABLE store_profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';

-- ============================================
-- TABLE : user_preferences (Préférences utilisateur)
-- thème, police, taille de texte, langue, format de date, notifications
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  font_family TEXT NOT NULL DEFAULT 'jakarta' CHECK (font_family IN ('jakarta','inter')),
  text_size TEXT NOT NULL DEFAULT 'normal' CHECK (text_size IN ('small','normal','large')),
  locale TEXT NOT NULL DEFAULT 'auto'
    CHECK (locale IN ('auto','fr','en')),
  date_format TEXT NOT NULL DEFAULT 'long'
    CHECK (date_format IN ('long','dd/mm/yyyy','mm/dd/yyyy','yyyy-mm-dd')),
  notify_general BOOLEAN NOT NULL DEFAULT TRUE,
  notify_stock BOOLEAN NOT NULL DEFAULT TRUE,
  notify_debts BOOLEAN NOT NULL DEFAULT TRUE,
  notify_activity BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE : support_requests (Aide & support)
-- « Contacter le support » et « Signaler un problème »
-- ============================================
CREATE TABLE IF NOT EXISTS support_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'contact' CHECK (kind IN ('contact','problem')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Nettoyage idempotent : supprime les policies existantes avant recréation
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- RLS Policies : products
CREATE POLICY "Users can view own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON products FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : customers
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : sales
CREATE POLICY "Users can view own sales" ON sales FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales" ON sales FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales" ON sales FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales" ON sales FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : sale_items (via sale_id -> sales.user_id)
CREATE POLICY "Users can view own sale_items" ON sale_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_id AND sales.user_id = auth.uid())
);
CREATE POLICY "Users can insert own sale_items" ON sale_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_id AND sales.user_id = auth.uid())
);
CREATE POLICY "Users can update own sale_items" ON sale_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_id AND sales.user_id = auth.uid())
);
CREATE POLICY "Users can delete own sale_items" ON sale_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_id AND sales.user_id = auth.uid())
);

-- RLS Policies : expenses
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : debts
CREATE POLICY "Users can view own debts" ON debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON debts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : debt_payments (via debt_id -> debts.user_id)
CREATE POLICY "Users can view own debt_payments" ON debt_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_id AND debts.user_id = auth.uid())
);
CREATE POLICY "Users can insert own debt_payments" ON debt_payments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_id AND debts.user_id = auth.uid())
);
CREATE POLICY "Users can update own debt_payments" ON debt_payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_id AND debts.user_id = auth.uid())
);
CREATE POLICY "Users can delete own debt_payments" ON debt_payments FOR DELETE USING (
  EXISTS (SELECT 1 FROM debts WHERE debts.id = debt_id AND debts.user_id = auth.uid())
);

-- RLS Policies : debt_history
CREATE POLICY "Users can view own debt_history" ON debt_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debt_history" ON debt_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debt_history" ON debt_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt_history" ON debt_history FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : store_profiles
CREATE POLICY "Users can view own store_profile" ON store_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own store_profile" ON store_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own store_profile" ON store_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own store_profile" ON store_profiles FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : goal_targets
CREATE POLICY "Users can view own goal_targets" ON goal_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goal_targets" ON goal_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal_targets" ON goal_targets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goal_targets" ON goal_targets FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : stock_movements (historique du stock)
CREATE POLICY "Users can view own stock_movements" ON stock_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock_movements" ON stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock_movements" ON stock_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock_movements" ON stock_movements FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : goals (objectifs du commerçant)
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : user_preferences (préférences d'affichage)
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preferences" ON user_preferences FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies : support_requests (messages envoyés au support)
CREATE POLICY "Users can view own support_requests" ON support_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own support_requests" ON support_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own support_requests" ON support_requests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own support_requests" ON support_requests FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRIGGER : Créer store_profile + goal_targets + goals + user_preferences
-- à l'inscription. Les informations du commerce saisies à l'inscription
-- (métadonnées du compte) sont enregistrées dans la table protégée
-- store_profiles (RLS), et les préférences d'affichage dans
-- user_preferences (thème système par défaut).
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
    (NEW.id, 'sales',   'Objectif de Ventes Mensuel',       'Chiffre d''affaires', 10000, NULL,      'mois', 0),
    (NEW.id, 'profit',  'Objectif de Bénéfice Net',         'Rentabilité',         4000,  NULL,      'mois', 1),
    (NEW.id, 'pieces',  'Volume de Pièces Vendues',         'Volume de Stock',     200,   'articles','mois', 2),
    (NEW.id, 'expenses','Plafond des Dépenses Récurrentes', 'Contrôle des Coûts',  1500,  NULL,      'mois', 3);

  INSERT INTO public.user_preferences (user_id, locale)
  VALUES (NEW.id, 'auto')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- INDEX pour performances
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_history_user_id ON debt_history(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_history_user_created_at ON debt_history(user_id, created_at_ts DESC);
CREATE INDEX IF NOT EXISTS idx_store_profiles_user_id ON store_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_targets_user_id ON goal_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_sort ON goals(user_id, sort_order, created_at_ts);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_created_at ON stock_movements(user_id, created_at_ts DESC);

-- ============================================
-- FONCTIONS TRANSACTIONNELLES (Intégrité métier)
-- ============================================

-- 1) VENTE : création atomique (sale + items + stock + client)
CREATE OR REPLACE FUNCTION process_sale(
  p_code TEXT,
  p_date TEXT,
  p_customer_id UUID,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_client_avatar TEXT,
  p_payment_method TEXT,
  p_items JSONB,
  p_total_amount DECIMAL,
  p_total_profit DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_prod RECORD;
  v_new_qty INTEGER;
  v_new_status TEXT;
  v_customer_id UUID;
BEGIN
  INSERT INTO sales (user_id, code, date, customer_id, client_name, client_phone, client_avatar, total_amount, total_profit, payment_method, status)
  VALUES (auth.uid(), p_code, p_date, p_customer_id, p_client_name, p_client_phone, p_client_avatar, p_total_amount, p_total_profit, p_payment_method, 'validee')
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, purchase_price, total)
    VALUES (
      v_sale_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::NUMERIC,
      NULLIF(v_item->>'purchase_price', '')::NUMERIC,
      (v_item->>'total')::NUMERIC
    );

    IF v_item->>'product_id' IS NOT NULL AND v_item->>'product_id' <> '' THEN
      SELECT * INTO v_prod FROM products WHERE id = (v_item->>'product_id')::UUID AND user_id = auth.uid() FOR UPDATE;
      IF FOUND THEN
        v_new_qty := GREATEST(0, v_prod.quantity - (v_item->>'quantity')::INT);
        IF v_new_qty <= 0 THEN v_new_status := 'rupture';
        ELSIF v_new_qty <= v_prod.min_threshold THEN v_new_status := 'stock_faible';
        ELSE v_new_status := 'en_stock';
        END IF;

        UPDATE products
        SET quantity = v_new_qty, status = v_new_status, total_sales_count = total_sales_count + (v_item->>'quantity')::INT
        WHERE id = v_prod.id;
      END IF;
    END IF;
  END LOOP;

  -- Client : upsert (par id si fourni, sinon recherche par nom/téléphone)
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET purchases_count = purchases_count + 1, total_spent = total_spent + p_total_amount, last_purchase_date = p_date
    WHERE id = p_customer_id AND user_id = auth.uid()
    RETURNING id INTO v_customer_id;
  END IF;

  IF v_customer_id IS NULL THEN
    SELECT id INTO v_customer_id FROM customers
    WHERE user_id = auth.uid() AND lower(name) = lower(p_client_name)
    LIMIT 1;

    IF FOUND THEN
      UPDATE customers
      SET purchases_count = purchases_count + 1, total_spent = total_spent + p_total_amount, last_purchase_date = p_date
      WHERE id = v_customer_id;
    ELSE
      INSERT INTO customers (user_id, name, phone, avatar, purchases_count, total_spent, last_purchase_date)
      VALUES (auth.uid(), p_client_name, COALESCE(p_client_phone, ''), COALESCE(p_client_avatar, ''), 1, p_total_amount, p_date)
      RETURNING id INTO v_customer_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('sale_id', v_sale_id, 'customer_id', v_customer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) VENTE : suppression atomique (restaure stock + client + supprime)
CREATE OR REPLACE FUNCTION delete_sale_data(p_sale_id UUID) RETURNS VOID AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_prod RECORD;
  v_new_qty INTEGER;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT * INTO v_prod FROM products WHERE id = v_item.product_id AND user_id = auth.uid() FOR UPDATE;
      IF FOUND THEN
        v_new_qty := v_prod.quantity + v_item.quantity;
        IF v_new_qty <= 0 THEN v_new_status := 'rupture';
        ELSIF v_new_qty <= v_prod.min_threshold THEN v_new_status := 'stock_faible';
        ELSE v_new_status := 'en_stock';
        END IF;
        UPDATE products
        SET quantity = v_new_qty, status = v_new_status, total_sales_count = GREATEST(0, total_sales_count - v_item.quantity)
        WHERE id = v_prod.id;
      END IF;
    END IF;
  END LOOP;

  UPDATE customers
  SET purchases_count = GREATEST(0, purchases_count - 1), total_spent = GREATEST(0, total_spent - v_sale.total_amount)
  WHERE user_id = auth.uid() AND (
    (v_sale.customer_id IS NOT NULL AND id = v_sale.customer_id)
    OR lower(name) = lower(v_sale.client_name)
  );

  DELETE FROM sales WHERE id = p_sale_id; -- supprime les sale_items en cascade
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) DETTE : règlement atomique (dette + payment + historique)
CREATE OR REPLACE FUNCTION record_debt_payment_rpc(
  p_debt_id UUID,
  p_amount DECIMAL,
  p_note TEXT,
  p_date TEXT
) RETURNS JSONB AS $$
DECLARE
  v_debt RECORD;
  v_actual NUMERIC;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_status TEXT;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_debt FROM debts WHERE id = p_debt_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dette introuvable');
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  v_actual := LEAST(p_amount, v_debt.remaining_amount);
  v_new_paid := v_debt.paid_amount + v_actual;
  v_new_remaining := GREATEST(0, v_debt.initial_amount - v_new_paid);
  IF v_new_remaining = 0 THEN v_new_status := 'payee'; ELSE v_new_status := 'partiellement_payee'; END IF;

  UPDATE debts
  SET paid_amount = v_new_paid, remaining_amount = v_new_remaining, status = v_new_status, last_payment_date = p_date
  WHERE id = p_debt_id;

  INSERT INTO debt_payments (debt_id, date, amount, remaining_after, note)
  VALUES (p_debt_id, p_date, v_actual, v_new_remaining, COALESCE(p_note, CASE WHEN v_new_remaining = 0 THEN 'Règlement total' ELSE 'Paiement partiel' END))
  RETURNING id INTO v_payment_id;

  INSERT INTO debt_history (user_id, date, debt_id, person_name, phone, email, type, initial_amount, payment_amount, total_paid, remaining_amount, status)
  VALUES (auth.uid(), p_date, p_debt_id, v_debt.person_name, v_debt.phone, v_debt.email, 'paiement', v_debt.initial_amount, v_actual, v_new_paid, v_new_remaining, v_new_status);

  RETURN jsonb_build_object('success', true, 'payment_id', v_payment_id, 'paid_amount', v_new_paid, 'remaining_amount', v_new_remaining, 'status', v_new_status, 'actual_paid', v_actual);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) DETTE : création avec historique + VENTE AUTOMATIQUE LIÉE
-- (produit endetté, ligne de vente, décrément du stock, client — tout atomique)
DROP FUNCTION IF EXISTS create_debt_with_history(TEXT, TEXT, TEXT, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION create_debt_with_history(
  p_person_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_initial_amount DECIMAL,
  p_date TEXT,
  p_product_id UUID DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_quantity INTEGER DEFAULT NULL,
  p_code TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_debt_id UUID;
  v_sale_id UUID;
  v_customer_id UUID;
  v_prod RECORD;
  v_qty INTEGER;
  v_new_qty INTEGER;
  v_new_status TEXT;
  v_unit DECIMAL;
  v_purchase DECIMAL;
  v_item_name TEXT;
  v_profit DECIMAL;
BEGIN
  IF p_initial_amount IS NULL OR p_initial_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant de la dette invalide');
  END IF;

  v_qty := GREATEST(COALESCE(p_quantity, 1), 1);

  -- Vérification du produit endetté (optionnel) + contrôle de stock
  -- Les champs de v_prod ne sont accessibles QUE dans ce bloc (jamais assigné sinon)
  v_item_name := p_product_name;
  v_purchase := 0;
  IF p_product_id IS NOT NULL THEN
    SELECT * INTO v_prod FROM products WHERE id = p_product_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Produit introuvable dans le stock');
    END IF;
    IF v_prod.quantity < v_qty THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant pour ' || v_prod.name);
    END IF;
    v_item_name := COALESCE(v_prod.name, p_product_name);
    v_purchase := COALESCE(v_prod.purchase_price, 0);
  END IF;

  -- Nom de la ligne de vente : produit choisi, sinon libellé générique fourni par l'app
  v_item_name := COALESCE(v_item_name, 'Vente à crédit');
  v_unit := CASE WHEN v_qty > 0 THEN ROUND(p_initial_amount / v_qty, 2) ELSE p_initial_amount END;
  v_profit := p_initial_amount - (v_purchase * v_qty);

  -- 1) Dette liée au produit endetté (product_name uniquement si produit choisi)
  INSERT INTO debts (user_id, person_name, phone, email, initial_amount, paid_amount, remaining_amount, date, status, product_id, product_name, quantity)
  VALUES (auth.uid(), p_person_name, COALESCE(p_phone, ''), p_email, p_initial_amount, 0, p_initial_amount, p_date, 'non_payee', p_product_id, CASE WHEN p_product_id IS NOT NULL THEN v_item_name END, v_qty)
  RETURNING id INTO v_debt_id;

  -- 2) Vente automatique liée à la dette (montant total = montant de la dette)
  INSERT INTO sales (user_id, code, date, client_name, client_phone, total_amount, total_profit, payment_method, status, debt_id)
  VALUES (
    auth.uid(),
    COALESCE(p_code, 'VNT-' || right(floor(random() * 100000000)::text, 8)),
    p_date,
    p_person_name,
    NULLIF(p_phone, ''),
    p_initial_amount,
    v_profit,
    'especes',
    'validee',
    v_debt_id
  )
  RETURNING id INTO v_sale_id;

  -- 3) Ligne de vente (produit endetté)
  INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, purchase_price, total)
  VALUES (v_sale_id, p_product_id, v_item_name, v_qty, v_unit, CASE WHEN p_product_id IS NOT NULL THEN v_purchase ELSE NULL END, p_initial_amount);

  -- 4) Décrément du stock (comme process_sale)
  IF p_product_id IS NOT NULL THEN
    v_new_qty := GREATEST(0, v_prod.quantity - v_qty);
    IF v_new_qty <= 0 THEN v_new_status := 'rupture';
    ELSIF v_new_qty <= v_prod.min_threshold THEN v_new_status := 'stock_faible';
    ELSE v_new_status := 'en_stock';
    END IF;
    UPDATE products
    SET quantity = v_new_qty, status = v_new_status, total_sales_count = total_sales_count + v_qty
    WHERE id = p_product_id;
  END IF;

  -- 5) Client : upsert (comme process_sale)
  SELECT id INTO v_customer_id FROM customers WHERE user_id = auth.uid() AND lower(name) = lower(p_person_name) LIMIT 1;
  IF FOUND THEN
    UPDATE customers
    SET purchases_count = purchases_count + 1, total_spent = total_spent + p_initial_amount, last_purchase_date = p_date
    WHERE id = v_customer_id;
  ELSE
    INSERT INTO customers (user_id, name, phone, purchases_count, total_spent, last_purchase_date)
    VALUES (auth.uid(), p_person_name, COALESCE(p_phone, ''), 1, p_initial_amount, p_date)
    RETURNING id INTO v_customer_id;
  END IF;

  -- 6) Historique (événement CRÉATION avec produit endetté)
  INSERT INTO debt_history (user_id, date, debt_id, person_name, phone, email, type, initial_amount, payment_amount, total_paid, remaining_amount, status, product_name, quantity)
  VALUES (auth.uid(), p_date, v_debt_id, p_person_name, p_phone, p_email, 'creation', p_initial_amount, 0, 0, p_initial_amount, 'non_payee', CASE WHEN p_product_id IS NOT NULL THEN v_item_name END, v_qty);

  RETURN jsonb_build_object('success', true, 'debt_id', v_debt_id, 'sale_id', v_sale_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Droits d'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION process_sale TO authenticated;
GRANT EXECUTE ON FUNCTION delete_sale_data TO authenticated;
GRANT EXECUTE ON FUNCTION record_debt_payment_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION create_debt_with_history TO authenticated;
