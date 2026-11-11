-- COMAXE — Patch : la langue suit automatiquement le navigateur (défaut « auto »)
-- Tant que l'utilisateur n'a pas choisi explicitement une langue,
-- COMAXE continue de respecter la logique Accept-Language existante.
ALTER TABLE user_preferences ALTER COLUMN locale SET DEFAULT 'auto';
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_locale_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_locale_check
  CHECK (locale IN ('auto','fr','en'));
