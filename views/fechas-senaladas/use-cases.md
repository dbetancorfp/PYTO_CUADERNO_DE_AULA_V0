# Use Cases — Fechas señaladas

**Fourth Configuración screen.** Master CRUD over `key_dates`, a single shared, global table
holding the Canary Islands' official school calendar template — day/month only, no year, not
scoped per teacher, not tied to `academic_years` (see `description_fechas-senaladas.md`'s
"Domain and scope"). Six independent category sections (no master/detail cascade between
them), each following `lib/patterns/crud-table-component.md` exactly like Ciclos/Módulos.
Seeded once, automatically, on every backend boot from `documentation/calendario_dias_clave.json`
(43 rows) — that seeding is a one-off data load, not a UI feature of any use case below.

---

## UC-01: Navigate between the four Configuración screens

**Primary actor**: Any signed-in teacher
**Preconditions**: Valid session
**Elements**: `back-to-dashboard-link`, `teacher-nav-link`, `training-catalog-nav-link`,
`academic-year-nav-link`, `key-dates-nav-link`

### Main flow

1. `key-dates-nav-link` is added to the shared settings nav (`settings-nav.ts`), after
   `academic-year-nav-link` — same centered, active/inactive styling as the other three
   screen links (see Configuración's own UC-03, which this use case extends with the fourth
   link rather than duplicating).
2. Clicking `key-dates-nav-link` from any of the other three screens navigates to
   `/configuracion/fechas-senaladas`.
3. Clicking `back-to-dashboard-link` from this screen navigates to `/dashboard`.

### Alternative flows

- **A1 — Already on this screen**: clicking `key-dates-nav-link` again is a no-op.

### Postconditions

- Route changes; no data changes.

### Acceptance criteria

- [x] `key-dates-nav-link` shows `aria-current="page"` and highlighted styling when the
      current route is `/configuracion/fechas-senaladas`
- [x] Clicking `key-dates-nav-link` navigates to `/configuracion/fechas-senaladas`
- [x] Clicking `back-to-dashboard-link` navigates to `/dashboard`

---

## UC-02: Manage Fechas clave FP

**Primary actor**: Any signed-in teacher, on `/configuracion/fechas-senaladas`
**Preconditions**: Valid session
**Elements**: `academic-key-dates-table`, `academic-key-dates-table-add-button`

**Real backend, shared/global** — `key_dates` rows where `category = 'academic_key_dates'`.
Range category: every row has a start and end day/month, shown as `DD/MM – DD/MM`, plus
`tipo` (free text — see UC-04's own `tipo` rules, now shared by every category, not just
Días festivos).

### Main flow

1. `academic-key-dates-table` lists every `key_dates` row in this category.
2. Teacher clicks `academic-key-dates-table-add-button`; a blank, inline-editable draft row
   opens (nombre, fecha inicio `DD/MM`, fecha fin `DD/MM`, tipo).
3. Teacher fills nombre + fecha inicio + fecha fin (+ optionally tipo) and saves; the row
   persists immediately.

### Alternative flows

- **A1 — Duplicate (category, nombre, fecha inicio)**: rejected (`DUPLICATE_NAME`), inline
  error on the row, draft stays open.
- **A2 — Invalid date**: `DD/MM` that isn't a real day-in-month (e.g. `31/02`) is rejected
  client-side before submit; if it somehow reaches the backend anyway, rejected there too
  (`400`).
- **A3 — Edit a row**: Editar switches it to the same inline inputs, pre-filled; Guardar
  persists the change, Cancelar discards it.
- **A4 — Delete a row**: Eliminar removes it immediately — unconditional, no confirmation,
  nothing else in the schema references `key_dates`.
- **A5 — Tipo left blank**: allowed — `type` is nullable.

### Postconditions

- On A1/A2: no change. On main flow/A3/A4: `key_dates` reflects the change.

### Acceptance criteria

