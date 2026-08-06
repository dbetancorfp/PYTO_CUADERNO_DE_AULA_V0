# Review Report — configuracion (Año académico) — 2026-08-06

## Result: PASS ✅

## Layers implicated: none

## Also implicated: none

## 2026-08-06 update

The 2026-08-05 gap below was closed: `tdd-engineer` added the 4 tests it specified
(`academic-year.routes.test.ts` × 3, `academic-year-settings-view.test.ts` × 1 for
`_cancelAdding`), all green, 100% coverage reached on both files.

`supervisor`'s re-run integration smoke test then found a **new** real bug those tests
incidentally exposed: every `:id`-taking route under `/api/academic-years` and
`/api/academic-year-modules` responded `500` (Postgres `22P02`, "invalid input syntax for
type uuid") instead of the `404` `api-contracts.md` documents, whenever `:id` wasn't a
syntactically valid UUID — invisible to the unit suite because it runs against
`DATA_BACKEND=memory` (a `Map`, tolerant of any string key). `backend-implementer` fixed it
with a shared `router.param('id', requireValidUuidParam)` middleware
(`src/backend/src/routes/require-valid-uuid.ts`) on both routers — verified live against
real Postgres: all five previously-500 calls now 404, a well-formed-but-nonexistent UUID
still 404s via the pre-existing service-null-check path, and the full create/delete flow
still works end-to-end. `supervisor` re-ran clean (`Layers implicated: none`).

That fix has a side effect on coverage: the existing tests' `"unknown-id"` fixture (not a
valid UUID) now gets intercepted by the new middleware *before* reaching each route
handler's own `service-returned-null → 404` branch, so those branches — real, necessary,
still correctly-working code (confirmed live above) — now have zero test coverage. This is
the same `requires-tdd-engineer` situation as 2026-08-05, one layer over: the fix is
correct, only the test fixtures need a second, well-formed-but-nonexistent UUID case added
alongside the existing malformed-id case (which now legitimately covers the middleware
itself, not wasted). See the updated **Coverage gap** table below.

