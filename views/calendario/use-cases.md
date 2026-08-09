# Use Cases — Calendario

Read-only dashboard screen (route `/calendario`) showing one módulo's school calendar
(September of a selected school year → June of the next) with `key_dates` categories
marked red or blue, sourced exclusively from `calendario_modulo` — a snapshot table
populated as a side effect of Año académico's existing "Guardar selección"/"Quitar" flows
(UC-06/UC-07 below), never read live from `key_dates`. See
`views/calendario/description_calendario.md` for the full rationale.

---

## UC-01: Navigate to Calendario and back to Dashboard

**Primary actor**: Any signed-in teacher
**Preconditions**: Valid session
**Elements**: `calendario-heading`, `back-to-dashboard-link`

### Main flow

1. Teacher clicks the dashboard's existing `calendar-card` (already wired to `/calendario`
   in `dashboard-view.ts`, out of this view's scope) and lands on this screen.
2. `calendario-heading` shows "Calendario", pinned to the far left of the nav bar.
3. Teacher clicks `back-to-dashboard-link`, pinned to the far right, and returns to
   `/dashboard`.

### Postconditions

- Route changes; no data changes.

### Acceptance criteria

- [x] `calendario-heading` always renders the text "Calendario"
- [x] Clicking `back-to-dashboard-link` navigates to `/dashboard`

---

## UC-02: Browse and select a school year via the carousel

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session
**Elements**: `academic-year-filter-prev`, `academic-year-filter-value`,
`academic-year-filter-next`

### Main flow

1. On load, `academic-year-filter-value` shows the computed current school year
   (`currentSchoolYearStartYear`: current calendar month ≥ 9 → current calendar year;
   otherwise → current calendar year − 1), formatted `"<year>-<year+1>"`.
2. Teacher clicks `academic-year-filter-next`; the selected year advances by one and
   `cycle-filter`/`module-filter`/`calendario-months` re-derive for it.
3. Teacher clicks `academic-year-filter-prev`; the selected year goes back by one, same
   re-derivation.

### Alternative flows

- **A1 — Backward limit**: `academic-year-filter-prev` is disabled once there's no
  `academic_years` row for this teacher with `startYear` below the currently selected
  year (only years the teacher has actually taught are reachable going back).
- **A2 — Forward limit**: `academic-year-filter-next` is disabled once the selected year
  reaches `currentSchoolYearStartYear + 5`. No `academic_years` row is required to move
  forward — a future, not-yet-created year is still selectable.

### Postconditions

- `academic-year-filter-value` reflects the newly selected year; `cycle-filter`,
  `module-filter` and `calendario-months` reload for it.

### Acceptance criteria

- [x] On first load, `academic-year-filter-value` shows the school year containing
      today's date (September-cutoff rule), formatted `"<year>-<year+1>"`
- [x] `academic-year-filter-prev` is disabled when the teacher has no `academic_years`
      row with `startYear` less than the currently selected year
- [x] Clicking `academic-year-filter-prev` when enabled selects the previous available
      school year and updates `academic-year-filter-value`
- [x] `academic-year-filter-next` is disabled once the selected year equals
      `currentSchoolYearStartYear + 5`
- [x] Clicking `academic-year-filter-next` when enabled advances the selected year by 1
      and updates `academic-year-filter-value`
- [x] Selecting a future year with no `academic_years` row shows `cycle-filter` in its
      empty state and `calendario-empty-state` instead of `calendario-months`

---

## UC-03: Select a ciclo

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a school year with at least one `academic_years` row is
selected
**Elements**: `cycle-filter`

### Main flow

1. `cycle-filter` lists the distinct training cycles this teacher teaches in the selected
   school year — derived client-side from `GET /api/academic-years/:id/modules`,
   deduplicated by `catalogTrainingCycleId` (same derivation
   `academic-year-settings-view.ts` already uses for `training-cycle-table`).
2. First cycle selected by default.
3. Teacher changes `cycle-filter`; `module-filter` re-derives to that cycle's módulos and
   selects the first one.

### Alternative flows

- **A1 — No cycles**: selected school year has no `academic_years` row yet, or has one
  with zero módulos assigned — `cycle-filter` shows its empty state.

### Postconditions

- `module-filter` reflects the newly selected cycle's módulos.

### Acceptance criteria

- [x] `cycle-filter` lists exactly the distinct cycles present in the selected year's
      módulo assignments, no duplicates
- [x] `cycle-filter` has its first option selected by default when the year has at
      least one cycle
- [x] Changing `cycle-filter` updates `module-filter` to only that cycle's módulos

---

## UC-04: Select a módulo and view its calendar

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a cycle with at least one módulo is selected
**Elements**: `module-filter`, `calendario-months`, `calendario-empty-state`

### Main flow

1. `module-filter` lists the selected cycle's módulos (from the same
   `GET /api/academic-years/:id/modules` response already fetched for `cycle-filter`),
   first one selected by default.
2. `GET /api/calendario-modulo?academicYearModuleId=<id>` fetches that módulo's
   snapshot rows.
