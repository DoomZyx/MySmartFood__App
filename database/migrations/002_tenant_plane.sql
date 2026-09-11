-- Plan de données : métier client, cloisonné par tenant.
-- Chaque table porte un tenant_id NOT NULL et est protégée par Row-Level Security forcée.
--
-- Les contrôles d'intégrité référentielle contournent RLS par conception dans PostgreSQL.
-- Les clés étrangères internes sont donc composées avec tenant_id, ce qui rend impossible
-- une référence croisée entre deux tenants.

-- ---------------------------------------------------------------------------
-- Configuration de l'assistant vocal, une ligne par tenant
-- ---------------------------------------------------------------------------
CREATE TABLE tenant_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants (id) ON DELETE CASCADE,
  phone_line_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  currency TEXT NOT NULL DEFAULT 'EUR',
  voice_model TEXT NOT NULL DEFAULT 'gpt-4o-realtime-mini',
  voice_name TEXT NOT NULL DEFAULT 'ballad',
  noise_reduction_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Consignes additionnelles injectées dans le prompt de l'assistant.
  assistant_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tenant_settings_set_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Carte : catégories et articles
-- ---------------------------------------------------------------------------
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_categories_tenant_scope UNIQUE (tenant_id, id),
  CONSTRAINT menu_categories_unique_name UNIQUE (tenant_id, name)
);

CREATE INDEX menu_categories_tenant_sort_idx ON menu_categories (tenant_id, sort_order);

CREATE TRIGGER menu_categories_set_updated_at
  BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  category_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_items_tenant_scope UNIQUE (tenant_id, id),
  CONSTRAINT menu_items_unique_name UNIQUE (tenant_id, name),
  CONSTRAINT menu_items_category_fk FOREIGN KEY (tenant_id, category_id)
    REFERENCES menu_categories (tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX menu_items_tenant_category_idx ON menu_items (tenant_id, category_id);
CREATE INDEX menu_items_tenant_available_idx ON menu_items (tenant_id, is_available);

CREATE TRIGGER menu_items_set_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Horaires d'ouverture : plusieurs plages possibles par jour
-- ---------------------------------------------------------------------------
CREATE TABLE opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  -- 0 = dimanche, conforme à EXTRACT(DOW) de PostgreSQL.
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opening_hours_range CHECK (closes_at > opens_at),
  CONSTRAINT opening_hours_unique_slot UNIQUE (tenant_id, day_of_week, opens_at)
);

CREATE INDEX opening_hours_tenant_day_idx ON opening_hours (tenant_id, day_of_week);

CREATE TRIGGER opening_hours_set_updated_at
  BEFORE UPDATE ON opening_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Clients finaux de l'établissement
-- ---------------------------------------------------------------------------
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clients_tenant_scope UNIQUE (tenant_id, id),
  CONSTRAINT clients_unique_phone UNIQUE (tenant_id, phone)
);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Commandes à emporter
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  client_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'ready', 'completed', 'cancelled')),
  -- Origine de la commande : appel vocal automatisé ou saisie manuelle au tableau de bord.
  source TEXT NOT NULL DEFAULT 'voice' CHECK (source IN ('voice', 'dashboard')),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  pickup_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_tenant_scope UNIQUE (tenant_id, id),
  CONSTRAINT orders_client_fk FOREIGN KEY (tenant_id, client_id)
    REFERENCES clients (tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX orders_tenant_created_idx ON orders (tenant_id, created_at DESC);
CREATE INDEX orders_tenant_status_idx ON orders (tenant_id, status);
CREATE INDEX orders_tenant_pickup_idx ON orders (tenant_id, pickup_at);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  menu_item_id UUID,
  -- Libellé figé au moment de la commande : la carte peut changer ensuite.
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_items_order_fk FOREIGN KEY (tenant_id, order_id)
    REFERENCES orders (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT order_items_menu_item_fk FOREIGN KEY (tenant_id, menu_item_id)
    REFERENCES menu_items (tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX order_items_tenant_order_idx ON order_items (tenant_id, order_id);

-- ---------------------------------------------------------------------------
-- Réservations de table
-- ---------------------------------------------------------------------------
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  client_id UUID,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  reserved_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  source TEXT NOT NULL DEFAULT 'voice' CHECK (source IN ('voice', 'dashboard')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservations_client_fk FOREIGN KEY (tenant_id, client_id)
    REFERENCES clients (tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX reservations_tenant_reserved_idx ON reservations (tenant_id, reserved_at);
CREATE INDEX reservations_tenant_status_idx ON reservations (tenant_id, status);

CREATE TRIGGER reservations_set_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Quotas de minutes d'appel, par période de facturation
-- ---------------------------------------------------------------------------
CREATE TABLE call_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  minutes_included INTEGER NOT NULL CHECK (minutes_included >= 0),
  seconds_used INTEGER NOT NULL DEFAULT 0 CHECK (seconds_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT call_quotas_period CHECK (period_end > period_start),
  CONSTRAINT call_quotas_unique_period UNIQUE (tenant_id, period_start)
);

CREATE INDEX call_quotas_tenant_period_idx ON call_quotas (tenant_id, period_end DESC);

CREATE TRIGGER call_quotas_set_updated_at
  BEFORE UPDATE ON call_quotas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Sessions d'appel
-- ---------------------------------------------------------------------------
CREATE TABLE call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  call_sid TEXT NOT NULL,
  from_number TEXT,
  to_number TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- L'unicité est scopée au tenant, contrairement à l'index global du schéma Mongo.
  CONSTRAINT call_sessions_unique_sid UNIQUE (tenant_id, call_sid)
);

CREATE INDEX call_sessions_tenant_started_idx ON call_sessions (tenant_id, started_at DESC);

CREATE TRIGGER call_sessions_set_updated_at
  BEFORE UPDATE ON call_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Extractions en échec, pour reprise et analyse
-- ---------------------------------------------------------------------------
CREATE TABLE failed_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  call_sid TEXT,
  transcript TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX failed_extractions_tenant_created_idx
  ON failed_extractions (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- Appliquée en boucle pour qu'aucune table du plan de données ne puisse être oubliée.
--
-- ENABLE active les politiques pour les rôles ordinaires ; FORCE les applique aussi au
-- propriétaire des tables, ce qui ferme le piège classique où l'application se connecte
-- avec le rôle propriétaire et contourne silencieusement toutes les politiques.
--
-- current_setting('app.tenant_id', true) renvoie NULL au lieu de lever une erreur quand
-- le contexte n'est pas positionné : l'absence de contexte ne montre alors aucune ligne
-- plutôt que de tout exposer. WITH CHECK interdit d'écrire dans le périmètre d'un autre tenant.
DO $$
DECLARE
  target_table TEXT;
  tenant_tables TEXT[] := ARRAY[
    'tenant_settings',
    'menu_categories',
    'menu_items',
    'opening_hours',
    'clients',
    'orders',
    'order_items',
    'reservations',
    'call_quotas',
    'call_sessions',
    'failed_extractions'
  ];
  policy_template TEXT := 'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)';
BEGIN
  FOREACH target_table IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', target_table);
    EXECUTE format(policy_template, target_table);
  END LOOP;
END $$;
