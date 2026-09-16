-- Correspondances d'identifiants hérités : plus de vocabulaire Mongo dans le schéma.

ALTER TABLE IF EXISTS mongo_import_refs RENAME TO legacy_id_refs;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'legacy_id_refs' AND column_name = 'mongo_id'
  ) THEN
    ALTER TABLE legacy_id_refs RENAME COLUMN mongo_id TO source_id;
  END IF;
END $$;

ALTER INDEX IF EXISTS mongo_import_refs_tenant_pg_idx
  RENAME TO legacy_id_refs_tenant_pg_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'mongo_import_refs_pkey'
  ) THEN
    ALTER TABLE legacy_id_refs RENAME CONSTRAINT mongo_import_refs_pkey TO legacy_id_refs_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'migration_rejections' AND column_name = 'mongo_id'
  ) THEN
    ALTER TABLE migration_rejections RENAME COLUMN mongo_id TO source_id;
  END IF;
END $$;
