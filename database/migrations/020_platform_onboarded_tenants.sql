ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarded_by TEXT NOT NULL DEFAULT 'self';

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_onboarded_by_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_onboarded_by_check
  CHECK (onboarded_by IN ('self', 'platform'));
