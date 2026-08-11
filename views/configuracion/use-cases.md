# Use Cases — Configuración

Rewritten from scratch 2026-08-04 for the full view redesign: Ciclos/Módulos owns two
shared, global tables (`catalog_cycles`, `catalog_modules`), un-scoped from any teacher as
of 2026-08-05. Año académico's old, teacher-owned tables were dropped in that same redesign
and got a UI-only stub — 2026-08-05 gives it a real data layer again (`academic_years`,
`academic_year_modules`, see UC-06 through UC-09), built on top of the shared catalog
instead of duplicating it per teacher. 2026-08-11 adds a 4th screen, Horario
(`academic_year_module_schedules`, see UC-10/UC-11): a weekly Mon-Fri hours grid per
`academic_year_module`, reusing Calendario's Año/Ciclo/Módulo filter-bar pattern.

## UC-01: Edit the teacher's name

**Primary actor**: Any signed-in teacher, on `/configuracion/profesor`
**Preconditions**: Valid session
**Elements**: `teacher-full-name-input`, `teacher-save-name-button`, `teacher-name-save-message`

### Main flow

1. `teacher-full-name-input` loads pre-filled with the teacher's current `full_name`.
2. Teacher edits it and clicks `teacher-save-name-button`.
3. Client-side validation passes (non-empty).
4. Server updates `users.full_name` for the signed-in teacher.
5. `teacher-name-save-message` shows a success state.

### Alternative flows

- **A1 — Empty name**: client-side validation blocks submit; inline error shown; no request
  sent.
- **A2 — Server error**: `teacher-name-save-message` shows an error state; `full_name`
  unchanged.

### Postconditions