That second gap is now also closed: `tdd-engineer` added the 5 well-formed-nonexistent-UUID
tests it specified, `supervisor` re-confirmed both unit suites and the live integration
smoke test pass, and coverage is now **100.00%** on both `src/backend/src/` and
`src/frontend/src/` (`bun test --coverage --coverage-reporter=lcov`, aggregated across all
files, not just this view's). Result: **PASS**.

## SOLID violations found

None. Audited every file under `src/backend/src/` and `src/frontend/src/` touched or added
by the Año académico redesign:

- **SRP**: `AcademicYearService` contains only academic-year business rules (ownership via
  `teacherId`, duplicate-`startYear` checks, `HAS_DEPENDENTS` check) — no HTTP, no SQL, no
  presentation. `academic-year.routes.ts`/`academic-year-module.routes.ts` only validate
  input shape and delegate. Repositories only do data access.
- **OCP**: no growing `if/else`/`switch` on type anywhere audited.
- **LSP**: `InMemoryAcademicYear*Repository`/`PgAcademicYear*Repository` both satisfy their
  interfaces with matching return types; no supertype-widening throws.
- **ISP**: `AcademicYearRepository`/`AcademicYearModuleRepository` expose only the methods
  their consumers use (`catalogModuleRepository` is injected into `AcademicYearService`
  read-only, for existence checks only — no write method used).
- **DIP**: no `new Http*`/`new Pg*`/`new InMemory*` outside `app.ts`'s composition root
  (`buildRepositories`) confirmed by grep. `AcademicYearSettingsView` receives
  `academicYearService`/`catalogCycleService`/`catalogModuleService` as injected properties
  — no direct `fetch()` inside the component. `toast.ts`'s `ToastController`/`renderToast`
  are plain, dependency-free functions/classes — correctly **not** a second custom element
  (would nest a second Shadow DOM inside `app-academic-year-settings-view`, forbidden by
  `CLAUDE.md`'s Web Components rules).

Dead code / explicit types: none found. No `any` in the audited files.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| Deleted three orphaned frontend test files (`training-cycle-management.test.ts`, `module-management.test.ts`, `module-selection.test.ts`) that tested the OLD academic-year-settings-view.ts contract (creating catalog cycles/modules from this screen). | Accepted. That behavior was explicitly removed by the user's approved redesign (confirmed answer: "Desaparece, solo seleccionar" in the Phase A clarification round) — the old tests exercised a contract that no longer exists and could not coexist with the new one on the same component. Correctly treated as dead test artifacts, not tests to rewrite. |
| `ui-spec.json`'s `academic-year-toast` note says "Implemented as its own Web Component"; frontend-implementer built a plain shared render function + state class (`ToastController`/`renderToast`) instead. | Accepted — the implementation is correct and `ui-spec.json`'s note is what's stale. A second custom element nested inside `app-academic-year-settings-view`'s Shadow DOM would violate `CLAUDE.md`'s explicit "no nested Shadow DOM" rule; the approved RED test (`toast.test.ts`) already specified the plain-function contract, not a custom element. `ui-spec.json`'s stray note should be corrected on next touch of that file so it doesn't mislead a future reader — non-blocking. |
| `module-selection-table` accumulates módulos across every checked cycle, not just the most recently checked one — inferred from `api-contracts.md`'s "every checked cycle × checked módulo" wording. | Accepted. Matches `api-contracts.md`'s `POST /api/academic-years/selection` request description literally, and UC-07's "check one or several cycles" main-flow step. Correct reading, not an overreach. |
| `training-cycle-table` pre-checks and disables already-assigned módulos when extending an existing year, though no RED test exercised it directly. | Accepted as implemented — this is UC-07's explicit acceptance criterion ("Extending an existing year pre-checks and disables that year's already-assigned módulos"). Verified in code (`_startExtendYear` populates `_alreadyAssignedModuleIds` from `_yearModules`) and confirmed correct, but flagged below under **Criteria without verifiable coverage** since no test proves it — see Step 6b. |
| `src/frontend/cypress/e2e/uc-06-manage-academic-years.cy.ts` untouched, still describes the old local-state design. | Correctly out of scope for `backend-implementer`/`frontend-implementer` — this is `e2e-engineer`'s file, next pipeline step. Not a reviewer concern. |
| 2026-08-06: `supervisor`'s re-run integration smoke test found every `:id`-taking academic-year/academic-year-module route 500ing on a malformed id instead of 404ing (Postgres `22P02`), invisible to `DATA_BACKEND=memory` unit tests. Routed to `backend-implementer` as `Layers implicated: backend` (free supervisor-triggered redo, no cycle cost). | Resolved — `requireValidUuidParam` middleware added, verified live against real Postgres (all 5 routes now 404 correctly, well-formed-nonexistent-UUID and full create/delete flow both still correct). Same defect independently confirmed present in already-merged `catalog` routes (`PATCH /api/catalog/training-cycles/unknown-id` also 500s) — explicitly out of scope for this cycle since that view already shipped to `main`; flagged here for a human to decide whether it warrants its own fix-only view/PR later. |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

`academic-year-store.ts` reports 0% Funcs / 100% Lines in `bun test --coverage`'s function
metric — a known instrumentation artifact for implicit-constructor, field-initializer-only
classes (already documented and accepted for `catalog-store.ts` in this view's prior review
pass; every line executes via `academic-year.routes.test.ts`'s `backend: 'memory'` runs).
Not a real gap; the gate's line-coverage number (which SonarCloud's actual threshold uses)
is unaffected and at 100%.

### Coverage gap (the reason for FAIL) — 2026-08-06, post-UUID-middleware-fix

The 2026-08-05 gap (4 items) was closed by `tdd-engineer` and confirmed green. The
`requireValidUuidParam` fix that followed opened a new, narrower one:

| File | Uncovered | What it is |
|------|-----------|------------|
| `src/backend/src/routes/academic-year.routes.ts` | lines 55-56 | `GET /:id/modules` → `service.listModules` returned `null` (well-formed UUID, not owned by this teacher) |
| `src/backend/src/routes/academic-year.routes.ts` | lines 70-71 | `POST /:id/modules` → `service.extendSelection` returned `null` |
| `src/backend/src/routes/academic-year.routes.ts` | lines 92-93 | `PATCH /:id` → `service.update` returned `null` |
| `src/backend/src/routes/academic-year.routes.ts` | lines 101-102 | `DELETE /:id` → `service.delete` returned `null` |
| `src/backend/src/routes/academic-year-module.routes.ts` | lines 22-23 | `DELETE /:id` → `service.removeModule` returned `null` |

Applying the mockability check: all five are real, still-necessary, correctly-working code
— verified live against real Postgres with a well-formed-but-nonexistent UUID during this
cycle's `supervisor` re-run (all five returned `404` as documented). They're only uncovered
because every existing test exercising these routes' "not found" case uses the literal
string `"unknown-id"`, which is not a valid UUID — since `requireValidUuidParam` (new this
cycle) now intercepts that before the handler's own `service`-returned-`null` branch ever
runs. Not `backend-implementer`'s gap: the implementation is correct, confirmed live; the
gap is purely that no test exists using a syntactically-valid-but-nonexistent UUID for
these five cases.

**Tests to add** (precise enough to hand to `tdd-engineer` directly, no further
investigation needed — add alongside the existing `"unknown-id"` tests, don't replace
them, since those now correctly cover `requireValidUuidParam`'s malformed-id branch):
1. `academic-year.routes.test.ts`: `GET /api/academic-years/:id/modules` responds 404 for
   a well-formed UUID that doesn't match any academic year (e.g.
   `00000000-0000-0000-0000-000000000000`).
2. `academic-year.routes.test.ts`: `POST /api/academic-years/:id/modules` responds 404 for
   a well-formed UUID that doesn't match any academic year.
3. `academic-year.routes.test.ts`: `PATCH /api/academic-years/:id` responds 404 for a
   well-formed UUID that doesn't match any academic year.
4. `academic-year.routes.test.ts`: `DELETE /api/academic-years/:id` responds 404 for a
   well-formed UUID that doesn't match any academic year.
5. `academic-year-module.routes.test.ts` (or add to `academic-year.routes.test.ts` if that's
   where the existing `DELETE /api/academic-year-modules/:id` 404 test already lives):
   `DELETE /api/academic-year-modules/:id` responds 404 for a well-formed UUID that doesn't
   match any `academic_year_modules` row.

The 2026-08-05 gap items (now closed, kept here for history):
1. ~~`GET /api/academic-years/:id/modules` responds 404 for an unknown id~~ — done, now
   superseded by item 1 above (needs the well-formed-UUID variant too).
2. ~~`PATCH /api/academic-years/:id` responds 400 for non-integer `startYear`~~ — done,
   still green, unaffected by the UUID middleware (400 checks run before the `:id` lookup
   ever needs the middleware... actually `router.param` runs before the handler body, but
   this case's body-shape check is independent of the `:id` value and still exercised
   normally with a real created id).
3. ~~`PATCH /api/academic-years/:id` responds 400 for non-boolean `isCurrent`~~ — done, same
   as above.
4. ~~`_cancelAdding()` while in adding mode~~ — done, still green, no interaction with the
   backend fix.

## Acceptance criteria marked (use-cases.md)

Re-verified against `use-cases.md`'s exact wording (not paraphrased) before marking —
each row below cites the test whose *assertion*, not just executed line, proves the
criterion.

| Criterion (use-cases.md wording) | Test that verifies it |
|-----------|------------------------|
| UC-06: "Shows one row per `academic_years` row owned by the signed-in teacher" | `academic-year-settings-view.test.ts` "shows every academic year, displayed as..." |
| UC-06: "Displays a row's start year as `"<start_year>-<start_year+1>"`" | `academic-year-settings-view.test.ts` "shows every academic year, displayed as..." |
| UC-06: "Renaming a row to a start year that already exists...is rejected: `academic-year-toast` shown, row stays in edit mode" | `academic-year-settings-view.test.ts` "row Editar with a duplicate start year shows academic-year-toast and keeps the row editable" |
| UC-06: "Marking a different row current un-marks the previous one" | `academic-year.routes.test.ts` "PATCH /api/academic-years/:id marks a row current, unmarking the previously current one" (real HTTP, two rows, asserts both final states) |
| UC-06: "Deleting a row with assigned módulos is rejected: `academic-year-toast` names the block..." | `academic-year-settings-view.test.ts` "row Eliminar blocked by assigned módulos shows academic-year-toast and the row stays" |
| UC-06: "Deleting a row with no assigned módulos succeeds" | `academic-year-settings-view.test.ts` "row Eliminar with no módulos assigned removes the row" |
| UC-06: "Selecting a row reloads `training-cycle-table` and `module-table` from that year's assigned módulos" | `academic-year-settings-view.test.ts` "selecting a row loads its assigned módulos and reloads training-cycle-table/module-table" + UC-07's "selecting a row in normal mode filters module-table to that cycle" (module-table half) |
| UC-07: "Normal mode shows only cycles with ≥1 módulo assigned to the selected academic year" | `academic-year-settings-view.test.ts` "normal mode shows only cycles derived from the selected year's assigned módulos" |
| UC-07: "Adding mode shows every cycle in `catalog_cycles`, each with a checkbox" | `academic-year-settings-view.test.ts` "clicking it switches training-cycle-table to show every catalog cycle with a checkbox" |
| UC-07: "Selecting a row in normal mode reloads `module-table` filtered to that cycle" | `academic-year-settings-view.test.ts` "selecting a row in normal mode filters module-table to that cycle" |
| UC-07: "Checking a row in adding mode reloads `module-selection-table` with that cycle's `catalog_modules`" | `academic-year-settings-view.test.ts` "checking a cycle in adding mode loads its módulos into module-selection-table" |
| UC-07: "`training-cycle-table-add-cycle-button` is hidden unless an existing academic year is selected in normal mode" | `academic-year-settings-view.test.ts` "is hidden when no academic year is selected" + "clicking it, with an existing year selected, switches to adding mode..." (implicitly proves visible/clickable once a year is selected) |
| UC-08: "Is hidden while adding mode is active" | `academic-year-settings-view.test.ts` "is hidden while adding mode is active" |
| UC-08: "Quitar on a row removes it from `academic_year_modules` and the table immediately" | `academic-year-settings-view.test.ts` "Quitar removes the assignment via academicYearService.removeModule" |
| UC-09: "Is hidden in normal mode" | `academic-year-settings-view.test.ts` both "is hidden in normal mode" tests (`module-selection-table`, `module-selection-save-button`) |
| UC-09: "Toggling a checkbox doesn't persist anything by itself" | `academic-year-settings-view.test.ts` "toggling a checkbox does not persist anything by itself" |
| UC-09: "New-year flow: a click persists the draft year and every checked cycle/módulo, then shows `module-selection-save-message`" | `academic-year-settings-view.test.ts` "new-year flow: click persists the draft year and every checked módulo via createWithSelection" |
| UC-09: "New-year flow: a duplicate start year on save shows `academic-year-toast` and keeps adding mode open" | `academic-year-settings-view.test.ts` "new-year flow: a duplicate start year shows academic-year-toast and keeps adding mode open" |
| UC-09: "Extend-existing flow: a click adds only the newly-checked módulos to the already-selected year, then shows `module-selection-save-message`" | `academic-year-settings-view.test.ts` "extend-existing flow: click adds only the newly-checked módulos via extendSelection" |
| `academic-year-toast`: shows on duplicate/blocked-delete, auto-dismiss, manual dismiss, replace-not-stack | `toast.test.ts` (full `ToastController`/`renderToast` suite) |

Also now covered (2026-08-06, previously undocumented): UC-06's A5 "Cancel while adding"
alternative flow (not a separate numbered acceptance-criteria box, but exercised by
`academic-year-settings-view.test.ts` "discards the draft row and in-progress selection,
returning to normal mode"), and the malformed/well-formed-nonexistent-id 404 contract for
every academic-year/academic-year-module route (`academic-year.routes.test.ts`, 10 cases
across both id shapes).

## Criteria without verifiable coverage

Re-audited independently this pass, not just carried over from 2026-08-05 — three
additional gaps found beyond what that pass listed. None of these block the Quality Gate
(the underlying lines execute via other tests; the specific claim in each criterion just
isn't what's being asserted) and none are infrastructure-blocked, so they're not deferred
to `e2e-engineer` either — they're real, addressable gaps in test *design*, left for a
future touch of this view rather than blocking this cycle over acceptance-criteria
completeness (the Quality Gate, not this table, gates `Result`).

| Criterion | Reason |
|-----------|--------|
| UC-07: "Extending an existing year pre-checks and disables that year's already-assigned módulos in `module-selection-table`" | Implemented correctly (verified by reading `_startExtendYear`), but no test asserts the checkbox's `checked`/`disabled` DOM state for an already-assigned módulo in extend mode. |
| UC-07 A1: "Unchecking a cycle in adding mode discards its checked módulos from the in-progress selection" | Implemented (`_toggleCycleChecked`'s `checked === false` branch), but no test unchecks a previously-checked cycle and asserts its módulos are dropped from the selection. |
| UC-08: "Shows this teacher's assigned módulos of the selected cycle, grouped by curso" | Grouping-by-course rendering exists (`academic-year-settings-view.ts` course-header rows), but every test fixture uses a single course (`course: 1`) — no test asserts a second course-header row appears for a two-course cycle. |
| UC-08: "Removing a cycle's last módulo makes that cycle disappear from `training-cycle-table`" | Implemented via the same `training-cycle-table` derivation used elsewhere, but no test removes a cycle's only assigned módulo and asserts the cycle's row is gone from `training-cycle-table`. |
| UC-09: "On success, returns to normal mode with the affected academic year selected" | Both save-flow tests assert the service call and the success message, but neither asserts post-save `_mode`/selection state (e.g. that `module-selection-table` becomes hidden again, or which year row is selected). |

## Deferred to e2e-engineer
| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---------------|-----------------------------------|-----------------------------------------|
| `http-academic-year-api-service.ts` | Real `fetch()` client wired only in `main.ts` against the built `dist/` bundle — same established pattern as every other `Http*ApiService` in this project (already spot-checked once this cycle by `supervisor`'s integration smoke test against a real Postgres-backed server, matching `api-contracts.md` exactly) | Cypress specs hitting the real backend — `e2e-engineer`'s job, including rewriting `uc-06-manage-academic-years.cy.ts`, which still describes the old local-state design |
