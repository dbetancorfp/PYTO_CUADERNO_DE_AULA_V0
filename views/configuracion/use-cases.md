# Use Cases — Configuración

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
  attempt-tracking here (the teacher is already authenticated — this isn't Login's public,
  unauthenticated endpoint). `teacher-password-save-message` shows an error; fields are not
  cleared.

### Postconditions

- On success: `users.password_hash` updated to the new password's hash. On A2:
  `users.password_hash` unchanged.

### Acceptance criteria

- [ ] Shows an inline error and does not submit if any field is left empty
- [x] Shows an inline error and does not submit if the repeat doesn't match the new password
- [ ] Shows a loading state and is disabled from click until the response arrives
- [x] On success: shows success in `teacher-password-save-message`, clears all three fields
- [x] On a current-password mismatch: shows an error in `teacher-password-save-message`,
      without indicating anything else about the account

---

## UC-03: Navigate between settings screens

**Primary actor**: Any signed-in teacher
**Preconditions**: Valid session
**Elements**: `teacher-nav-link`, `academic-year-nav-link`

### Main flow

1. Teacher is on one of the two settings screens.
2. Teacher clicks the nav link for the other screen.
3. The app navigates there.

### Alternative flows

- **A1 — Clicking the link for the screen already active**: no-op, no navigation.

### Postconditions

- The browser is on the clicked screen's route.

### Acceptance criteria

- [x] `teacher-nav-link` shows an active state on `/configuracion/profesor`, inactive on
      `/configuracion/ano-academico`
- [x] `academic-year-nav-link` shows an active state on `/configuracion/ano-academico`,
      inactive on `/configuracion/profesor`
- [x] Clicking `academic-year-nav-link` from `/configuracion/profesor` navigates to
      `/configuracion/ano-academico`
- [x] Clicking `teacher-nav-link` from `/configuracion/ano-academico` navigates to
      `/configuracion/profesor`

---

## UC-04: Manage academic years

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `academic-year-table`, `academic-year-table-add-button`,
`academic-year-delete-blocked-message`

### Main flow

1. `academic-year-table` lists every academic year the teacher has created, one column
   showing which (if any) is marked current.
2. Teacher clicks `academic-year-table-add-button`; a new blank, inline-editable row appears.
3. Teacher types a name and it saves (per `lib/patterns/crud-table-component.md`'s inline-edit
   flow).
4. Teacher marks a row current — the previously-current row (if any) is un-marked.

### Alternative flows

- **A1 — Duplicate name**: saving a name that already exists for this teacher is rejected;
  inline error on the row.
- **A2 — Delete the row marked current**: rejected server-side (dependency-blocked deletion);
  `academic-year-delete-blocked-message` becomes visible.
- **A3 — Delete a non-current row**: succeeds, row removed. No other blocking rule applies to
  an academic year's own deletion.

### Postconditions

- On A1: no row added/renamed. On A2: the row remains, marked current, unchanged. On main
  flow / A3: `academic_years` reflects the change.

### Acceptance criteria

- [x] Shows one row per existing academic year, with which one (if any) is current
- [x] Adding a row and saving a unique name persists it
- [x] Saving a duplicate name is rejected, inline error shown
- [x] Marking a row current un-marks whichever was current before
- [x] Deleting the row marked current is rejected, `academic-year-delete-blocked-message`
      becomes visible
- [x] Deleting a non-current row succeeds

---

## UC-05: Manage training cycles

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `training-cycle-table`, `training-cycle-table-add-button`,
`training-cycle-delete-blocked-message`

### Main flow

1. `training-cycle-table` lists the teacher's training cycles.
2. Teacher clicks `training-cycle-table-add-button`; a new blank, inline-editable row appears.
3. Teacher types a name and it saves.

### Alternative flows

- **A1 — Duplicate name**: rejected, inline error on the row.
- **A2 — Delete a cycle with a module referenced by some academic year's selection**:
  rejected server-side; `training-cycle-delete-blocked-message` names the referencing academic
  year(s).
- **A3 — Delete a cycle with no referenced modules**: succeeds; its own modules (all
  unreferenced, by definition of A2 not applying) are deleted along with it.

### Postconditions

- On A1/A2: no change. On main flow/A3: `training_cycles` (and, for A3, its now-deleted
  `modules` rows) reflects the change.

