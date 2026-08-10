# API Contracts — Calendario

Two read-only endpoints (`GET /api/calendario-modulo`, `GET
/api/calendario-evaluation-working-days`), plus a documented side-effect change to three
endpoints that already exist in `views/configuracion/api-contracts.md` (their
request/response shapes don't change — only their behavior gains a new effect). `GET
/api/academic-years/:id/modules` (already documented there) is reused as-is by
`cycle-filter`/`module-filter`, no changes.

---

### GET /api/calendario-modulo

**Description**: Returns a módulo's snapshotted calendar entries (see
`views/calendario/description_calendario.md`) — the only data source for
`calendario-months`/`calendario-empty-state`/`calendario-day-toast`/`calendario-legend`
(UC-11).
**Allowed roles**: authenticated teacher, only for an `academic_year_module_id` belonging
to one of their own `academic_years`
**Elements**: `calendario-months`, `calendario-empty-state`, `calendario-legend`

#### Request

- **Query**: `{ academicYearModuleId: string (UUID) }` — required

#### Response 200

```json
{
  "entries": [
    {
      "id": "b3f1...",
      "category": "holidays",
      "name": "Vacaciones de Navidad.",
      "startDate": "2026-12-22",
      "endDate": "2027-01-07",
      "type": "Vacaciones"
    }
  ]
}
```

`entries` is `[]` (not a 404) when the módulo exists but has no snapshot rows yet —
`calendario-empty-state` renders on an empty array, same "empty is a valid 200, not an
error" convention every other list endpoint in this app already follows.

`category` is one of `academic_key_dates`, `holidays`, `public_holidays`,
`free_disposal_days`, `evaluations`, `feoe_project_days`, `final_exams` — the last one
computed, not copied from `key_dates` (see `views/calendario/use-cases.md` UC-08).

`type` (2026-08-10) is copied from `key_dates.type` at seed time — free text, nullable,
same as `key_dates` itself (see `views/fechas-senaladas/api-contracts.md`). `null` for
every `final_exams` entry (computed, no `key_dates` row to copy `type` from) and for any
category whose `key_dates` row happens to have no `type` set. Drives `calendario-legend`
and `calendario-months`'s per-(category,type) color (UC-11).

#### Errors

| Code | Condition |
|------|-----------|
| 400 | `academicYearModuleId` missing or not a well-formed UUID |
| 401 | Not authenticated |
| 404 | `academicYearModuleId` doesn't match an `academic_year_modules` row owned (via its `academic_year_id`) by the authenticated teacher |

---

### GET /api/calendario-evaluation-working-days

**Description**: Returns, for one módulo, the count of working days between that módulo's
course start ("Inicio curso: 1º de Grado Superior de FP." or "Inicio curso: 2º de Grado
Superior de FP.", whichever matches the módulo's own `course`) and each evaluación's
"Examen final" date — see
`views/calendario/use-cases.md` UC-09. The only data source for
`evaluation-working-days-summary`.
**Allowed roles**: authenticated teacher, only for an `academic_year_module_id` belonging
to one of their own `academic_years` — same ownership check as `GET
/api/calendario-modulo`.
**Elements**: `evaluation-working-days-summary`, `evaluation-working-days-1`,
`evaluation-working-days-2`, `evaluation-working-days-3`

#### Request

- **Query**: `{ academicYearModuleId: string (UUID) }` — required

#### Response 200

```json
{
  "entries": [
    { "evaluationNumber": 1, "workingDays": 47 },
    { "evaluationNumber": 2, "workingDays": 89 }
  ]
}
```

`entries` has at most 3 rows (one per `evaluationNumber` 1/2/3) and can have fewer — a
módulo whose course has no 3ª evaluación data in `key_dates` (currently: any curso 2
módulo) simply has no `evaluationNumber: 3` entry, not a `workingDays: 0` one. `entries` is
`[]` (not a 404) when the snapshot hasn't been generated yet, same convention as `GET
/api/calendario-modulo`.

#### Errors

| Code | Condition |
|------|-----------|
| 400 | `academicYearModuleId` missing or not a well-formed UUID |
| 401 | Not authenticated |
| 404 | `academicYearModuleId` doesn't match an `academic_year_modules` row owned (via its `academic_year_id`) by the authenticated teacher |

---

## Modified existing endpoints (side effect only — shapes unchanged)

These three are already fully documented in `views/configuracion/api-contracts.md`
("Academic years" / "Academic year módulo selection" sections). Only their behavior
changes, per `views/calendario/use-cases.md` UC-06/UC-07 — request/response bodies, status
codes and existing error conditions are untouched.

### POST /api/academic-years/selection

**New side effect**: after creating the academic year and its `academic_year_modules`
rows, resolves and inserts a full, **course-filtered** `calendario_modulo` snapshot
(2026-08-10: only `key_dates` entries applicable to that módulo's own `course` — see
`views/calendario/use-cases.md` UC-06/A1 — currently 34 rows for course 1 / 32 for course
2, plus the computed `final_exams` rows — see UC-06/UC-08) for every módulo now assigned
to it, and a `calendario_evaluation_working_days` row per evaluación that módulo has data
for (see UC-09). The `"Inicio curso: <sufijo>."` row is itself split into two single-day
rows, `"Inicio curso: ..."` and `"Fin de curso: ..."` (2026-08-10, UC-06/A2) — accounted
for in the 34/32 figures above. Purely additive — response shape (`{ academicYear,
moduleCount }`) is
unchanged; neither snapshot step ever fails the request (idempotent insert, `ON CONFLICT
DO NOTHING`, no new error codes).
**Elements**: `module-selection-save-button` (`views/configuracion/`)

### POST /api/academic-years/:id/modules

**New side effect**: same snapshot generation as above (`calendario_modulo` including
`final_exams`, and `calendario_evaluation_working_days`), scoped to the newly added
módulos of this already-existing academic year. Response shape (`{ addedCount }`)
unchanged.
**Elements**: `module-selection-save-button` (`views/configuracion/`)

### DELETE /api/academic-year-modules/:id

**New side effect**: deleting the `academic_year_modules` row cascades (`ON DELETE
CASCADE`, both `calendario_modulo.academic_year_module_id` and
`calendario_evaluation_working_days.academic_year_module_id` FKs) to remove every
`calendario_modulo` and `calendario_evaluation_working_days` row that referenced it —
enforced at the database level, no application-code change to this route, no new error
codes.
**Elements**: `module-table-row-<id>-delete` (`views/configuracion/`)
