ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS siret TEXT,
  ADD COLUMN IF NOT EXISTS siren TEXT;

ALTER TABLE establishment_profiles
  DROP CONSTRAINT IF EXISTS establishment_profiles_siret_format;
ALTER TABLE establishment_profiles
  ADD CONSTRAINT establishment_profiles_siret_format
  CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$');

ALTER TABLE establishment_profiles
  DROP CONSTRAINT IF EXISTS establishment_profiles_siren_format;
ALTER TABLE establishment_profiles
  ADD CONSTRAINT establishment_profiles_siren_format
  CHECK (siren IS NULL OR siren ~ '^[0-9]{9}$');
