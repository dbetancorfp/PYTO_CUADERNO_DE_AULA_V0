# API Contracts — Configuración

Every endpoint below requires a valid session (see Login's `GET /api/auth/session` /
`session-guard`) and only ever reads/writes the signed-in teacher's own rows — never another
teacher's. **Allowed roles** is the same for all of them: Authenticated teacher, own data
only — not repeated per endpoint below.

Domain error codes used across this file (per `tecnologias/tecnologia_code.md`'s centralized
`STATUS_MAP` convention — `code` classes mapped to HTTP status in `routes/error.ts`):

| Code | HTTP status | Meaning |
|------|-------------|---------|
| `DUPLICATE_NAME` | 409 | A name/(name, course) that must be unique for this teacher already exists |
| `HAS_DEPENDENTS` | 409 | Delete (or, for a module, edit without `confirm: true`) rejected — referenced by one or more academic years |
| `IS_CURRENT` | 409 | Delete rejected — this academic year is the one marked current |
| `INVALID_CREDENTIALS` | 401 | Current password didn't match (password-change only) |

---

## Teacher (Profesor screen)

### PATCH /api/teacher/name

**Description**: Updates the signed-in teacher's `full_name`.
**Elements**: `teacher-full-name-input`, `teacher-save-name-button`, `teacher-name-save-message`

#### Request
- **Body**: `{ fullName: string }`

