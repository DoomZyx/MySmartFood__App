-- Infos de compte par utilisateur et par établissement (membership).
-- Le nom / e-mail / avatar restent globaux sur users.

ALTER TABLE tenant_memberships
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT;
