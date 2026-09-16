ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS platform_totp_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS platform_totp_last_step BIGINT;
