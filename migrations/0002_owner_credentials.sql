CREATE TABLE owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  user_handle TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE passkey (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id INTEGER NOT NULL DEFAULT 1 REFERENCES owner(id) ON DELETE CASCADE CHECK (owner_id = 1),
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL CHECK (counter >= 0),
  transports TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE session (
  token_hash TEXT PRIMARY KEY NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES owner(id) ON DELETE CASCADE CHECK (owner_id = 1),
  expires_at INTEGER NOT NULL
);
CREATE INDEX session_expiry ON session(expires_at);
CREATE TABLE auth_challenge (
  token_hash TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('register', 'login')),
  challenge TEXT NOT NULL,
  owner_name TEXT,
  user_handle TEXT,
  expires_at INTEGER NOT NULL
);
CREATE INDEX challenge_expiry ON auth_challenge(expires_at);
CREATE TABLE auth_rate_limit (
  bucket INTEGER PRIMARY KEY,
  attempts INTEGER NOT NULL
);
CREATE TABLE credential (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL CHECK (length(provider) BETWEEN 1 AND 80),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  encrypted_secret TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unverified', 'valid', 'invalid', 'error')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_verified_at INTEGER
);
CREATE UNIQUE INDEX credential_provider_default ON credential(provider) WHERE is_default = 1;
