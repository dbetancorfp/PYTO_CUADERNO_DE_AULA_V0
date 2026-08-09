# API Contracts — Calendario

One new read-only endpoint (`GET /api/calendario-modulo`), plus a documented side-effect
change to three endpoints that already exist in `views/configuracion/api-contracts.md`
(their request/response shapes don't change — only their behavior gains a new effect).
`GET /api/academic-years/:id/modules` (already documented there) is reused as-is by
`cycle-filter`/`module-filter`, no changes.

---

### GET /api/calendario-modulo

**Description**: Returns a módulo's snapshotted calendar entries (see
`views/calendario/description_calendario.md`) — the only data source for
`calendario-months`/`calendario-empty-state`/`calendario-day-toast`.
**Allowed roles**: authenticated teacher, only for an `academic_year_module_id` belonging
to one of their own `academic_years`
**Elements**: `calendario-months`, `calendario-empty-state`

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
      "endDate": "2027-01-07"
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
rows, resolves and inserts a full `calendario_modulo` snapshot (43 rows plus the computed
`final_exams` rows — see `views/calendario/use-cases.md` UC-06/UC-08) for every módulo now
assigned to it. Purely additive — response shape (`{ academicYear, moduleCount }`) is
unchanged; the snapshot step never fails the request (idempotent insert, `ON CONFLICT DO
NOTHING`, no new error codes).
**Elements**: `module-selection-save-button` (`views/configuracion/`)

### POST /api/academic-years/:id/modules

**New side effect**: same snapshot generation as above (including `final_exams`), scoped
to the newly added módulos of this already-existing academic year. Response shape
(`{ addedCount }`) unchanged.
**Elements**: `module-selection-save-button` (`views/configuracion/`)

### DELETE /api/academic-year-modules/:id

**New side effect**: deleting the `academic_year_modules` row cascades
(`ON DELETE CASCADE`, `calendario_modulo.academic_year_module_id` FK) to remove every
`calendario_modulo` row that referenced it — enforced at the database level, no
application-code change to this route, no new error codes.
**Elements**: `module-table-row-<id>-delete` (`views/configuracion/`)
