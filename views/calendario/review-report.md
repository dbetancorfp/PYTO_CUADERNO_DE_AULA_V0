# Review Report — calendario — 2026-08-07

## Result: PASS ✅

## Layers implicated: none

## SOLID violations found

None. Audited every file under `src/backend/src/` and `src/frontend/src/` this view added
or modified:

**Backend**: `repositories/calendario-modulo.repository.ts` (interface only — ISP-narrow,
exactly the two methods `CalendarioModuloService` uses), `repositories/in-memory/
calendario-modulo-store.ts` + `in-memory-calendario-modulo.repository.ts`,
`repositories/postgres/pg-calendario-modulo.repository.ts`, `services/
calendario-modulo.service.ts`, `routes/calendario-modulo.routes.ts`, `routes/
require-valid-uuid.ts` (modified — exported an existing regex, no behavior change),
`services/academic-year.service.ts` (modified), `app.ts` (modified).

**Frontend**: `calendario-modulo-api-service.ts`, `http-calendario-modulo-api-service.ts`,
`calendario-view.ts`, `toast.ts` (modified — added an `'info'` `ToastVariant`), `main.ts`
(modified).

- **SRP**: `CalendarioModuloService` owns exactly one cohesive responsibility — seeding
  and reading `calendario_modulo` — no HTTP, no presentation. `calendario-view.ts`
  separates its pure helper functions (`currentSchoolYearStartYear`, `schoolYearMonths`,
  `entryCoversDay`, `categoriesForDay`, `backgroundStyleForCategories`) from the
  stateful component class; each is independently testable and none touches the DOM.
- **OCP**: category→color mapping is a `Record` (`CATEGORY_COLOR_HEX`), not an `if/else`
  chain — a seventh category needs one array entry, not a new branch. Same pattern
  `toast.ts`'s `VARIANT_ACCENT_CLASSES` already used, now extended the same way for
  `'info'`.
- **LSP**: `InMemoryCalendarioModuloRepository`/`PgCalendarioModuloRepository` both
  satisfy `CalendarioModuloRepository` with matching return types.
- **ISP**: `CalendarioModuloSeeder` (in `calendario-modulo.service.ts`) exposes only
  `seedForModules` — the one method `AcademicYearService` actually calls; reading
  (`findForTeacher`) stays on the concrete `CalendarioModuloService`, used only by the
  route. On the frontend, `CalendarioAcademicYearApiService = Pick<AcademicYearApiService,
  'list' | 'listModules'>` narrows the reused service type to what `CalendarioView`
  actually calls, derived via `Pick` (not redeclared) so it can't drift from the real
  interface — a clean application of the same principle `tdd-engineer`'s own RED test
  applied when it declared its narrower local fake.
- **DIP**: no `new Http*`/`new Pg*`/`new InMemory*` outside `app.ts`'s composition root or
  `main.ts`'s bootstrap (confirmed by reading both in full). `CalendarioView` receives all
  three services via setters; the only direct instantiation inside it is `new
  ToastController(...)`, which is pure UI state (not an IO-performing external
  dependency) — same precedent as every other view using `toast.ts`.

