-- schema-changes.sql — Configuración view
--
-- Incremental DDL against the real, already-existing Postgres database. Introspected first
-- (\dt): only `users` exists — none of the tables below exist yet. pgcrypto is already
-- enabled at the project level (see tecnologias/tecnologia_bbdd.md), providing
-- gen_random_uuid().
--
-- Everything here is scoped to a single teacher (teacher_id -> users.id). There's no
-- cross-teacher visibility by design (see description_configuracion.md).

CREATE TABLE IF NOT EXISTS training_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);

-- `course` is the training cycle's own year (1º/2º/3º — most cycles run 1-2, some 3, see
-- description_configuracion.md). ON DELETE CASCADE from training_cycles: deleting a cycle
-- deletes its modules too, UNLESS one of those modules is itself referenced by
-- academic_year_modules (ON DELETE RESTRICT below) — that dependency-blocked case makes
-- the whole cascade fail, which is exactly UC-05 A2's "can't delete a referenced cycle"
-- rule, enforced by the FK graph itself rather than an application-side dependent count.
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_cycle_id UUID NOT NULL REFERENCES training_cycles(id) ON DELETE CASCADE,
  course INTEGER NOT NULL CHECK (course IN (1, 2, 3)),
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_cycle_id, course, name)
);

CREATE INDEX IF NOT EXISTS modules_training_cycle_id_idx ON modules (training_cycle_id);

CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(20) NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);

-- At most one academic year marked current per teacher — a partial unique index rather
-- than a CHECK, since "at most one TRUE per teacher_id" spans multiple rows (see
-- tecnologias/tecnologia_bbdd.md's "functions + triggers when needed" — this case doesn't
-- need a trigger, a partial unique index expresses it directly). Application code (not this
-- constraint) is what un-marks the previous current row when a new one is marked, and what
-- rejects deleting the row currently marked current (UC-04 A2) — a single-row self-check,
-- same precedent as Login's lockout logic living in AuthService, not a trigger.
CREATE UNIQUE INDEX IF NOT EXISTS academic_years_one_current_per_teacher
  ON academic_years (teacher_id)
  WHERE is_current;

-- A teacher's module selection for a given academic year. ON DELETE CASCADE from
-- academic_years: deleting an academic year (never blocked by this table — only by the
-- is_current application check above) also deletes its selection rows. ON DELETE RESTRICT
-- from modules: deleting a module that's part of any academic year's selection is rejected
-- by Postgres itself (UC-06 A3), which is also what makes UC-05 A2 (deleting a cycle with a
-- referenced module) fail via the cascade attempt described above.
CREATE TABLE IF NOT EXISTS academic_year_modules (
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
  PRIMARY KEY (academic_year_id, module_id)
);
