# API Contracts — Configuración

Rewritten from scratch 2026-08-04 for the full view redesign. Every endpoint below requires
a valid session (see Login's `GET /api/auth/session` / `session-guard`). **Allowed roles** is
the same for all of them: Authenticated teacher — not repeated per endpoint.

**Ownership scoping differs by section, un-scoped 2026-08-05**: the Teacher endpoints
(`/api/teacher/*`) still read/write only the signed-in teacher's own `users` row. The
training cycles/modules catalog (`/api/catalog/*`) does **not** scope by teacher at all —
`catalog_cycles` has no `teacher_id` column or relation to `users` — it's one shared,
global catalog for every signed-in teacher, matching how official BOC curricula (e.g. DAM,
DAW) are the same regardless of who teaches them. Any signed-in teacher can list, create,
rename, or delete any cycle or module in it.

**Año académico (`/configuracion/ano-academico`) gets real endpoints as of 2026-08-05** —
see "Academic years" and "Academic year módulo selection" below. `academic_years` rows are
scoped per teacher (own data only, like `/api/teacher/*`); the cycle/módulo picker in adding
mode reuses the existing, unscoped `GET /api/catalog/training-cycles` and
`GET /api/catalog/training-cycles/:cycleId/modules` endpoints above — no new endpoints
needed for browsing the catalog itself.

Domain error codes used below (per `tecnologias/tecnologia_code.md`'s centralized
`STATUS_MAP` convention):

| Code | HTTP status | Meaning |
|------|-------------|---------|
| `DUPLICATE_NAME` | 409 | A name/(name, course) that must be unique (per teacher for `/api/teacher/*` and `/api/academic-years`, globally for `/api/catalog/*`) already exists |
| `INVALID_CREDENTIALS` | 401 | Current password didn't match (password-change only) |
| `HAS_DEPENDENTS` | 409 | Deleting an academic year is blocked because it still has módulos assigned |

---

## Teacher (Profesor screen)

Unchanged from the previous design — `users` was never touched by the redesign.

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
teacher is already authenticated.
**Elements**: `teacher-current-password-input`, `teacher-new-password-input`,
`teacher-repeat-password-input`, `teacher-save-password-button`, `teacher-password-save-message`

#### Request
- **Body**: `{ currentPassword: string, newPassword: string }`

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

## Training cycles catalog (Ciclos/Módulos screen)

New tables, no relation to `users` — shared, global catalog, see `schema-changes.sql`.
`catalog_modules`' FK to `catalog_cycles` is `ON DELETE CASCADE`. As of the 2026-08-06 fix
for #4, deletion of a cycle or módulo IS dependency-blocked (`409 HAS_DEPENDENTS`) when some
academic year (`academic_year_modules`, any teacher's) still has one of the cycle's módulos
assigned — `academic_year_modules_catalog_module_id_fkey` has no cascade of its own, so an
unblocked delete would fail with a raw `500` instead.

### GET /api/catalog/training-cycles

**Description**: Lists the complete catalog training cycle list (shared across all teachers).
**Elements**: `catalog-training-cycle-table`

#### Response 200
```json
{ "trainingCycles": [{ "id": "uuid", "name": "Desarrollo de Aplicaciones Web" }] }
```

---

### POST /api/catalog/training-cycles

**Description**: Creates a catalog training cycle.
**Elements**: `catalog-training-cycle-table-add-button`, `catalog-training-cycle-table`

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
| 409 | `name` already exists. Body: `{ "message": "...", "code": "DUPLICATE_NAME" }` |

---

### PATCH /api/catalog/training-cycles/:id

**Description**: Renames a catalog training cycle.
**Elements**: `catalog-training-cycle-table`

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
| 404 | `id` doesn't match an existing catalog training cycle |
| 409 | `name` already exists (on a different cycle). `code: "DUPLICATE_NAME"` |

---

### DELETE /api/catalog/training-cycles/:id

**Description**: Deletes a catalog training cycle and cascades to its modules
(`catalog_modules_catalog_training_cycle_id_fkey ON DELETE CASCADE`) — unless any of those
modules is still assigned to some academic year, in which case the whole deletion is
blocked (2026-08-06 fix for #4).
**Elements**: `catalog-training-cycle-table`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an existing catalog training cycle |
| 409 | Some módulo of this cycle is still assigned to an academic year. Body: `{ "message": "...", "code": "HAS_DEPENDENTS" }` |

---

## Modules catalog (Ciclos/Módulos screen)

### GET /api/catalog/training-cycles/:cycleId/modules

**Description**: Lists all modules of one catalog training cycle, grouped by `course`.
**Elements**: `catalog-module-table`

#### Request
- **Params**: `{ cycleId: string }`

#### Response 200
```json
{ "modules": [{ "id": "uuid", "catalogTrainingCycleId": "uuid", "course": 1, "name": "Programación" }] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `cycleId` doesn't match an existing catalog training cycle |

---

### POST /api/catalog/training-cycles/:cycleId/modules

**Description**: Creates a module under a catalog training cycle.
**Elements**: `catalog-module-table-add-button`, `catalog-module-table`

#### Request
- **Params**: `{ cycleId: string }`
- **Body**: `{ name: string, course: number }`

#### Response 201
```json
{ "id": "uuid", "catalogTrainingCycleId": "uuid", "course": 1, "name": "Programación" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` missing/empty/not a string, or `course` not one of `1`, `2` |
| 404 | `cycleId` doesn't match an existing catalog training cycle |
| 409 | `(name, course)` already exists within this cycle. `code: "DUPLICATE_NAME"` |

---

### PATCH /api/catalog/modules/:id

**Description**: Renames a module and/or changes its `course`. Always saves immediately —
no confirmation step, unlike the old `modules` table's `confirm` flow; nothing references a
catalog module.
**Elements**: `catalog-module-table`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ name?: string, course?: number }`

#### Response 200
```json
{ "id": "uuid", "catalogTrainingCycleId": "uuid", "course": 2, "name": "Bases de Datos" }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `name` present but empty/not a string, or `course` present but not one of `1`, `2` |
| 404 | `id` doesn't match an existing catalog module |
| 409 | `(name, course)` already exists within the module's cycle (on a different module). `code: "DUPLICATE_NAME"` |

---

### DELETE /api/catalog/modules/:id

**Description**: Deletes a catalog module — unless it's still assigned to some academic
year, in which case deletion is blocked (2026-08-06 fix for #4).
**Elements**: `catalog-module-table`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an existing catalog module |
| 409 | Still assigned to an academic year. Body: `{ "message": "...", "code": "HAS_DEPENDENTS" }` |

---

## Dependency on Dashboard

`views/dashboard/ui-spec.json`'s `settings-menu` is currently a disabled placeholder (see
`views/dashboard/description_dashboard.md`). Making it a real link to
`/configuracion/profesor` is a small reopen of the Dashboard view — its own Phase A/B, not
part of this view's artifacts. Unaffected by the 2026-08-04 redesign.

---

## Academic years (Año académico screen)

`academic_years` rows are scoped per teacher — own data only, same as `/api/teacher/*`.
Displayed client-side as `"<startYear>-<startYear+1>"`; the API only ever sends/receives
the integer `startYear`.

### GET /api/academic-years

**Description**: Lists the signed-in teacher's complete academic year list.
**Elements**: `academic-year-table`

#### Response 200
```json
{ "academicYears": [{ "id": "uuid", "startYear": 2026, "isCurrent": true }] }
```

---

### PATCH /api/academic-years/:id

**Description**: Renames a row's `startYear`, and/or marks it current. Marking one current
un-marks whichever row was previously current for this teacher, in the same request.
**Elements**: `academic-year-table`, `academic-year-toast`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ startYear?: number, isCurrent?: boolean }`

#### Response 200
```json
{ "id": "uuid", "startYear": 2026, "isCurrent": true }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `startYear` present but not an integer, or `isCurrent` present but not a boolean |
| 404 | `id` doesn't match an academic year owned by this teacher |
| 409 | `startYear` already exists among this teacher's other academic years. Body: `{ "message": "...", "code": "DUPLICATE_NAME" }` |

---

### DELETE /api/academic-years/:id

**Description**: Deletes an academic year. Blocked while it still has `academic_year_modules`
rows — the teacher must remove the assigned módulos/ciclos first (see
`DELETE /api/academic-year-modules/:id` below).
**Elements**: `academic-year-table`, `academic-year-toast`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an academic year owned by this teacher |
| 409 | The year still has módulos assigned. Body: `{ "message": "...", "code": "HAS_DEPENDENTS" }` |

---

## Academic year módulo selection (Año académico screen)

### GET /api/academic-years/:id/modules

**Description**: Lists the modules this teacher has assigned to this academic year (across
every cycle), each including its `catalogTrainingCycleId`/`course`/`name` (joined from
`catalog_modules`) so the frontend can derive `training-cycle-table`'s normal-mode list and
group `module-table` by curso without a second round trip.
**Elements**: `training-cycle-table`, `module-table`

#### Request
- **Params**: `{ id: string }`

#### Response 200
```json
{
  "modules": [
    {
      "id": "uuid",
      "catalogModuleId": "uuid",
      "catalogTrainingCycleId": "uuid",
      "catalogTrainingCycleName": "Desarrollo de Aplicaciones Web",
      "course": 1,
      "name": "Programación"
    }
  ]
}
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an academic year owned by this teacher |

---

### POST /api/academic-years/selection

**Description**: Creates a brand-new academic year and its initial cycle/módulo selection
in one request — what `module-selection-save-button` calls in **new-year mode**, entered via
`academic-year-table-add-button` (UC-06's A4). `moduleIds` may be empty (a year with nothing
assigned yet is valid).
**Elements**: `academic-year-table-add-button`, `module-selection-table`,
`module-selection-save-button`, `module-selection-save-message`, `academic-year-toast`

#### Request
- **Body**: `{ startYear: number, moduleIds: string[] }` — `moduleIds` are `catalog_modules.id`
  values.

#### Response 201
```json
{ "academicYear": { "id": "uuid", "startYear": 2026, "isCurrent": false }, "moduleCount": 3 }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `startYear` missing/not an integer, or `moduleIds` not an array of strings |
| 404 | Some `moduleIds` entry doesn't match an existing `catalog_modules` row |
| 409 | `startYear` already exists for this teacher. Body: `{ "message": "...", "code": "DUPLICATE_NAME" }` |

---

### POST /api/academic-years/:id/modules

**Description**: Adds more módulos to an already-existing academic year — what
`module-selection-save-button` calls in **extend-existing mode**, entered via
`training-cycle-table-add-cycle-button`. Never touches `startYear`/`isCurrent`. `moduleIds`
already assigned to this year are silently ignored (no error, no duplicate row) rather than
rejected — the frontend pre-checks and disables them so they're normally not resent at all,
but the backend doesn't rely on that.
**Elements**: `training-cycle-table-add-cycle-button`, `module-selection-table`,
`module-selection-save-button`, `module-selection-save-message`

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ moduleIds: string[] }` — `catalog_modules.id` values.

#### Response 200
```json
{ "addedCount": 2 }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `moduleIds` missing or not an array of strings |
| 404 | `id` doesn't match an academic year owned by this teacher, or some `moduleIds` entry doesn't match an existing `catalog_modules` row |

---

### DELETE /api/academic-year-modules/:id

**Description**: Un-assigns one módulo from an academic year (`module-table`'s row-level
Quitar). Deletes only the `academic_year_modules` row — never the underlying
`catalog_modules` row.
**Elements**: `module-table`

#### Request
- **Params**: `{ id: string }` — the `academic_year_modules` row id.

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an `academic_year_modules` row owned (via its academic year) by this teacher |

---

## Horario (Horario screen, 2026-08-11)

The filter bar's Año/Ciclo/Módulo cascade reuses `GET /api/academic-years` and
`GET /api/academic-years/:id/modules` (documented above under "Academic year módulo
selection") as-is — no new endpoint for the filter bar itself, only for the weekly
schedule grid below it. `id` in both endpoints below is an `academic_year_modules.id`
(same resource `DELETE /api/academic-year-modules/:id` already uses), never a bare
`catalog_module_id`.

### GET /api/academic-year-modules/:id/schedule

**Description**: Lists the weekly schedule already saved for this `academic_year_module` —
one entry per weekday that has a row. A weekday absent from the array means "no class that
day"; the frontend renders it as the weekday select's blank/"Sin clase" option.
**Elements**: `schedule-monday-select`, `schedule-tuesday-select`, `schedule-wednesday-select`,
`schedule-thursday-select`, `schedule-friday-select`

#### Request
- **Params**: `{ id: string }` — the `academic_year_modules` row id.

#### Response 200
```json
{ "schedule": [ { "weekday": 1, "hours": 2 }, { "weekday": 3, "hours": 1 } ] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an `academic_year_modules` row owned (via its academic year) by this teacher |

---

### PUT /api/academic-year-modules/:id/schedule

**Description**: Replaces this `academic_year_module`'s entire weekly schedule in one
request — what `schedule-save-button` calls. Weekdays present in `schedule` are upserted
with their `hours`; weekdays not present are deleted if a row existed for them (this is a
full replace, not a partial patch — the frontend always sends its complete 5-weekday draft,
one entry per weekday that isn't left blank).
**Elements**: `schedule-save-button`, `schedule-save-message`, `schedule-monday-select`,
`schedule-tuesday-select`, `schedule-wednesday-select`, `schedule-thursday-select`,
`schedule-friday-select`

#### Request
- **Params**: `{ id: string }` — the `academic_year_modules` row id.
- **Body**: `{ schedule: Array<{ weekday: number, hours: number }> }` — `weekday` 1-5
  (Monday-Friday), `hours` 1-3; at most one entry per `weekday`.

#### Response 200
```json
{ "schedule": [ { "weekday": 1, "hours": 2 }, { "weekday": 3, "hours": 1 } ] }
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `schedule` missing or not an array; an entry's `weekday` not in 1-5; an entry's `hours` not in 1-3; the same `weekday` appears more than once |
| 404 | `id` doesn't match an `academic_year_modules` row owned (via its academic year) by this teacher |
