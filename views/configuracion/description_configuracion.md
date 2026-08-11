# Configuración

Reached from the Dashboard's navbar `settings-menu` icon, which today is an explicitly
disabled placeholder (see `views/dashboard/description_dashboard.md`) — this view is what
makes it real. Three sections, in this order: **Profesor** (the signed-in teacher's own
name and password), **Ciclos/Módulos** (master CRUD over a shared, global catalog of ciclos
formativos and módulos profesionales, seeded from the official BOC curricula), and
**Año académico** (each teacher's own list of school years, each with the cycles/módulos —
picked from the shared catalog — they teach that year).

Domain: Formación Profesional (Canarias). Profesor and Año académico belong to the
signed-in teacher only. Ciclos/Módulos is shared/global — un-scoped 2026-08-05, since
official BOC curricula (e.g. DAM, DAW) are the same regardless of who teaches them — any
signed-in teacher can see and edit it, but only picks from it into their *own*
`academic_years`/`academic_year_modules` rows.

**Redesign history**: 2026-08-04 dropped the old, teacher-owned `training_cycles`/`modules`/
`academic_years`/`academic_year_modules` tables and rebuilt Ciclos/Módulos as a standalone,
shared catalog with a UI-only Año académico stub. 2026-08-05 gives Año académico a real data
layer again — `academic_years` and `academic_year_modules` (see "Data" below) — built on
top of that shared catalog instead of duplicating it per teacher.

## What the user sees

### Entry point (Dashboard)

`settings-menu` in the Dashboard navbar stops being disabled: it becomes a real link to
`/configuracion`.

### Section: Profesor

- The teacher's current full name, editable, saved on its own.
- A change-password form: current password, new password, repeat new password. Saving
  requires the current password to match (re-verified server-side) — the same idea as
  Login's credential check, but this endpoint has no lockout/attempt-tracking of its own
  (the user is already authenticated; lockout exists to stop unauthenticated guessing,
  which doesn't apply here).
- Email is not shown or editable here — out of scope.
- Unaffected by the redesign — keep as already built.

### Section: Ciclos/Módulos

Master data management for a shared, global catalog of ciclos formativos and módulos
profesionales — a brand-new pair of tables (`catalog_cycles`, `catalog_modules`),
independent of años académicos: no FK to any year-related table, no
"selected for this year" concept at all, and no FK to `users` either — any signed-in teacher
sees and edits the same catalog. It's a reference catalog every teacher browses and edits,
seeded initially from Canarias' official BOC curricula (Desarrollo de Aplicaciones
Multiplataforma and Desarrollo de Aplicaciones Web, both cursos 1º/2º) — that seeding is a
one-off data load, not a UI feature of this view.

