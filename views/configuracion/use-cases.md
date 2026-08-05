# Use Cases — Configuración

Rewritten from scratch 2026-08-04 for the full view redesign: Ciclos/Módulos owns two
brand-new, standalone tables (`catalog_training_cycles`, `catalog_modules`); Año académico's
former tables were dropped and are not recreated in this pass — its use cases below describe
local-component-state behavior only, no network calls.

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
`academic-year-nav-link`

### Main flow

1. Teacher is on one of the three settings screens.
2. Teacher clicks the nav link for another screen.
3. The app navigates there.

### Alternative flows

- **A1 — Clicking the link for the screen already active**: no-op, no navigation.
- **A2 — Teacher clicks `back-to-dashboard-link`**: the app navigates to `/dashboard`,
  regardless of which of the three settings screens is currently active.

### Postconditions

- The browser is on the clicked screen's route.

### Acceptance criteria

- [x] Each nav link shows an active state on its own screen, inactive on the other two
- [x] Clicking any nav link from either other screen navigates to its route
- [x] `back-to-dashboard-link` is present on all three settings screens
- [x] Clicking `back-to-dashboard-link` navigates to `/dashboard`

---

## UC-04: Manage catalog training cycles

**Primary actor**: Any signed-in teacher, on `/configuracion/ciclos-modulos`
**Preconditions**: Valid session
**Elements**: `catalog-training-cycle-table`, `catalog-training-cycle-table-add-button`

### Main flow

1. `catalog-training-cycle-table` lists every training cycle the teacher has created in
   `catalog_training_cycles` — a standalone catalog, no filtering by anything. First row
   selected by default on load.
2. Selecting a different row reloads `catalog-module-table` filtered to that cycle's modules
   (see UC-05).
3. Teacher clicks `catalog-training-cycle-table-add-button`; a new blank, inline-editable row
   appears; typing a name and saving persists it immediately.

### Alternative flows

- **A1 — Duplicate name**: rejected, inline error on the row.
- **A2 — Delete a cycle**: always succeeds — `catalog_modules`' FK to
  `catalog_training_cycles` is `ON DELETE CASCADE`, so the cycle's modules are deleted along
  with it. There is no dependency-blocked deletion in this screen — nothing else references
  this catalog.

### Postconditions

- On A1: no change. On main flow/A2: `catalog_training_cycles` (and, for A2, its now-deleted
  `catalog_modules` rows) reflects the change.

### Acceptance criteria

- [x] Shows every training cycle the teacher has created
- [x] First row is selected by default on load
- [x] Adding a row and saving a unique name persists it
- [ ] Saving a duplicate name is rejected, inline error shown
- [x] Deleting a cycle always succeeds and removes its modules too, unconditionally
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
- **A3 — Delete a module**: always succeeds — nothing references this catalog.
- **A4 — Edit (rename or change course) a module**: always saves immediately — no
  confirmation modal, unlike Año académico's old `module-edit-confirm-modal`; nothing
  references a catalog module to warn about.

### Postconditions

- On A1/A2: no change. On main flow/A3/A4: `catalog_modules` reflects the change.

### Acceptance criteria

- [x] Shows nothing and prompts to pick/create a cycle when
      `catalog-training-cycle-table` has no selected row
- [x] Shows one row per module of the selected cycle, grouped by course
- [x] `catalog-module-table-add-button` is disabled while
      `catalog-training-cycle-table` has no cycle selected
- [x] Adding a row and saving a unique (name, course) within the cycle persists it
- [x] Saving a duplicate (name, course) within the cycle is rejected, inline error shown
- [x] Deleting a module always succeeds, unconditionally
- [x] Editing a module always saves immediately, no modal, regardless of anything else in
      the system

---

## UC-06: Manage academic years (local state — not wired)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `academic-year-table`, `academic-year-table-add-button`,
`academic-year-delete-blocked-message`

**This screen's data layer was removed in the 2026-08-04 redesign.** Every step below
operates on the component's own in-memory state — no HTTP request, no persistence across a
page reload. The UI and interactions are otherwise unchanged from the previous design.

### Main flow

1. `academic-year-table` lists every academic year added during the current session, one
   column showing which (if any) is marked current.
2. Selecting a row cascades locally: `training-cycle-table` updates to that year's cycles
   (see UC-07), then `module-table` to that cycle's modules for this year (see UC-08).
