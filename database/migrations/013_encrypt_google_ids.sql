-- google_id contient désormais un ciphertext AES-256-GCM.
-- La recherche et l'unicité reposent sur un index aveugle HMAC-SHA-256.
ALTER TABLE users
  ADD COLUMN google_id_hash TEXT;

DROP INDEX users_google_id_key;

CREATE UNIQUE INDEX users_google_id_hash_key
  ON users (google_id_hash)
  WHERE google_id_hash IS NOT NULL;
