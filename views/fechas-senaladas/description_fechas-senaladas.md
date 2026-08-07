# Fechas señaladas

A fourth section of **Configuración**, alongside Profesor, Ciclos/Módulos and Año académico
— reached via a new `key-dates-nav-link` in the shared settings nav (`settings-nav.ts`,
redesigned 2026-08-06 to match the main navbar's style: "Configuración" far left, screen
links centered, "Volver" far right). Master CRUD over the Canary Islands' official school
calendar template: recurring key dates, holidays, public holidays, free-disposal days,
evaluation-session windows, and FEOE (work-placement) alternation days — the same kind of
reference data Ciclos/Módulos already models (shared, global, not scoped per teacher),
seeded once from `documentation/calendario_dias_clave.json` (a local, not-committed
reference file — see `.gitignore`).

## Domain and scope

- **Global, day/month only, no year.** The source data is a template: "12/10" (Fiesta
  Nacional de España), "22/12–07/01" (Vacaciones de Navidad) — no year attached, because
  the same day/month repeats every academic year. This is **not** tied to any specific
  `academic_years` row and has **no** FK to `users` or `academic_years` — any signed-in
  teacher sees and edits the same shared template, exactly like Ciclos/Módulos' catalog.
  Storing full dates (with a year) is explicitly out of scope for this view; if a future
  view needs year-specific calendar dates, that's a separate concern building on top of this
  template, not something this view does.
- **One table, not one per category.** The six categories in the source JSON
  (`fechas_clave_fp`, `vacaciones`, `dias_festivos`, `libre_disposicion`, `evaluaciones`,
  `proyecto_basado_en_retos_FEOE`) all share the same shape — a named event on a single day
  or spanning a day range — differing only in whether they carry a `tipo` (only
  `dias_festivos` does) and whether they're a range or a single day. One `key_dates` table
  with a `category` column (closed domain, `CHECK` constraint — see CLAUDE.md's "no ENUM"
  rule) avoids six near-identical tables, six near-identical CRUD endpoints, and six
  near-identical frontend sections for what is one entity type.
- A single-day entry stores the same day/month in both start and end columns (no separate
  "is this a range" flag needed — the UI treats `start == end` as a single day, matching how
  the source JSON's `fecha` (no range) vs `fecha_inicio`/`fecha_fin` (range) distinction
  collapses cleanly into one shape).

## Categories (seed data, from `calendario_dias_clave.json`)

| Category (internal id) | Spanish label | Shape | Count |
|---|---|---|---|
| `academic_key_dates` | Fechas clave FP | range | 4 |
| `holidays` | Vacaciones | range | 2 |
| `public_holidays` | Días festivos | single day + `tipo` | 10 |
| `free_disposal_days` | Días de libre disposición | single day | 4 |
| `evaluations` | Evaluaciones | range | 13 |
| `feoe_project_days` | Proyecto FEOE | single day | 10 |

43 rows total. The source JSON had two data-quality issues, already fixed by the user
directly in the local file before this view started: invalid trailing-comma JSON syntax in
`evaluaciones`, a duplicate `libre_disposicion` entry (removed), and a mislabeled second "Dia
de alternancia 4" in `proyecto_basado_en_retos_FEOE` (renamed to "5", matching its distinct
date). The seed data this view embeds should match the now-corrected file exactly — verify
against it directly, don't re-derive from memory of the earlier broken version.

## What the user sees

### Entry point

`key-dates-nav-link` added to `settings-nav.ts`'s shared nav, after `academic-year-nav-link`
— same active/inactive styling as the other three links.

### Fechas señaladas screen

One table per category (six sections, in the order listed above), each showing that
category's rows: nombre, fecha (single day, `DD/MM`) or rango (`DD/MM – DD/MM`), and — only
for Días festivos — tipo. Each section:

- **Create**: inline add row (nombre + fecha-inicio + fecha-fin [same field, disabled/hidden
  for single-day categories — decide the simplest honest UI for this at design time] +
  tipo [Días festivos only]).
- **Edit**: inline, same pattern as Ciclos/Módulos' rows (Editar → inputs + Guardar/Cancelar).
- **Delete**: Eliminar, unconditional — nothing else in the schema references `key_dates`
  rows (no dependency-blocked deletion case, unlike Ciclos/Módulos' post-#4 behavior).
- Day/month inputs: two small numeric inputs (día 1–31, mes 1–12) or a single `DD/MM`-typed
  text input with format validation — view-designer's call; either must reject an invalid
  day/month combination (e.g. `31/02`) client-side before submit, and the backend must
  re-validate regardless (never trust client-side validation alone).

### Uniqueness / validation

- No natural uniqueness constraint across categories (e.g. two different categories can
  legitimately land on the same day — a `dias_festivos` entry and a `libre_disposicion`
  entry could coincide). Don't invent a uniqueness rule the source data doesn't have.
- `tipo` is free text when present (seed values include parenthetical locations, e.g.
  "Insular (Tenerife)", "Local (Puerto de la Cruz)") — not a closed domain, no `CHECK`.

## Data

New table, `views/fechas-senaladas/schema-changes.sql`:

- `key_dates`: `id` (uuid PK), `category` (`varchar`, `CHECK` against the six internal ids
  above), `name` (`varchar`), `start_day`/`start_month` (`integer`, `CHECK` 1–31/1–12),
  `end_day`/`end_month` (`integer`, same `CHECK`s — always populated, equal to start for a
  single-day entry per the "Domain and scope" note above), `type` (`varchar`, nullable, only
  meaningful for `public_holidays`), `created_at`.
- No FK to `users` or `academic_years` — global/shared, per "Domain and scope" above.

## Seeding — auto-loaded on every backend boot

Same pattern as `src/backend/src/db/seed-catalog-curriculum.ts` (2026-08-06): a
`seedKeyDates(sql)` function with the 43 rows embedded as a TypeScript constant (not read
from `documentation/calendario_dias_clave.json` at runtime — that file is local-only,
`.gitignore`d, and won't exist in other environments), called from `index.ts` on every
`DATA_BACKEND=postgres` boot, idempotent (`ON CONFLICT DO NOTHING`/`DO UPDATE` — pick a
natural conflict target, e.g. `(category, name, start_day, start_month)`, since there's no
other natural uniqueness signal). This guarantees the calendar template is always present,
the same guarantee `seedCatalogCurriculum` gives the BOC curriculum catalog, for the same
reason (reference data a test run or manual cleanup could otherwise wipe).

## Out of scope

- Per-academic-year real dates (with a year attached) — this view is the day/month template
  only, as scoped above.
- Any connection to `academic_years`/`academic_year_modules`/grading/attendance — this is
  pure reference calendar data, not wired into any other view's logic yet.
- Import/export, file upload UI — the seed is a one-time data load at boot, not a
  user-facing import feature.
