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
**Elements**: `back-to-dashboard-link`, `teacher-nav-link`, `academic-year-nav-link`

### Main flow

1. Teacher is on one of the two settings screens.
2. Teacher clicks the nav link for the other screen.
3. The app navigates there.

### Alternative flows

- **A1 — Clicking the link for the screen already active**: no-op, no navigation.
- **A2 — Teacher clicks `back-to-dashboard-link`**: the app navigates to `/dashboard`,
  regardless of which of the two settings screens is currently active.

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
- [x] `back-to-dashboard-link` is present on both `/configuracion/profesor` and
      `/configuracion/ano-academico`
- [x] Clicking `back-to-dashboard-link` navigates to `/dashboard`

---

## UC-04: Manage academic years

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `academic-year-table`, `academic-year-table-add-button`,
`academic-year-delete-blocked-message`

### Main flow

1. `academic-year-table` lists every academic year the teacher has created, one column
   showing which (if any) is marked current. The row marked current is selected by default
   on load (none selected if none is current).
2. Selecting a row cascades: `training-cycle-table` reloads filtered to that year's cycles
   (see UC-05), then, once it auto-selects its first row, `module-table` reloads filtered to
   that cycle's modules for this year (see UC-06).
3. Teacher marks a row current — the previously-current row (if any) is un-marked.

### Alternative flows

- **A1 — Duplicate name**: saving a name that already exists for this teacher is rejected;
  inline error on the row.
- **A2 — Delete the row marked current**: rejected server-side (dependency-blocked deletion);
  `academic-year-delete-blocked-message` becomes visible.
- **A3 — Delete a non-current row**: succeeds, row removed. No other blocking rule applies to
  an academic year's own deletion.
- **A4 — Add a new academic year**: clicking `academic-year-table-add-button` opens a blank
  row with only a name input — **no per-row save**. This switches the whole screen into
  "adding-year" mode: `training-cycle-table` shows the complete, unfiltered cycle list
  instead of the current selection's filtered one (see UC-05's A-flow), `module-table` hides,
  and `module-selection-table` takes its place (see UC-07). The draft's name is only
  persisted together with the selection, by `module-selection-save-button` — there's no way
  to save the name alone.
- **A5 — Cancel while adding a new academic year**: clicking the draft row's Cancelar
  discards the typed name and the whole in-progress module selection, and returns
  `training-cycle-table`/`module-table` to whichever academic year was selected before A4.

### Postconditions

- On A1: no row added/renamed. On A2: the row remains, marked current, unchanged. On main
  flow / A3: `academic_years` reflects the change. On A4/A5: nothing is persisted — creation
  only happens via UC-07's combined save.

### Acceptance criteria

- [x] Shows one row per existing academic year, with which one (if any) is current
- [x] On load, the row marked current is selected by default (none selected if none is
      current)
- [x] Saving a duplicate name is rejected, inline error shown
- [x] Marking a row current un-marks whichever was current before
- [x] Deleting the row marked current is rejected, `academic-year-delete-blocked-message`
      becomes visible
- [x] Deleting a non-current row succeeds
- [x] Selecting a row reloads `training-cycle-table` to that year's cycles and, after its
      default selection, `module-table` to that cycle's modules for this year
- [x] `academic-year-table-add-button` opens a draft row with only a name input and Cancelar,
      no independent save button
- [x] Opening the draft row switches `training-cycle-table` to its complete unfiltered list,
      hides `module-table`, and shows `module-selection-table` scoped to the first cycle
- [x] Cancelling the draft row discards the name and the in-progress selection, restoring the
      previously-selected academic year's normal filtered view

---

## UC-05: Manage training cycles

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `training-cycle-table`, `training-cycle-table-add-button`,
`training-cycle-delete-blocked-message`

### Main flow

1. **Normal mode** (an existing academic year selected, see UC-04): `training-cycle-table`
   lists only the cycles with ≥1 module selected for that academic year — "which cycles the
   teacher teaches this year" is never asked separately, it's derived from the year's
   selection. The first one is selected by default.
2. Selecting a different row reloads `module-table` filtered to that cycle's modules for the
   active academic year (see UC-06).
