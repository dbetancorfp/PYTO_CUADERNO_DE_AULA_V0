# Configuración

Reached from the Dashboard's navbar `settings-menu` icon, which today is an explicitly
disabled placeholder (see `views/dashboard/description_dashboard.md`) — this view is what
makes it real. Two sections: **Profesor** (the signed-in teacher's own name and password)
and **Año académico** (the school-year setup: which ciclos formativos and módulos
profesionales the teacher teaches, and which year is the current one).

Domain: Formación Profesional (Canarias). Everything here belongs to the signed-in teacher
— there's no shared/global catalog, no other-teacher visibility. All of it persists to
Postgres and supports full CRUD.

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

### Section: Año académico

- **Lista de años académicos**: every año académico this teacher has ever created (e.g.
  "2026/2027", "2027/2028"), each showing whether it's the one marked "en curso". Create
  new (just a name/label — no start/end dates for now), rename, delete. Exactly one can be
  marked "en curso" at a time; marking a different one "en curso" un-marks the previous one.
  It's valid for **none** to be marked "en curso" (e.g. right after the teacher's very first
  login, before they've set anything up).
- **Ciclos**: the teacher's own list of ciclos formativos (e.g. "Desarrollo de Aplicaciones
  Web"). Create, rename, delete.
- **Módulos**: for each ciclo, its módulos profesionales, each tagged with which curso it
  belongs to within that ciclo — 1º, 2º, or (some ciclos) 3º. Create, rename, change curso,
  delete, all scoped to a ciclo.
- **Selección del año académico**: for whichever año académico the teacher is looking at
  (typically the one "en curso", but past years stay editable too — this is real CRUD, not
  a frozen history), a way to pick which of the teacher's módulos apply that year. "Which
  ciclos the teacher teaches this year" is never asked separately — it's just whichever
  ciclos have at least one selected módulo that year; there's no standalone "select a ciclo
  for this year" step.
- If the teacher has no ciclos/módulos yet (new install, empty tables), the módulo-selection
  area has nothing to show — the teacher has to create at least one ciclo and one módulo
  under it first. This is a real, expected first-run state, not an error.

## Behavior

- Reaching `/configuracion` requires a valid session, same gate as Dashboard: no session →
  redirect to `/login`.
- **Uniqueness**, all scoped to the signed-in teacher: ciclo names are unique; módulo names
  are unique within their (ciclo, curso); año académico names are unique.
- **Deleting a ciclo or módulo that's referenced by any año académico's selection (past or
  current) is blocked** — the teacher has to remove it from that year's selection first.
  Show a clear message naming which año(s) académico(s) are holding the reference.
- **Deleting the año académico currently marked "en curso" is blocked**, same reasoning —
  the teacher has to mark a different one "en curso" (or explicitly have none marked) before
  deleting it.
- **Editing a módulo that's already selected in one or more años académicos is allowed**
  (renaming it or changing its curso doesn't remove it from any selection), but must show a
  confirmation message first — a real modal (its own `modal`-type element inside this view's
  Shadow DOM, not a native `confirm()` dialog) naming which año(s) académico(s) reference it,
  which the teacher has to confirm before the edit saves. Editing a ciclo's name has no such
  warning — the reference lives on the módulo, not the ciclo.
- Every create/edit/delete across ciclos, módulos, años académicos, and the year selection
  persists immediately to Postgres — this is real CRUD, not a client-side draft the teacher
  has to separately "publish."

## Data

- New tables needed (all scoped by a foreign key to the signed-in teacher's `users` row):
  `ciclos` (nombre), `modulos` (ciclo, curso [1/2/3], nombre), `anos_academicos` (nombre,
  is_current), and a join between `anos_academicos` and `modulos` recording that year's
  selection.
- Reuses `users.full_name` (already exists, from Login's session-gap reopen) for the
  Profesor section's name field, and `users.password_hash` (via the same `Bun.password`
  verify/hash flow Login already uses) for the password-change flow.

## Out of scope

- Start/end dates on an año académico — just a name/label for now.
- Multi-teacher management (creating other teacher accounts, roles/permissions) — this
  view only ever touches the signed-in teacher's own data.
- Anything that actually *uses* the año-académico/ciclo/módulo setup (Listado de alumnos,
  Diario, Criterios de evaluación, etc.) — those are separate, future views. This view only
  builds the configuration they'll eventually read.
