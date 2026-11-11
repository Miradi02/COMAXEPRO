-- ============================================
-- COMAXE — Messages de support
-- « Contacter le support » et « Signaler un problème » :
-- chaque message est réellement enregistré et consultable côté COMAXE.
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

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own support_requests" ON support_requests;
DROP POLICY IF EXISTS "Users can insert own support_requests" ON support_requests;
DROP POLICY IF EXISTS "Users can update own support_requests" ON support_requests;
DROP POLICY IF EXISTS "Users can delete own support_requests" ON support_requests;

CREATE POLICY "Users can view own support_requests" ON support_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own support_requests" ON support_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own support_requests" ON support_requests
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own support_requests" ON support_requests
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_id
  ON support_requests(user_id, created_at_ts DESC);
