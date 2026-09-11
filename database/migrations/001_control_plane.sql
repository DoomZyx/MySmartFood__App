-- Plan de contrôle : comptes, tenants, abonnements, provisioning, site vitrine.
-- Ces tables sont globales et ne portent pas de tenant_id : elles ne sont pas soumises à RLS.
-- Requiert PostgreSQL 13 ou supérieur pour gen_random_uuid().

-- Trigger partagé : évite d'oublier updated_at dans les requêtes applicatives.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Comptes utilisateurs
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  google_id TEXT,
  -- Administrateur de la plateforme (accès aux contacts, demos, outils internes).
  is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_key ON users (LOWER(email));
CREATE UNIQUE INDEX users_google_id_key ON users (google_id) WHERE google_id IS NOT NULL;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue des offres : source de vérité unique des quotas et des identifiants Stripe
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  monthly_call_minutes INTEGER NOT NULL CHECK (monthly_call_minutes >= 0),
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX plans_stripe_price_id_key ON plans (stripe_price_id) WHERE stripe_price_id IS NOT NULL;

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tenants : un tenant = un établissement client
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- Cycle de vie piloté uniquement par des événements vérifiés côté serveur.
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'pending_compliance', 'active', 'suspended', 'closed')),
  country_code TEXT NOT NULL DEFAULT 'FR' CHECK (country_code IN ('FR', 'BE', 'LU')),
  owner_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tenants_owner_user_id_idx ON tenants (owner_user_id);
CREATE INDEX tenants_status_idx ON tenants (status);

CREATE TRIGGER tenants_set_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Appartenances : un utilisateur peut administrer plusieurs tenants
-- ---------------------------------------------------------------------------
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_memberships_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX tenant_memberships_user_id_idx ON tenant_memberships (user_id);

CREATE TRIGGER tenant_memberships_set_updated_at
  BEFORE UPDATE ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Abonnements : états Stripe réels, historique conservé
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX subscriptions_stripe_subscription_id_key
  ON subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX subscriptions_tenant_id_idx ON subscriptions (tenant_id);
CREATE INDEX subscriptions_status_idx ON subscriptions (status);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Idempotence des webhooks Stripe (rejeu sur retry)
-- ---------------------------------------------------------------------------
CREATE TABLE stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Provisioning : machine à états idempotente et rejouable
-- ---------------------------------------------------------------------------
CREATE TABLE provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN (
    'pending', 'awaiting_documents', 'bundle_submitted',
    'bundle_approved', 'bundle_rejected', 'number_purchased', 'completed', 'failed'
  )),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul parcours de provisioning par tenant.
CREATE UNIQUE INDEX provisioning_jobs_tenant_id_key ON provisioning_jobs (tenant_id);
CREATE INDEX provisioning_jobs_state_idx ON provisioning_jobs (state);

CREATE TRIGGER provisioning_jobs_set_updated_at
  BEFORE UPDATE ON provisioning_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Bundles réglementaires Twilio
-- ---------------------------------------------------------------------------
CREATE TABLE twilio_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  bundle_sid TEXT NOT NULL UNIQUE,
  -- Statuts renvoyés par l'API Twilio Numbers.
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending-review', 'in-review', 'twilio-rejected', 'twilio-approved'
  )),
  end_user_sid TEXT,
  phone_number TEXT,
  phone_number_sid TEXT,
  failure_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX twilio_bundles_tenant_id_idx ON twilio_bundles (tenant_id);
CREATE UNIQUE INDEX twilio_bundles_phone_number_key
  ON twilio_bundles (phone_number) WHERE phone_number IS NOT NULL;

CREATE TRIGGER twilio_bundles_set_updated_at
  BEFORE UPDATE ON twilio_bundles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents de conformité : chiffrés au repos, jamais en pièce jointe e-mail
-- ---------------------------------------------------------------------------
CREATE TABLE onboarding_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('kbis', 'id_recto', 'id_verso', 'address_proof')),
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  -- Empreinte du contenu en clair, pour contrôle d'intégrité après déchiffrement.
  content_sha256 TEXT NOT NULL,
  -- Paramètres de chiffrement AES-256-GCM (la clé vient de l'environnement, jamais de la base).
  encryption_iv TEXT NOT NULL,
  encryption_auth_tag TEXT NOT NULL,
  retention_until TIMESTAMPTZ NOT NULL,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT onboarding_documents_unique_kind UNIQUE (tenant_id, kind)
);

CREATE INDEX onboarding_documents_retention_idx
  ON onboarding_documents (retention_until) WHERE purged_at IS NULL;

CREATE TRIGGER onboarding_documents_set_updated_at
  BEFORE UPDATE ON onboarding_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Profil établissement : coordonnées utilisées pour la conformité Twilio
-- ---------------------------------------------------------------------------
CREATE TABLE establishment_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  address_line TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL CHECK (country IN ('France', 'Belgique', 'Luxembourg')),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  seat_count INTEGER CHECK (seat_count IS NULL OR (seat_count >= 1 AND seat_count <= 999)),
  cuisine_type TEXT,
  -- Justification de l'usage du numéro, exigée par la conformité Twilio.
  phone_number_usage TEXT,
  documents_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER establishment_profiles_set_updated_at
  BEFORE UPDATE ON establishment_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Site vitrine : formulaire de contact et demandes de démonstration
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouveau'
    CHECK (status IN ('nouveau', 'en_cours', 'traite', 'archive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contacts_status_created_idx ON contacts (status, created_at DESC);
CREATE INDEX contacts_email_created_idx ON contacts (LOWER(email), created_at DESC);

CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  team_size TEXT NOT NULL,
  needs TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  duration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouveau'
    CHECK (status IN ('nouveau', 'en_cours', 'traite', 'archive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX demos_created_idx ON demos (created_at DESC);

CREATE TRIGGER demos_set_updated_at
  BEFORE UPDATE ON demos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
