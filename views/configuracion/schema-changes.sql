-- views/configuracion — Ciclos/Módulos redesign (2026-08-04, un-scoped from teacher 2026-08-05)
--
-- Standalone, shared catalog of ciclos formativos / módulos profesionales: no relation to
-- anything year-related, and no relation to `users` either — official BOC curricula (e.g.
-- DAM, DAW) are the same for every teacher, so this catalog is global, not per-teacher. See
-- views/configuracion/description_configuracion.md's "Redesign note" and use-cases.md
-- UC-04/UC-05.

CREATE TABLE IF NOT EXISTS catalog_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: deleting a cycle deletes its modules — this catalog has no
  -- dependency-blocked-deletion case (see UC-04's A2), unlike the old training_cycles/
  -- modules pair, which was guarded by academic_year_modules.
  catalog_training_cycle_id UUID NOT NULL REFERENCES catalog_cycles(id) ON DELETE CASCADE,
  -- No ENUM (project convention) — closed domain as a CHECK. Only 1/2 (BOC curricula
  -- seeded for this catalog only go up to 2º), unlike the old modules table's 1/2/3.
  course INTEGER NOT NULL CHECK (course IN (1, 2)),
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_training_cycle_id, course, name)
);

CREATE INDEX IF NOT EXISTS catalog_modules_cycle_id_idx
  ON catalog_modules (catalog_training_cycle_id);
