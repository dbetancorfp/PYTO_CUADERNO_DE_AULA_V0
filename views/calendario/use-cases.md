# Use Cases — Calendario

Read-only dashboard screen (route `/calendario`) showing one módulo's school calendar
(September of a selected school year → June of the next) with `key_dates` categories
marked red or blue, sourced exclusively from `calendario_modulo` — a snapshot table
populated as a side effect of Año académico's existing "Guardar selección"/"Quitar" flows
(UC-06/UC-07 below), never read live from `key_dates`. See
`views/calendario/description_calendario.md` for the full rationale.

---

## UC-01: Navigate to Calendario and back to Dashboard

**Primary actor**: Any signed-in teacher
**Preconditions**: Valid session
**Elements**: `calendario-heading`, `back-to-dashboard-link`

### Main flow

1. Teacher clicks the dashboard's existing `calendar-card` (already wired to `/calendario`
   in `dashboard-view.ts`, out of this view's scope) and lands on this screen.
2. `calendario-heading` shows "Calendario", pinned to the far left of the nav bar.
3. Teacher clicks `back-to-dashboard-link`, pinned to the far right, and returns to
   `/dashboard`.

### Postconditions

- Route changes; no data changes.

### Acceptance criteria

- [x] `calendario-heading` always renders the text "Calendario"
- [x] Clicking `back-to-dashboard-link` navigates to `/dashboard`

---

## UC-02: Browse and select a school year via the carousel

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session
**Elements**: `academic-year-filter-prev`, `academic-year-filter-value`,
`academic-year-filter-next`

### Main flow

1. On load, `academic-year-filter-value` shows the computed current school year
   (`currentSchoolYearStartYear`: current calendar month ≥ 9 → current calendar year;
   otherwise → current calendar year − 1), formatted `"<year>-<year+1>"`.
2. Teacher clicks `academic-year-filter-next`; the selected year advances by one and
   `cycle-filter`/`module-filter`/`calendario-months` re-derive for it.
3. Teacher clicks `academic-year-filter-prev`; the selected year goes back by one, same
   re-derivation.

### Alternative flows

- **A1 — Backward limit**: `academic-year-filter-prev` is disabled once there's no
  `academic_years` row for this teacher with `startYear` below the currently selected
  year (only years the teacher has actually taught are reachable going back).
- **A2 — Forward limit**: `academic-year-filter-next` is disabled once the selected year
  reaches `currentSchoolYearStartYear + 5`. No `academic_years` row is required to move
  forward — a future, not-yet-created year is still selectable.

### Postconditions

- `academic-year-filter-value` reflects the newly selected year; `cycle-filter`,
  `module-filter` and `calendario-months` reload for it.

### Acceptance criteria

- [x] On first load, `academic-year-filter-value` shows the school year containing
      today's date (September-cutoff rule), formatted `"<year>-<year+1>"`
- [x] `academic-year-filter-prev` is disabled when the teacher has no `academic_years`
      row with `startYear` less than the currently selected year
- [x] Clicking `academic-year-filter-prev` when enabled selects the previous available
      school year and updates `academic-year-filter-value`
- [x] `academic-year-filter-next` is disabled once the selected year equals
      `currentSchoolYearStartYear + 5`
- [x] Clicking `academic-year-filter-next` when enabled advances the selected year by 1
      and updates `academic-year-filter-value`
- [x] Selecting a future year with no `academic_years` row shows `cycle-filter` in its
      empty state and `calendario-empty-state` instead of `calendario-months`

---

## UC-03: Select a ciclo

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a school year with at least one `academic_years` row is
selected
**Elements**: `cycle-filter`

### Main flow

1. `cycle-filter` lists the distinct training cycles this teacher teaches in the selected
   school year — derived client-side from `GET /api/academic-years/:id/modules`,
   deduplicated by `catalogTrainingCycleId` (same derivation
   `academic-year-settings-view.ts` already uses for `training-cycle-table`).
2. First cycle selected by default.
3. Teacher changes `cycle-filter`; `module-filter` re-derives to that cycle's módulos and
   selects the first one.

### Alternative flows

- **A1 — No cycles**: selected school year has no `academic_years` row yet, or has one
  with zero módulos assigned — `cycle-filter` shows its empty state.

### Postconditions

- `module-filter` reflects the newly selected cycle's módulos.

### Acceptance criteria

- [x] `cycle-filter` lists exactly the distinct cycles present in the selected year's
      módulo assignments, no duplicates
- [x] `cycle-filter` has its first option selected by default when the year has at
      least one cycle
- [x] Changing `cycle-filter` updates `module-filter` to only that cycle's módulos

---

## UC-04: Select a módulo and view its calendar

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a cycle with at least one módulo is selected
**Elements**: `module-filter`, `calendario-months`, `calendario-empty-state`

### Main flow

1. `module-filter` lists the selected cycle's módulos (from the same
   `GET /api/academic-years/:id/modules` response already fetched for `cycle-filter`),
   first one selected by default.
2. `GET /api/calendario-modulo?academicYearModuleId=<id>` fetches that módulo's
   snapshot rows.
3. `calendario-months` renders 10 month cards, September of the selected school year
   through June of the next, each day cell colored per the `(category, type)` pair(s)
   covering it — see UC-11's color table (2026-08-10, replaces the earlier fixed
   red/blue/green-by-category scheme). A `(category, type)` combination absent from
   UC-11's table (a custom `key_dates` row with no `tipo` set) falls back to that
   category's base hue.
4. Teacher changes `module-filter`; `calendario-months` reloads for the newly selected
   `academic_year_module_id`.

### Alternative flows

- **A1 — Long range**: a `calendario_modulo` range spanning more than 30 days (e.g.
  "Curso escolar", 01/09–31/07) colors only its `start_date` and `end_date`, not every
  day in between — a range of 30 days or fewer colors every day in it, including both
  boundaries.
- **A2 — Overlapping entries**: a day covered by more than one `calendario_modulo` entry
  shows a split background (one color band per active `(category, type)`, hard CSS
  stops), not just one color chosen arbitrarily — generalizes the same rule from
  category-level (pre-2026-08-10) to `(category, type)`-level.