#### Response 200
```json
{ "message": "Name updated" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `fullName` missing, empty, or not a string |

---

### PATCH /api/teacher/password

**Description**: Changes the signed-in teacher's password. Re-verifies `currentPassword`
against `users.password_hash` (`Bun.password.verify`, same mechanism as Login's
`AuthService.login`) before accepting `newPassword`. No lockout/attempt-tracking — the
teacher is already authenticated, unlike Login's public endpoint.
**Elements**: `teacher-current-password-input`, `teacher-new-password-input`,
`teacher-repeat-password-input`, `teacher-save-password-button`, `teacher-password-save-message`

#### Request
- **Body**: `{ currentPassword: string, newPassword: string }` (repeat-matches-new is a
  client-side-only check — the server never receives a third value)

#### Response 200
```json
{ "message": "Password updated" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `currentPassword` or `newPassword` missing, empty, or not a string |
| 401 | `currentPassword` doesn't match. Body: `{ "message": "Incorrect current password", "code": "INVALID_CREDENTIALS" }` |

---

## Training cycles (Año académico screen)

### GET /api/training-cycles

**Description**: Lists the signed-in teacher's complete training cycle list, unfiltered.
Used in adding-year/adding-cycle mode, where `training-cycle-table` shows every cycle
regardless of any academic year's selection (see `GET
/api/academic-years/:id/training-cycles` below for the normal-mode, year-filtered list).
**Elements**: `training-cycle-table`

#### Response 200
```json
{ "trainingCycles": [{ "id": "uuid", "name": "Desarrollo de Aplicaciones Web" }] }
```

---

### GET /api/academic-years/:id/training-cycles

**Description**: Lists only the training cycles that have at least one module currently
selected for this academic year (a derived join, `training_cycles` ⋈ `modules` ⋈
`academic_year_modules` filtered by `academic_year_id`, `DISTINCT` on the cycle) — there's
no stored cycle↔year relation, "which cycles a year has" is always this query. Used by
`training-cycle-table` in normal mode.
**Elements**: `training-cycle-table`

#### Request
- **Params**: `{ id: string }`

#### Response 200
```json
{ "trainingCycles": [{ "id": "uuid", "name": "Desarrollo de Aplicaciones Web" }] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an academic year owned by this teacher |

---

### POST /api/training-cycles

**Description**: Creates a training cycle for the signed-in teacher.
**Elements**: `training-cycle-table-add-button`, `training-cycle-table`

#### Request
- **Body**: `{ name: string }`

#### Response 201
```json
{ "id": "uuid", "name": "Desarrollo de Aplicaciones Web" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` missing, empty, or not a string |
| 409 | `name` already exists for this teacher. Body: `{ "message": "...", "code": "DUPLICATE_NAME" }` |

---

### PATCH /api/training-cycles/:id

**Description**: Renames a training cycle.
**Elements**: `training-cycle-table`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ name: string }`

#### Response 200
```json
{ "id": "uuid", "name": "Desarrollo de Aplicaciones Web" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` missing, empty, or not a string |
| 404 | `id` doesn't match a training cycle owned by this teacher |
| 409 | `name` already exists for this teacher (on a different cycle). `code: "DUPLICATE_NAME"` |

---

### DELETE /api/training-cycles/:id

**Description**: Deletes a training cycle and its modules — rejected if any of those modules
are referenced by any academic year's selection (enforced by the `modules` →
`academic_year_modules` `ON DELETE RESTRICT` foreign key; see `schema-changes.sql`, verified
against the real database).
**Elements**: `training-cycle-table`, `training-cycle-delete-blocked-message`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match a training cycle owned by this teacher |
| 409 | One or more of this cycle's modules are referenced by an academic year's selection. Body: `{ "message": "...", "code": "HAS_DEPENDENTS", "academicYears": [{ "id": "uuid", "name": "2026/2027" }] }` |

---

## Modules (Año académico screen)

### GET /api/training-cycles/:cycleId/modules

**Description**: Lists **all** modules of one training cycle, grouped by `course`, regardless
of any academic year's selection. Used by `module-selection-table` (adding-year/adding-cycle
mode) to build the checklist for a cycle that already has modules — see `GET
/api/academic-years/:id/training-cycles/:cycleId/modules` below for `module-table`'s
normal-mode, year-filtered list.
**Elements**: `module-selection-table`

#### Request
- **Params**: `{ cycleId: string }`

#### Response 200
```json
{ "modules": [{ "id": "uuid", "trainingCycleId": "uuid", "course": 1, "name": "Programación" }] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `cycleId` doesn't match a training cycle owned by this teacher |

---

### GET /api/academic-years/:id/training-cycles/:cycleId/modules

**Description**: Lists the modules of one training cycle that are also selected for this
academic year, grouped by `course` (join `modules` ⋈ `academic_year_modules` filtered by
both `training_cycle_id` and `academic_year_id`). Used by `module-table` in normal mode.
**Elements**: `module-table`

#### Request
- **Params**: `{ id: string, cycleId: string }`

#### Response 200
```json
{ "modules": [{ "id": "uuid", "trainingCycleId": "uuid", "course": 1, "name": "Programación" }] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an academic year, or `cycleId` doesn't match a training cycle, owned by this teacher |

---

### POST /api/training-cycles/:cycleId/modules

**Description**: Creates a module under a training cycle. Doesn't touch any academic year's
selection by itself — a module is only ever added to `academic_year_modules` via `PUT
/api/academic-years/:id/modules`. `module-table-add-button` (normal mode) and
`module-selection-add-button` (adding-year/adding-cycle mode) both call this to create the
row, then include its id the next time the selection is saved — for
`module-table-add-button` specifically, the frontend calls the `PUT` immediately after, so
the module is already selected for the active academic year by the time `module-table`
re-renders.
**Elements**: `module-table-add-button`, `module-table`, `module-selection-add-button`,
`module-selection-table`

#### Request
- **Params**: `{ cycleId: string }`
- **Body**: `{ name: string, course: number }`

#### Response 201
```json
{ "id": "uuid", "trainingCycleId": "uuid", "course": 1, "name": "Programación" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` missing/empty/not a string, or `course` not one of `1`, `2`, `3` |
| 404 | `cycleId` doesn't match a training cycle owned by this teacher |
| 409 | `(name, course)` already exists within this cycle. `code: "DUPLICATE_NAME"` |

---

### PATCH /api/modules/:id

**Description**: Renames a module and/or changes its `course`. If the module is referenced by
one or more academic years' selections and `confirm` isn't `true`, the edit is **not** saved —
the response names which academic year(s) hold the reference, so the frontend can show
`module-edit-confirm-modal` before resending with `confirm: true`.
**Elements**: `module-table`, `module-edit-confirm-modal`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ name?: string, course?: number, confirm?: boolean }`

#### Response 200
```json
{ "id": "uuid", "trainingCycleId": "uuid", "course": 2, "name": "Bases de Datos" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` present but empty/not a string, or `course` present but not one of `1`, `2`, `3` |
| 404 | `id` doesn't match a module owned by this teacher |
| 409 | `(name, course)` already exists within the module's cycle (on a different module). `code: "DUPLICATE_NAME"` |
| 409 | The module is referenced by one or more academic years and `confirm` wasn't `true` — nothing saved. Body: `{ "message": "...", "code": "HAS_DEPENDENTS", "academicYears": [{ "id": "uuid", "name": "2026/2027" }] }` |

---

### DELETE /api/modules/:id

**Description**: Deletes a module — rejected if referenced by any academic year's selection
(enforced by `academic_year_modules`'s `ON DELETE RESTRICT` on `module_id`).
**Elements**: `module-table`, `module-delete-blocked-message`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match a module owned by this teacher |
| 409 | Referenced by an academic year's selection. Body: `{ "message": "...", "code": "HAS_DEPENDENTS", "academicYears": [{ "id": "uuid", "name": "2026/2027" }] }` |

---

### GET /api/modules

**Description**: Lists **every** module the teacher has, across all training cycles, each
including its cycle's id and name. Not called by the frontend — no element on this screen
shows a flat, cross-cycle module list; `module-selection-table` is always scoped to one
cycle at a time (`GET /api/training-cycles/:cycleId/modules` above) and `module-table` is
scoped to one cycle and one year (`GET
/api/academic-years/:id/training-cycles/:cycleId/modules` below). This endpoint exists
because `AcademicYearService.replaceSelection` needs it server-side, to verify every
submitted `moduleIds` entry is owned by the teacher (see `PUT
/api/academic-years/:id/modules` below) — exposed as a route mainly for completeness/testing,
not part of any UI flow.
**Elements**: none

#### Response 200
```json
{
  "modules": [
    { "id": "uuid", "name": "Programación", "course": 1, "trainingCycleId": "uuid", "trainingCycleName": "Desarrollo de Aplicaciones Web" }
  ]
}
```

---

## Academic years (Año académico screen)

### GET /api/academic-years

**Description**: Lists the signed-in teacher's academic years.
**Elements**: `academic-year-table`

#### Response 200
```json
{ "academicYears": [{ "id": "uuid", "name": "2026/2027", "isCurrent": true }] }
```

---

### POST /api/academic-years

**Description**: Creates an academic year. Never marked current on creation — the teacher
marks one current via `PATCH`. In adding-year mode (UC-04's A4), `module-selection-save-button`
calls this first with the draft name, then immediately calls `PUT
/api/academic-years/:id/modules` with the accumulated selection — two sequential requests
behind what the teacher experiences as one click, no single combined endpoint.
If this `POST` succeeds but the following `PUT` fails (network drop, not a validation error —
`moduleIds` are already known-good ids), the academic year is left created with an empty
selection rather than the whole action rolling back — confirmed, no rollback.
`module-selection-save-message` still shows an error and the draft's checkboxes stay as they
were, but the year now exists and is selectable from `academic-year-table` on retry.
**Elements**: `academic-year-table-add-button`, `academic-year-table`,
`module-selection-save-button`

#### Request
- **Body**: `{ name: string }`

#### Response 201
```json
{ "id": "uuid", "name": "2026/2027", "isCurrent": false }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` missing, empty, or not a string |
| 409 | `name` already exists for this teacher. `code: "DUPLICATE_NAME"` |

---

### PATCH /api/academic-years/:id

**Description**: Renames an academic year and/or marks it current. Marking `isCurrent: true`
un-marks whichever row was previously current for this teacher (enforced together with the
partial unique index `academic_years_one_current_per_teacher` — the application sets the
previous row's `is_current` to `false` in the same transaction before setting the new one to
`true`, so the index is never violated).
**Elements**: `academic-year-table`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ name?: string, isCurrent?: true }` (setting `isCurrent: false` directly isn't a
  supported way to "unset current" — mark a *different* row current instead, or leave none
  current by never marking any)

#### Response 200
```json
{ "id": "uuid", "name": "2026/2027", "isCurrent": true }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` present but empty/not a string |
| 404 | `id` doesn't match an academic year owned by this teacher |
| 409 | `name` already exists for this teacher (on a different year). `code: "DUPLICATE_NAME"` |

---

### DELETE /api/academic-years/:id

**Description**: Deletes an academic year and its module selection — rejected if it's the one
marked current (application-level check, not a DB constraint — same precedent as Login's
lockout logic living in `AuthService`, not a trigger).
**Elements**: `academic-year-table`, `academic-year-delete-blocked-message`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an academic year owned by this teacher |
| 409 | This academic year is marked current. Body: `{ "message": "...", "code": "IS_CURRENT" }` |

---

## Academic year ↔ module selection (Año académico screen)

### GET /api/academic-years/:id/modules

**Description**: Lists the module ids currently selected for this academic year.
**Elements**: `module-selection-table`

#### Request
- **Params**: `{ id: string }`

#### Response 200
```json
{ "moduleIds": ["uuid", "uuid"] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an academic year owned by this teacher |

---

### PUT /api/academic-years/:id/modules

**Description**: Replaces this academic year's module selection with exactly the submitted
set — any previously-selected module not included is removed from the selection (the module
itself, and its training cycle, are untouched; only the join-table rows change). In
adding-year mode this is the second of the two sequential calls behind
`module-selection-save-button`'s one click (see `POST /api/academic-years` above); in
adding-cycle mode it's the only call.
**Elements**: `module-selection-save-button`, `module-selection-table`,
`module-selection-save-message`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ moduleIds: string[] }`

#### Response 200
```json
{ "moduleIds": ["uuid", "uuid"] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `moduleIds` missing, not an array, or contains a non-string entry |
| 404 | `id` doesn't match an academic year owned by this teacher, or some `moduleIds` entry doesn't match a module owned by this teacher |

---

## Dependency on Dashboard

`views/dashboard/ui-spec.json`'s `settings-menu` is currently a disabled placeholder (see
`views/dashboard/description_dashboard.md`). Making it a real link to
`/configuracion/profesor` is a small reopen of the Dashboard view — its own Phase A/B, not
part of this view's artifacts. Noted here so the Orchestrator schedules it as a follow-up
after this view, the same way Login's session-gap reopen preceded Dashboard's own build.