- [x] `academic-key-dates-table` shows an empty-state message when the category has no rows
- [x] `academic-key-dates-table` shows one row per `key_dates` row in this category, columns:
      nombre, fecha inicio, fecha fin, tipo
- [x] Clicking `academic-key-dates-table-add-button` opens a blank, inline-editable draft row
- [x] Saving the draft row with a valid nombre and fecha (`DD/MM`) persists a new row and it
      appears in the table, tipo optional
- [x] Saving with an invalid date (e.g. `31/02`, or a non-`DD/MM` value) shows an inline
      error and does not submit
- [x] Clicking a row's Editar switches it to inline-editable inputs for nombre, fecha
      inicio, fecha fin, tipo
- [x] Clicking a row's Eliminar deletes it unconditionally and it disappears from the table
- [x] A row's date displays as `"DD/MM – DD/MM"` when start and end differ, or a single
      `"DD/MM"` when they're equal

---

## UC-03: Manage Vacaciones

**Primary actor**: Any signed-in teacher, on `/configuracion/fechas-senaladas`
**Preconditions**: Valid session
**Elements**: `holidays-table`, `holidays-table-add-button`

Identical shape and rules to UC-02, scoped to `category = 'holidays'` and `holidays-table`/
`holidays-table-add-button` instead. Range category (fecha inicio/fecha fin), plus tipo
(same as every category now — see UC-04).

### Acceptance criteria

- [x] `holidays-table` shows an empty-state message when the category has no rows
- [x] `holidays-table` shows one row per `key_dates` row in this category, columns: nombre,
      fecha inicio, fecha fin, tipo
- [x] Clicking `holidays-table-add-button` opens a blank, inline-editable draft row
- [x] Saving the draft row with a valid nombre and fecha (`DD/MM`) persists a new row and it
      appears in the table, tipo optional
- [x] Saving with an invalid date shows an inline error and does not submit
- [x] Clicking a row's Editar switches it to inline-editable inputs for nombre, fecha
      inicio, fecha fin, tipo
- [x] Clicking a row's Eliminar deletes it unconditionally and it disappears from the table
- [x] A row's date displays as `"DD/MM – DD/MM"` when start and end differ, or a single
      `"DD/MM"` when they're equal

---

## UC-04: Manage Días festivos

**Primary actor**: Any signed-in teacher, on `/configuracion/fechas-senaladas`
**Preconditions**: Valid session
**Elements**: `public-holidays-table`, `public-holidays-table-add-button`

**Single-day category, with tipo.** `key_dates` rows where `category = 'public_holidays'` —
`tipo` (free text, e.g. "Festivo nacional", "Festivo insular (Tenerife)") is shown/edited
here first, and every other category's table now carries the same column (UC-02/03/05/06/07)
— `type` isn't a `public_holidays`-only field, it's just free text on every row, populated
or not depending on what the teacher enters. The row's `end_day`/`end_month` always equal
`start_day`/`start_month` (see schema-changes.sql);
the UI shows and edits only one fecha field, never a redundant end-date input.

### Main flow

1. `public-holidays-table` lists every row, columns: nombre, fecha, tipo.
2. Teacher clicks `public-holidays-table-add-button`; a blank draft row opens (nombre, fecha
   `DD/MM`, tipo).
3. Teacher fills nombre + fecha (+ optionally tipo) and saves; persists immediately.

### Alternative flows

- **A1 — Duplicate (category, nombre, fecha)**: rejected (`DUPLICATE_NAME`), inline error,
  draft stays open.
- **A2 — Invalid date**: same as UC-02's A2.
- **A3 — Edit a row**: Editar → inline inputs (nombre, fecha, tipo), Guardar/Cancelar.
- **A4 — Delete a row**: Eliminar, unconditional.
- **A5 — Tipo left blank**: allowed — `type` is nullable.

### Postconditions

- On A1/A2: no change. On main flow/A3/A4: `key_dates` reflects the change.

### Acceptance criteria