- **A3 — Empty**: selected `academic_year_module_id` has zero `calendario_modulo` rows
  AND zero `calendario_horario` rows (module assigned, but neither snapshot exists yet —
  e.g. no key_dates seeded, or Horario never saved — or the school year itself has no
  `academic_years` row) — `calendario-months` isn't rendered, `calendario-empty-state`
  is shown instead. **2026-08-11**: widened from `calendario_modulo` alone — a módulo
  with `calendario_horario` rows but zero `calendario_modulo` entries still renders the
  grid (ring-only, no fill on any day), see UC-13/A1.
- **A4 — Weekend (2026-08-10)**: a Saturday/Sunday with no entry covering it renders a
  neutral gray (`#cbd5e1`) instead of the plain-weekday's uncolored background — a purely
  calendar-structure cue, not a `(category, type)` color, so it has no `calendario-legend`
  entry. A Saturday/Sunday that *is* covered by an entry renders that entry's real
  `(category, type)` color, same as a weekday — no darkening, unlike the pre-2026-08-10
  scheme's "weekend + public_holidays = darker red" special case, which this replaces.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] `module-filter` lists exactly the módulos belonging to the currently selected
      cycle
- [x] `module-filter` has its first option selected by default when the cycle has at
      least one módulo
- [x] Changing `module-filter` triggers a new `GET /api/calendario-modulo` request for
      the newly selected `academic_year_module_id`
- [x] `calendario-months` renders exactly 10 month cards, September of the selected
      school year through June of the following year, in order
- [x] A day inside a ≤30-day `calendario_modulo` range (e.g. Vacaciones de Navidad,
      22/12–07/01) is colored for every day in that range, including the boundary days,
      using that entry's `(category, type)` color
- [x] A day inside a >30-day `calendario_modulo` range (e.g. Curso escolar, 01/09–31/07)
      is colored only on its start day and its end day, not on the days in between
- [x] Each entry is colored per its own `(category, type)` pair (UC-11's table), not a
      single fixed color per category
- [x] A `(category, type)` pair not in UC-11's table (no `tipo` set) falls back to that
      category's base hue
- [x] A plain Saturday/Sunday with no entry is colored neutral gray (`#cbd5e1`)
- [x] A Saturday/Sunday covered by an entry is colored that entry's real color, not
      darkened
- [x] A day covered by more than one entry at once shows a split background (one band
      per `(category, type)`), not just one color
- [x] When the selected `academic_year_module_id` has no `calendario_modulo` rows,
      `calendario-months` is not rendered and `calendario-empty-state` is shown instead

---

## UC-05: See event details on hover

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; `calendario-months` is populated
**Elements**: `calendario-months`, `calendario-day-tooltip`

2026-08-10: replaces the earlier `calendario-day-toast` mechanism (fixed bottom-right,
shared `toast.ts`'s `ToastController`/`renderToast`) with a Tailwind `group`/
`group-hover` CSS tooltip, anchored to the right of the hovered day cell instead of a
fixed screen corner. `toast.ts` itself is unchanged — Configuración's
`academic-year-toast` keeps using it as before; this view simply stops.

### Main flow

1. Teacher hovers a colored day cell inside `calendario-months`.
2. That day cell's `calendario-day-tooltip` child (already present in the DOM, initially
   hidden) becomes visible via pure CSS — no JS event handling, no component re-render —
   positioned immediately to the right of the day cell, listing every `calendario_modulo`
   entry's `name` covering that day, one per line if more than one.
3. Teacher moves the mouse off the day; the tooltip hides immediately, same pure-CSS
   mechanism, no dismiss timer of any kind.

### Alternative flows

- **A1 — Uncovered day**: a day cell with no `calendario_modulo` entry covering it has no
  `calendario-day-tooltip` child in the DOM at all — hovering it reveals nothing.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] `calendario-day-tooltip` shows the exact event name of a hovered single-category day
- [x] `calendario-day-tooltip` shows every applicable event name, one per line, when the
      hovered day is covered by more than one `calendario_modulo` entry
- [ ] `calendario-day-tooltip` disappears as soon as the mouse leaves the day cell
- [x] `calendario-day-tooltip` is positioned to the right of its own day cell, not at a
      fixed screen corner
- [x] A day cell with no covering `calendario_modulo` entry has no `calendario-day-tooltip`
      node in the DOM (A1)

---

## UC-06: `calendario_modulo` is generated when módulos are saved (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session
**Elements**: `module-selection-save-button` (existing element, `views/configuracion/`)

Cross-view backend side effect, not a UI flow of this screen — documented here because
`calendario_modulo` is this view's own data source and its generation rule belongs to this
view's spec, not Año académico's (whose own `use-cases.md` doesn't change).

### Main flow

1. Teacher clicks `module-selection-save-button` to create a new academic year with
   módulos (`POST /api/academic-years/selection`), or to extend an existing one with more
   módulos (`POST /api/academic-years/:id/modules`).
2. For every `academic_year_modules` row now present for that academic year (both
   pre-existing and newly added), the backend resolves all 6 `key_dates` categories to
   real dates for that year's `startYear` (month ≥ 9 → `startYear`; month ≤ 8 →
   `startYear + 1`), **keeps only the entries applicable to that módulo's own `course`**
   (see A1), splits the `"Inicio curso: <sufijo>."` entry into two single-day rows (see
   A2), and inserts the result into `calendario_modulo`, one row per resolved `key_dates`
   entry per módulo (two, for the split entry).
3. In the same pass, `final_exams` rows are computed from the just-resolved, already
   course-filtered `evaluations` rows and inserted alongside them — see UC-08.
4. Insertion is idempotent (`ON CONFLICT DO NOTHING` on the natural key) — a módulo that
   already has its snapshot generated is never duplicated.

### Alternative flows