3. Teacher marks a row current — the previously-current row (if any) is un-marked, in local
   state.

### Alternative flows

- **A1 — Duplicate name**: rejected against local state; inline error on the row.
- **A2 — Delete the row marked current**: rejected (local-state check);
  `academic-year-delete-blocked-message` becomes visible.
- **A3 — Delete a non-current row**: succeeds locally.
- **A4 — Add a new academic year**: opens a blank draft row, switches
  `training-cycle-table`/`module-table`/`module-selection-table` into adding-year mode, all
  local.
- **A5 — Cancel while adding**: discards the local draft.

### Postconditions

- Nothing persists past a page reload — this is intentional for this pass.

### Acceptance criteria

- [ ] Shows one row per academic year added this session, with which (if any) is current
- [ ] Saving a duplicate name is rejected, inline error shown
- [ ] Marking a row current un-marks whichever was current before
- [ ] Deleting the row marked current is rejected, `academic-year-delete-blocked-message`
      becomes visible
- [ ] Deleting a non-current row succeeds
- [ ] No interaction on this element makes a network request

---

## UC-07: Manage training cycles (local state — not wired)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `training-cycle-table`, `training-cycle-table-add-button`,
`training-cycle-delete-blocked-message`

**Not wired** — see UC-06.

### Main flow

1. Normal mode: `training-cycle-table` shows local-state cycles with ≥1 module locally
   selected for the active academic year.
2. Adding-year/adding-cycle mode: shows the complete local-state cycle list instead.
3. Teacher clicks `training-cycle-table-add-button`; a new row is added to local state.

### Alternative flows

- **A1 — Duplicate name**: rejected against local state.
- **A2 — Delete a cycle with a locally-referenced module**: rejected;
  `training-cycle-delete-blocked-message` shown.

### Postconditions

- Local state only, no persistence.

### Acceptance criteria

- [ ] Normal mode shows only local-state cycles with ≥1 selected module for the selected
      academic year
- [ ] Adding-year/adding-cycle mode shows the complete local-state cycle list
- [ ] No interaction on this element makes a network request

---

## UC-08: Manage modules within a training cycle (local state — not wired)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; a training cycle selected (UC-07); normal mode
**Elements**: `module-table`, `module-table-add-button`, `module-delete-blocked-message`,
`module-edit-confirm-modal`

**Not wired** — see UC-06.

### Main flow

1. `module-table` shows local-state modules of the selected cycle, selected for the active
   academic year, grouped by course.
2. Teacher clicks `module-table-add-button`; a new row is added to local state.

### Alternative flows

- **A1 — Adding-year/adding-cycle mode active**: `module-table` hidden;
  `module-selection-table` takes its place (UC-09).
- **A2 — Delete a locally-referenced module**: rejected; `module-delete-blocked-message`
  shown.
- **A3 — Edit a locally-referenced module**: `module-edit-confirm-modal` opens instead of
  saving immediately.

### Postconditions

- Local state only, no persistence.

### Acceptance criteria

- [ ] Is hidden while adding-year or adding-cycle mode is active
- [ ] Editing a locally-referenced module opens `module-edit-confirm-modal`
- [ ] No interaction on this element makes a network request

---

## UC-09: Build and commit an academic year's module selection (local state — not wired)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; adding-year or adding-cycle mode active
**Elements**: `module-selection-table`, `module-selection-add-button`,
`module-selection-save-button`, `module-selection-save-message`

**Not wired** — see UC-06.

### Main flow

1. `module-selection-table` shows the locally-selected cycle's modules with in-progress
   checked state.
2. Teacher toggles checkboxes — local, unsaved state only.
3. Teacher clicks `module-selection-save-button`; the in-progress selection is committed into
   local state (academic-year-table/module-table update accordingly). No network request.
4. `module-selection-save-message` shows a success outcome; screen returns to normal mode.

### Alternative flows

- **A1 — Selected cycle has no local-state modules yet**: `module-selection-add-button`
  fuses into the table.

### Postconditions

- Local state only, no persistence past a page reload.

### Acceptance criteria

- [ ] Is hidden in normal mode
- [ ] Toggling a checkbox doesn't persist anything by itself
- [ ] A click on `module-selection-save-button` commits local state and shows
      `module-selection-save-message`
- [ ] No interaction on this element makes a network request
