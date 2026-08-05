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

**Año académico (`/configuracion/ano-academico`) has no endpoints in this pass.** Its former
tables (`training_cycles`, `modules`, `academic_years`, `academic_year_modules`) were dropped
and are not recreated here — see `description_configuracion.md`'s "Redesign note" and
`functional-spec.json`'s "NOT WIRED" elementSpecs. `frontend-implementer` wires that screen to
a local-state-only stub; there is nothing to document here.

Domain error codes used below (per `tecnologias/tecnologia_code.md`'s centralized
`STATUS_MAP` convention):

| Code | HTTP status | Meaning |
|------|-------------|---------|
| `DUPLICATE_NAME` | 409 | A name/(name, course) that must be unique (per teacher for `/api/teacher/*`, globally for `/api/catalog/*`) already exists |
| `INVALID_CREDENTIALS` | 401 | Current password didn't match (password-change only) |

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

New tables, no relation to anything year-related, no relation to `users` either — shared,
global catalog, see `schema-changes.sql`. No dependency-blocked deletion anywhere in this
group: `catalog_modules`' FK to `catalog_cycles` is `ON DELETE CASCADE`, and nothing
references `catalog_modules` at all.

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
(`catalog_modules_catalog_training_cycle_id_fkey ON DELETE CASCADE`). Always succeeds if the
cycle exists — no dependency check, nothing references this catalog.
**Elements**: `catalog-training-cycle-table`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an existing catalog training cycle |

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

**Description**: Deletes a catalog module. Always succeeds if it exists — no dependency
check.
**Elements**: `catalog-module-table`

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an existing catalog module |

---

## Dependency on Dashboard

`views/dashboard/ui-spec.json`'s `settings-menu` is currently a disabled placeholder (see
`views/dashboard/description_dashboard.md`). Making it a real link to
`/configuracion/profesor` is a small reopen of the Dashboard view — its own Phase A/B, not
part of this view's artifacts. Unaffected by the 2026-08-04 redesign.
