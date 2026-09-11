CREATE TABLE oauth_link_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  google_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX oauth_link_challenges_user_id_idx ON oauth_link_challenges (user_id);
CREATE INDEX oauth_link_challenges_expires_idx ON oauth_link_challenges (expires_at)
  WHERE consumed_at IS NULL;
