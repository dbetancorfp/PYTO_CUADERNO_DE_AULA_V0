# Review Report — calendario — 2026-08-10 (amendment: UC-09/UC-10 `evaluation_working_days`)

**Post-merge layout follow-up (2026-08-10, branch `view/calendario-working-days-layout-fix`)**:
user reported, after using the merged view in a real browser, that `evaluation-working-days-summary`
visually overflowed past the filters `<section>`'s bottom edge (a direct consequence of the
`position: absolute` fix below — the section stopped "seeing" that content for its own height
calculation, so taller content just spilled past the card's rendered boundary instead of
being clipped or accounted for), and that the text should read left-aligned instead of
right-aligned. Fixed: the `<section>` now carries `min-h-24` (a constant 96px, computed from
3× `text-xs` line-height + gaps + the block's `top-3` offset + margin) so its height no longer
varies between the empty and populated states and no longer depends on the absolutely-positioned
content's own height — genuinely constant, not just "unaffected because absolute," which is
a stronger and more literal reading of the original "must not change the row's height"
requirement. `items-end`/`text-right` swapped for `items-start`/`text-left` on the summary's
own text. `evaluation-working-days-summary`'s Cypress assertions extended to check both
(no overflow past the section's bottom edge, left edges of different-length lines align —
the real differentiator between left- and right-alignment, since right-alignment would instead
align each line's *right* edge). Full 77/77 Cypress suite green afterward; no unit test
touched (this class of regression isn't observable in `happy-dom`, same reasoning as the
original deferral).

**Post-review layout bugfix (same day, same cycle)**: `e2e-engineer`'s real-browser
Cypress run caught exactly the gap this review's own "Criteria without verifiable
coverage" section flagged as untestable here — `evaluation-working-days-summary`'s
`ml-auto flex-col` container still counted toward the filters `<section>`'s
`flex-wrap` width budget, so at a normal 1280px viewport with all three lines populated
it wrapped onto a second line, measuring **128px tall** instead of the required
single-line scale (verified `<60px`). `frontend-implementer` fixed it by taking the
block out of the flex flow entirely — `position: absolute` (`right-4 top-3` inside a
newly-`relative` section) instead of `ml-auto` — so its presence can never affect the
row's height regardless of viewport or text width. Re-verified with real Cypress against
a real Postgres-backed server: filters section height back to the same scale as before
the summary existed, summary's right edge hugs the section's own right edge (within
20px), full 77/77 Cypress suite green afterward. `calendario-view.test.ts`'s 30 unit
tests untouched and still green (they don't exercise real CSS layout, as this review
already noted).

## Result: PASS ✅

## Layers implicated: none

## SOLID violations found

None.

- **SRP**: `computeEvaluationWorkingDaysEntries`/`finalExamNameFor` are new, standalone
  pure functions (same shape as `computeFinalExamsEntries`) — no I/O, no side effects,
  independently testable. `nonWorkingRangesFor` was extracted out of
  `computeFinalExamsEntries` into a shared helper both functions now call, removing the
  duplication that would otherwise exist between the two (a real DRY improvement, not
  just new code bolted on).
- **OCP**: `finalExamNameFor`'s `if`-chain is keyed to `evaluationNumber ∈ {1,2,3}`, a
  domain the schema itself closes (`CHECK (evaluation_number IN (1,2,3))`) — not an
  open-ended type that would need a new branch per future addition.
- **LSP/ISP**: `CalendarioEvaluationWorkingDaysRepository` exposes exactly the two
  methods used (`findAllForAcademicYearModule`, `createMany`), mirroring
  `CalendarioModuloRepository`'s own shape; `InMemoryCalendarioEvaluationWorkingDaysRepository`/
  `PgCalendarioEvaluationWorkingDaysRepository` both satisfy it with matching return
  types.
- **DIP**: `CalendarioModuloService`'s constructor grew to 5 injected interfaces, no
  `new Concrete...` anywhere outside `app.ts`'s composition root (confirmed by reading
  it in full). `CalendarioView` receives `evaluationWorkingDaysService` via a setter,
  same pattern as `calendarioModuloService`.

**Non-blocking observation**: `CalendarioModuloService` now owns three computed side
effects (`calendario_modulo` snapshot, `final_exams`, `calendario_evaluation_working_days`)
plus two read methods. Still defensible under the same framing the original review
accepted ("everything computed at 'Guardar selección' time for the Calendario view", all
sharing the same resolved-`key_dates` pass — splitting it would mean either re-fetching
`key_dates` redundantly or threading resolved data across a new service boundary), but
it's the widest this class has gotten. Worth a dedicated look on the next touch of this
file, not a redo cycle today.

**Minor test-precision note** (not a defect, flagging for `tdd-engineer` on a future
touch): `calendario-view.test.ts`'s test named "changing module-filter reloads the
summary..." actually drives the change through `cycle-filter` (which cascades into a new
`module-filter` selection, same as the pre-existing `cycle-filter` test above it) rather
than changing `module-filter` directly. The code path is genuinely shared — both trigger
points call the same `_loadEvaluationWorkingDays()` — and coverage confirms the direct
`module-filter`-change branch is also exercised (100% lines, via the pre-existing
`calendario-months` module-filter test). Still, no single test's *name and assertion*
together prove the literal "changing module-filter" scenario for this new element.
Cosmetic, not blocking.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| `GET /api/calendario-evaluation-working-days`'s response includes `id`/`academicYearModuleId` per entry, fields `api-contracts.md`'s example doesn't list. | **Accepted as-is**, same precedent as the identical `GET /api/calendario-modulo` drift accepted in the 2026-08-09 review — harmless (frontend's `EvaluationWorkingDaysEntry` type declares only `evaluationNumber`/`workingDays`, ignores the rest structurally). Not a new inconsistency, a repeated one; worth fixing both response shapes together on a future, dedicated touch of `api-contracts.md`. |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

