# API Contracts — Fechas señaladas

`key_dates` is a single, shared, global table (see `schema-changes.sql`) — no FK to `users`
or `academic_years`, day/month only, no year. One REST resource, not six: every category
listed below is the same table filtered/tagged by its `category` value, not a separate
endpoint group — matches the "one table, not six" decision in
`description_fechas-senaladas.md`.

**Allowed roles**: any authenticated teacher (`requireAuth`), same as every other
Configuración endpoint — see Login's `GET /api/auth/session` / `session-guard`.

## Category values

| Internal id (`category` column / API field) | Spanish label | Shape |
|---|---|---|
| `academic_key_dates` | Fechas clave FP | range |
| `holidays` | Vacaciones | range |
| `public_holidays` | Días festivos | single day + `type` |
| `free_disposal_days` | Días de libre disposición | single day |
| `evaluations` | Evaluaciones | range |
| `feoe_project_days` | Proyecto FEOE | single day |

A single-day category's row always has `endDay === startDay` and `endMonth === startMonth`
in the response (see `schema-changes.sql`'s note) — the frontend for those four category
tables only renders/edits one `fecha` field and sends the same value for both start and end.

---

## GET /api/key-dates

**Description**: Lists `key_dates` rows, optionally filtered to one category.
**Elements**: `academic-key-dates-table`, `holidays-table`, `public-holidays-table`,
`free-disposal-days-table`, `evaluations-table`, `feoe-project-days-table`

#### Request
- **Query**: `{ category?: string }` — one of the six values above. Omitted returns all 43+
  rows across every category (not used by this screen's own UI, which always requests one
  category per table, but not forbidden either).

#### Response 200
```json
{
  "keyDates": [
    {
      "id": "uuid",
      "category": "public_holidays",
      "name": "Fiesta Nacional de España.",
      "startDay": 12,
      "startMonth": 10,
      "endDay": 12,
      "endMonth": 10,
      "type": "Nacional"
    }
  ]
}
```
`type` is `null` for every category except `public_holidays`.

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `category` present but not one of the six valid values |

---

## POST /api/key-dates

**Description**: Creates a `key_dates` row.
**Elements**: `academic-key-dates-table-add-button`, `holidays-table-add-button`,
`public-holidays-table-add-button`, `free-disposal-days-table-add-button`,
`evaluations-table-add-button`, `feoe-project-days-table-add-button`

#### Request
- **Body**: `{ category: string, name: string, startDay: number, startMonth: number, endDay: number, endMonth: number, type?: string }`
  — `endDay`/`endMonth` are required in the request body even for single-day categories; the
  frontend sends the same value as `startDay`/`startMonth` for those (see "Category values"
  above) rather than the backend inferring it, so the contract has no category-conditional
  shape.

#### Response 201
```json
{
  "id": "uuid",
  "category": "public_holidays",
  "name": "Fiesta Nacional de España.",
  "startDay": 12,
  "startMonth": 10,
  "endDay": 12,
  "endMonth": 10,
  "type": "Nacional"
}
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | `category` missing/not one of the six values; `name` missing/empty; `startDay`/`endDay` not an integer 1–31; `startMonth`/`endMonth` not an integer 1–12; `startDay`/`startMonth` don't form a real day-in-month (e.g. day 31, month 2) — same check for `endDay`/`endMonth` |
| 409 | `(category, name, startDay, startMonth)` already exists. Body: `{ "message": "...", "code": "DUPLICATE_NAME" }` |

---

## PATCH /api/key-dates/:id

**Description**: Renames and/or changes the date(s)/type of an existing row. `category`
itself is never editable — a row can't move between categories.
**Elements**: same six `*-table` elements as GET (row-level Editar/Guardar)

#### Request
- **Params**: `{ id: string }`
- **Body**: `{ name?: string, startDay?: number, startMonth?: number, endDay?: number, endMonth?: number, type?: string }`

#### Response 200
```json
{
  "id": "uuid",
  "category": "public_holidays",
  "name": "Fiesta Nacional de España (renombrado).",
  "startDay": 12,
  "startMonth": 10,
  "endDay": 12,
  "endMonth": 10,
  "type": "Nacional"
}
```

#### Errors
| Code | Condition |
|------|-----------|
| 400 | Same field-shape/real-day-in-month checks as POST, applied to whichever fields are present |
| 404 | `id` doesn't match an existing `key_dates` row |
| 409 | The edit would collide with another row's `(category, name, startDay, startMonth)`. `code: "DUPLICATE_NAME"` |

---

## DELETE /api/key-dates/:id

**Description**: Deletes a `key_dates` row. Always succeeds if it exists — no dependency
check, nothing else in the schema references this table.
**Elements**: same six `*-table` elements (row-level Eliminar)

#### Request
- **Params**: `{ id: string }`

#### Response 204
No body.

#### Errors
| Code | Condition |
|------|-----------|
| 404 | `id` doesn't match an existing `key_dates` row |
