-- Jeton envoyé après paiement Stripe : l'utilisateur l'ouvre pour accéder au dashboard.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dashboard_unlocked_at TIMESTAMPTZ;

CREATE TABLE dashboard_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX dashboard_access_tokens_user_id_idx ON dashboard_access_tokens (user_id);
