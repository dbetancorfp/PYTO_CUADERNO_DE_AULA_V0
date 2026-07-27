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