- On success: `users.full_name` updated; any other view reading it via
  `GET /api/auth/session` (e.g. Dashboard's `welcome-message`) reflects it on next load.

### Acceptance criteria

- [x] Pre-fills with the current `full_name` on load
- [x] Shows an inline error and does not submit if left empty
- [ ] Shows a loading state and is disabled from click until the response arrives
- [x] Shows success in `teacher-name-save-message` after a successful response
- [x] Shows an error in `teacher-name-save-message` after a failed response

---

## UC-02: Change password

**Primary actor**: Any signed-in teacher, on `/configuracion/profesor`
**Preconditions**: Valid session
**Elements**: `teacher-current-password-input`, `teacher-new-password-input`,
`teacher-repeat-password-input`, `teacher-save-password-button`,
`teacher-password-save-message`

### Main flow

1. Teacher fills current password, new password, and repeats the new password.
2. Client-side validation passes (all non-empty, repeat matches new).
3. Teacher clicks `teacher-save-password-button`.
4. Server re-verifies the current password against `users.password_hash`
   (`Bun.password.verify`, same mechanism as Login's `AuthService`).
5. Server hashes and stores the new password.
6. `teacher-password-save-message` shows success; all three fields clear.

### Alternative flows

- **A1 — Client-side validation fails** (any field empty, or repeat doesn't match new): inline
  error(s) shown; no request sent.
- **A2 — Current password doesn't match**: server responds with an error; no lockout or
  attempt-tracking here. `teacher-password-save-message` shows an error; fields are not
  cleared.

### Postconditions

- On success: `users.password_hash` updated to the new password's hash. On A2:
  `users.password_hash` unchanged.

### Acceptance criteria

- [ ] Shows an inline error and does not submit if any field is left empty
- [x] Shows an inline error and does not submit if the repeat doesn't match the new password
- [ ] Shows a loading state and is disabled from click until the response arrives
- [x] On success: shows success in `teacher-password-save-message`, clears all three fields
- [x] On a current-password mismatch: shows an error in `teacher-password-save-message`

---

## UC-03: Navigate between settings screens

**Primary actor**: Any signed-in teacher
**Preconditions**: Valid session
**Elements**: `back-to-dashboard-link`, `teacher-nav-link`, `training-catalog-nav-link`,
`academic-year-nav-link`, `schedule-nav-link` (plus `key-dates-nav-link`, which belongs to
`views/fechas-senaladas/` — its own view — but is rendered on this nav bar too via the
shared `settings-nav.ts`)

### Main flow

1. Teacher is on one of this view's four settings screens (a 5th, `/configuracion/fechas-
   senaladas`, is `views/fechas-senaladas/`'s own screen sharing this same nav bar).
2. Teacher clicks the nav link for another screen.
3. The app navigates there.

### Alternative flows

- **A1 — Clicking the link for the screen already active**: no-op, no navigation.
- **A2 — Teacher clicks `back-to-dashboard-link`**: the app navigates to `/dashboard`,
  regardless of which settings screen is currently active.

### Postconditions

- The browser is on the clicked screen's route.

### Acceptance criteria

- [x] Each nav link shows an active state on its own screen, inactive on every other one
- [x] Clicking any nav link from any other screen navigates to its route
- [x] `back-to-dashboard-link` is present on all of this view's settings screens
- [x] Clicking `back-to-dashboard-link` navigates to `/dashboard`

---

## UC-04: Manage catalog training cycles

**Primary actor**: Any signed-in teacher, on `/configuracion/ciclos-modulos`
**Preconditions**: Valid session
**Elements**: `catalog-training-cycle-table`, `catalog-training-cycle-table-add-button`

### Main flow

1. `catalog-training-cycle-table` lists every training cycle in `catalog_cycles` — a
   standalone, shared catalog (not scoped per teacher, see `api-contracts.md`), no filtering
   by anything. First row selected by default on load.
2. Selecting a different row reloads `catalog-module-table` filtered to that cycle's modules
   (see UC-05).
3. Teacher clicks `catalog-training-cycle-table-add-button`; a new blank, inline-editable row
   appears; typing a name and saving persists it immediately.

### Alternative flows

- **A1 — Duplicate name**: rejected, inline error on the row.
- **A2 — Delete a cycle, none of its modules assigned to any academic year**: succeeds —
  `catalog_modules`' FK to `catalog_cycles` is `ON DELETE CASCADE`, so the cycle's modules
  are deleted along with it.
- **A5 — Delete a cycle with a module still assigned to an academic year (2026-08-06 fix
  for #4)**: rejected (`HAS_DEPENDENTS`) — cascading past `academic_year_modules` would
  otherwise violate `academic_year_modules_catalog_module_id_fkey`, which has no cascade of
  its own. The teacher must remove the módulo from every academic year that has it first
  (Año académico's `module-table` row-level Quitar, see UC-08).

### Postconditions

- On A1/A5: no change. On main flow/A2: `catalog_cycles` (and, for A2, its now-deleted
  `catalog_modules` rows) reflects the change.

### Acceptance criteria

- [x] Shows every training cycle in the shared catalog
- [x] First row is selected by default on load
- [x] Adding a row and saving a unique name persists it
- [ ] Saving a duplicate name is rejected, inline error shown
- [x] Deleting a cycle with none of its modules assigned to an academic year succeeds and
      removes its modules too
- [x] Deleting a cycle with a module still assigned to an academic year is rejected
      (`HAS_DEPENDENTS`)
- [x] Selecting a different row reloads `catalog-module-table` filtered to that cycle's
      modules

---

## UC-05: Manage modules within a catalog training cycle

**Primary actor**: Any signed-in teacher, on `/configuracion/ciclos-modulos`
**Preconditions**: Valid session; a training cycle is selected in
`catalog-training-cycle-table` (see UC-04)
**Elements**: `catalog-module-table`, `catalog-module-table-add-button`

### Main flow

1. `catalog-module-table` shows every module of the selected cycle in `catalog_modules`,
   grouped by course (1º/2º).
2. Teacher clicks `catalog-module-table-add-button`; a new blank, inline-editable row (name +
   course) appears, scoped to the selected cycle.
3. Teacher fills name + course and it saves.

### Alternative flows

- **A1 — No cycle selected in `catalog-training-cycle-table`**: `catalog-module-table`
  prompts to pick/create one; `catalog-module-table-add-button` is disabled.
- **A2 — Duplicate (name, course) within the cycle**: rejected, inline error on the row.
- **A3 — Delete a module not assigned to any academic year**: succeeds.
- **A5 — Delete a module still assigned to an academic year (2026-08-06 fix for #4)**:
  rejected (`HAS_DEPENDENTS`) — see UC-04's A5, same underlying constraint. The teacher must
  remove it from every academic year that has it first (Año académico's `module-table`
  row-level Quitar, see UC-08).
- **A4 — Edit (rename or change course) a module**: always saves immediately — no
  confirmation modal, unlike Año académico's old `module-edit-confirm-modal`. Editing is
  unaffected by any academic year assignment — only deletion is blocked.

### Postconditions

- On A1/A2/A5: no change. On main flow/A3/A4: `catalog_modules` reflects the change.

### Acceptance criteria

- [x] Shows nothing and prompts to pick/create a cycle when
      `catalog-training-cycle-table` has no selected row
- [x] Shows one row per module of the selected cycle, grouped by course
- [x] `catalog-module-table-add-button` is disabled while
      `catalog-training-cycle-table` has no cycle selected
- [x] Adding a row and saving a unique (name, course) within the cycle persists it
- [x] Saving a duplicate (name, course) within the cycle is rejected, inline error shown
- [x] Deleting a module not assigned to any academic year succeeds
- [x] Deleting a module still assigned to an academic year is rejected (`HAS_DEPENDENTS`)
- [x] Editing a module always saves immediately, no modal, regardless of anything else in
      the system

---

## UC-06: Manage academic years

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `academic-year-table`, `academic-year-table-add-button`,
`training-cycle-table-add-cycle-button`, `academic-year-toast`

**Real backend as of the 2026-08-05 redesign.** `academic_years` rows are scoped per
teacher — this teacher's list, not shared with anyone else.

### Main flow

1. `academic-year-table` lists every `academic_years` row owned by the signed-in teacher,
   displayed as `"<start_year>-<start_year+1>"` (e.g. `2026` → `"2026-2027"`), one column
   showing which (if any) is `is_current`.
2. Selecting a row loads its assigned módulos: `training-cycle-table` updates to the
   cycles derived from that selection (see UC-07), then `module-table` to the selected
   cycle's assigned módulos for this year (see UC-08).
3. Teacher marks a row current — the previously-current row (if any) is un-marked, in the
   same request.

### Alternative flows

- **A1 — Duplicate start year on rename**: rejected server-side (`DUPLICATE_NAME`);
  `academic-year-toast` names the conflict; the row stays in edit mode until corrected.
- **A2 — Delete a year with módulos still assigned**: rejected (`HAS_DEPENDENTS`);
  `academic-year-toast` explains the block and tells the teacher to remove the assigned
  módulos/ciclos first (see UC-08's row-level Quitar).
- **A3 — Delete a year with no módulos assigned**: succeeds.
- **A4 — Add a new academic year**: `academic-year-table-add-button` opens a blank draft
  row (start year only) and switches `training-cycle-table`/`module-table`/
  `module-selection-table` into adding mode (see UC-07/UC-09) — the draft isn't persisted
  until `module-selection-save-button` is clicked (UC-09).
- **A5 — Cancel while adding**: discards the draft row (or, in A6, just the in-progress
  cycle/módulo checks) and any in-progress selection, returns to normal mode.
- **A6 — Extend an already-existing year's selection**: with an existing year selected in
  normal mode, `training-cycle-table-add-cycle-button` switches
  `training-cycle-table`/`module-table`/`module-selection-table` into adding mode the same
  way, but scoped to that already-existing year — no new draft row in `academic-year-table`.
  Saving (UC-09) adds the newly-checked módulos to that year instead of creating a new one.

### Postconditions

- On A1/A2: no change. On main flow's rename/mark-current/A3: `academic_years` reflects the
  change immediately.

### Acceptance criteria

- [x] Shows one row per `academic_years` row owned by the signed-in teacher
- [x] Displays a row's start year as `"<start_year>-<start_year+1>"`
- [x] Renaming a row to a start year that already exists for this teacher is rejected:
      `academic-year-toast` shown, row stays in edit mode
- [x] Marking a different row current un-marks the previous one
- [x] Deleting a row with assigned módulos is rejected: `academic-year-toast` names the
      block and tells the teacher to remove módulos/ciclos first
- [x] Deleting a row with no assigned módulos succeeds
- [x] Selecting a row reloads `training-cycle-table` and `module-table` from that year's
      assigned módulos

---

## UC-07: Pick training cycles for an academic year

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `training-cycle-table`, `training-cycle-table-add-cycle-button`

**Real backend as of the 2026-08-05 redesign.** No more creating/renaming/deleting catalog
cycles from this screen — cycles come exclusively from the shared, global `catalog_cycles`
table (see UC-04); this use case is only about which of them a teacher picks for a given
year, whether that year is brand new or already exists.

### Main flow

1. Normal mode: `training-cycle-table` shows the distinct cycles derived from the selected
   academic year's assigned módulos — a cycle appears here only while it has ≥1 módulo
   assigned for that year (read-only, no create/rename/delete here).
2. Adding mode — entered either via UC-06's A4 (new year) or A6
   (`training-cycle-table-add-cycle-button`, extending an existing year): shows every row of
   `catalog_cycles` — the complete, unfiltered shared catalog — each with a checkbox.
3. Teacher checks one or several cycles they'll teach this year; checking a cycle for the
   first time loads its módulos into `module-selection-table` (UC-09), all unchecked — except
   when extending an existing year, where that cycle's already-assigned módulos load
   pre-checked and disabled, since they're already theirs.

### Alternative flows

- **A1 — Unchecking a cycle in adding mode**: removes it and every one of its checked
  módulos from the in-progress selection.

### Postconditions

- Nothing persists here by itself — the whole selection persists together only via
  `module-selection-save-button` (UC-09).

### Acceptance criteria

- [x] Normal mode shows only cycles with ≥1 módulo assigned to the selected academic year
- [x] Adding mode shows every cycle in `catalog_cycles`, each with a checkbox
- [x] Selecting a row in normal mode reloads `module-table` filtered to that cycle
- [x] Checking a row in adding mode reloads `module-selection-table` with that cycle's
      `catalog_modules`
- [ ] Unchecking a cycle in adding mode discards its checked módulos from the in-progress
      selection
- [x] `training-cycle-table-add-cycle-button` is hidden unless an existing academic year is
      selected in normal mode
- [ ] Extending an existing year pre-checks and disables that year's already-assigned
      módulos in `module-selection-table`

---

## UC-08: Manage a teacher's assigned módulos within a cycle

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; a training cycle selected (UC-07); normal mode
**Elements**: `module-table`

**Real backend as of the 2026-08-05 redesign.** No more creating/editing catalog módulos
from this screen — this use case is only about un-assigning one from the selected academic
year (removing an `academic_year_modules` row), never the underlying `catalog_modules` row.

### Main flow

1. `module-table` shows this teacher's `academic_year_modules` for the selected cycle
   within the selected academic year, grouped by curso (1º/2º).
2. Teacher clicks a row's Quitar.
3. That `academic_year_modules` row is deleted; the row disappears from `module-table`. If
   it was the cycle's last assigned módulo, the cycle also disappears from
   `training-cycle-table` (UC-07).

### Alternative flows

- **A1 — Adding mode active**: `module-table` is hidden; `module-selection-table` takes its
  place (UC-09).

### Postconditions

- Quitar takes effect immediately — real deletion of the `academic_year_modules` row, not a
  draft.

### Acceptance criteria

- [x] Is hidden while adding mode is active
- [ ] Shows this teacher's assigned módulos of the selected cycle, grouped by curso
- [x] Quitar on a row removes it from `academic_year_modules` and the table immediately
- [ ] Removing a cycle's last módulo makes that cycle disappear from `training-cycle-table`

---

## UC-09: Build and commit an academic year's módulo selection

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; adding mode active (UC-06's A4 or A6)
**Elements**: `module-selection-table`, `module-selection-save-button`,
`module-selection-save-message`, `academic-year-toast`

**Real backend as of the 2026-08-05 redesign.** Behaves differently depending on how adding
mode was entered — creating a new year (UC-06's A4) vs extending an existing one (UC-06's
A6) — see each flow below.

### Main flow — new year (entered via UC-06's A4)

1. `module-selection-table` shows the checked cycle's `catalog_modules` rows (UC-07), with
   a checkbox reflecting the in-progress, unsaved selection.
2. Teacher toggles checkboxes — local, unsaved state only, no network request.
3. Teacher clicks `module-selection-save-button`; the draft academic year's start year plus
   every checked cycle × checked módulo is sent in one request
   (`POST /api/academic-years/selection`).
4. On success: the new `academic_years` row and its `academic_year_modules` rows are
   created; `module-selection-save-message` shows success; screen returns to normal mode
   with the newly-created year selected.

### Main flow — extend an existing year (entered via UC-06's A6)

1. Same `module-selection-table` behavior as above, except already-assigned módulos of a
   checked cycle load pre-checked and disabled (UC-07).
2. Teacher checks additional módulos.
3. Teacher clicks `module-selection-save-button`; only the newly-checked módulos are sent
   (`POST /api/academic-years/:id/modules`, `:id` = the already-selected year) — no start
   year involved.
4. On success: the new `academic_year_modules` rows are added to the existing year;
   `module-selection-save-message` shows success; screen returns to normal mode with the
   same year still selected.

### Alternative flows

- **A1 — Duplicate start year on save (new-year flow only)**: rejected (`DUPLICATE_NAME`);
  `academic-year-toast` shown; adding mode stays open so the teacher can correct the draft
  year.
- **A2 — No cycle checked yet**: `module-selection-table` shows a prompt to check a cycle
  first (UC-07); `module-selection-save-button` has nothing to submit yet.

### Postconditions

- On success (either flow): `academic_years`/`academic_year_modules` persisted. On A1: no
  change, still in adding mode.

### Acceptance criteria

- [x] Is hidden in normal mode
- [x] Toggling a checkbox doesn't persist anything by itself
- [x] New-year flow: a click persists the draft year and every checked cycle/módulo, then
      shows `module-selection-save-message`
- [x] New-year flow: a duplicate start year on save shows `academic-year-toast` and keeps
      adding mode open
- [x] Extend-existing flow: a click adds only the newly-checked módulos to the already-
      selected year, then shows `module-selection-save-message`
- [ ] On success, returns to normal mode with the affected academic year selected

---

## UC-10: Browse and select a módulo's horario via the filter bar

**Primary actor**: Any signed-in teacher, on `/configuracion/horario`
**Preconditions**: Valid session
**Elements**: `schedule-academic-year-filter-prev`, `schedule-academic-year-filter-value`,
`schedule-academic-year-filter-next`, `schedule-cycle-filter`, `schedule-module-filter`,
`schedule-empty-state`

### Main flow

1. On load, `schedule-academic-year-filter-value` shows the computed current school year
   (`currentSchoolYearStartYear`, same September-cutoff rule as Calendario's UC-02),
   formatted `"<year>-<year+1>"`, if the teacher has that `academic_years` row.
2. `GET /api/academic-years` and `GET /api/academic-years/:id/modules` (both already
   exist, reused as-is — same calls Calendario's filter bar makes) derive
   `schedule-cycle-filter`'s and `schedule-module-filter`'s options, same cascading logic
   as Calendario's UC-02/UC-03/UC-04: `schedule-cycle-filter` lists the distinct cycles
   the teacher teaches in the selected year (first one selected by default);
   `schedule-module-filter` lists the selected cycle's módulos (first one selected by
   default).
3. Teacher changes `schedule-academic-year-filter-prev`/`-next`,
   `schedule-cycle-filter`, or `schedule-module-filter`; the filters below re-derive, and
   any unsaved weekday draft (UC-11) for the previously selected módulo is discarded.
4. Once a módulo is selected, `GET /api/academic-year-modules/:id/schedule` loads its
   saved weekly schedule into the grid (see UC-11).

### Alternative flows

- **A1 — Backward limit**: `schedule-academic-year-filter-prev` is disabled once there's
  no `academic_years` row for this teacher with `startYear` below the currently selected
  year — same rule as Calendario's UC-02/A1.
- **A2 — Forward limit**: `schedule-academic-year-filter-next` is disabled once the
  selected year reaches `currentSchoolYearStartYear + 5` — same rule as Calendario's
  UC-02/A2.
- **A3 — No cycles**: selected school year has no `academic_years` row yet, or has one
  with zero módulos assigned — `schedule-cycle-filter` shows its empty state,
  `schedule-empty-state` is shown instead of the weekday grid and `schedule-save-button`.
- **A4 — No módulos in cycle**: selected cycle has no módulos in this school year —
  `schedule-module-filter` shows its empty state, same `schedule-empty-state` fallback
  as A3.

### Postconditions

- `schedule-module-filter`'s selection (or lack of one) determines whether the weekday
  grid (UC-11) or `schedule-empty-state` is shown.

### Acceptance criteria

- [x] On first load, `schedule-academic-year-filter-value` shows the school year
      containing today's date, formatted `"<year>-<year+1>"`
- [x] `schedule-academic-year-filter-prev` is disabled when the teacher has no
      `academic_years` row with `startYear` less than the currently selected year
- [x] `schedule-academic-year-filter-next` is disabled once the selected year equals
      `currentSchoolYearStartYear + 5`
- [x] `schedule-cycle-filter` lists exactly the distinct cycles present in the selected
      year's módulo assignments, first one selected by default
- [x] `schedule-module-filter` lists exactly the selected cycle's módulos, first one
      selected by default
- [ ] Changing any filter discards an unsaved weekday draft for the previously selected
      módulo
- [x] `schedule-empty-state` is shown instead of the weekday grid whenever
      `schedule-module-filter` has no selection

---

## UC-11: Edit and save a módulo's weekly horario

**Primary actor**: Any signed-in teacher, on `/configuracion/horario`
**Preconditions**: Valid session; a módulo is selected (UC-10)
**Elements**: `schedule-monday-select`, `schedule-tuesday-select`, `schedule-wednesday-select`,
`schedule-thursday-select`, `schedule-friday-select`, `schedule-save-button`,
`schedule-save-message`

### Main flow

1. `GET /api/academic-year-modules/:id/schedule` (UC-10 step 4) returns the
   `academic_year_module_schedules` rows already saved for this módulo; each weekday
   select shows its saved `hours` (1-3), or blank/"Sin clase" if no row exists for that
   weekday.
2. Teacher changes one or more weekday selects; each change updates only the local,
   in-progress draft — no request sent yet.
3. Teacher clicks `schedule-save-button`.
4. `PUT /api/academic-year-modules/:id/schedule` sends all 5 weekdays' current draft
   values in one request: weekdays with a value (1-3) are upserted, weekdays left blank
   are removed if a row existed for them.
5. `schedule-save-message` shows a success state.

### Alternative flows

- **A1 — Server error**: `schedule-save-message` shows an error state; persisted schedule
  unchanged.
- **A2 — Filter changed after a save**: `schedule-save-message` hides again as soon as any
  of UC-10's filters or a weekday select changes, so it never shows a stale result.

### Postconditions

- On success: `academic_year_module_schedules` for this `academic_year_module_id` exactly
  matches the 5 weekday selects' values at save time (a blank weekday has no row).

### Acceptance criteria

- [x] Each weekday select offers exactly 4 options: blank/"Sin clase", 1, 2, 3
- [x] On load, each weekday select reflects its saved value, or blank if no row exists for
      that weekday
- [x] Changing a weekday select does not send a request by itself
- [x] Clicking `schedule-save-button` sends exactly one request with all 5 weekdays'
      current draft values
- [x] A weekday left blank in the draft has no `academic_year_module_schedules` row after
      a successful save
- [x] A weekday set to 1/2/3 has exactly that value persisted after a successful save
- [ ] `schedule-save-button` shows a loading state and is disabled from click until the
      response arrives
- [x] `schedule-save-message` shows success after a successful response
- [x] `schedule-save-message` shows an error after a failed response
- [ ] `schedule-save-message` hides again as soon as a filter or weekday select changes
      after a save
