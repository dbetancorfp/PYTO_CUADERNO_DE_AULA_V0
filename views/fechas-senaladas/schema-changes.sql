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
  -- Only meaningful for category = 'public_holidays' (e.g. "Nacional", "Insular
  -- (Tenerife)") — free text, no CHECK: values include parenthetical locations, not a
  -- small closed set.
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