- **A1 — Course-specific `key_dates` entries (2026-08-10 bugfix)**: some `key_dates`
  entries only apply to one of the two `catalog_modules.course` values (1 or 2), marked by
  a course token in the entry's own `name` — a `key_dates` entry with no such token applies
  to both courses alike. `<prefix>` below stands for whatever text precedes the token; the
  match is on the token's presence, not the whole name.

  | Course token in `name` | Applies to | Examples |
  |---|---|---|
  | none | both courses | `Curso escolar`, every `holidays`/`public_holidays`/`free_disposal_days` entry, `1ª Evaluación - ...` (3 rows), `Sesión de evaluación sin nota.` |
  | `1º de Grado` / starts with `1º ` or `1º -` | course 1 only | `Inicio curso: 1º de Grado Superior de FP.`, `1º - Dia de alternancia <N>.` (5 rows) |
  | `2º de Grado` / starts with `2º ` or `2º -` | course 2 only | `Inicio curso: 2º de Grado Superior de FP.`, `2º Presentación de proyectos.`, `2º - Dia de alternancia <N>.` (5 rows) |
  | `(1º)` | course 1 only | `2ª Evaluación (1º) - ...` (3 rows), `3ª Evaluación (1º) - ...` (3 rows) — no `(2º)` variant exists for 3ª evaluación |
  | `(2º)` | course 2 only | `2ª Evaluación (2º) - ...` (3 rows) |

  The masculine ordinal `º` (course token) never collides with the feminine ordinal `ª`
  (evaluación-number token, `1ª`/`2ª`/`3ª`) — distinct Unicode characters, so `1ª
  Evaluación`/`2ª Evaluación`/`3ª Evaluación` are never mistaken for a course-1/2 token.
  As of the current `key_dates` seed data: 21 of 43 rows are course-agnostic, 12 are
  course-1-only, 10 are course-2-only (see UC-06 Postconditions for the resulting
  per-course row counts).

- **A2 — "Inicio curso" / "Fin de curso" split (2026-08-10 UX fix)**: `"Inicio curso: 1º
  de Grado Superior de FP."` and `"Inicio curso: 2º de Grado Superior de FP."` are each a
  long `key_dates` range (16/09–22/06 and 16/09–27/05 respectively, both >30 days) — by
  UC-04/A1's long-range rule, `calendario-months` would otherwise color and make hoverable
  *both* boundary days of that range, showing the same `"Inicio curso: ..."` name on the
  end-of-year boundary too, which misleadingly reads as a second "start" instead of the
  end of that course's teaching period. Fix, applied after A1's course filter, same
  compute-and-substitute pattern already used for `final_exams` (UC-08) — `key_dates`
  itself is untouched: replace that one resolved entry with two single-day
  `calendario_modulo` rows —
  `"Inicio curso: <sufijo>."` (`start_date = end_date` = the range's original
  `start_date`) and `"Fin de curso: <sufijo>."` (`start_date = end_date` = the range's
  original `end_date`) — both `category = 'academic_key_dates'`, `type` copied from the
  original entry (`'Curso escolar'`, so UC-11's legend/color for both is unchanged, still
  row 1's hex — the split is a `name`/date-shape change only, not a new color-table row).
  `"Curso escolar"` itself (01/09–31/07, the generic entry whose name doesn't claim to be
  a single point in time) is **not** split — no `key_dates` entry that lacks
  `"Inicio"`/`"Fin"` in its name is affected by this rule.

### Postconditions

- Every `academic_year_modules` row for that academic year has a full, **course-filtered**
  `calendario_modulo` snapshot (or already had one): a course-1 módulo gets every
  course-agnostic and course-1-only `key_dates` entry (currently 33 rows, resolved to 34
  once the `"Inicio curso"` split of A2 turns 1 of those 33 into 2) plus 2×`E₁`
  `final_exams` rows; a course-2 módulo gets every course-agnostic and course-2-only entry
  (currently 31 rows, resolved to 32 by the same split) plus 2×`E₂` `final_exams` rows.
  `E꜀` is the number of that course's applicable `evaluations` rows whose name matches
  "`<prefix>` - Último día para poner notas." (currently `E₁` = 3, `E₂` = 2, see UC-08 —
  not hardcoded, tracks whatever `key_dates`' `evaluations` category holds at seed time,
  filtered per A1). Currently: 40 rows total for a course-1 módulo, 36 for a course-2
  módulo.

### Acceptance criteria

- [x] Saving a new academic year with N módulos generates a full, course-filtered snapshot
      (see Postconditions for the exact row-count formula) for each of the N módulos
- [x] Extending an existing academic year with an additional módulo generates a full
      snapshot for that módulo, without touching already-existing módulos' rows
- [x] Saving the same selection twice never duplicates `calendario_modulo` rows
- [x] A course-1 módulo's snapshot excludes every `key_dates` entry marked exclusively for
      course 2, and vice versa (A1)
- [x] A `key_dates` entry with no course token (e.g. `Curso escolar`, any
      `holidays`/`public_holidays`/`free_disposal_days` entry, `1ª Evaluación - ...`,
      `Sesión de evaluación sin nota.`) is included in both a course-1 and a course-2
      módulo's snapshot
- [x] A course-1 módulo's snapshot has exactly 40 rows and a course-2 módulo's has exactly
      36 rows, given the current `key_dates` seed data (Postconditions)
- [x] A módulo's snapshot contains `"Inicio curso: <sufijo>."` as a single-day row
      (`start_date = end_date`) on the course's real start day, and a separate
      `"Fin de curso: <sufijo>."` single-day row on the course's real end day (A2) — never
      one long-range row spanning both
- [x] `"Curso escolar"` is never split — it keeps covering its full `start_date`–`end_date`
      range as a single row (A2)

---

## UC-07: `calendario_modulo` is removed when a módulo is unassigned (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Valid session; the módulo being removed has a `calendario_modulo`
snapshot
**Elements**: `module-table-row-<id>-delete` (existing dynamic element,
`views/configuracion/`)

### Main flow

1. Teacher clicks a `module-table` row's "Eliminar" (`module-table-row-<id>-delete`),
   which deletes that `academic_year_modules` row (`DELETE
   /api/academic-year-modules/:id`).
2. `calendario_modulo` rows referencing that `academic_year_module_id` are removed
   automatically — `ON DELETE CASCADE`, no separate application code.

### Postconditions

- No `calendario_modulo` row references the deleted `academic_year_modules` id.

### Acceptance criteria

- [x] Deleting a módulo assignment removes every `calendario_modulo` row tied to it
- [x] Deleting a módulo assignment never removes `calendario_modulo` rows belonging to
      other módulos

---

## UC-08: `final_exams` dates are computed when `calendario_modulo` is generated (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Same as UC-06 — this is the same generation pass, not a separate
trigger.
**Elements**: `module-selection-save-button` (existing element, `views/configuracion/`),
`calendario-months` (renders the result — see UC-04)

Cross-view backend side effect, same nature as UC-06: documented here, not in Año
académico's own `use-cases.md`, because `calendario_modulo` is this view's data source.
Runs as a second step of `CalendarioModuloService.seedForModules`, after the six
`key_dates` categories are resolved to real dates for the módulo (UC-06 step 2) and
before they're inserted — so the `evaluations`/`holidays`/`public_holidays`/
`free_disposal_days` rows this step reads are that módulo's own just-resolved real
dates, not `key_dates`' day/month template.

### Main flow

1. From the módulo's just-resolved `evaluations` rows — already course-filtered per UC-06
   step 2/A1, so a course-2 módulo's batch never contains a `(1º)`-tagged row and vice
   versa — find every one whose `name` matches `"<prefix> - Último día para poner
   notas."` (e.g. `"1ª Evaluación"`, plus whichever of `"2ª Evaluación (2º)"`, `"2ª
   Evaluación (1º)"`, `"3ª Evaluación (1º)"` applies to this módulo's own course; no
   fixed count).
2. For each `<prefix>` found, build that módulo's non-working set: Saturdays, Sundays,
   and every day inside a `holidays`, `public_holidays` or `free_disposal_days` range
   already resolved for this módulo in the same pass (`academic_key_dates` is excluded —
   its ranges, e.g. "Curso escolar", are informational spans, not actual days off).
3. Compute `"<prefix> - Examen de recuperación final."` = `<prefix>`'s "Último día para
   poner notas" date − 2 business days (walking backward, skipping every non-working day
   from step 2, landing on the 2nd business day found) — **before** the grade deadline,
   confirmed with the user 2026-08-09: "Último día para poner notas" is the deadline for
   every grade, including the resit's, to already be entered, so the resit exam itself
   must conclude before it, not after.
