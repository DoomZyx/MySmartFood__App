ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dossier_notice_pending_at TIMESTAMPTZ;
