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

-- views/configuracion — Año académico redesign (2026-08-05)
--
-- Gives Año académico a real, persisted data layer again, built on top of the shared
-- catalog above instead of duplicating it per teacher. `academic_years` is per-teacher;
-- `academic_year_modules` links a teacher's academic year to catalog_modules rows they'll
-- teach that year — a row's cycle is derived via catalog_modules.catalog_training_cycle_id,
-- not stored again here. See use-cases.md UC-06/UC-07/UC-08/UC-09.

CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: deleting the teacher's account removes their academic years with it.
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The "2026" in the "2026-2027" displayed school year — the end year is always start+1,
  -- computed for display, never stored.
  start_year INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, start_year)
);

CREATE INDEX IF NOT EXISTS academic_years_teacher_id_idx
  ON academic_years (teacher_id);

CREATE TABLE IF NOT EXISTS academic_year_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: deleting an academic year removes its module assignments with it.
  -- Deleting the academic_years row itself is blocked at the application level while this
  -- table still has rows for it (HAS_DEPENDENTS) — see api-contracts.md.
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  -- No ON DELETE CASCADE from this side: deleting a catalog_modules row while an
  -- academic_year_modules row still references it is blocked at the application level
  -- instead (HAS_DEPENDENTS, see api-contracts.md's DELETE /api/catalog/modules/:id and
  -- DELETE /api/catalog/training-cycles/:id — 2026-08-06 fix for #4, UC-04/UC-05's A5).
  catalog_module_id UUID NOT NULL REFERENCES catalog_modules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, catalog_module_id)
);

CREATE INDEX IF NOT EXISTS academic_year_modules_academic_year_id_idx
  ON academic_year_modules (academic_year_id);

CREATE INDEX IF NOT EXISTS academic_year_modules_catalog_module_id_idx
  ON academic_year_modules (catalog_module_id);