4. Compute `"<prefix> - Examen final."` = the date from step 3 − 4 business days (walking
   backward further, same non-working set) — still earlier than the retake date.
5. Both are inserted as single-day `calendario_modulo` rows (`start_date = end_date`),
   `category = 'final_exams'`.
6. Insertion is idempotent, same natural key and `ON CONFLICT DO NOTHING` as every other
   `calendario_modulo` row (UC-06 step 4) — re-saving a selection never duplicates these
   either.

### Alternative flows

- **A1 — No matching evaluación**: a módulo's resolved `evaluations` rows contain no
  `"... - Último día para poner notas."` entry for some prefix (e.g. a future `key_dates`
  edit removes the 3ª evaluación row) — no `final_exams` pair is generated for that
  prefix; the other prefixes present are unaffected.
- **A2 — Insufficient run-up**: `[INFERENCE — verify with the user]` no minimum-distance
  validation against the start of the module's teaching period, or against earlier
  `evaluations` entries, is performed — the business-day walk always produces a date,
  even one that lands earlier than seems intended for a very compressed calendar. Flagged
  for the user to confirm this is acceptable rather than an error condition.

### Postconditions

- Every `evaluations` "Último día para poner notas" entry resolved for a módulo has a
  matching pair of `final_exams` rows in that módulo's `calendario_modulo` snapshot (see
  UC-06 Postconditions for the row-count formula).

### Acceptance criteria

- [x] For a módulo whose resolved `evaluations` include `"1ª Evaluación - Último día
      para poner notas."` on a given date, `calendario_modulo` gains
      `"1ª Evaluación - Examen de recuperación final."` 2 business days before that date
      and `"1ª Evaluación - Examen final."` a further 4 business days before that
- [x] The business-day walk skips Saturdays and Sundays
- [x] The business-day walk skips days inside that módulo's resolved `holidays`,
      `public_holidays` and `free_disposal_days` ranges
- [x] The business-day walk does **not** skip days inside `academic_key_dates` ranges
      (e.g. it may land inside "Curso escolar" — that range is informational only)
- [x] Every generated `final_exams` row has `start_date = end_date` (single day)
- [x] Re-running the generation for an already-snapshotted módulo never duplicates
      `final_exams` rows
- [x] A módulo whose resolved `evaluations` include N distinct "Último día para poner
      notas." prefixes gains exactly 2×N `final_exams` rows
- [x] A course-1 módulo never gains a `final_exams` pair derived from a `(2º)`-tagged
      evaluación, and a course-2 módulo never gains one derived from a `(1º)`-tagged
      evaluación (2026-08-10 bugfix — see UC-06/A1)

### 2026-08-12 revision — snapped to the módulo's real horario

The dates computed above (steps 3-4) are a **provisional** estimate, valid only until the
teacher has saved a weekly schedule for this módulo (Horario, UC-12) — a business day with
no `calendario_horario` row for this módulo has no class to hold an exam in. Every time
`schedule-save-button` is clicked (UC-12's `PUT /api/academic-year-modules/:id/schedule`),
right after `calendario_horario` itself is regenerated, `final_exams` is **recomputed** for
that módulo:

1. Steps 3-4 above run exactly as before (2 business days back for the resit, 4 more for
   the final — same non-working set, same chaining), landing on a candidate date.
2. If that candidate date has no `calendario_horario` row for this módulo, keep walking
   backward one calendar day at a time — no longer stepping in business-day units, just
   checking each earlier date — until landing on one that does. A `calendario_horario` row
   only ever exists on a laborable date to begin with (UC-12), so this walk can never land
   on a weekend or a holiday.
3. The resit's snapped date is used as the base for step 4's 4-business-day walk (not the
   pre-snap one), so the final exam always lands strictly before the (snapped) resit date.
4. The 2 rows are **replaced** (delete then insert, not `ON CONFLICT DO NOTHING`) — unlike
   the idempotent insert in steps 5-6 above, a recomputed date can legitimately differ from
   what was stored before, every time the teacher changes their weekly schedule.
5. If the teacher's saved schedule is entirely blank (`calendario_horario` ends up empty
   for this módulo), there's nothing to snap to — `final_exams` falls back to the plain
   business-day dates from steps 3-4, same as the pre-Horario provisional state.

