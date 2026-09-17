-- Contenu chiffré des pièces d'identité / justificatifs, en base.
ALTER TABLE onboarding_documents
  ADD COLUMN IF NOT EXISTS ciphertext BYTEA;
