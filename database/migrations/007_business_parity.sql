-- Parité métier Mongo -> PostgreSQL.
-- N'altère pas les migrations déjà appliquées : uniquement ALTER et nouvelles tables.

-- ---------------------------------------------------------------------------
-- Profil établissement : adresse brute héritée et coordonnées
-- ---------------------------------------------------------------------------
ALTER TABLE establishment_profiles
  ADD COLUMN IF NOT EXISTS raw_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Paramètres de service (réservation / emporter)
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS reservation_slot_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (reservation_slot_minutes > 0),
  ADD COLUMN IF NOT EXISTS order_prep_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (order_prep_minutes >= 0),
  ADD COLUMN IF NOT EXISTS takeaway_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reservation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Carte : catégories et articles enrichis
-- ---------------------------------------------------------------------------
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE menu_categories
   SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
 WHERE slug IS NULL;

ALTER TABLE menu_categories
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_tenant_slug_idx
  ON menu_categories (tenant_id, slug);

ALTER TABLE menu_items
  DROP CONSTRAINT IF EXISTS menu_items_unique_name;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS size_label TEXT,
  ADD COLUMN IF NOT EXISTS is_customizable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_meats INTEGER CHECK (max_meats IS NULL OR max_meats >= 1),
  ADD COLUMN IF NOT EXISTS composition_text TEXT,
  ADD COLUMN IF NOT EXISTS included_ingredients JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS available_ingredients JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_tenant_category_name_idx
  ON menu_items (tenant_id, category_id, name);

-- ---------------------------------------------------------------------------
-- Horaires : plages midi / soir, fermeture le lendemain possible
-- ---------------------------------------------------------------------------
ALTER TABLE opening_hours
  DROP CONSTRAINT IF EXISTS opening_hours_range;

ALTER TABLE opening_hours
  DROP CONSTRAINT IF EXISTS opening_hours_unique_slot;

ALTER TABLE opening_hours
  ADD COLUMN IF NOT EXISTS slot_kind TEXT NOT NULL DEFAULT 'midi',
  ADD COLUMN IF NOT EXISTS closes_next_day BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE opening_hours
  DROP CONSTRAINT IF EXISTS opening_hours_slot_kind_check;

ALTER TABLE opening_hours
  ADD CONSTRAINT opening_hours_slot_kind_check
    CHECK (slot_kind IN ('midi', 'soir'));

ALTER TABLE opening_hours
  ADD CONSTRAINT opening_hours_range CHECK (
    (closes_next_day = FALSE AND closes_at > opens_at)
    OR closes_next_day = TRUE
  );

ALTER TABLE opening_hours
  ADD CONSTRAINT opening_hours_unique_slot UNIQUE (tenant_id, day_of_week, slot_kind);

-- ---------------------------------------------------------------------------
-- Clients : prénom, nom, adresse, entreprise, type
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_type_check;

ALTER TABLE clients
  ADD CONSTRAINT clients_type_check CHECK (client_type IN ('client', 'fournisseur'));

-- ---------------------------------------------------------------------------
-- Commandes enrichies
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS legacy_status TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reminder_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS related_call TEXT,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_created_by_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_created_by_check
    CHECK (created_by IN ('manual', 'calendly', 'system'));

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS composition TEXT,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_tenant_scope;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_tenant_scope UNIQUE (tenant_id, id);

-- ---------------------------------------------------------------------------
-- Réservations enrichies
-- ---------------------------------------------------------------------------
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS legacy_status TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reminder_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_sms_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS related_call TEXT,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_created_by_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_created_by_check
    CHECK (created_by IN ('manual', 'calendly', 'system'));

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_tenant_scope;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_tenant_scope UNIQUE (tenant_id, id);

-- ---------------------------------------------------------------------------
-- Quotas, sessions d'appel, extractions
-- ---------------------------------------------------------------------------
ALTER TABLE call_quotas
  ADD COLUMN IF NOT EXISTS client_ref TEXT,
  ADD COLUMN IF NOT EXISTS subscription_key TEXT,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS client_ref TEXT,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE failed_extractions
  ADD COLUMN IF NOT EXISTS stream_sid TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'extraction_echouee',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_stack TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS treated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Catalogue d'équipements (global) + état par tenant