3. `calendario-months` renders 10 month cards, September of the selected school year
   through June of the next, each day cell colored per the categories covering it (red:
   `academic_key_dates`, `holidays`, `public_holidays`, `free_disposal_days`; blue:
   `evaluations`, `feoe_project_days`; light green (`#bbf7d0`): `final_exams` — see
   UC-08).
4. Teacher changes `module-filter`; `calendario-months` reloads for the newly selected
   `academic_year_module_id`.

### Alternative flows

- **A1 — Long range**: a `calendario_modulo` range spanning more than 30 days (e.g.
  "Curso escolar", 01/09–31/07) colors only its `start_date` and `end_date`, not every
  day in between — a range of 30 days or fewer colors every day in it, including both
  boundaries.
- **A2 — Overlapping categories**: a day covered by more than one category's range shows
  a split background (one color band per active category), not just one color chosen
  arbitrarily.
- **A3 — Empty**: selected `academic_year_module_id` has zero `calendario_modulo` rows
  (module assigned, but its snapshot never generated, or the school year itself has no
  `academic_years` row) — `calendario-months` isn't rendered, `calendario-empty-state`
  is shown instead.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] `module-filter` lists exactly the módulos belonging to the currently selected
      cycle
- [x] `module-filter` has its first option selected by default when the cycle has at
      least one módulo
- [x] Changing `module-filter` triggers a new `GET /api/calendario-modulo` request for
      the newly selected `academic_year_module_id`
- [x] `calendario-months` renders exactly 10 month cards, September of the selected
      school year through June of the following year, in order
- [x] A day inside a ≤30-day `calendario_modulo` range (e.g. Vacaciones de Navidad,
      22/12–07/01) is colored red for every day in that range, including the boundary
      days
- [x] A day inside a >30-day `calendario_modulo` range (e.g. Curso escolar, 01/09–31/07)
      is colored only on its start day and its end day, not on the days in between
- [x] A day covered only by an `evaluations` or `feoe_project_days` range is colored blue
- [x] A day covered only by a `final_exams` entry is colored light green (`#bbf7d0`)
- [x] A day covered by both a red-category and a blue-category range at once shows both
      colors, not just one
- [x] When the selected `academic_year_module_id` has no `calendario_modulo` rows,
      `calendario-months` is not rendered and `calendario-empty-state` is shown instead

---

## UC-05: See event details on hover

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; `calendario-months` is populated
**Elements**: `calendario-months`, `calendario-day-toast`

### Main flow

1. Teacher hovers a colored day cell inside `calendario-months`.
2. `calendario-day-toast` appears (reuses `toast.ts`'s `ToastController`/`renderToast`
   with a new neutral `'info'` `ToastVariant`), listing every `calendario_modulo` entry's
   `name` covering that day, one per line if more than one.
3. Teacher moves the mouse off the day; `calendario-day-toast` dismisses immediately —
   not on the shared 5-second auto-dismiss timer used elsewhere in the app for
   action-confirmation toasts.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] `calendario-day-toast` shows the exact event name of a hovered single-category day
- [x] `calendario-day-toast` shows every applicable event name, one per line, when the
      hovered day is covered by more than one `calendario_modulo` entry
- [x] `calendario-day-toast` disappears as soon as the mouse leaves the day cell, without
      waiting 5 seconds

---

## UC-06: `calendario_modulo` is generated when módulos are saved (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `module-selection-save-button` (existing element, `views/configuracion/`)

Cross-view backend side effect, not a UI flow of this screen — documented here because
`calendario_modulo` is this view's own data source and its generation rule belongs to this
view's spec, not Año académico's (whose own `use-cases.md` doesn't change).

### Main flow

1. Teacher clicks `module-selection-save-button` to create a new academic year with
   módulos (`POST /api/academic-years/selection`), or to extend an existing one with more
   módulos (`POST /api/academic-years/:id/modules`).
2. For every `academic_year_modules` row now present for that academic year (both
   pre-existing and newly added), the backend resolves all 6 `key_dates` categories (43
   rows) to real dates for that year's `startYear` (month ≥ 9 → `startYear`; month ≤ 8 →
   `startYear + 1`) and inserts them into `calendario_modulo`, one row per resolved
   `key_dates` entry per módulo.
3. In the same pass, `final_exams` rows are computed from the just-resolved `evaluations`
   rows and inserted alongside them — see UC-08.
4. Insertion is idempotent (`ON CONFLICT DO NOTHING` on the natural key) — a módulo that
   already has its snapshot generated is never duplicated.

### Postconditions