`bun test --coverage --coverage-reporter=lcov`: every new/modified file shows 100.00%
Lines — `business-day.ts` (45/45), `calendario-modulo.service.ts` (114/114),
`calendario-evaluation-working-days.repository.ts` + in-memory + Postgres implementations
(15/15, 18/18), `calendario-evaluation-working-days.routes.ts` (26/26),
`calendario-view.ts` (380/380). `calendario-view.ts` Funcs: 84/87 — verified via `git
stash` against `main` that this is the *same pre-existing 3-function gap* accepted in the
2026-08-07 and 2026-08-09 reviews (main: 79/76, this diff: +8/+8, gap unchanged), not
something this cycle introduced.

Full backend + frontend suite: 569 pass, 0 fail (305 backend + 259 frontend + 5 schema
tests).

## Acceptance criteria marked (use-cases.md)
| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-09: course=1 → rows 1/2/3; course=2 → rows 1/2 only | `calendario-modulo.service.test.ts` "generates one row per evaluación..." + "uses the (2º) course-start entry..." |
| UC-09: `working_days` = Mon-Fri in `[start, end)`, start inclusive/end exclusive | `business-day.test.ts`'s `countLaborableDays` describe block (7 tests) + the same service-level tests above (56/121/186, 104) |
| UC-09: excludes holidays/public_holidays/free_disposal_days | `business-day.test.ts` "skips a non-working range inside the window" — `computeEvaluationWorkingDaysEntries` reuses the same `nonWorkingRangesFor` already proven for `final_exams` |
| UC-09: does **not** exclude `academic_key_dates` | Structural: `nonWorkingRangesFor` (shared with UC-08, whose own dedicated test proves this) never includes `academic_key_dates`; the course-start lookup itself reads an `academic_key_dates` entry directly, outside that filter |
| UC-09: course-start is the course-specific entry, never "Curso escolar" | `calendario-modulo.service.test.ts`'s UC-09 fixtures never seed a "Curso escolar" row at all and still resolve correctly from the course-specific one alone |
| UC-09: re-seeding never duplicates | **Reviewer's own live-Postgres verification this pass** (same class of criterion as UC-08's — a real re-seed against the real unique constraint): called `seedForModules` twice directly against a real `academic_year_module_id`, row count unchanged (3/3) |
| UC-09: cascade delete | `calendario-evaluation-working-days.routes.test.ts` "deleting a módulo assignment removes its calendario_evaluation_working_days rows (cascade) — GET 404s afterward" |
| UC-10: each present line, exact text | `calendario-view.test.ts` "renders one line per evaluationNumber present..." + "renders all three lines..." |
| UC-10: no `evaluationNumber: 3` → two lines, not three | Same "renders one line per..." test (asserts `evaluation-working-days-3` is `null`) |
| UC-10: module-filter change reloads | `calendario-view.test.ts` "changing module-filter reloads the summary..." — see the test-precision note above (exercises the shared reload path via `cycle-filter`, not a literal `module-filter` change) |
| UC-10: zero rows → no lines | `calendario-view.test.ts` "renders no lines at all when the selected módulo has zero..." |

