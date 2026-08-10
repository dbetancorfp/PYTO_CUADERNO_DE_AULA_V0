-- Fechas señaladas — a single, shared, global table for the Canary Islands' official school
-- calendar template (see description_fechas-senaladas.md's "Domain and scope"). Day/month
-- only, no year: the same day/month repeats every academic year, and the source data
-- (documentation/calendario_dias_clave.json) carries no year at all. No FK to users or
-- academic_years — like catalog_cycles/catalog_modules, any signed-in teacher sees and
-- edits the same rows.

CREATE TABLE IF NOT EXISTS key_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Closed domain, CHECK not ENUM (project convention) — one row per
  -- documentation/calendario_dias_clave.json top-level key.
  category VARCHAR(40) NOT NULL CHECK (category IN (
    'academic_key_dates',
    'holidays',
    'public_holidays',
    'free_disposal_days',
    'evaluations',
    'feoe_project_days'
  )),
  name VARCHAR(200) NOT NULL,
  start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  -- Always populated, even for a single-day entry (end = start in that case) — the
  -- category tables' UI only shows one "fecha" field for single-day categories
  -- (public_holidays/free_disposal_days/feoe_project_days), never a redundant end-date
  -- field, but the row itself always carries both ends (see description's "Domain and
  -- scope" — collapses the source JSON's fecha vs fecha_inicio/fecha_fin distinction into
  -- one shape without a separate "is this a range" flag).
  end_day INTEGER NOT NULL CHECK (end_day BETWEEN 1 AND 31),
  end_month INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
  -- Free text on every category, not restricted to public_holidays (e.g. "Festivo
  -- nacional", "Festivo insular (Tenerife)", "Vacaciones", "Curso escolar") — no CHECK:
  -- values include parenthetical locations, not a small closed set.
  type VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS key_dates_category_idx
  ON key_dates (category);

-- (category, name, start_day, start_month) is this table's natural key — same pattern as
-- catalog_modules' UNIQUE (catalog_training_cycle_id, course, name): the service checks it
-- before inserting and responds 409 DUPLICATE_NAME (see api-contracts.md), and it's also
-- the seed script's ON CONFLICT target so re-running it never duplicates rows. Two
-- different categories can still legitimately land on the same day — this constraint only
-- prevents an exact (category, name, start_day, start_month) collision.
CREATE UNIQUE INDEX IF NOT EXISTS key_dates_natural_key_idx
  ON key_dates (category, name, start_day, start_month);
-- Migration (2026-08-10) — teacher-provided corrections/additions to the key_dates
-- reference data, re-seeded from an updated documentation/calendario_dias_clave.json
-- export: two academic_key_dates rows renamed to be explicit about what they mark, and
-- `type` populated for every category (previously public_holidays-only) — see
-- description_fechas-senaladas.md and use-cases.md UC-02/03/05/06/07 (amended).
-- Matches by (category, name) against the natural key BEFORE the rename for the two
-- renamed rows, so this is safe to run against a database that already has the old
-- names — and idempotent afterward, since re-running it just re-sets the same values.
-- Only touches these known seed rows by exact name match; any teacher-added custom
-- key_dates row is untouched.

-- Renames (must run before the type backfill below, which matches by the NEW name).
UPDATE key_dates SET name = 'Inicio curso: 1º de Grado Superior de FP.'
  WHERE category = 'academic_key_dates' AND name = '1º de Grado Superior de FP.';
UPDATE key_dates SET name = 'Inicio curso: 2º de Grado Superior de FP.'
  WHERE category = 'academic_key_dates' AND name = '2º de Grado Superior de FP.';

-- Type backfill, one UPDATE per (category, name).
-- academic_key_dates
UPDATE key_dates SET type = 'Curso escolar' WHERE category = 'academic_key_dates' AND name = 'Inicio curso: 1º de Grado Superior de FP.';
UPDATE key_dates SET type = 'Presentación de proyectos' WHERE category = 'academic_key_dates' AND name = '2º Presentación de proyectos.';
UPDATE key_dates SET type = 'Curso escolar' WHERE category = 'academic_key_dates' AND name = 'Curso escolar';
UPDATE key_dates SET type = 'Curso escolar' WHERE category = 'academic_key_dates' AND name = 'Inicio curso: 2º de Grado Superior de FP.';
-- holidays
UPDATE key_dates SET type = 'Vacaciones' WHERE category = 'holidays' AND name = 'Semana Santa.';
UPDATE key_dates SET type = 'Vacaciones' WHERE category = 'holidays' AND name = 'Vacaciones de Navidad.';
-- public_holidays
UPDATE key_dates SET type = 'Festivo autonómico' WHERE category = 'public_holidays' AND name = 'Día del Enseñante y del Estudiante.';
UPDATE key_dates SET type = 'Festivo nacional' WHERE category = 'public_holidays' AND name = 'Día de la Constitución.';
UPDATE key_dates SET type = 'Festivo nacional' WHERE category = 'public_holidays' AND name = 'Todos los Santos.';
UPDATE key_dates SET type = 'Festivo local (Puerto de la Cruz)' WHERE category = 'public_holidays' AND name = 'Gran Poder de Dios.';
UPDATE key_dates SET type = 'Festivo insular (Tenerife)' WHERE category = 'public_holidays' AND name = 'Martes de Carnaval.';
UPDATE key_dates SET type = 'Festivo local (Puerto de la Cruz)' WHERE category = 'public_holidays' AND name = 'Virgen del Carmen.';
UPDATE key_dates SET type = 'Festivo nacional' WHERE category = 'public_holidays' AND name = 'Día de la Inmaculada Concepción.';
UPDATE key_dates SET type = 'Festivo autonómico' WHERE category = 'public_holidays' AND name = 'Día de Canarias.';
UPDATE key_dates SET type = 'Festivo nacional' WHERE category = 'public_holidays' AND name = 'Fiesta Nacional de España.';
UPDATE key_dates SET type = 'Festivo insular (Tenerife)' WHERE category = 'public_holidays' AND name = 'Virgen de la Candelaria.';
-- free_disposal_days
UPDATE key_dates SET type = 'Libre disposición' WHERE category = 'free_disposal_days' AND name = 'Día de libre disposición, lunes de Carnaval.';
UPDATE key_dates SET type = 'Libre disposición' WHERE category = 'free_disposal_days' AND name = 'Día de libre disposición, puente de mayo.';
UPDATE key_dates SET type = 'Libre disposición' WHERE category = 'free_disposal_days' AND name = 'Día de libre disposición, martes de Carnaval.';
UPDATE key_dates SET type = 'Libre disposición' WHERE category = 'free_disposal_days' AND name = 'Día de libre disposición, puente de Todos los Santos';
-- evaluations
UPDATE key_dates SET type = 'Sesión evaluación' WHERE category = 'evaluations' AND name = '1ª Evaluación - Sesión de evaluación con nota.';
UPDATE key_dates SET type = 'Último dia para poner nota' WHERE category = 'evaluations' AND name = '2ª Evaluación (2º) - Último día para poner notas.';
UPDATE key_dates SET type = 'Atención familiar' WHERE category = 'evaluations' AND name = '3ª Evaluación (1º) - Atención familiar.';
UPDATE key_dates SET type = 'Sesión evaluación' WHERE category = 'evaluations' AND name = '3ª Evaluación (1º) - Sesión de evaluación con nota.';
UPDATE key_dates SET type = 'Sesión evaluación' WHERE category = 'evaluations' AND name = '2ª Evaluación (2º) - Sesión de evaluación con nota.';
UPDATE key_dates SET type = 'Último dia para poner nota' WHERE category = 'evaluations' AND name = '1ª Evaluación - Último día para poner notas.';
UPDATE key_dates SET type = 'Último dia para poner nota' WHERE category = 'evaluations' AND name = '3ª Evaluación (1º) - Último día para poner notas.';
UPDATE key_dates SET type = 'Último dia para poner nota' WHERE category = 'evaluations' AND name = '2ª Evaluación (1º) - Último día para poner notas.';
UPDATE key_dates SET type = 'Atención familiar' WHERE category = 'evaluations' AND name = '1ª Evaluación - Atención familiar.';
UPDATE key_dates SET type = 'Atención familiar' WHERE category = 'evaluations' AND name = '2ª Evaluación (2º) - Atención familiar.';
UPDATE key_dates SET type = 'Sesión evaluación' WHERE category = 'evaluations' AND name = '2ª Evaluación (1º) - Sesión de evaluación con nota.';
UPDATE key_dates SET type = 'Sesión evaluación' WHERE category = 'evaluations' AND name = 'Sesión de evaluación sin nota.';
UPDATE key_dates SET type = 'Atención familiar' WHERE category = 'evaluations' AND name = '2ª Evaluación (1º) - Atención familiar.';
-- feoe_project_days
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '1º - Dia de alternancia 1.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '2º - Dia de alternancia 4.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '1º - Dia de alternancia 4.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '1º - Dia de alternancia 2.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '1º - Dia de alternancia 5.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '1º - Dia de alternancia 3.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '2º - Dia de alternancia 2.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '2º - Dia de alternancia 3.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '2º - Dia de alternancia 1.';
UPDATE key_dates SET type = 'Día de alternancia' WHERE category = 'feoe_project_days' AND name = '2º - Dia de alternancia 5.';

