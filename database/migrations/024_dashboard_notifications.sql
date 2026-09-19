-- Notifications dashboard persistées : rattrapage si le restaurateur n'a pas le WebSocket ouvert.

CREATE TABLE dashboard_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT dashboard_notifications_tenant_scope UNIQUE (tenant_id, id)
);

CREATE INDEX dashboard_notifications_tenant_unread_idx
  ON dashboard_notifications (tenant_id, created_at DESC)
  WHERE read_at IS NULL;

DO $$
DECLARE
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
  EXECUTE 'ALTER TABLE dashboard_notifications ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE dashboard_notifications FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON dashboard_notifications';
  EXECUTE format(policy_template, 'dashboard_notifications');
END $$;