### Alternative flows (2026-08-12 addition)

- **A3 — Snapped past `Inicio curso`**: `[INFERENCE — verify with the user]` if the
  backward walk in step 2 above would need to go earlier than the módulo's own `Inicio
  curso` date to find a horario day (an edge case: a very sparse or very late-starting
  weekly schedule), the walk is bounded and simply keeps the last date reached rather than
  searching indefinitely — flagged for the user to confirm this is acceptable rather than
  a validation error.

### Acceptance criteria (2026-08-12 addition)

- [x] Once `calendario_horario` has at least one row for a módulo, saving Horario
      recomputes both `final_exams` rows for every evaluación that módulo has, replacing
      (not duplicating) whatever was there before
- [x] A recomputed "Examen de recuperación final"/"Examen final" date always falls on a
      date present in that módulo's `calendario_horario`
- [x] The final exam's date is always computed from the (already snapped) resit date, never
      from the pre-snap one
- [x] Saving an all-blank schedule (empty `calendario_horario`) falls back to the plain
      business-day dates, same as before any Horario was ever saved

---

## UC-09: `calendario_evaluation_working_days` is generated when `calendario_modulo` is generated (Año académico)

**Primary actor**: Any signed-in teacher, on `/configuracion/ano-academico`
**Preconditions**: Same as UC-06/UC-08 — same generation pass, not a separate trigger.
Runs after UC-08's `final_exams` rows are computed (in the same pass), since it reuses
their dates rather than recomputing them.
**Elements**: `module-selection-save-button` (existing element, `views/configuracion/`),
`evaluation-working-days-summary` (renders the result — see UC-10)

Cross-view backend side effect, same nature as UC-06/UC-08.

### Main flow

1. For the módulo's own `course` (1 or 2, from `academic_year_modules` ->
   `catalog_modules.course`), determine which `final_exams` "Examen final" rows apply:
   - `evaluationNumber: 1` -> `"1ª Evaluación - Examen final."` (always, single variant).
   - `evaluationNumber: 2` -> `"2ª Evaluación (1º) - Examen final."` if `course = 1`, or
     `"2ª Evaluación (2º) - Examen final."` if `course = 2`.
   - `evaluationNumber: 3` -> `"3ª Evaluación (1º) - Examen final."` if `course = 1`; no
     row at all if `course = 2` (no `(2º)` variant exists in `key_dates` today — see A1).
2. Determine the módulo's course-start date: the `academic_key_dates` entry `"Inicio curso:
   1º de Grado Superior de FP."` (`course = 1`) or `"Inicio curso: 2º de Grado Superior de
   FP."` (`course = 2`) — renamed 2026-08-10 from `"1º/2º de Grado Superior de FP."`, see
   `views/fechas-senaladas/schema-changes.sql`'s migration — already resolved to a real date
   in this same pass — **not** the generic "Curso escolar" entry. As of the 2026-08-10
   "Fin de curso" split (UC-06/A2), this entry is itself already a single-day row (its
   `start_date` and `end_date` are the same real date) rather than a long range — no
   change to this step's logic, `courseStartEntry.startDate` still resolves to the same
   date it always did.
3. For each `evaluationNumber` found in step 1, count working days in the half-open range
   `[courseStartDate, examenFinalDate)` — course-start day counts if it's a working day,
   the "Examen final" day itself never counts even if it's one. Same working-day
   definition as UC-08 (Mon-Fri, excluding that módulo's resolved `holidays`/
   `public_holidays`/`free_disposal_days`, not excluding `academic_key_dates`).
4. Insert one `calendario_evaluation_working_days` row per `evaluationNumber` found:
   `academic_year_module_id`, `evaluation_number`, `working_days`.
5. Insertion is idempotent (`ON CONFLICT DO NOTHING` on `(academic_year_module_id,
   evaluation_number)`) — re-saving a selection never duplicates these either.
6. Same cascade as UC-07: deleting a módulo's `academic_year_modules` row removes its
   `calendario_evaluation_working_days` rows too (`ON DELETE CASCADE`).

### Alternative flows

- **A1 — No 3ª evaluación for this course**: a `course = 2` módulo has no `"3ª Evaluación
  (2º) - Examen final."` row to work from (doesn't exist in today's `key_dates`) — no
  `evaluationNumber: 3` row is generated for it, not a `working_days: 0` one.

### Postconditions

- Every módulo has one `calendario_evaluation_working_days` row per evaluación it has
  `final_exams` data for (2 or 3 rows, per A1).
- No `calendario_evaluation_working_days` row references a deleted
  `academic_year_modules` id.

### Acceptance criteria

- [x] A `course = 1` módulo gets rows for `evaluationNumber` 1, 2 and 3; a `course = 2`
      módulo gets rows for 1 and 2 only
- [x] `working_days` counts Mon-Fri days in `[courseStartDate, examenFinalDate)`,
      including `courseStartDate` if it's a working day, excluding `examenFinalDate`
      always
- [x] `working_days` excludes days inside that módulo's resolved `holidays`/
      `public_holidays`/`free_disposal_days` ranges
