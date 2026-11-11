-- ============================================
-- COMAXE — Suppression du compte
-- Fonction SECURITY DEFINER appelée par l'utilisateur connecté
-- (RPC `delete_my_account`). Supprime la ligne auth.users :
-- toutes les données commerciales du compte suivent en CASCADE
-- (contraintes ON DELETE CASCADE des tables métier).
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Aucune session active';
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