3. Teacher clicks `training-cycle-table-add-button`; a new blank, inline-editable row
   appears; typing a name and saving persists it immediately (a cycle is a real,
   independent entity, unlike UC-04's draft academic year).

### Alternative flows

- **A1 — Duplicate name**: rejected, inline error on the row.
- **A2 — Delete a cycle with a module referenced by some academic year's selection**:
  rejected server-side; `training-cycle-delete-blocked-message` names the referencing academic
  year(s).
- **A3 — Delete a cycle with no referenced modules**: succeeds; its own modules (all
  unreferenced, by definition of A2 not applying) are deleted along with it.
- **A4 — Adding-year or adding-cycle mode is active** (UC-04's A4, or A5 below):
  `training-cycle-table` shows the teacher's **complete**, unfiltered cycle list instead of
  the year-filtered one, first one selected by default. Selecting a different row swaps
  which cycle's modules `module-selection-table` shows (UC-07), without discarding checks
  already made under another cycle.
- **A5 — Add a new cycle while an existing academic year is selected (not already
  adding-year)**: saving `training-cycle-table-add-button`'s draft row creates the cycle and
  selects it in this academic year's context; `module-table` hides and `module-selection-table`
  takes its place, scoped to the new (empty) cycle — same take-over as UC-04's A4, but the
  academic year itself already exists (see UC-07).

### Postconditions

- On A1/A2: no change. On main flow/A3: `training_cycles` (and, for A3, its now-deleted
  `modules` rows) reflects the change. On A5: `training_cycles` gains the new row; nothing
  in `academic_year_modules` yet (that's UC-07's job).

### Acceptance criteria

- [x] Normal mode shows only the cycles with ≥1 module selected for the selected academic
      year, first one selected by default
- [x] Adding-year/adding-cycle mode shows the teacher's complete cycle list, first one
      selected by default
- [x] Adding a row and saving a unique name persists it
- [x] Saving a duplicate name is rejected, inline error shown
- [x] Deleting a cycle referenced (via its modules) by some academic year is rejected,
      `training-cycle-delete-blocked-message` becomes visible naming the academic year(s)
- [x] Deleting an unreferenced cycle succeeds and removes its modules too
- [x] In normal mode, selecting a different row reloads `module-table` filtered to that
      cycle's modules for the selected academic year
- [x] In adding-year/adding-cycle mode, selecting a different row swaps
      `module-selection-table`'s cycle without losing checks made under the previous one
- [x] Saving a new cycle's name while an existing academic year is selected (not
      adding-year) selects it and switches `module-table` off / `module-selection-table` on

---

## UC-06: Manage modules within a training cycle

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; at least one training cycle selected (see UC-05); normal
mode (neither adding-year nor adding-cycle active — see UC-04/UC-05's alternative flows)
**Elements**: `module-table`, `module-table-add-button`, `module-delete-blocked-message`,
`module-edit-confirm-modal`

### Main flow

1. `module-table` shows the modules of the selected cycle that are also selected for the
   selected academic year, grouped by course (1º/2º/3º).
2. Teacher clicks `module-table-add-button`; a new blank, inline-editable row (name + course)
   appears, scoped to the selected cycle.
3. Teacher fills name + course and it saves; the new module is selected for the active
   academic year by default, so it stays visible in this filtered list.

### Alternative flows

- **A1 — Adding-year or adding-cycle mode is active**: `module-table` is hidden entirely;
  `module-selection-table` takes its place (see UC-07).
- **A2 — No cycle selected in `training-cycle-table`**: `module-table` prompts to pick/create
  one; `module-table-add-button` is disabled.
- **A3 — Duplicate (name, course) within the cycle**: rejected, inline error on the row.
- **A4 — Delete a module referenced by some academic year's selection**: rejected
  server-side; `module-delete-blocked-message` names the referencing academic year(s).
- **A5 — Delete an unreferenced module**: succeeds.
- **A6 — Edit (rename or change course) a module referenced by one or more academic years**:
  `module-edit-confirm-modal` opens instead of saving immediately, naming the referencing
  academic year(s). Confirming proceeds with the save; cancelling reverts the row.
- **A7 — Edit an unreferenced module**: saves immediately, no modal.

### Postconditions

- On A2/A3/A4: no change. On A6 confirmed / main flow / A5 / A7: `modules` reflects the
  change (and, for the main flow's new module, `academic_year_modules` gains one row too).

### Acceptance criteria

- [x] Is hidden while adding-year or adding-cycle mode is active
- [x] Shows nothing and prompts to pick/create a cycle when `training-cycle-table` has no
      selected row
- [x] Shows one row per module of the selected cycle that's selected for the selected
      academic year, grouped by course
- [x] `module-table-add-button` is disabled while `training-cycle-table` has no cycle
      selected
- [x] Adding a row and saving a unique (name, course) within the cycle persists it and
      selects it for the active academic year
- [x] Saving a duplicate (name, course) within the cycle is rejected, inline error shown
- [x] Deleting a module referenced by some academic year is rejected,
      `module-delete-blocked-message` becomes visible naming the academic year(s)
- [x] Deleting an unreferenced module succeeds
- [x] Editing a referenced module opens `module-edit-confirm-modal` instead of saving
      immediately, naming the referencing academic year(s)
- [x] Confirming in `module-edit-confirm-modal` persists the edit
- [x] Cancelling in `module-edit-confirm-modal` reverts the row to its last saved values
- [x] Editing an unreferenced module saves immediately, no modal

---

## UC-07: Build and save an academic year's module selection

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; adding-year mode (UC-04's A4) or adding-cycle mode (UC-05's
A5) is active
**Elements**: `module-selection-table`, `module-selection-add-button`,
`module-selection-save-button`, `module-selection-save-message`

### Main flow

1. `module-selection-table` shows the modules of whichever cycle is currently selected in
   `training-cycle-table` (all courses 1º/2º/3º), checkbox reflecting whether each is part of
   the in-progress, unsaved selection being built.
2. Teacher toggles checkboxes; switching to a different cycle in `training-cycle-table`
   swaps which modules are shown, but keeps checks already made under other cycles (see
   UC-05's A4).
3. Teacher clicks `module-selection-save-button`.
4. **Adding-year mode**: the server creates the academic year with the draft name from
   `academic-year-table` (UC-04's A4) and, in the same action, replaces its selection in
   `academic_year_modules` with exactly the accumulated checkbox state (including any modules
   just created in step 5 below).
   **Adding-cycle mode**: the academic year already exists — only the replace-selection call
   happens.
5. `module-selection-save-message` shows the outcome; on success, the screen returns to
   normal mode with the affected academic year selected.

### Alternative flows

- **A1 — Selected cycle has no modules yet**: `module-selection-table` merges with
  `module-selection-add-button` — teacher clicks it to insert a new blank, inline-editable
  row (name + course) scoped to the selected cycle; once filled in, it's checked by default
  in the in-progress selection. Available even when the cycle already has modules (not
  mutually exclusive with picking from existing ones).
- **A2 — Adding-year mode, duplicate academic year name**: the whole save fails — nothing is
  created or persisted; `module-selection-save-message` shows the error, the draft name and
  in-progress selection stay intact.
- **A3 — Save request in flight**: `module-selection-save-button` shows a loading state and
  is disabled until the response arrives.
- **A4 — Adding-year mode, the year is created but persisting the selection then fails**:
  creating the academic year and replacing its selection are two sequential requests behind
  the one click (see `api-contracts.md`'s `POST /api/academic-years`); if the first succeeds
  and the second fails, the academic year is left created with an empty selection rather than
  the whole action rolling back (confirmed — no rollback). `module-selection-save-message`
  shows an error; the year is now selectable from `academic-year-table` on retry.

### Postconditions

- On main flow (adding-year): `academic_years` gains the new row; `academic_year_modules` for
  it exactly matches what was checked at save time (including newly-created modules).
- On main flow (adding-cycle): `academic_year_modules` for the existing academic year exactly
  matches what was checked at save time; any previously-selected module not re-checked is
  removed from the selection (not deleted from `modules` itself).
- On A2: no change to `academic_years` or `academic_year_modules`.

### Acceptance criteria

- [x] Is hidden in normal mode (see UC-04/UC-05 main flows)
- [x] Shows the selected cycle's modules (1º/2º/3º) with their in-progress checked state
- [x] Toggling a checkbox doesn't persist anything by itself
- [x] Switching cycle shows that cycle's modules without discarding checks made under the
      previous one
- [x] A cycle with zero modules shows `module-selection-add-button` fused into the table
- [x] `module-selection-add-button` is available regardless of whether the selected cycle
      already has modules
- [x] A newly-added module via `module-selection-add-button` is checked by default
- [x] `module-selection-save-button` shows a loading state and is disabled from click until
      the response arrives
- [x] Adding-year mode: a successful save creates the academic year and persists exactly the
      in-progress selection, then shows a success message and returns to normal mode with the
      new academic year selected
- [x] Adding-cycle mode: a successful save persists exactly the in-progress selection for the
      existing academic year, then shows a success message and returns to normal mode
- [x] Adding-year mode: a duplicate academic year name shows an error message and keeps the
      draft (name + in-progress selection) intact
