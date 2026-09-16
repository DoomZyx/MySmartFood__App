-- Historique des tokens LLM par instance restaurant (plan de données, RLS).

CREATE TABLE llm_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT llm_usage_events_tenant_scope UNIQUE (tenant_id, id)
);

CREATE INDEX llm_usage_events_tenant_created_idx
  ON llm_usage_events (tenant_id, created_at DESC);

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
  EXECUTE 'ALTER TABLE llm_usage_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE llm_usage_events FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON llm_usage_events';
  EXECUTE format(policy_template, 'llm_usage_events');
END $$;