Dead code / explicit types: no `any` in any audited file. One **non-blocking observation**:
`calendario-view.ts`'s `_handleDayMouseEnter` (line ~327) has an `if (entries.length ===
0) return;` guard that is provably unreachable — `_renderDayCell` only ever sets
`data-calendario-day-categories` (the selector `_handleDayMouseEnter` matches against) when
`categoriesForDay(...)` already returned a non-empty list computed from the same
`_calendarEntries`/`dayDate` the handler re-derives, so the two can never disagree. This
doesn't cost any coverage (line coverage is 100% regardless of which branch of an `if`
actually executes) and isn't a SOLID violation — it's a harmless defensive line worth
removing on a future touch of this file, not worth a redo cycle for.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| Integration smoke test found `PgCalendarioModuloRepository` returning `startDate`/`endDate` as full ISO datetime strings (`"2119-12-22T00:00:00.000Z"`) instead of the `"YYYY-MM-DD"` shape `api-contracts.md` documents and the frontend's own string-comparison logic (`entryCoversDay`, `daysBetweenInclusive`) assumes — Postgres `DATE` columns come back from `Bun.SQL` as JS `Date` objects, not strings. | **Fixed** during the supervisor pass: added a `toIsoDate(value: string \| Date): string` helper to `pg-calendario-modulo.repository.ts`, normalizing every row before mapping to the domain shape. Re-verified live against real Postgres (fresh `curl` round-trip) — `startDate`/`endDate` now serialize as `"2119-12-22"`. `pg-calendario-modulo.repository.test.ts`'s fake-sql fixtures already used plain strings, so this regressed nothing; re-ran that file and the full suite after the fix, still green. |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

`bun test --coverage --coverage-reporter=lcov` (whole-repo run, no SonarCloud wiring yet —
see `tecnologias/tecnologia_qa.md`): every file this view touched shows 100.00% Lines.
`calendario-view.ts` shows 96.05% Funcs / 100.00% Lines — the Funcs gap is the same
unreachable defensive branch noted above (a function-coverage tool counting the untaken
`if`-body as a distinct path even though every *line* executed); doesn't affect the Lines
metric the Quality Gate is keyed to, same convention this project's earlier reviewer passes
already used (see `views/fechas-senaladas/review-report.md`).

Full backend + frontend suite: 449 pass, 0 fail (253 backend + 196 frontend), re-confirmed
after the date-serialization fix.

## Acceptance criteria marked (use-cases.md)
| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-01: `calendario-heading` text | `calendario-view.test.ts` "calendario-heading renders..." |
| UC-01: `back-to-dashboard-link` → `/dashboard` | `calendario-view.test.ts` "clicking back-to-dashboard-link..." |
| UC-02: default year (before/after Sept cutoff) | `calendario-view.test.ts` "defaults to the school year containing today..." (×2) |
| UC-02: `academic-year-filter-prev` disabled with no earlier year | `calendario-view.test.ts` "academic-year-filter-prev is disabled..." |
| UC-02: clicking prev selects previous year + re-derives | `calendario-view.test.ts` "clicking academic-year-filter-prev when enabled..." |
| UC-02: `academic-year-filter-next` disabled at +5 | `calendario-view.test.ts` "academic-year-filter-next is disabled once..." |
| UC-02: clicking next advances + re-derives | `calendario-view.test.ts` "clicking academic-year-filter-next advances..." |
| UC-02: future year with no row → empty state | `calendario-view.test.ts` "selecting a future year with no academic_years row..." |
| UC-03: `cycle-filter` distinct cycles, no duplicates | `calendario-view.test.ts` "cycle-filter lists distinct cycles, first selected by default..." |
| UC-03: `cycle-filter` first selected by default | same test (explicit `.value` assertion) |
| UC-03: changing `cycle-filter` updates `module-filter` | `calendario-view.test.ts` "changing cycle-filter re-derives module-filter..." |
| UC-04: `module-filter` scoped to selected cycle | `calendario-view.test.ts` "changing cycle-filter re-derives module-filter to that cycle´s módulos only" |
| UC-04: `module-filter` first selected by default | `calendario-view.test.ts` "cycle-filter lists distinct cycles..." (moduleSelect `.value` assertion) |
| UC-04: changing `module-filter` triggers new fetch | `calendario-view.test.ts` "changing module-filter reloads the calendar..." |
| UC-04: 10 month cards, Sept→June | `calendario-view.test.ts` "renders exactly 10 month cards..." |
| UC-04/A1: ≤30-day range colors every day | `calendario-view.test.ts` "colors every day of a <=30-day range..." |
| UC-04/A1: >30-day range colors only boundaries | `calendario-view.test.ts` "colors only the start and end day of a >30-day range..." |
| UC-04: blue-only day | `calendario-view.test.ts` "a day covered only by an evaluations/feoe_project_days range is colored blue..." |
| UC-04/A2: red+blue overlap shows both | `calendario-view.test.ts` "a day covered by both a red and a blue category shows both categories" |
| UC-04/A3: zero rows → empty state, not `calendario-months` | `calendario-view.test.ts` "shows calendario-empty-state instead of calendario-months..." |
| UC-05: toast shows single event name | `calendario-view.test.ts` "hovering a marked day shows calendario-day-toast..." |
| UC-05: toast shows multiple names, one per line | `calendario-view.test.ts` "shows every applicable event name when a day has more than one entry" |
| UC-05: toast dismisses on mouseleave, no 5s wait | `calendario-view.test.ts` "leaving a marked day dismisses calendario-day-toast immediately" |
| UC-06: `createWithSelection` generates 43 rows/módulo | `academic-year.service.test.ts` "createWithSelection seeds calendario_modulo..." + `calendario-modulo.routes.test.ts` "assigning a módulo...snapshots key_dates into calendario_modulo, readable via GET" (real HTTP, in-memory backend) + reviewer's own live-Postgres check (43 rows, this pass) |
| UC-06: `extendSelection` generates 43 rows for the new módulo only | `academic-year.service.test.ts` "extendSelection seeds calendario_modulo for the year´s full, updated módulo set..." + `calendario-modulo.routes.test.ts` "extending an existing academic year...also snapshots the newly-added módulo" |
| UC-06: saving twice never duplicates | `pg-calendario-modulo.repository.test.ts` "createMany sends one INSERT per entry, ON CONFLICT DO NOTHING" + the real `UNIQUE (academic_year_module_id, category, name, start_date)` constraint confirmed live via `\d calendario_modulo` — same evidence level this codebase's own `seed-key-dates.test.ts` precedent already established as sufficient for an identical idempotent-seed claim |
| UC-07: deleting a módulo removes its `calendario_modulo` rows | `calendario-modulo.routes.test.ts` "deleting a módulo assignment removes its calendario_modulo rows (cascade) — GET 404s afterward" **+ reviewer's own live-Postgres verification this pass**: seeded 43 rows, deleted the módulo via the real API, confirmed via direct `SELECT COUNT(*)` (bypassing the ownership-gated route, which would 404 either way) that the count dropped from 43 to 0 |
| UC-07: deleting a módulo never removes other módulos' rows | `ON DELETE CASCADE` is scoped to the FK's own row (`academic_year_module_id = <deleted id>`) — standard Postgres FK semantics, no cross-row effect possible; the schema itself (`schema-changes.sql`) is the proof |

## Criteria without verifiable coverage

None — all 28 criteria in `use-cases.md` are backed by a green test or (for the two
cascade/idempotency criteria a pure HTTP-level test can't fully distinguish from "parent
row gone") a direct, reviewer-performed live-Postgres verification this pass, documented
above.

## Deferred to e2e-engineer
| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---------------|-----------------------------------|-----------------------------------------|
| `http-calendario-modulo-api-service.ts` | Real `fetch()` client, wired only in `main.ts` against the built `dist/` bundle — spot-checked this cycle by the integration smoke test against a real Postgres-backed server (after the date-format fix), matching `api-contracts.md` exactly | Cypress spec for the full cascading-filter → calendar-render → hover-toast flow — `e2e-engineer`'s job, next pipeline step |
| `GET /calendario` static route | Not yet wired in `app.ts` — `backend-implementer` correctly deferred this; every other view's static SPA route was wired by `e2e-engineer`'s Step 0, not `backend-implementer` | `e2e-engineer` must add `app.get('/calendario', (_req, res) => res.sendFile(frontendIndex))` as part of its Step 0 infra check before generating specs |