-- ---------------------------------------------------------------------------
CREATE TABLE amenities (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO amenities (slug, label) VALUES
  ('pmr', 'Accès personnes à mobilité réduite'),
  ('highchair', 'Chaises bébé')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE tenant_amenities (
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  amenity_slug TEXT NOT NULL REFERENCES amenities (slug) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'available', 'unavailable')),
  quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, amenity_slug)
);

CREATE INDEX tenant_amenities_tenant_idx ON tenant_amenities (tenant_id);

CREATE TRIGGER tenant_amenities_set_updated_at
  BEFORE UPDATE ON tenant_amenities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Options de carte et compositions
-- ---------------------------------------------------------------------------
CREATE TABLE menu_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  selection_type TEXT NOT NULL DEFAULT 'single'
    CHECK (selection_type IN ('single', 'multiple')),
  min_select INTEGER NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select INTEGER CHECK (max_select IS NULL OR max_select >= 1),
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_option_groups_tenant_scope UNIQUE (tenant_id, id),
  CONSTRAINT menu_option_groups_unique_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX menu_option_groups_tenant_idx ON menu_option_groups (tenant_id, sort_order);

CREATE TRIGGER menu_option_groups_set_updated_at
  BEFORE UPDATE ON menu_option_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE menu_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_options_tenant_scope UNIQUE (tenant_id, id),
  CONSTRAINT menu_options_group_fk FOREIGN KEY (tenant_id, group_id)
    REFERENCES menu_option_groups (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT menu_options_unique_name UNIQUE (tenant_id, group_id, name)
);

CREATE INDEX menu_options_tenant_group_idx ON menu_options (tenant_id, group_id, sort_order);

CREATE TRIGGER menu_options_set_updated_at
  BEFORE UPDATE ON menu_options
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE menu_item_option_groups (
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  group_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, item_id, group_id),
  CONSTRAINT menu_item_option_groups_item_fk FOREIGN KEY (tenant_id, item_id)
    REFERENCES menu_items (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT menu_item_option_groups_group_fk FOREIGN KEY (tenant_id, group_id)
    REFERENCES menu_option_groups (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX menu_item_option_groups_tenant_idx
  ON menu_item_option_groups (tenant_id, item_id);

CREATE TABLE menu_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  component_item_id UUID,
  role TEXT NOT NULL DEFAULT 'autre'
    CHECK (role IN ('plat_principal', 'accompagnement', 'boisson', 'autre')),
  label TEXT,
  is_choice BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_compositions_item_fk FOREIGN KEY (tenant_id, item_id)
    REFERENCES menu_items (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT menu_compositions_component_fk FOREIGN KEY (tenant_id, component_item_id)
    REFERENCES menu_items (tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX menu_compositions_tenant_item_idx ON menu_compositions (tenant_id, item_id);

CREATE TABLE order_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL,
  group_name TEXT NOT NULL,
  option_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  legacy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_item_options_item_fk FOREIGN KEY (tenant_id, order_item_id)
    REFERENCES order_items (tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX order_item_options_tenant_item_idx
  ON order_item_options (tenant_id, order_item_id);

-- ---------------------------------------------------------------------------
-- Import Mongo : correspondances et rejets conservés
-- ---------------------------------------------------------------------------
CREATE TABLE mongo_import_refs (
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  mongo_id TEXT NOT NULL,
  pg_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, collection, mongo_id)
);

CREATE INDEX mongo_import_refs_tenant_pg_idx ON mongo_import_refs (tenant_id, pg_id);

CREATE TABLE migration_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  mongo_id TEXT,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX migration_rejections_tenant_idx
  ON migration_rejections (tenant_id, collection, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS : nouvelles tables du plan de données
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  target_table TEXT;
  tenant_tables TEXT[] := ARRAY[
    'tenant_amenities',
    'menu_option_groups',
    'menu_options',
    'menu_item_option_groups',
    'menu_compositions',
    'order_item_options',
    'mongo_import_refs',
    'migration_rejections'
  ];
  policy_template TEXT :=
    'CREATE POLICY tenant_isolation ON %I '
    'USING ('
    '  NULLIF(current_setting(''app.tenant_id'', true), '''') IS NOT NULL '
    '  AND tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid'
    ') '
    'WITH CHECK ('
    '  NULLIF(current_setting(''app.tenant_id'', true), '''') IS NOT NULL '
    '  AND tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid'
    ')';
BEGIN
  FOREACH target_table IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', target_table);
    EXECUTE format(policy_template, target_table);
  END LOOP;
END $$;