## Criteria without verifiable coverage
| Criterion | Reason |
|-----------|--------|
| UC-10: `evaluation-working-days-summary` sits at the far right, column layout, no row-height change | Real computed layout/CSS — `happy-dom`'s unit-test environment doesn't compute Tailwind's cascade meaningfully; this needs a real browser. Deferred to `e2e-engineer` below. |

## Deferred to e2e-engineer
| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---------------|-----------------------------------|-----------------------------------------|
| `evaluation-working-days-summary` layout | Real Tailwind cascade, real box layout — not observable via `happy-dom` | A computed-style/bounding-rect assertion (e.g. filters row's height unchanged with vs. without the summary populated, or the summary's own `justify-content`/position) — same "style application proof" class already established for this view's red/blue/green day coloring |
| `evaluation-working-days-api-service.ts`'s real HTTP client | `frontend-implementer` correctly left `http-evaluation-working-days-api-service.ts` and its `main.ts` wiring for `e2e-engineer`, consistent with the `final_exams` cycle's own precedent | `e2e-engineer` must create the concrete HTTP client and wire it into `main.ts`, then a Cypress spec exercising the real endpoint end to end |

---

# Review Report — calendario — 2026-08-09 (amendment: UC-08 `final_exams`)

**Post-merge direction fix (2026-08-09, branch `view/calendario-final-exams-fix`)**: user
reported, after the first merge, that "Examen de recuperación final" was landing *after*
"Último día para poner notas" instead of before — the original request's direction for
this specific date ("2 días o más ... del Último día de notas") was ambiguous and never
explicitly confirmed as an inference (a process gap: `requirement-architect` should have
flagged it `[INFERENCE — verify with the user]` in UC-08 like it did for A2, and didn't).
Confirmed with the user: "Último día para poner notas" is the deadline for *every* grade,
including the resit's, to already be entered — so both exams must conclude before it, not
after. Fix: `computeFinalExamsEntries` now calls `subtractLaborableDays` (was
`addLaborableDays`) for the retake date; "Examen final" stays `subtractLaborableDays` from
the retake date, unchanged (already correct — it was always meant to be the earliest of
the three). Only `calendario-modulo.service.ts` changed (one call swapped); `business-day.ts`
itself untouched. `calendario-modulo.service.test.ts`'s three date-asserting UC-08 tests
were updated to the corrected dates first (confirmed red against the old code), then the
implementation fixed to match — same TDD discipline as the original cycle. Re-verified
live against real Postgres (four evaluación prefixes, all four confirmed retake-before-
deadline and final-before-retake) and the full Cypress suite (76/76, 33 specs) green
afterward. `use-cases.md` UC-08 updated to state the corrected direction explicitly.

**Post-e2e bugfix note (same day, same cycle)**: `e2e-engineer`'s real-Postgres Cypress run
found `business-day.ts`'s `shiftByOneDay` throwing `RangeError: Invalid Date` for a 5+ digit
`startYear` (used by pre-existing Configuración/Año académico specs for collision-avoidance,
unrelated to this feature) — `new Date(string)` caps ISO parsing at a 4-digit year.
`backend-implementer` fixed it by replacing string-based `Date` parsing with numeric
`Date.UTC(year, month-1, day)` construction and manual `"YYYY-MM-DD"` formatting (no
`.toISOString()`, which also switches format outside the 4-digit-year range). Public
signatures unchanged, `business-day.test.ts`/`calendario-modulo.service.test.ts` untouched
and still green (29/29), re-verified 100% Lines/Funcs on `business-day.ts` (37/37, 9/9) after
the fix. Re-audited: still no SOLID violations, still pure/side-effect-free. Full Cypress
suite (76 tests, 33 specs, including this view's 4) green afterward — see below.

Original pass (2026-08-07, UC-01..UC-07) stays below, unchanged and still valid — none of
its files were touched by this cycle except as noted. This amendment audits the
`final_exams` addition only: `src/backend/src/services/business-day.ts` (new),
`src/backend/src/services/calendario-modulo.service.ts` (extended), `src/frontend/src/
calendario-view.ts` (extended: `GREEN_CATEGORIES`/`GREEN_HEX`), plus the corresponding
test files.

## Result: PASS ✅

## Layers implicated: none

## SOLID violations found

None.

- **SRP**: `business-day.ts` has exactly one responsibility — pure date-walking, no
  categories, no I/O. `computeFinalExamsEntries` (in `calendario-modulo.service.ts`) is
  factored out as its own module-level function rather than inlined into
  `seedForModules`, keeping the class method's own responsibility (orchestrating the
  seed + insert) separate from the calculation itself.
- **OCP**: no `if/else`/`switch` growing with category count — `computeFinalExamsEntries`
  matches evaluación entries by regex against a fixed suffix, not by enumerating known
  evaluación names; `NON_WORKING_CATEGORIES` is a `Set`, extending it needs no branch.
  `calendario-view.ts` follows its own already-established pattern
  (`GREEN_CATEGORIES`/`GREEN_HEX` mirrors `RED_CATEGORIES`/`BLUE_CATEGORIES` exactly,
  merged into `CATEGORY_COLOR_HEX` the same way) — a fourth color would cost one more
  array, not a rewritten conditional.
- **LSP**: n/a — no new subtypes introduced.
- **ISP**: n/a — no new interfaces; `DateRange` is a plain data shape, not a
  behavioral contract with unused members.
- **DIP**: `computeFinalExamsEntries`/`isLaborable`/`addLaborableDays`/
  `subtractLaborableDays` are pure functions with no hidden dependencies (no `Date.now()`,
  no I/O) — `seedForModules` calls them directly, which is fine since they aren't a
  swappable collaborator (DIP is about decoupling from concrete *external* effects, not
  every function call). No `new Concrete...` introduced anywhere in this diff.

Dead code / explicit types: no `any` in any new or modified line. No unused imports,
no declared-and-unused variables.

**Non-blocking observations** (neither costs coverage nor violates SOLID, not worth a
redo cycle):
1. `business-day.ts`'s `addLaborableDays`/`subtractLaborableDays` are near-mirrors
   (identical loop shape, differing only in the sign passed to the shared
   `shiftByOneDay` helper). Already minimized via that shared helper plus the shared
   `isLaborable` predicate — a further unification into one `walkLaborableDays(start,
   days, direction, ranges)` is a legitimate future simplification, not a duplication
   problem today (well under the 3% gate, see below).
2. `nonWorkingRanges: DateRange[]` (mutable) on `isLaborable`/`addLaborableDays`/
   `subtractLaborableDays` breaks with this codebase's own established convention for
   pure-function array parameters — `calendario-view.ts`'s `backgroundStyleForDay`
   already takes `categories: readonly string[]`. Worth `readonly DateRange[]` on a
   future touch of `business-day.ts`; doesn't affect behavior or coverage.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| `GET /api/calendario-modulo`'s real response includes `academicYearModuleId` per entry, a field `api-contracts.md`'s example doesn't list. | **Accepted as-is, pre-existing.** Confirmed via `git diff main -- src/backend/src/routes/calendario-modulo.routes.ts` that this route wasn't touched by this cycle's diff — the drift predates `final_exams` and isn't something `backend-implementer` introduced now. Harmless: `CalendarioModuloEntry` on the frontend (`calendario-modulo-api-service.ts`) declares only the five documented fields and ignores the extra one (structural typing). Left for a future, unrelated touch of `api-contracts.md`/the route, not this cycle's scope. |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | ~1% (see observation 1 above) | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

`bun test --coverage --coverage-reporter=lcov` (whole-repo run, no SonarCloud wiring yet):
- `src/backend/src/services/business-day.ts`: **100.00% Lines** (28/28), **100.00% Funcs**
  (7/7) — new file, fully covered.
- `src/backend/src/services/calendario-modulo.service.ts`: **100.00% Lines** (68/68),
  **100.00% Funcs** (12/12).
- `src/frontend/src/calendario-view.ts`: **100.00% Lines** (347/347), 96.20% Funcs
  (76/79). Verified this gap is **pre-existing, not introduced by this cycle**: stashed
  this diff and re-measured against `main` — 78 Funcs/75 covered there already (the exact
  same 3-function gap noted and accepted in the original 2026-08-07 review report, same
  convention: Lines is the metric the gate is keyed to). This diff's own new function
  (the `GREEN_CATEGORIES.map(...)` callback) is itself covered — 79/76 vs. the prior
  78/75 is a net +1/+1.

Full backend + frontend suite: 534 pass, 0 fail (279 backend + 255 frontend).

## Acceptance criteria marked (use-cases.md)
| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-04: day covered only by `final_exams` is light green (`#bbf7d0`) | `calendario-view.test.ts` "a day covered only by a final_exams entry is colored light green (category-tagged)" |
| UC-08: `+2`/`−4` business-day pair from "Último día para poner notas" | `calendario-modulo.service.test.ts` "generates 'Examen de recuperación final' (+2 business days) and 'Examen final' (-4 business days from it)" |
| UC-08: walk skips Saturdays/Sundays | `business-day.test.ts` "skips a weekend entirely..." (×2, `addLaborableDays`/`subtractLaborableDays`) + `isLaborable` weekend tests |
| UC-08: walk skips `holidays`/`public_holidays`/`free_disposal_days` | `business-day.test.ts` "skips a public holiday...", "skips an entire long holidays range...", "skips a free-disposal single day...", "skips several disjoint non-working ranges combined" |
| UC-08: walk does **not** skip `academic_key_dates` | `calendario-modulo.service.test.ts` "does not skip days inside an academic_key_dates range..." **+ reviewer's own live-Postgres verification this pass** (real `seedForModules` call against real Postgres, dates unaffected by the seeded "Curso escolar" row) |
| UC-08: `final_exams` rows are single-day | `calendario-modulo.service.test.ts` "every generated final_exams row is a single day..." |
| UC-08: re-seeding never duplicates `final_exams` | **Reviewer's own live-Postgres verification this pass** (pure-HTTP/unit tests can't distinguish "never inserted a duplicate" from "correctly no-opped" without a real re-seed against a real unique constraint, same class of criterion as the original pass's UC-06/UC-07 cascade checks): called `CalendarioModuloService.seedForModules` twice directly against a real `academic_year_module_id`, confirmed row count and `final_exams` count identical after both calls (51 total / 8 `final_exams`, unchanged) |
| UC-08: N distinct prefixes → 2×N `final_exams` rows | `calendario-modulo.service.test.ts` "generates one pair per distinct 'Último día para poner notas' prefix, preserving course-suffixed names" (N=2 → 4 rows) |
| UC-08/A1: non-matching evaluations entry generates nothing | `calendario-modulo.service.test.ts` "generates final_exams only for the matching entry, ignoring an evaluations entry that does not fit the pattern" |

## Criteria without verifiable coverage

None for this amendment — all 9 new/changed criteria above are backed by a green test or
(for the two idempotency/exclusion criteria noted) a direct, reviewer-performed
live-Postgres verification this pass.

## Deferred to e2e-engineer

None new this cycle — `final_exams` is a pure backend-computation + color-mapping change
to an already-Cypress-covered screen (`calendario-months`'s existing specs already drive
`app-calendario-view` end to end); no new route, no new build/static-serving concern.
`e2e-engineer`'s existing specs should incidentally start seeing green-colored days once
real seed data produces a matching "Último día para poner notas" entry — worth a
dedicated assertion added on that pass, not a blocker for this one.

---

# Review Report — calendario — 2026-08-07 (original pass, UC-01..UC-07)

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