### Acceptance criteria

- [x] Shows one row per existing training cycle
- [x] Adding a row and saving a unique name persists it
- [x] Saving a duplicate name is rejected, inline error shown
- [x] Deleting a cycle referenced (via its modules) by some academic year is rejected,
      `training-cycle-delete-blocked-message` becomes visible naming the academic year(s)
- [ ] Deleting an unreferenced cycle succeeds and removes its modules too

---

## UC-06: Manage modules within a training cycle

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; at least one training cycle exists to select
**Elements**: `module-cycle-select`, `module-table`, `module-table-add-button`,
`module-delete-blocked-message`, `module-edit-confirm-modal`

### Main flow

1. Teacher picks a training cycle in `module-cycle-select`.
2. `module-table` reloads (cascading select) showing that cycle's modules, grouped by course
   (1º/2º/3º).
3. Teacher clicks `module-table-add-button`; a new blank, inline-editable row (name + course)
   appears, scoped to the chosen cycle.
4. Teacher fills name + course and it saves.

### Alternative flows

- **A1 — No cycle chosen yet**: `module-table` prompts to pick one; `module-table-add-button`
  is disabled.
- **A2 — Duplicate (name, course) within the cycle**: rejected, inline error on the row.
- **A3 — Delete a module referenced by some academic year's selection**: rejected
  server-side; `module-delete-blocked-message` names the referencing academic year(s).
- **A4 — Delete an unreferenced module**: succeeds.
- **A5 — Edit (rename or change course) a module referenced by one or more academic years**:
  `module-edit-confirm-modal` opens instead of saving immediately, naming the referencing
  academic year(s). Confirming proceeds with the save; cancelling reverts the row.
- **A6 — Edit an unreferenced module**: saves immediately, no modal.

### Postconditions

- On A1/A2/A3: no change. On A5 confirmed / main flow / A4 / A6: `modules` reflects the
  change.

### Acceptance criteria

- [x] `module-table-add-button` is disabled while `module-cycle-select` has no cycle chosen
- [x] Choosing a cycle reloads `module-table` with that cycle's modules, grouped by course
- [x] Adding a row and saving a unique (name, course) within the cycle persists it
- [x] Saving a duplicate (name, course) within the cycle is rejected, inline error shown
- [x] Deleting a module referenced by some academic year is rejected,
      `module-delete-blocked-message` becomes visible naming the academic year(s)
- [ ] Deleting an unreferenced module succeeds
- [x] Editing a referenced module opens `module-edit-confirm-modal` instead of saving
      immediately, naming the referencing academic year(s)
- [x] Confirming in `module-edit-confirm-modal` persists the edit
- [x] Cancelling in `module-edit-confirm-modal` reverts the row to its last saved values
- [x] Editing an unreferenced module saves immediately, no modal

---

## UC-07: Select modules for an academic year

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; at least one academic year and one module exist
**Elements**: `module-selection-table`, `module-selection-save-button`

### Main flow

1. Teacher selects a row in `academic-year-table` (see UC-04).
2. `module-selection-table` shows every one of the teacher's modules (grouped by cycle, then
   course), checkbox reflecting whether each is part of that academic year's current
   selection.
3. Teacher toggles checkboxes (in-progress, unsaved).
4. Teacher clicks `module-selection-save-button`.
5. Server replaces that academic year's selection in `academic_year_modules` with exactly the
   submitted checkbox state.

### Alternative flows

- **A1 — No academic year selected yet**: `module-selection-table` prompts to pick one;
  `module-selection-save-button` is disabled.
- **A2 — Teacher has no modules yet**: `module-selection-table` shows an empty state
  prompting to create training cycles/modules first (see UC-05/UC-06).

### Postconditions

- On main flow: `academic_year_modules` for that academic year exactly matches what was
  checked at save time — any previously-selected module not re-checked is removed from the
  selection (not deleted from `modules` itself).

### Acceptance criteria

- [x] `module-selection-save-button` is disabled while no academic year is selected
- [x] Selecting an academic year shows every module with its current selection state
- [x] Toggling a checkbox doesn't persist by itself
- [x] Saving persists exactly the checkbox state at the moment of clicking, replacing the
      prior selection for that academic year
