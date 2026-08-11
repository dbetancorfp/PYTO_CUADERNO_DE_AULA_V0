-- views/calendario — snapshot of key_dates resolved to real dates per módulo (2026-08-07)
--
-- key_dates (Fechas señaladas) is a global, day/month-only template with no year — it can't
-- say which calendar year "22/12" falls in for a specific academic year, and it isn't meant
-- to persist a módulo's calendar if key_dates is edited later. calendario_modulo is the
-- snapshot: populated as a side effect of Año académico's "Guardar selección" flow (both
-- creating a new academic year and extending an existing one — see
-- views/calendario/use-cases.md UC-06), one row per key_dates entry per módulo assigned,
-- with start_day/start_month/end_day/end_month resolved to real start_date/end_date using
-- the academic year's start_year. Read-only from the Calendario view itself.

CREATE TABLE IF NOT EXISTS calendario_modulo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: removing a módulo's assignment to an academic year
  -- (academic_year_modules row) removes its generated calendar with it — no application
  -- code needed for cleanup (see use-cases.md UC-07). Mirrors academic_year_modules'
  -- own ON DELETE CASCADE from academic_years (see views/configuracion/schema-changes.sql).
  academic_year_module_id UUID NOT NULL REFERENCES academic_year_modules(id) ON DELETE CASCADE,
  -- Same closed domain as key_dates.category (views/fechas-senaladas/schema-changes.sql) —
  -- no ENUM (project convention), CHECK on VARCHAR instead.
  category VARCHAR(40) NOT NULL CHECK (category IN (
    'academic_key_dates','holidays','public_holidays',
    'free_disposal_days','evaluations','feoe_project_days'
  )),
  name VARCHAR(200) NOT NULL,
  -- Resolved real dates, not day/month — this table is anchored to one specific academic
  -- year, unlike key_dates' year-agnostic template. Stored as a range (not one row per day
  -- in the range): cheap regardless of how long the range is, and keeps the
  -- "long range colors only its boundary days" display rule a pure frontend concern (see
  -- functional-spec.json's calendario-months businessRules) rather than a storage decision.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Natural key mirrors key_dates_natural_key_idx (category, name, start_day, start_month)
  -- plus the módulo scope — makes seeding idempotent (ON CONFLICT DO NOTHING), so saving
  -- the same selection twice, or re-extending, never duplicates rows.
  UNIQUE (academic_year_module_id, category, name, start_date)
);

CREATE INDEX IF NOT EXISTS calendario_modulo_academic_year_module_id_idx
  ON calendario_modulo (academic_year_module_id);

-- Migration (2026-08-09) — 'final_exams' category, added to the already-live
-- calendario_modulo table (CREATE TABLE IF NOT EXISTS above is a no-op against it now).
-- Introspected via `psql "$DATABASE_URL" -c "\d calendario_modulo"` before writing this:
-- the CHECK constraint's real name is the Postgres default for an unnamed inline CHECK
-- on this column, "calendario_modulo_category_check" — confirmed against the live dev
-- database, not assumed.
--
-- 'final_exams' rows are computed, not copied from key_dates (key_dates stays day/month
-- only, six categories — see views/fechas-senaladas/schema-changes.sql, unchanged): for
-- every 'evaluations' row already resolved in this same seeding pass whose name matches
-- "<prefix> - Último día para poner notas.", CalendarioModuloService.seedForModules
-- computes and inserts two single-day 'final_exams' rows —
-- "<prefix> - Examen de recuperación final." (Último día de notas − 2 business days) and
-- "<prefix> - Examen final." (Examen de recuperación final − 4 business days) — both before
-- the grade deadline, not after (corrected 2026-08-09, see review-report.md) — see
-- views/calendario/use-cases.md UC-08.
ALTER TABLE calendario_modulo DROP CONSTRAINT IF EXISTS calendario_modulo_category_check;
ALTER TABLE calendario_modulo ADD CONSTRAINT calendario_modulo_category_check CHECK (category IN (
  'academic_key_dates','holidays','public_holidays',
  'free_disposal_days','evaluations','feoe_project_days','final_exams'
));