- [x] `working_days` does **not** exclude days inside `academic_key_dates` ranges
- [x] The course-start date used is `"Inicio curso: 1º de Grado Superior de FP."` or
      `"Inicio curso: 2º de Grado Superior de FP."` (matching the módulo's `course`), never
      the generic "Curso escolar" entry
- [x] Re-running the generation for an already-snapshotted módulo never duplicates
      `calendario_evaluation_working_days` rows
- [x] Deleting a módulo assignment removes every `calendario_evaluation_working_days` row
      tied to it

### 2026-08-12 revision — hours actually taught, not days available

Steps 3-4 above remain the **provisional** count, valid only until the teacher has saved a
weekly schedule for this módulo (Horario, UC-12). Every time `schedule-save-button` is
clicked, right after `calendario_horario` and the (now snapped) `final_exams` dates are
regenerated (UC-08's 2026-08-12 revision), `calendario_evaluation_working_days` is
**recomputed** with a different formula: the sum of `calendario_horario.hours` actually
scheduled in each evaluación's own period — never a day-count again, an hour-count — minus
a flat 2-hour discount per evaluación for the day spent on its own resit exam:

1. The first evaluación's period is `[Inicio curso date, día antes de su "Examen final."
   )` — half-open, same convention as the day-count version: `Inicio curso` counts if it
   has horario hours, the exam day itself never counts.
2. The second evaluación's period starts the day **after** the first evaluación's own
   "Examen final." date (not from `Inicio curso` again — unlike the day-count version,
   these are non-overlapping, sequential periods) and ends the day before the second
   evaluación's own "Examen final." date.
3. The third evaluación's period (if the módulo's course has one, A1) starts the day after
   the second evaluación's "Examen final." date and ends the day before the third's.
4. For each period, sum every `calendario_horario` row's `hours` whose `date` falls inside
   it, then subtract 2 (the day given over to that evaluación's own resit exam, which
   falls inside the same period, before its "Examen final.") — floored at 0, never
   negative.
5. Same replace-not-insert semantics as `final_exams`' 2026-08-12 revision — a changed
   weekly schedule can change every evaluación's hour count, not just add new rows.
6. If the teacher's saved schedule is entirely blank (`calendario_horario` empty for this
   módulo), there's nothing to sum — falls back to the original day-count formula (steps
   3-4 above), same provisional state as before any Horario was ever saved.

### Acceptance criteria (2026-08-12 addition)

- [x] Once `calendario_horario` has at least one row for a módulo, saving Horario
      recomputes every evaluación's `working_days` value as an hour-sum-minus-2, replacing
      (not duplicating) whatever was there before
- [x] The first evaluación's period starts at `Inicio curso`; each later evaluación's
      period starts the day after the previous evaluación's own "Examen final." date — the
      periods never overlap and never all start from `Inicio curso`
- [x] Each evaluación's count is exactly `(sum of calendario_horario.hours in its period) -
      2`, floored at 0
- [x] Saving an all-blank schedule (empty `calendario_horario`) falls back to the original
      day-count formula, same as before any Horario was ever saved

---

## UC-10: See working-days-per-evaluación summary for the selected módulo

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a módulo is selected (same precondition as UC-04)
**Elements**: `evaluation-working-days-summary`, `evaluation-working-days-1`,
`evaluation-working-days-2`, `evaluation-working-days-3`

### Main flow

1. Once a módulo is selected (initial load, or after changing `module-filter`),
   `GET /api/calendario-evaluation-working-days?academicYearModuleId=<id>` fetches that
   módulo's working-day counts (see UC-09).
2. `evaluation-working-days-summary` renders at the far right of the filters row (same row
   as `academic-year-filter-*`/`cycle-filter`/`module-filter`), one line per entry
   returned, stacked in a column, in small text that doesn't change the filters row's
   height: `"Horas lectivas 1ª evaluación: <N>"`, `"Horas lectivas 2ª evaluación: <N>"`,
   `"Horas lectivas 3ª evaluación: <N>"` (label changed 2026-08-12 — `<N>` is now a sum of
   `calendario_horario` hours, not a day count, see UC-09's 2026-08-12 revision; the
   underlying `working_days` field/table name is unchanged, only its meaning and this
   label).
3. Only lines with a real entry render — a `course = 2` módulo (no 3ª evaluación data,
   UC-09/A1) shows only two lines, not a third one reading "0".
4. Changing `module-filter` reloads this summary for the newly selected
   `academic_year_module_id`, same trigger as `calendario-months` (UC-04).

### Alternative flows

- **A1 — No data yet**: selected módulo has zero `calendario_evaluation_working_days`
  rows (assigned but selection never saved, i.e. the same state `calendario-empty-state`
  covers for `calendario-months`) — `evaluation-working-days-summary` renders nothing
  (no lines, no placeholder text), it simply isn't there.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] `evaluation-working-days-summary` sits at the far right of the filters row, in a
      column, without increasing that row's height
- [x] Each present `evaluationNumber` renders its own line, exact text `"Horas lectivas
      <N>ª evaluación: <workingDays>"` (2026-08-12 label change, see above)
- [x] A módulo with no `evaluationNumber: 3` entry renders exactly two lines, not three
- [x] Changing `module-filter` triggers a new `GET
      /api/calendario-evaluation-working-days` request and updates the rendered lines
- [x] A módulo with zero rows renders no lines at all

---

## UC-11: See the color legend for the selected módulo's calendar

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a módulo is selected (same precondition as UC-04)
**Elements**: `calendario-legend`

Replaces the earlier undocumented 3-color (red/blue/green) category scheme with one color
per `(category, type)` pair — `type` (2026-08-10, see `views/fechas-senaladas`) is now
copied into `calendario_modulo` at seed time (UC-06) instead of being dropped. The color
table below is the single source of truth `calendario-months` (UC-04) and
`calendario-legend` both read from — a day's fill and its legend entry are always the same
color by construction, never maintained as two separate lists.

### Color table (canonical order — also `calendario-legend`'s render order)

| # | category | type (or name-suffix match) | Label shown | Hex |
|---|---|---|---|---|
| 1 | `academic_key_dates` | `Curso escolar` | Curso escolar | `#2a78d6` |
| 2 | `academic_key_dates` | `Presentación de proyectos` | Presentación de proyectos | `#75a7e4` |
| 3 | `holidays` | `Vacaciones` | Vacaciones | `#eda100` |
| 4 | `public_holidays` | `Festivo nacional` | Festivo nacional | `#eb6834` |
| 5 | `public_holidays` | `Festivo autonómico` | Festivo autonómico | `#ef8961` |
| 6 | `public_holidays` | `Festivo insular (Tenerife)` | Festivo insular (Tenerife) | `#f4aa8d` |
| 7 | `public_holidays` | `Festivo local (Puerto de la Cruz)` | Festivo local (Puerto de la Cruz) | `#f7c6b2` |
| 8 | `free_disposal_days` | `Libre disposición` | Libre disposición | `#1baf7a` |
| 9 | `evaluations` | `Último dia para poner nota` | Último día para poner notas | `#e87ba4` |
| 10 | `evaluations` | `Sesión evaluación` | Sesión de evaluación | `#ee9cbb` |
| 11 | `evaluations` | `Atención familiar` | Atención familiar | `#f4bdd2` |
| 12 | `feoe_project_days` | `Día de alternancia` | Día de alternancia (FEOE) | `#4a3aa7` |
| 13 | `final_exams` | name ends `"Examen final."` | Examen final | `#008300` |
| 14 | `final_exams` | name ends `"Examen de recuperación final."` | Examen de recuperación final | `#59ae59` |

Rows 1-12 match by `(category, type)` equality against `calendario_modulo.type`; rows
13-14 (`final_exams`, which has no `type`) match by `name`'s suffix instead. A
`calendario_modulo` entry whose `(category, type)` isn't any of rows 1-12 (a custom
`key_dates` row saved with no `tipo`) doesn't get its own legend entry — `calendario-months`
falls back to that category's row-1-of-that-category hex (UC-04/A1... see UC-04's own
fallback rule), but the legend only ever lists colors that come from this fixed table.

