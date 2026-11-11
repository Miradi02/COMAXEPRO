-- ============================================
-- COMAXE — Rapports enregistrés
-- Chaque ligne = un rapport réellement généré par le commerçant
-- (type, période, métriques figées au moment de la génération).
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'rep-sales','rep-profit','rep-expenses','rep-stock',
    'rep-customers','rep-debts','rep-performance'
  )),
  title TEXT NOT NULL,
  period_label TEXT NOT NULL DEFAULT '',
  metrics TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Politiques nommées comme dans schema.sql (exécution idempotente)
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON reports;
DROP POLICY IF EXISTS "Users can update own reports" ON reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON reports;

CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON reports
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports" ON reports
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reports_user_id
  ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_created_at
  ON reports(user_id, created_at_ts DESC);
