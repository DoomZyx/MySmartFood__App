ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_role TEXT;

UPDATE users
   SET platform_role = CASE
     WHEN is_platform_owner THEN 'owner'
     WHEN is_platform_admin THEN 'ops'
     ELSE NULL
   END
 WHERE platform_role IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_platform_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_platform_role_check
      CHECK (
        platform_role IS NULL
        OR platform_role IN ('owner', 'ops', 'support', 'billing', 'readonly')
      );
  END IF;
END $$;