- [x] `public-holidays-table` shows an empty-state message when the category has no rows
- [x] `public-holidays-table` shows one row per row in this category, columns: nombre,
      fecha, tipo
- [x] Clicking `public-holidays-table-add-button` opens a blank, inline-editable draft row
- [x] Saving the draft row with a valid nombre and fecha (`DD/MM`) persists a new row, tipo
      optional
- [x] Saving with an invalid date shows an inline error and does not submit
- [x] Clicking a row's Editar switches it to inline-editable inputs for nombre, fecha, tipo
- [x] Clicking a row's Eliminar deletes it unconditionally and it disappears from the table
- [x] `public-holidays-table` shows each row's tipo (free text) alongside its fecha

---

## UC-05: Manage Días de libre disposición

**Primary actor**: Any signed-in teacher, on `/configuracion/fechas-senaladas`
**Preconditions**: Valid session
**Elements**: `free-disposal-days-table`, `free-disposal-days-table-add-button`

Same single-day shape as UC-04, `category = 'free_disposal_days'`, now also with tipo (see
UC-04).

### Acceptance criteria

- [x] `free-disposal-days-table` shows an empty-state message when the category has no rows
- [x] `free-disposal-days-table` shows one row per row in this category, columns: nombre,
      fecha, tipo
- [x] Clicking `free-disposal-days-table-add-button` opens a blank, inline-editable draft row
- [x] Saving the draft row with a valid nombre and fecha (`DD/MM`) persists a new row, tipo
      optional
- [x] Saving with an invalid date shows an inline error and does not submit
- [x] Clicking a row's Editar switches it to inline-editable inputs for nombre, fecha, tipo
- [x] Clicking a row's Eliminar deletes it unconditionally and it disappears from the table

---

## UC-06: Manage Evaluaciones

**Primary actor**: Any signed-in teacher, on `/configuracion/fechas-senaladas`
**Preconditions**: Valid session
**Elements**: `evaluations-table`, `evaluations-table-add-button`

Same range shape as UC-02/UC-03 — `category = 'evaluations'`, now also with tipo (see UC-04).

### Acceptance criteria

- [x] `evaluations-table` shows an empty-state message when the category has no rows
- [x] `evaluations-table` shows one row per row in this category, columns: nombre, fecha
      inicio, fecha fin, tipo
- [x] Clicking `evaluations-table-add-button` opens a blank, inline-editable draft row
- [x] Saving the draft row with a valid nombre and fecha (`DD/MM`) persists a new row, tipo
      optional
- [x] Saving with an invalid date shows an inline error and does not submit
- [x] Clicking a row's Editar switches it to inline-editable inputs for nombre, fecha
      inicio, fecha fin, tipo
- [x] Clicking a row's Eliminar deletes it unconditionally and it disappears from the table
- [x] A row's date displays as `"DD/MM – DD/MM"` when start and end differ, or a single
      `"DD/MM"` when they're equal

---

## UC-07: Manage Proyecto FEOE

**Primary actor**: Any signed-in teacher, on `/configuracion/fechas-senaladas`
**Preconditions**: Valid session
**Elements**: `feoe-project-days-table`, `feoe-project-days-table-add-button`

Same single-day shape as UC-05 — `category = 'feoe_project_days'`, now also with tipo (see
UC-04).

### Acceptance criteria

- [x] `feoe-project-days-table` shows an empty-state message when the category has no rows
- [x] `feoe-project-days-table` shows one row per row in this category, columns: nombre,
      fecha, tipo
- [x] Clicking `feoe-project-days-table-add-button` opens a blank, inline-editable draft row
- [x] Saving the draft row with a valid nombre and fecha (`DD/MM`) persists a new row, tipo
      optional
- [x] Saving with an invalid date shows an inline error and does not submit
- [x] Clicking a row's Editar switches it to inline-editable inputs for nombre, fecha, tipo
- [x] Clicking a row's Eliminar deletes it unconditionally and it disappears from the table
