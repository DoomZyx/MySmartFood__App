-- current_setting('app.tenant_id', true) renvoie une chaîne vide (pas NULL)
-- quand le GUC n'a jamais été positionné. Un cast ::uuid sur '' lève alors
-- une erreur au lieu d'appliquer le fail-closed. NULLIF ferme ce cas.

DO $$
DECLARE
  target_table TEXT;
  tenant_tables TEXT[] := ARRAY[
    'tenant_settings',
    'menu_categories',
    'menu_items',
    'opening_hours',
    'clients',
    'orders',
    'order_items',
    'reservations',
    'call_quotas',
    'call_sessions',
    'failed_extractions'
  ];
  policy_template TEXT :=
    'CREATE POLICY tenant_isolation ON %I '
    'USING ('
    '  NULLIF(current_setting(''app.tenant_id'', true), '''') IS NOT NULL '
    '  AND tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid'
    ') '
    'WITH CHECK ('
    '  NULLIF(current_setting(''app.tenant_id'', true), '''') IS NOT NULL '
    '  AND tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid'
    ')';
BEGIN
  FOREACH target_table IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', target_table);
    EXECUTE format(policy_template, target_table);
  END LOOP;
END $$;
