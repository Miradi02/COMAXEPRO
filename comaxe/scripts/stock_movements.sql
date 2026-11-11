-- ============================================
-- COMAXE — Historique du stock (mouvements)
-- Chaque entrée = un mouvement réel : création, réappro,
-- sortie (vente/dette) ou annulation (stock restitué).
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

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Politiques nommées comme dans schema.sql (le bloc DO de schema.sql
-- les supprime déjà toutes avant recréation → exécution idempotente)
DROP POLICY IF EXISTS "Users can view own stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "Users can insert own stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "Users can update own stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "Users can delete own stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_select_own" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_own" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_delete_own" ON stock_movements;

CREATE POLICY "Users can view own stock_movements" ON stock_movements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stock_movements" ON stock_movements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stock_movements" ON stock_movements
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stock_movements" ON stock_movements
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id
  ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_created_at
  ON stock_movements(user_id, created_at_ts DESC);

-- Amorçage : les sorties déjà enregistrées (ventes + ventes liées aux dettes)
INSERT INTO stock_movements (user_id, product_id, product_name, movement_type, quantity, reference, date, created_at_ts)
SELECT s.user_id, si.product_id, si.product_name, 'sortie', si.quantity, s.code, s.date, s.created_at_ts
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE NOT EXISTS (
  SELECT 1 FROM stock_movements sm
  WHERE sm.user_id = s.user_id
    AND sm.reference = s.code
    AND sm.product_name = si.product_name
);
