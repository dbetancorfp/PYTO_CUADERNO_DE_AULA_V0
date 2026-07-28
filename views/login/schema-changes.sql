-- schema-changes.sql — Login view
--
-- Incremental DDL against the real, already-existing Postgres database. `users` doesn't
-- exist yet (introspected: no relations found) — this is a brand-new app, per
-- description_login.md. pgcrypto is already enabled at the project level (see
-- tecnologias/tecnologia_bbdd.md), providing gen_random_uuid().

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session gap (reopen, see description_login.md "Session" section): `users` is introspected
-- as it stands today — id, email, password_hash, failed_attempts, is_locked, created_at,
-- 3 existing QA rows — with no column to answer "who is signed in" with something
-- displayable. Sessions themselves are NOT persisted here: per tecnologias/tecnologia_bbdd.md
-- and tecnologia_code.md, session_id -> user identity lives in an in-process
-- InMemorySessionRepository Map, not in Postgres.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150) NOT NULL DEFAULT '';

-- Backfill the 3 existing QA-inserted rows (added before full_name existed) so the
-- NOT NULL invariant holds without a blank display name; new rows must supply a real one.
UPDATE users SET full_name = split_part(email, '@', 1) WHERE full_name = '';

ALTER TABLE users ALTER COLUMN full_name DROP DEFAULT;
