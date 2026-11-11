-- ============================================
-- COMAXE — Préférences utilisateur (fullstack)
-- Une ligne par compte : thème, police, taille de texte,
-- langue, format de date et notifications.
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Affichage
  theme TEXT NOT NULL DEFAULT 'system'
    CHECK (theme IN ('system','light','dark')),
  font_family TEXT NOT NULL DEFAULT 'jakarta'
    CHECK (font_family IN ('jakarta','inter')),
  text_size TEXT NOT NULL DEFAULT 'normal'
    CHECK (text_size IN ('small','normal','large')),

  -- Préférences générales
  -- 'auto' = suivre la langue du navigateur (logique Accept-Language de COMAXE)
  locale TEXT NOT NULL DEFAULT 'auto'
    CHECK (locale IN ('auto','fr','en')),
  date_format TEXT NOT NULL DEFAULT 'long'
    CHECK (date_format IN ('long','dd/mm/yyyy','mm/dd/yyyy','yyyy-mm-dd')),

  -- Notifications
  notify_general BOOLEAN NOT NULL DEFAULT TRUE,
  notify_stock BOOLEAN NOT NULL DEFAULT TRUE,
  notify_debts BOOLEAN NOT NULL DEFAULT TRUE,
  notify_activity BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preferences" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Horodatage de dernière mise à jour
CREATE OR REPLACE FUNCTION public.touch_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_user_preferences ON user_preferences;
CREATE TRIGGER trg_touch_user_preferences
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_preferences();
