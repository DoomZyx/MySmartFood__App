ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_owner BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
   SET is_platform_owner = TRUE
 WHERE id = (
   SELECT id
     FROM users
    WHERE is_platform_admin = TRUE
    ORDER BY created_at ASC
    LIMIT 1
 );
