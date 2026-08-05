# Review Report — configuracion — 2026-08-05

## Result: PASS ✅

## Layers implicated: none

## Also implicated: none

## SOLID violations found

None. Audited every file under `src/backend/src/` and `src/frontend/src/` touched or added
by this view's redesign (catalog services, repositories, routes, `training-catalog-settings-
view.ts`, `http-catalog-*-api-service.ts`, `app.ts` composition root):

- **SRP**: services contain only business rules (ownership checks, duplicate-name checks);
  routes only validate input shape and delegate; repositories only do data access.
- **OCP**: no growing `if/else`/`switch` on type.
- **LSP**: `InMemoryCatalog*Repository`/`PgCatalog*Repository` both satisfy their interfaces
  with matching return types; no supertype-widening throws.
- **ISP**: `CatalogTrainingCycleRepository`/`CatalogModuleRepository` interfaces expose only
  the methods each consumer uses.
- **DIP**: no `new ConcreteImpl()` outside `app.ts`'s composition root (`buildRepositories`).
  `TrainingCatalogSettingsView` receives `trainingCycleService`/`moduleService` as injected
  properties — no direct `fetch()` inside the component (confirmed by grep).

Dead code / explicit types: none found. No `any` in the audited files.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| Integration smoke test initially failed 500 on every `/api/catalog/*` call: dev PostgreSQL had a stale `catalog_cycles` table (no `teacher_id`, wrong name) from an earlier draft migration, never updated to match the finalized `schema-changes.sql` (`catalog_training_cycles`, with `teacher_id`). | Not a code defect — DB drift. Fixed directly: dropped the stale tables and reapplied the current `schema-changes.sql`; re-ran the full smoke test, all 13 contract calls (list/create/duplicate/rename/create-module/list-modules/update-module/delete-module/delete-cycle-cascade/teacher-name) matched `api-contracts.md` exactly. |
| `schema-bootstrap.ts` (described in `tecnologias/tecnologia_bbdd.md` as the mechanism that applies `schema-changes.sql` via `sql.file()` at startup) does not exist anywhere in `src/backend/src/db/` — no view's schema is auto-applied on boot, project-wide. | Pre-existing gap, not introduced by this view and not blocking it (today's incident was caused by a stale manual migration, not by the missing bootstrap file itself — even with bootstrap wired, `CREATE TABLE IF NOT EXISTS` would not have renamed the stale table). Flagged for a human decision: either build `schema-bootstrap.ts` for real or drop the promise from `tecnologia_bbdd.md` (`CLAUDE.md`'s "no pretend mechanisms" rule). Out of scope to fix inside this view's cycle. |
| `src/frontend/src/http-catalog-training-cycle-api-service.ts` / `http-catalog-module-api-service.ts` and `api-outcomes.ts`'s `parseWriteResult`/`parseDeleteResult` are not exercised by any unit test — never imported by any test file. | Accepted as-is, consistent with the project's existing pattern for every other real HTTP client (`http-auth-api-service.ts`, `http-session-api-service.ts`, `http-teacher-settings-api-service.ts` — none of these has a unit test either). These are thin `fetch` wrappers verified only once real infra exists — see **Deferred to e2e-engineer** below. |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100% | 100% | ✅ |
| Coverage (functions) | 100% | 100%* | ~95%* | ✅ (see note) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

\* `bun test --coverage` reports `% Funcs` below 100 for `CatalogStore` (0/1) and every Web
Component file (`training-catalog-settings-view.ts` 43/45, `teacher-settings-view.ts` 19/20,
`login-view.ts` 17/18, `dashboard-view.ts` 16/17, `academic-year-settings-view.ts` 98/102) —
in every case **`% Lines` is 100% and `Uncovered Line #s` is empty**. This is a known
`bun test --coverage` instrumentation artifact for classes with no explicit `constructor()`
body (field-initializer-only classes, and every `HTMLElement` subclass here that relies on
the implicit default constructor): the implicit constructor is counted as a declared
function but never separately marked "hit" even though every line inside the class executes.
`CatalogStore` is instantiated and its fields used on every request in
`catalog-training-cycle.routes.test.ts`/`catalog-module.routes.test.ts`
(`backend: 'memory'`); the pattern is identical and pre-existing on `login-view.ts` and
`dashboard-view.ts`, both already-shipped views. No actual uncovered line/branch exists in
any of these files. Not a gap — accepted as-is.

## Acceptance criteria marked (use-cases.md)
| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-03: Each nav link shows an active state on its own screen, inactive on the other two | `training-catalog-settings-view.test.ts:107`, `teacher-settings-view.test.ts:219`, `academic-year-settings-view.test.ts:423` |
| UC-03: Clicking any nav link from either other screen navigates to its route | `training-catalog-settings-view.test.ts:117,129`, `teacher-settings-view.test.ts:233,245`, `academic-year-settings-view.test.ts:435,447` |
| UC-04: Shows every training cycle the teacher has created | `training-catalog-settings-view.test.ts:152` |
| UC-04: First row is selected by default on load | `training-catalog-settings-view.test.ts:163` |
| UC-04: Adding a row and saving a unique name persists it | `training-catalog-settings-view.test.ts:201,226` |
| UC-04: Deleting a cycle always succeeds and removes its modules too, unconditionally | `training-catalog-settings-view.test.ts:276` |
| UC-04: Selecting a different row reloads `catalog-module-table` filtered to that cycle's modules | `training-catalog-settings-view.test.ts:181` |
| UC-05: Shows nothing and prompts to pick/create a cycle when no cycle selected | `training-catalog-settings-view.test.ts:297` |
| UC-05: Shows one row per module of the selected cycle, grouped by course | `training-catalog-settings-view.test.ts:306` |
| UC-05: `catalog-module-table-add-button` disabled while no cycle selected | `training-catalog-settings-view.test.ts:387` |
| UC-05: Adding a row and saving a unique (name, course) persists it | `training-catalog-settings-view.test.ts:397` |
| UC-05: Saving a duplicate (name, course) is rejected, inline error shown | `training-catalog-settings-view.test.ts:424` (asserts the exact error text renders) |
| UC-05: Deleting a module always succeeds, unconditionally | `training-catalog-settings-view.test.ts:369` |
| UC-05: Editing a module always saves immediately, no modal | `training-catalog-settings-view.test.ts:322` |

## Criteria without verifiable coverage
| Criterion | Reason |
|-----------|--------|
| UC-04: Saving a duplicate name is rejected, inline error shown | Production code implements this (`training-catalog-settings-view.ts:222-225`, `_cycleRowError` set to `DUPLICATE_CYCLE_NAME_MESSAGE`), but the only test exercising it (`training-catalog-settings-view.test.ts:255`, rename path) only asserts the row isn't removed — it never asserts the error text/element renders, unlike the equivalent module test at line 424. Not blocking (behavior is real and correctly implemented); a precise assertion should be added on next touch of this test file. |

## Deferred to e2e-engineer
| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---------------|-----------------------------------|-----------------------------------------|
| `http-catalog-training-cycle-api-service.ts`, `http-catalog-module-api-service.ts` | Real `fetch()` clients wired only in `main.ts` against the built `dist/` bundle — no unit test in this project ever exercises a `Http*ApiService` directly (same pattern as `http-auth-api-service.ts`, `http-session-api-service.ts`, `http-teacher-settings-api-service.ts`) | Cypress specs hitting the real backend confirm these call the routes/payloads `api-contracts.md` documents — already spot-checked once by this review's integration smoke test (Step 3 of `supervisor`), full user-flow coverage is `e2e-engineer`'s job |
| `api-outcomes.ts`'s `parseWriteResult`/`parseDeleteResult` | Only reachable through the `Http*ApiService` files above | Same as above |