-- New table (2026-08-09) — working-day count between the módulo's course start and each
-- evaluación's "Examen final" date, one row per (módulo, evaluación). A count, not a date
-- range, so it doesn't fit calendario_modulo's shape — a sibling table instead, same FK
-- target and same ON DELETE CASCADE lifecycle as calendario_modulo (see use-cases.md UC-09).
--
-- evaluation_number (1/2/3), not the key_dates name suffix ("(1º)"/"(2º)") — a given módulo
-- only ever has one course, so which suffix applies is already implied by
-- academic_year_modules -> catalog_modules.course; storing the suffix too would be
-- redundant and could theoretically disagree with it.
CREATE TABLE IF NOT EXISTS calendario_evaluation_working_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_module_id UUID NOT NULL REFERENCES academic_year_modules(id) ON DELETE CASCADE,
  evaluation_number SMALLINT NOT NULL CHECK (evaluation_number IN (1, 2, 3)),
  -- Count of working days in [course start, Examen final) for this módulo/evaluación — see
  -- use-cases.md UC-09 for the exact range (start inclusive, end exclusive) and the
  -- working-day definition (reuses business-day.ts's isLaborable).
  working_days INTEGER NOT NULL CHECK (working_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotent seeding, same pattern as calendario_modulo's own natural key.
  UNIQUE (academic_year_module_id, evaluation_number)
);

CREATE INDEX IF NOT EXISTS calendario_evaluation_working_days_academic_year_module_id_idx
  ON calendario_evaluation_working_days (academic_year_module_id);

-- Migration (2026-08-10) — `type` column on calendario_modulo, added purely for the color
-- legend (calendario-legend, UC-11): the calendar day-coloring scheme moves from one fixed
-- color per category to one color per (category, type) pair, matching key_dates' own `type`
-- column (see views/fechas-senaladas/schema-changes.sql) — `seedForModules` now copies
-- `keyDate.type` alongside category/name/dates. Nullable, same as key_dates.type: a custom
-- key_dates row a teacher adds without a tipo still snapshots fine, the frontend falls back
-- to that category's base hue when type is null. `final_exams` rows have no key_dates row to
-- copy `type` from (they're computed, not copied) — stay NULL; the frontend distinguishes
-- "Examen final."/"Examen de recuperación final." by name suffix instead, not by `type`.
ALTER TABLE calendario_modulo ADD COLUMN IF NOT EXISTS type VARCHAR(100);

-- Backfill the 102 already-live rows (2026-08-10, real dev DB, one existing academic_years
-- assignment) from key_dates by (category, name) — the exact same natural-key match
-- `seedForModules` already uses implicitly when it copies a key_dates row. Safe to re-run:
-- always re-sets the same value. Only affects category != 'final_exams' (no key_dates row
-- to join for those, they stay NULL, as intended).
UPDATE calendario_modulo cm
SET type = kd.type
FROM key_dates kd
WHERE cm.category = kd.category
  AND cm.name = kd.name
  AND cm.category != 'final_exams';

-- calendario_horario (2026-08-11) — one row per real, laborable school-year date whose
-- weekday has an hours value in academic_year_module_schedules (see
-- views/configuracion/schema-changes.sql), regenerated in full every time Horario's
-- schedule-save-button is clicked (see use-cases.md UC-12). Independent of
-- calendario_modulo: a day can have a calendario_horario row with zero calendario_modulo
-- entries (the common case — most school days have no key_dates entry at all), or both at
-- once (UC-13/A2). Never a color-table row (UC-11) — an overlay ring on calendario-months,
-- not a fill.
CREATE TABLE IF NOT EXISTS calendario_horario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: deleting the módulo assignment (or the academic year it cascades
  -- from) removes its horario overlay with it — same as calendario_modulo (UC-07).
  academic_year_module_id UUID NOT NULL REFERENCES academic_year_modules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours SMALLINT NOT NULL CHECK (hours BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_module_id, date)
);

CREATE INDEX IF NOT EXISTS calendario_horario_academic_year_module_id_idx
  ON calendario_horario (academic_year_module_id);