- Every `academic_year_modules` row for that academic year has a full
  `calendario_modulo` snapshot of 43 + 2×`E` rows (or already had one), where `E` is the
  number of `evaluations` rows in that snapshot whose name matches
  "`<prefix>` - Último día para poner notas." (currently 4, see UC-08 — not hardcoded,
  tracks whatever `key_dates`' `evaluations` category holds at seed time).

### Acceptance criteria

- [x] Saving a new academic year with N módulos generates a full snapshot (43 + 2×`E`
      rows, see Postconditions) for each of the N módulos
- [x] Extending an existing academic year with an additional módulo generates a full
      snapshot for that módulo, without touching already-existing módulos' rows
- [x] Saving the same selection twice never duplicates `calendario_modulo` rows

---

## UC-07: `calendario_modulo` is removed when a módulo is unassigned (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; the módulo being removed has a `calendario_modulo`
snapshot
**Elements**: `module-table-row-<id>-delete` (existing dynamic element,
`views/configuracion/`)

### Main flow

1. Teacher clicks a `module-table` row's "Eliminar" (`module-table-row-<id>-delete`),
   which deletes that `academic_year_modules` row (`DELETE
   /api/academic-year-modules/:id`).
2. `calendario_modulo` rows referencing that `academic_year_module_id` are removed
   automatically — `ON DELETE CASCADE`, no separate application code.

### Postconditions

- No `calendario_modulo` row references the deleted `academic_year_modules` id.

### Acceptance criteria

- [x] Deleting a módulo assignment removes every `calendario_modulo` row tied to it
- [x] Deleting a módulo assignment never removes `calendario_modulo` rows belonging to
      other módulos

---

## UC-08: `final_exams` dates are computed when `calendario_modulo` is generated (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Same as UC-06 — this is the same generation pass, not a separate
trigger.
**Elements**: `module-selection-save-button` (existing element, `views/configuracion/`),
`calendario-months` (renders the result — see UC-04)

Cross-view backend side effect, same nature as UC-06: documented here, not in Año
académico's own `use-cases.md`, because `calendario_modulo` is this view's data source.
Runs as a second step of `CalendarioModuloService.seedForModules`, after the six
`key_dates` categories are resolved to real dates for the módulo (UC-06 step 2) and
before they're inserted — so the `evaluations`/`holidays`/`public_holidays`/
`free_disposal_days` rows this step reads are that módulo's own just-resolved real
dates, not `key_dates`' day/month template.

### Main flow

1. From the módulo's just-resolved `evaluations` rows, find every one whose `name`
   matches `"<prefix> - Último día para poner notas."` (e.g. `"1ª Evaluación"`, `"2ª
   Evaluación (2º)"`, `"2ª Evaluación (1º)"`, `"3ª Evaluación (1º)"` — whichever prefixes
   are present in this batch; no fixed count, no filtering by the módulo's own course).
2. For each `<prefix>` found, build that módulo's non-working set: Saturdays, Sundays,
   and every day inside a `holidays`, `public_holidays` or `free_disposal_days` range
   already resolved for this módulo in the same pass (`academic_key_dates` is excluded —
   its ranges, e.g. "Curso escolar", are informational spans, not actual days off).
3. Compute `"<prefix> - Examen de recuperación final."` = `<prefix>`'s "Último día para
   poner notas" date + 2 business days (walking forward, skipping every non-working day
   from step 2, landing on the 2nd business day found).
4. Compute `"<prefix> - Examen final."` = the date from step 3 − 4 business days (walking
   backward, same non-working set).
5. Both are inserted as single-day `calendario_modulo` rows (`start_date = end_date`),
   `category = 'final_exams'`.
6. Insertion is idempotent, same natural key and `ON CONFLICT DO NOTHING` as every other
   `calendario_modulo` row (UC-06 step 4) — re-saving a selection never duplicates these
   either.

### Alternative flows

- **A1 — No matching evaluación**: a módulo's resolved `evaluations` rows contain no
  `"... - Último día para poner notas."` entry for some prefix (e.g. a future `key_dates`
  edit removes the 3ª evaluación row) — no `final_exams` pair is generated for that
  prefix; the other prefixes present are unaffected.
- **A2 — Insufficient run-up**: `[INFERENCE — verify with the user]` no minimum-distance
  validation against the start of the module's teaching period, or against earlier
  `evaluations` entries, is performed — the business-day walk always produces a date,
  even one that lands earlier than seems intended for a very compressed calendar. Flagged
  for the user to confirm this is acceptable rather than an error condition.

### Postconditions

- Every `evaluations` "Último día para poner notas" entry resolved for a módulo has a
  matching pair of `final_exams` rows in that módulo's `calendario_modulo` snapshot (see
  UC-06 Postconditions for the row-count formula).

### Acceptance criteria

- [x] For a módulo whose resolved `evaluations` include `"1ª Evaluación - Último día
      para poner notas."` on a given date, `calendario_modulo` gains
      `"1ª Evaluación - Examen de recuperación final."` on that date + 2 business days
      and `"1ª Evaluación - Examen final."` 4 business days before that
- [x] The business-day walk skips Saturdays and Sundays
- [x] The business-day walk skips days inside that módulo's resolved `holidays`,
      `public_holidays` and `free_disposal_days` ranges
- [x] The business-day walk does **not** skip days inside `academic_key_dates` ranges
      (e.g. it may land inside "Curso escolar" — that range is informational only)
- [x] Every generated `final_exams` row has `start_date = end_date` (single day)
- [x] Re-running the generation for an already-snapshotted módulo never duplicates
      `final_exams` rows
- [x] A módulo whose resolved `evaluations` include N distinct "Último día para poner
      notas." prefixes gains exactly 2×N `final_exams` rows
