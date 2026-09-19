ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS platform_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_audit_events_created_at_idx
  ON platform_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_target_idx
  ON platform_audit_events (target_type, target_id);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS internal_note TEXT,
  ADD COLUMN IF NOT EXISTS converted_tenant_id UUID REFERENCES tenants (id) ON DELETE SET NULL;

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS internal_note TEXT,
  ADD COLUMN IF NOT EXISTS converted_tenant_id UUID REFERENCES tenants (id) ON DELETE SET NULL;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS internal_note TEXT;
