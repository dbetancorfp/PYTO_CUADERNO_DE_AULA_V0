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