### Main flow

1. Once `calendario-months` has data (module selected, `calendario_modulo` non-empty),
   `calendario-legend` renders directly below the filters row (same card style, its own
   row), one swatch + label per color-table row that has at least one matching entry in
   the currently loaded `calendario_modulo` response — in the table's canonical order,
   never re-sorted by frequency or alphabetically.
2. Swatches lay out horizontally (`flex flex-wrap`), wrapping onto additional lines as
   needed at narrow widths — never horizontal scroll.
3. Teacher changes `module-filter`; `calendario-legend` recomputes for the newly loaded
   entries, same trigger as `calendario-months` (UC-04).

### Alternative flows

- **A1 — Empty**: selected `academic_year_module_id` has zero `calendario_modulo` rows
  (same state `calendario-empty-state` covers for `calendario-months`, UC-04/A3) —
  `calendario-legend` renders nothing.
- **A2 — Partial coverage**: a módulo whose `calendario_modulo` rows don't include every
  color-table row (e.g. a curso-2 módulo's `evaluations` set lacks whatever produces row
  11) shows only the rows it actually has — never a placeholder swatch for an absent one.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] `calendario-legend` sits directly below the filters row, in its own horizontal,
      wrapping row (`flex flex-wrap`), never a horizontal scrollbar
- [x] `calendario-legend` shows exactly one swatch+label per color-table row that has at
      least one matching entry in the currently loaded módulo's `calendario_modulo` data
- [x] Swatches render in the color table's fixed order (table above), not re-sorted
- [x] Each swatch's color exactly matches the hex `calendario-months` uses for that same
      `(category, type)` (or, for `final_exams`, that same name-suffix) — single source of
      truth, never two independently-maintained color lists
- [x] A módulo with zero `calendario_modulo` rows renders no legend swatches at all
- [x] A módulo missing some color-table rows' data shows only the rows it has, no
      placeholder for absent ones

---

## UC-12: `calendario_horario` is generated when a módulo's weekly schedule is saved (Horario)

**Primary actor**: Any signed-in teacher, on `/configuracion/horario`
**Preconditions**: Valid session; a módulo is selected (same precondition Horario's own
UC-10 already documents in `views/configuracion/use-cases.md`)
**Elements**: `schedule-save-button` (existing element, `views/configuracion/`)

