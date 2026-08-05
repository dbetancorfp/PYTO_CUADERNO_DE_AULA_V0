# Configuración

Reached from the Dashboard's navbar `settings-menu` icon, which today is an explicitly
disabled placeholder (see `views/dashboard/description_dashboard.md`) — this view is what
makes it real. Three sections, in this order: **Profesor** (the signed-in teacher's own
name and password), **Ciclos/Módulos** (master CRUD over the teacher's catalog of ciclos
formativos and módulos profesionales, seeded from the official BOC curricula), and
**Año académico** (the school-year setup screen — UI only for now, see below).

Domain: Formación Profesional (Canarias). Everything here belongs to the signed-in teacher
— there's no shared/global catalog, no other-teacher visibility.

**Redesign note (2026-08-04)**: the tables that used to back Año académico
(`training_cycles`, `modules`, `academic_years`, `academic_year_modules`) have been dropped.
Ciclos/Módulos is **not** a new UI surface over those tables — it owns its own, brand-new
pair, decoupled from anything year-related. Año académico's own data layer is out of scope
for this pass (see its section below).

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

Master data management for the teacher's own catalog of ciclos formativos and módulos
profesionales — a brand-new pair of tables (`catalog_training_cycles`, `catalog_modules`),
independent of años académicos: no FK to any year-related table, no
"selected for this year" concept at all. It's a reference catalog the teacher browses and
edits, seeded initially from Canarias' official BOC curricula (Desarrollo de Aplicaciones
Multiplataforma and Desarrollo de Aplicaciones Web, both cursos 1º/2º) — that seeding is a
one-off data load, not a UI feature of this view.

- **Ciclos list**: every ciclo formativo this teacher has created (e.g. "Desarrollo de
  Aplicaciones Multiplataforma", "Desarrollo de Aplicaciones Web"). Create new (name only),
  rename, delete. Selecting a ciclo drives the Módulos list below it (master/detail).
- **Módulos list** (scoped to the selected ciclo): each módulo's curso (1º/2º) and nombre.
  Create new (curso + nombre), rename, change curso, delete.
- Uniqueness, scoped to the signed-in teacher: ciclo names unique; módulo names unique
  within their (ciclo, curso).
- Deleting a ciclo cascades to deleting its módulos — no other table references this
  catalog, so there's no dependency-blocked-deletion case here (unlike the old
  training_cycles/modules pair, which was blocked by academic_year_modules).
- If the teacher has no ciclos yet, an empty state prompts to create the first one.

### Section: Año académico — UI only, not wired, for this pass

Keep the screen's existing visual layout and components (`academic-year-table`,
`training-cycle-table`, `module-table`, the three-mode adding-year/adding-cycle/normal
behavior) exactly as already designed — don't redesign the UI. But its backing tables
(`training_cycles`, `modules`, `academic_years`, `academic_year_modules`) are gone, and this
pass doesn't recreate them: the screen renders, but isn't wired to a working backend. No new
API contracts, no new schema, no new tests for this section's data behavior in this pass —
it's a placeholder until a future view rebuilds its data layer (possibly on top of the new
catalog tables, possibly its own — undecided, out of scope here).

## Behavior

- Reaching `/configuracion` requires a valid session, same gate as Dashboard: no session →
  redirect to `/login`.
- Ciclos/Módulos: every create/edit/delete persists immediately to Postgres — real CRUD, no
  client-side draft/publish step.
- Año académico: no persistence behavior in scope for this pass (see above).

## Data

- **New tables** (Ciclos/Módulos only), scoped by a foreign key to the signed-in teacher's
  `users` row:
  - `catalog_training_cycles`: `id`, `teacher_id`, `name`, unique per teacher.
  - `catalog_modules`: `id`, `catalog_training_cycle_id` (FK, `ON DELETE CASCADE`), `course`
    (1 or 2), `name`, unique within (`catalog_training_cycle_id`, `course`, `name`).
  - No FK to `users`/`academic_years`/anything else beyond the two above — a standalone
    catalog.
- Reuses `users.full_name`/`users.password_hash` for Profesor, unchanged.
- Año académico's former tables are dropped and not recreated in this pass.

## Initial data load (Ciclos/Módulos)

Two official BOC PDFs already in `documentation/` — `desarrollo_aplicaciones_multiplataformas.pdf`
(DAM) and `desarrollo_aplicaciones_web.pdf` (DAW) — list each ciclo's módulos per curso. This
data gets loaded directly into `catalog_training_cycles`/`catalog_modules` for the
`e2e-valid-user@example.com` teacher account, as a one-off step outside the UI (not a
"cargar datos" button in this view) — no código MEC column, name + curso only, matching the
schema above.

## Out of scope

- Multi-teacher management (creating other teacher accounts, roles/permissions) — this
  view only ever touches the signed-in teacher's own data.
- Año académico's data layer (see its section above) — future work.
- Anything that actually *uses* the ciclo/módulo catalog (Listado de alumnos, Diario,
  Criterios de evaluación, etc.) — those are separate, future views.