- **Ciclos list**: every ciclo formativo in the shared catalog (e.g. "Desarrollo de
  Aplicaciones Multiplataforma", "Desarrollo de Aplicaciones Web"). Create new (name only),
  rename, delete. Selecting a ciclo drives the Módulos list below it (master/detail).
- **Módulos list** (scoped to the selected ciclo): each módulo's curso (1º/2º) and nombre.
  Create new (curso + nombre), rename, change curso, delete.
- Uniqueness, global (not scoped per teacher): ciclo names unique; módulo names unique
  within their (ciclo, curso).
- Deleting a ciclo cascades to deleting its módulos, unless one of them is still assigned
  to some academic year (`academic_year_modules`) — that's blocked with `HAS_DEPENDENTS`
  instead (2026-08-06 fix for #4; re-introduces the dependency-blocked case the original
  2026-08-04 catalog decoupling had intentionally removed, now that Año académico's
  real-backend redesign gives the catalog a real dependent again).
- If the catalog has no ciclos yet, an empty state prompts to create the first one.

### Section: Año académico — real backend, 2026-08-05 redesign

**This section now gets a real, persisted data layer**, built on top of the shared
Ciclos/Módulos catalog (`catalog_cycles`/`catalog_modules`) instead of the old, dropped
per-teacher `training_cycles`/`modules` pair. A teacher's academic years are their own
(scoped per teacher), but the cycles/modules they can pick from each year are the shared
catalog — there is no more "create a new cycle/module from this screen": every cycle/módulo
a teacher assigns to a year must already exist in the Ciclos/Módulos catalog.

**Año académico row**:
- Displayed as `"2026-2027"` (a school year spans two calendar years) but only the start
  year is stored — `2026` — as an integer. The end year is always start+1, computed for
  display, never stored.
- One row per teacher can be marked current ("En curso"); marking a row current un-marks
  whichever was current before (same teacher).
- Duplicate start years are rejected **per teacher** — teacher A and teacher B can each
  have their own `2026` row; the same teacher cannot have two.
- Normal mode: **Editar** (rename the year value) and **Borrar** per row.
  - Editar with a start year that already exists for this teacher: rejected — a **Toast**
    notification names the conflict and the row stays in edit mode until corrected.
  - Borrar is blocked if the year has any cycles/módulos already assigned (see below) — a
    Toast explains the block and tells the teacher to remove the assigned módulos/ciclos
    first. No confirmation modal — the Toast itself is the message, not a dialog to
    confirm through.

**Ciclos (`training-cycle-table`) — normal mode**: shows only the cycles this teacher has
at least one módulo assigned to, for the selected academic year (derived from the
selection, not a separate row to manage — see "Data" below). Read-only list here — no
create/rename/delete of catalog cycles from this screen (that's Ciclos/Módulos' job).

**Ciclos — "Añadir año académico" mode** (entered via `academic-year-table-add-button`):
shows **every** cycle in `catalog_cycles` (the whole shared catalog, not filtered to this
teacher — there's no such filter, the catalog has no owner) so the teacher can check one or
several cycles they'll teach this year.

**Módulos (`module-table`) — normal mode**: shows this teacher's assigned módulos for the
selected cycle within the selected academic year, grouped by curso.

**Módulos — "Añadir año académico" mode**: shows every módulo of the currently-checked
cycle from `catalog_modules` (all courses), so the teacher can check which ones they'll
teach.

**Añadir ciclo** (`training-cycle-table-add-cycle-button`, new element): visible in normal
mode whenever an existing academic year is selected. Switches
`training-cycle-table`/`module-table`/`module-selection-table` into the same adding-mode UI
as "Añadir año académico" — but scoped to the already-selected year, with no new draft row
in `academic-year-table`. Lets a teacher add more cycles/módulos to a year created earlier,
not just at creation time; that cycle/year's already-assigned módulos load pre-checked and
disabled so they can't be re-added.

**Guardar selección** (`module-selection-save-button`): behaves differently depending on how
adding mode was entered —
- Via "Añadir año académico": creates the brand-new academic year together with its initial
  cycle/módulo selection (every checked cycle × its checked módulos) in one request.
- Via "Añadir ciclo": adds only the newly-checked módulos to the already-existing,
  already-selected year — no year creation, no `startYear` involved.

Either way, returns to normal mode on success with the affected year selected.

### Section: Horario

**Nueva tabla**: `academic_year_module_schedules` — horario semanal (lunes-viernes) por
módulo dentro de un año académico concreto, no por año académico en general (un profesor
con varios módulos tiene un horario distinto por cada uno).

**Filtros** (3, igual patrón que Calendario — Año carrusel / Ciclo / Módulo, cada cambio
actualiza el siguiente):
1. **Año**: por defecto el año escolar actual calculado (mismo criterio que Calendario:
   mes actual ≥ 9 → año natural actual; si no, año natural actual − 1); solo años con fila
   real en `academic_years`.
2. **Ciclo**: ciclos del profesor autenticado en el año seleccionado.
3. **Módulo**: módulos del ciclo seleccionado.

Al quedar seleccionado un módulo concreto (`academic_year_module_id`), se carga (o se
inicializa vacío si no existe aún) su horario.

**Grid de horario**: fila con los 5 días (Lunes-Viernes) y debajo de cada uno un
combobox con valores 1, 2, 3 y una opción vacía ("Sin clase") — ningún día es obligatorio.

**Guardado**: botón único **Guardar horario** — envía los 5 valores juntos en una sola
petición (upsert de las filas de `academic_year_module_schedules` para ese
`academic_year_module_id`; los días marcados "Sin clase" no generan fila, o borran la
existente).

## Behavior

- Reaching `/configuracion` requires a valid session, same gate as Dashboard: no session →
  redirect to `/login`.
- Ciclos/Módulos: every create/edit/delete persists immediately to Postgres — real CRUD, no
  client-side draft/publish step.
- Año académico: `academic-year-table`'s Editar/Borrar persist immediately (real CRUD, same
  as Ciclos/Módulos). The cycle/módulo selection is the one client-side-draft exception in
  this view — built up locally while in "Añadir año académico" mode, committed to Postgres
  in one request only when `module-selection-save-button` is clicked (see its section
  above) — matches the existing UI's "Guardar selección" concept, now wired to a real
  backend instead of local-only state.
- Toast notifications (new, reusable — not scoped to this view) surface duplicate-year and
  blocked-delete errors: transient, auto-dismissing, not a modal the user must act through.

## Data

- **New tables** (Ciclos/Módulos only) — shared, global catalog, no FK to `users` at all
  (official BOC curricula are the same for every teacher, un-scoped 2026-08-05):
  - `catalog_cycles`: `id`, `name` (globally unique).
  - `catalog_modules`: `id`, `catalog_training_cycle_id` (FK to `catalog_cycles`, `ON DELETE
    CASCADE`), `course` (1 or 2), `name`, unique within (`catalog_training_cycle_id`,
    `course`, `name`).
  - No FK to `academic_years`/anything else beyond the two above — a standalone catalog.
- Reuses `users.full_name`/`users.password_hash` for Profesor, unchanged.
- **New tables** (Año académico, 2026-08-05):
  - `academic_years`: `id`, `teacher_id` (FK `users`, `ON DELETE CASCADE`), `start_year`
    (INTEGER — the `2026` in `"2026-2027"`), `is_current` (BOOLEAN, default false), unique
    within (`teacher_id`, `start_year`).
  - `academic_year_modules`: `id`, `academic_year_id` (FK `academic_years`, `ON DELETE
    CASCADE`), `catalog_module_id` (FK `catalog_modules`, no cascade needed the other way —
    catalog módulos aren't deleted through this view), unique within (`academic_year_id`,
    `catalog_module_id`). This is the one table relating teacher (via `academic_years`) +
    academic year + the cycles/módulos they teach — a row's cycle is derived by joining
    `catalog_module_id` → `catalog_modules.catalog_training_cycle_id`, not stored again
    here.
  - Deleting an `academic_years` row is blocked (application-level check, not a DB
    constraint) whenever it still has `academic_year_modules` rows — see its section above.
- **New table** (Horario, 2026-08-11):
  - `academic_year_module_schedules`: `id`, `academic_year_module_id` (FK
    `academic_year_modules`, `ON DELETE CASCADE`), `weekday` (SMALLINT 1-5, lunes=1),
    `hours` (SMALLINT, CHECK 1-3), unique within (`academic_year_module_id`, `weekday`).
    Ausencia de fila para un día = "sin clase" ese día (no se guarda 0).

## Initial data load (Ciclos/Módulos)

Two official BOC PDFs already in `documentation/` — `desarrollo_aplicaciones_multiplataformas.pdf`
(DAM) and `desarrollo_aplicaciones_web.pdf` (DAW) — list each ciclo's módulos per curso. This
data gets loaded directly into `catalog_cycles`/`catalog_modules` — shared, global rows, no
teacher scoping — as a one-off step outside the UI (not a "cargar datos" button in this
view) — no código MEC column, name + curso only, matching the schema above.

## Out of scope

- Multi-teacher management (creating other teacher accounts, roles/permissions, teacher
  self-registration). The Profesor screen still only ever touches the signed-in teacher's
  own `users` row; the Ciclos/Módulos catalog is shared/global (see "Data" above), not
  per-teacher; `academic_years`/`academic_year_modules` are per-teacher.
- Creating brand-new cycles/módulos from the Año académico screen — every cycle/módulo a
  teacher assigns to a year must already exist in the Ciclos/Módulos catalog; this screen
  only selects from it.
- Anything that actually *uses* a teacher's academic-year módulo selection (Listado de
  alumnos, Diario, Criterios de evaluación, etc.) — those are separate, future views.
