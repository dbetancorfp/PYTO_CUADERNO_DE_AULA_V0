-- views/configuracion — Ciclos/Módulos redesign (2026-08-04)
--
-- Standalone catalog of ciclos formativos / módulos profesionales, decoupled from the
-- (dropped) año-académico tables: no FK into anything year-related, no relation at all
-- beyond the owning teacher. See views/configuracion/description_configuracion.md's
-- "Redesign note" and use-cases.md UC-04/UC-05.

CREATE TABLE IF NOT EXISTS catalog_training_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: deleting the teacher's account removes their whole catalog with it.
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);

CREATE INDEX IF NOT EXISTS catalog_training_cycles_teacher_id_idx
  ON catalog_training_cycles (teacher_id);

CREATE TABLE IF NOT EXISTS catalog_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: deleting a cycle deletes its modules — this catalog has no
  -- dependency-blocked-deletion case (see UC-04's A2), unlike the old training_cycles/
  -- modules pair, which was guarded by academic_year_modules.
  catalog_training_cycle_id UUID NOT NULL REFERENCES catalog_training_cycles(id) ON DELETE CASCADE,
  -- No ENUM (project convention) — closed domain as a CHECK. Only 1/2 (BOC curricula
  -- seeded for this catalog only go up to 2º), unlike the old modules table's 1/2/3.
  course INTEGER NOT NULL CHECK (course IN (1, 2)),
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (catalog_training_cycle_id, course, name)
);

CREATE INDEX IF NOT EXISTS catalog_modules_cycle_id_idx
  ON catalog_modules (catalog_training_cycle_id);
