-- COMAXE — Patch : la langue suit automatiquement le navigateur (défaut « auto »)
-- (version intégrée à handle_new_user pour les futurs comptes)
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