Cross-view backend side effect, not a UI flow of this screen — documented here for the
same reason UC-06 is: `calendario_horario` is this view's own data source (UC-13 below),
so its generation rule belongs to this view's spec, not Horario's own `use-cases.md`
(which doesn't change).

### Main flow

1. Teacher clicks `schedule-save-button`; the frontend sends the full current draft
   (`PUT /api/academic-year-modules/:id/schedule`, see
   `views/configuracion/api-contracts.md`'s "Horario" section — full replace, unchanged
   request/response shape).
2. Before responding, the backend reads this same módulo's own already-seeded
   `calendario_modulo` rows (UC-06 already guarantees these exist — a módulo always has
   its `calendario_modulo` snapshot before it can have a schedule, since it can only be
   selected in Horario's own filter cascade once it's assigned via Año académico) to
   derive **the module's own actual teaching-period bounds**: the single-day
   `academic_key_dates` entries named `"Inicio curso: <sufijo>."` and `"Fin de curso:
   <sufijo>."` (UC-06/A2's split, course-specific — `calendario_modulo` is already
   course-filtered at seed time per UC-06/A1, so exactly one of each exists for this
   módulo, matching its own `course`). **2026-08-12 bugfix**: the walk range is `[Inicio
   curso date, Fin de curso date]` inclusive — e.g. 16/09–22/06 for a curso-1 módulo,
   16/09–27/05 for curso-2 — **never** a fixed 1 September–30 June window (the original,
   incorrect implementation): a fixed window both starts too early (before 16/09, no
   teaching happens yet) and, for a curso-2 módulo, runs a full month past the real
   27/05 end date. Also derives the real non-working date ranges from those same
   `calendario_modulo` rows: only `holidays`/`public_holidays`/`free_disposal_days`
   entries count (`academic_key_dates` is informational, same exclusion
   `business-day.ts`'s callers already apply for UC-08/UC-09 — see A2 there).
3. Every existing `calendario_horario` row for this `academic_year_module_id` is deleted.
4. The backend walks every date in `[Inicio curso date, Fin de curso date]`; for each date
   whose weekday (Monday=1 … Friday=5) has an entry in the just-saved schedule **and** is
   laborable (`business-day.ts`'s `isLaborable`, excluding the ranges from step 2), it
   inserts one `calendario_horario` row with that weekday's `hours`.
5. Regeneration is a full replace (delete-then-reinsert), same semantics `PUT
   /api/academic-year-modules/:id/schedule` itself already has — never a partial patch,
   never duplicated across repeated identical saves.
6. **2026-08-12**: immediately after step 5, the just-computed `calendario_horario`
   entries also drive a recomputation of `final_exams` (UC-08's 2026-08-12 revision) and
   `calendario_evaluation_working_days` (UC-09's 2026-08-12 revision) for this same
   módulo, in the same request — not a separate trigger, not a separate endpoint.

### Alternative flows

- **A1 — Every weekday left blank**: the draft has zero entries — step 3's delete still
  runs, step 4 inserts nothing, leaving `calendario_horario` empty for that módulo.
- **A2 — A scheduled weekday falls on a non-working day**: e.g. a Monday with `hours`
  saved that lands inside `Vacaciones de Navidad` — no `calendario_horario` row is
  inserted for that specific date, even though the weekday pattern says "Monday has
  class"; the day's own `calendario_modulo`-driven color (Vacaciones) is unaffected
  either way.
- **A3 — Módulo unassigned**: `DELETE /api/academic-year-modules/:id` (see
  `views/configuracion/api-contracts.md`) removes the `academic_year_modules` row;
  `calendario_horario`'s `ON DELETE CASCADE` FK removes its rows for that módulo too, same
  as `calendario_modulo` already does (UC-07).
- **A4 — A scheduled weekday's date falls before `Inicio curso` or after `Fin de curso`**:
  e.g. a curso-2 módulo's `Fin de curso` is 27/05 — no `calendario_horario` row for any
  scheduled weekday's date in the last few days of May or in June, even though the
  fixed-window bug used to generate them (see this UC's 2026-08-12 bugfix note above).

### Postconditions

- `calendario_horario` for this `academic_year_module_id` contains exactly one row per
  real, laborable date within `[Inicio curso, Fin de curso]` (that módulo's own course-
  specific teaching period, not a fixed calendar window) whose weekday has an hours value
  in the just-saved schedule — never a row for a non-laborable date, never a row outside
  that period, never a row for a weekday left blank.

### Acceptance criteria

- [x] Saving a schedule with N weekdays set generates exactly one `calendario_horario` row
      per laborable date, within `[Inicio curso, Fin de curso]`, matching one of those N
      weekdays
- [x] A scheduled weekday that falls on a holiday/public-holiday/free-disposal-day date
      gets no `calendario_horario` row for that specific date (A2)
- [x] A scheduled weekday's date before `Inicio curso` or after `Fin de curso` gets no
      `calendario_horario` row (A4) — e.g. a curso-2 módulo generates no rows after 27/05
- [x] Saving an all-blank schedule leaves `calendario_horario` empty for that módulo (A1)
- [ ] Re-saving the same schedule twice never duplicates `calendario_horario` rows (full
      replace, not additive)
- [x] Saving a changed schedule (e.g. Monday removed, Wednesday added) removes the
      now-stale dates and adds the newly-scheduled ones in the same request
- [x] Deleting the módulo's `academic_year_modules` assignment removes its
      `calendario_horario` rows too (A3, cascade)

---

## UC-13: See a módulo's horario overlaid on its calendar

**Primary actor**: Any signed-in teacher, on `/calendario`
**Preconditions**: Valid session; a módulo is selected (same precondition as UC-04)
**Elements**: `calendario-months`, `calendario-day-tooltip`, `calendario-legend`

### Main flow

1. Once a módulo is selected (UC-04), `GET /api/calendario-horario?academicYearModuleId=...`
   fetches this módulo's `calendario_horario` rows, alongside the existing
   `GET /api/calendario-modulo` call.
2. Every day cell in `calendario-months` whose date is covered by a `calendario_horario`
   row shows a `#06b6d4` ring/border around its day number — layered over whatever
   `(category,type)` fill (UC-11) already covers that day, if any, never replacing it.
3. `calendario-legend` appends one extra, always-last item (`calendario-legend-item-
   horario`, label "Horario", an outlined ring swatch rather than a filled one) whenever
   the currently loaded módulo has at least one `calendario_horario` row.
4. Hovering a ringed day reveals `calendario-day-tooltip` with an added, final line
   "Horario: N horas" (N = that day's `hours`) — appended after any `calendario_modulo`
   event name(s) already listed for that day (UC-05).
5. Teacher changes `module-filter` (or the year/cycle filters); the ring/legend/tooltip
   data reloads for the newly selected módulo, same trigger UC-04/UC-11 already use.

### Alternative flows

- **A1 — Horario day with no other event**: the vast majority of school days have no
  `calendario_modulo` entry at all (only holidays/evaluations/exam days do) — a day with a
  `calendario_horario` row but no `calendario_modulo` entry shows the ring alone, on the
  day's normal (uncolored) background, and its tooltip shows only the "Horario: N horas"
  line.
- **A2 — Horario day that's also a colored event day**: a day covered by both a
  `calendario_modulo` entry and a `calendario_horario` row shows the fill color **and**
  the ring together; its tooltip lists the event name(s) first, "Horario: N horas" last.
- **A3 — Empty**: the selected módulo has zero `calendario_horario` rows (Horario never
  saved for it, or saved all-blank) — no rings anywhere on `calendario-months`, no
  `calendario-legend-item-horario`; `calendario-months`/`calendario-legend`'s own
  rendering (from `calendario_modulo`, UC-04/UC-11) is otherwise unaffected.

### Postconditions

- No data changes (read-only).

### Acceptance criteria

- [x] A day covered by a `calendario_horario` row shows a `#06b6d4` ring around its day
      number
- [x] The ring renders together with any existing `(category,type)` fill on the same day,
      never replacing it (A2)
- [x] A day with a `calendario_horario` row but no `calendario_modulo` entry still shows
      the ring, on its normal background (A1)
- [x] `calendario-legend` shows the "Horario" item, last, exactly when the selected
      módulo has at least one `calendario_horario` row
- [x] `calendario-legend` shows no "Horario" item when the selected módulo has zero
      `calendario_horario` rows, even if it has `calendario_modulo` rows (A3)
- [x] Hovering a ringed day's tooltip shows "Horario: N horas" as its last line
- [x] A day with only a `calendario_horario` row (no `calendario_modulo` entry) still
      shows a `calendario-day-tooltip` on hover, with just the "Horario: N horas" line
- [x] Changing `module-filter` reloads the ring/legend/tooltip data for the newly selected
      módulo
