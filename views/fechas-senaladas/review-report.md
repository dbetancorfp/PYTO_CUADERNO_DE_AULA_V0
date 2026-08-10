# Review Report — fechas-senaladas — 2026-08-10 (amendment: tipo on all categories, 2 renames)

## Result: PASS ✅

## Layers implicated: none

## SOLID violations found

None. Diff is minimal by design: 5 boolean flips (`hasType: false → true`) in
`key-date-settings-view.ts`'s already-data-driven `CATEGORIES` array (no new code path —
the header/`<td>`/edit-`<input>` for tipo were already conditioned on `catDef.hasType`,
added when `public_holidays` was implemented; a seventh category tomorrow would cost one
more array entry, same OCP shape already in place), one string literal changed in
`calendario-modulo.service.ts`'s `computeEvaluationWorkingDaysEntries` (`courseStartName`),
and a wholesale data replacement in `seed-key-dates.ts`'s six seed arrays (structure
untouched — `KeyDateSeed` interface, `singleDay()`, `SEED`, `seedKeyDates()` all
unchanged). No new classes, no new interfaces, no new branches.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| None raised — supervisor's smoke test explicitly re-verified UC-09 (calendario's working-days feature) still resolves the renamed `academic_key_dates` entries correctly against real Postgres, since that cross-view dependency was the main risk in this change. | N/A |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

`seed-key-dates.ts` (75/75), `calendario-modulo.service.ts` (114/114),
`key-date-settings-view.ts` (282/282) — all 100% lines, no gap introduced (the `hasType`
branch itself was already fully covered before this change, just exercised with different
data now). Full suite: 575 pass (backend+frontend), 0 fail.

**Migration re-run verified idempotent**: reapplied `views/fechas-senaladas/schema-changes.sql`
against the real dev DB a second time this pass — same `UPDATE 1` per statement, row count
unchanged (43), `SELECT count(*) FROM key_dates WHERE type IS NULL` still 0.

## Acceptance criteria marked (use-cases.md)

UC-02/03/05/06/07's new tipo-column criteria (left unmarked by `requirement-architect`
since no test existed yet) — now backed:

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-02/03/05/06/07: table shows tipo column | `key-date-settings-view.test.ts`'s shared per-category loop, `"${tableId} shows one row per key_dates row in its category"` (now asserts tipo text when `cat.hasType`, true for all 6) |
| UC-02/03/05/06/07: saving persists tipo, optional | `key-date-settings-view.test.ts`, `"saving the draft row in ${tableId} sends the typed tipo"` (new, one per category) |
| UC-02/03/05/06/07: Editar includes tipo input | Same shared `catDef.hasType`-gated markup already proven by the pre-existing `public-holidays-table` Editar test; structurally identical for all 6 (same `<input data-element-id="${tableId}-row-${id}-type">` pattern) — no per-category Editar-tipo test was added since the render path is unconditionally shared, not category-specific logic |
| seed-key-dates: 2 renames | `seed-key-dates.test.ts` "renames the two course-start academic_key_dates entries..." |
| seed-key-dates: type populated on all 43 rows | `seed-key-dates.test.ts` "populates type for every category..." |
| seed-key-dates: anomaly row corrected | `seed-key-dates.test.ts` "corrects the '1ª Evaluación - Atención familiar.' row's type..." |
| calendario UC-09 still resolves course-start after rename | `calendario-modulo.service.test.ts`'s UC-09 tests (fixtures updated to new name) + **reviewer's own/supervisor's live-Postgres verification**: real `seedForModules` flow against real renamed data, `working_days` computed correctly (50/100/160 for a real módulo) |

## Criteria without verifiable coverage

None for this amendment.

## Deferred to e2e-engineer

None new — no new route, no new build/static-serving concern, no new visual layout (the
tipo column already existed structurally for `public_holidays`; the other 5 tables now
render the same already-styled column, not a new visual pattern).

**e2e-engineer follow-up (2026-08-10)**: extended `uc-02-manage-fechas-clave-fp.cy.ts`
(added a real-Postgres check that the 2 renamed rows render as "Inicio curso: ..." plus
tipo add/edit) and `uc-03-manage-vacaciones.cy.ts`/`uc-05-manage-dias-libre-disposicion.cy.ts`
(tipo add/edit for one more range and one more single-day category — covering exactly
the "Editar…tipo" gap this report's SOLID section already noted wasn't independently
proven at the unit level). Fixed a stale assertion in `uc-05`'s old spec that asserted the
tipo input `should('not.exist')` — would have failed against the real updated component.
Full Cypress suite: 78/78 green, 34 specs, real Postgres.

---

# Review Report — fechas-senaladas — 2026-08-07

## Result: FAIL ❌ (cycle 1) → tdd-engineer exception applied, see addendum below

## Layers implicated: requires-tdd-engineer

## Also implicated: none

## SOLID violations found

None. Audited every file under `src/backend/src/` and `src/frontend/src/` added by this
view:

- **SRP**: `KeyDateService` contains only business rules (natural-key duplicate check,
  not-found handling) — no HTTP, no SQL. `key-date.routes.ts` only validates input shape and
  delegates. Repositories only do data access. `KeyDateSettingsView` separates event
  delegation, row persistence, and rendering into distinct method groups.
- **OCP**: `KeyDateSettingsView` drives all six category tables from one `CATEGORIES: readonly
  CategoryDef[]` array plus a `Map<category, CategoryState>` — a seventh category would only
  mean adding one more `CategoryDef` entry, no new code path, no growing `if/else` on type.
  No `switch`/`if-else` chain on category anywhere in the implementation.
- **LSP**: `InMemoryKeyDateRepository`/`PgKeyDateRepository` both satisfy `KeyDateRepository`
  with matching return types; no supertype-widening throws.
- **ISP**: `KeyDateRepository` exposes only the methods `KeyDateService` actually uses.
- **DIP**: no `new Http*`/`new Pg*`/`new InMemory*` outside `app.ts`'s composition root
  (confirmed by grep). `KeyDateSettingsView` receives `sessionService`/`keyDateService` as
  injected properties — no direct `fetch()` inside the component.

Dead code / explicit types: none found. No `any` in the audited files.

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| None — supervisor's pass reported `Layers implicated: none` with no additional notes (per-layer tests + live integration smoke test against real Postgres both passed cleanly, including malformed-`:id` → 404 via `requireValidUuidParam`, reused correctly by the new router). | N/A |

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 99.3%* | 100.00% | ❌ (backend only) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

\* `bun test --coverage --coverage-reporter=lcov`, aggregated across the whole backend, not
just this view's files.

### Coverage gap (the reason for FAIL)

| File | Uncovered | What it is |
|------|-----------|------------|
| `src/backend/src/routes/key-date.routes.ts` | lines 104-105 | `PATCH /:id` → 400 branch when the body fails `updateSchema` (Zod) validation |
| `src/backend/src/routes/key-date.routes.ts` | lines 109-110 | `PATCH /:id` → 400 branch when `startDay` is present without `startMonth` (or vice versa) |
| `src/backend/src/routes/key-date.routes.ts` | lines 113-114 | `PATCH /:id` → 400 branch when `endDay` is present without `endMonth` (or vice versa) |
| `src/backend/src/routes/key-date.routes.ts` | lines 121-122 | `PATCH /:id` → 400 branch when `endDay`/`endMonth` don't form a real day-in-month (the existing RED test only covers this for `startDay`/`startMonth`, not `end`) |

Applying the mockability check: all four are real, production-necessary branches reachable
by real client input (a malformed PATCH body; a partial day/month pair; an invalid `end`
date on an edit) — not leftover code. `backend-implementer` went beyond what the RED tests
specified here, adding a `startDay`/`startMonth` (and `endDay`/`endMonth`) "must be provided
together" check the original `tdd-engineer` pass didn't anticipate, plus the `end` half of
the real-day-in-month check for `PATCH` specifically (the `POST` equivalent, which checks
both `start` and `end`, is fully covered — `key-date.routes.test.ts`'s existing `POST
...responds 400 when endDay/endMonth is not a real day-in-month (31/04)` test proves the
helper function itself works; what's missing is only the `PATCH` path exercising it). This is
exactly the `requires-tdd-engineer` exception: real code, no test, not
`backend-implementer`'s gap to close (writing tests is out of scope for Phase B).

**Tests to add** (precise enough to hand to `tdd-engineer` directly, no further
investigation needed — add to `src/backend/tests/key-date.routes.test.ts`):
1. `PATCH /api/key-dates/:id` responds 400 when the body fails schema validation (e.g.
   `{"name": 123}` — wrong type).
2. `PATCH /api/key-dates/:id` responds 400 when `startDay` is present without `startMonth`.
3. `PATCH /api/key-dates/:id` responds 400 when `endDay` is present without `endMonth`.
4. `PATCH /api/key-dates/:id` responds 400 when `endDay`/`endMonth` don't form a real
   day-in-month (e.g. `endDay: 31, endMonth: 4`).

## Acceptance criteria marked (use-cases.md)
| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-01: `key-dates-nav-link` active/inactive styling and navigation | `key-date-settings-view.test.ts` "key-dates-nav-link is active..." |
| UC-01: `back-to-dashboard-link` navigates to `/dashboard` | `key-date-settings-view.test.ts` "clicking back-to-dashboard-link..." |
| UC-02..UC-07 (per category, ×6): empty state | `key-date-settings-view.test.ts` "`<tableId>` shows an empty state..." (generated per category) |
| UC-02..UC-07: shows one row per category | `key-date-settings-view.test.ts` "`<tableId>` shows one row per key_dates row..." |
| UC-02..UC-07: add-button opens draft row | `key-date-settings-view.test.ts` "clicking `<addButtonId>` opens a blank..." |
| UC-02..UC-07: saving a valid draft persists | `key-date-settings-view.test.ts` "saving the draft row with a valid nombre and fecha..." |
| UC-02..UC-07 A2: invalid date (31/02) shows inline error, no submit | `key-date-settings-view.test.ts` "saving the draft row with an invalid date (31/02)..." |
| UC-02..UC-07 A3: Editar switches to inline inputs | `key-date-settings-view.test.ts` "clicking a row's Editar..." |
| UC-02..UC-07 A4: Eliminar deletes unconditionally | `key-date-settings-view.test.ts` "clicking a row's Eliminar..." |
| UC-02/03/06 (range categories): displays `"DD/MM – DD/MM"` | `key-date-settings-view.test.ts` "displays a row's date as..." (`holidays-table`) |
| UC-04 A5/UC-04: shows/edits `tipo` | `key-date-settings-view.test.ts` "public-holidays-table — tipo" describe block, both tests |
| UC-05/UC-07 (single-day categories): single `fecha` field, no `fecha-fin` | `key-date-settings-view.test.ts` "free-disposal-days-table — single-day category" describe block |
| Backend: `GET /api/key-dates` contract (all categories, filter, invalid category) | `key-date.routes.test.ts`, `key-date.service.test.ts` |
| Backend: `POST /api/key-dates` contract (all six categories accepted, validation, duplicate) | `key-date.routes.test.ts` |
| Backend: `PATCH /api/key-dates/:id` main flow (rename), 404, duplicate-on-edit | `key-date.routes.test.ts` |
| Backend: `DELETE /api/key-dates/:id` unconditional, 404 | `key-date.routes.test.ts` |
| Backend: `key_dates_natural_key_idx` mapping, row→domain shape | `pg-key-date.repository.test.ts` |
| Backend: seed data — 43 rows, exact per-category counts, idempotent | `seed-key-dates.test.ts` |
| Global rule: seeded automatically on every `DATA_BACKEND=postgres` boot | Verified live by `supervisor` this cycle (43 rows appeared from a cold boot with no prior data) — not a `bun test` case (infra-level, matches how `seed-catalog-curriculum.ts` was verified) |

## Criteria without verifiable coverage
| Criterion | Reason |
|-----------|--------|
| UC-02/03/06: "Duplicate (category, nombre, fecha inicio)" A1 shown as inline error on the row | Implemented (`DUPLICATE_NAME_MESSAGE` in `key-date-settings-view.ts`, wired to `result.outcome === 'duplicate-name'`) and covered end-to-end at the backend level (`key-date.routes.test.ts`'s 409 tests), but no frontend unit test drives a `create`/`update` fake to `outcome: 'duplicate-name'` and asserts the inline message renders. Real, working code (verified by reading it), just no dedicated frontend test — add one alongside the `requires-tdd-engineer` pass above if convenient, though it's frontend-side, not part of this FAIL's blocking gap. |

## Deferred to e2e-engineer
| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---------------|-----------------------------------|-----------------------------------------|
| `http-key-date-api-service.ts` | Real `fetch()` client, wired only in `main.ts` against the built `dist/` bundle — same established pattern as every other `Http*ApiService` in this project (already spot-checked this cycle by `supervisor`'s integration smoke test against a real Postgres-backed server, matching `api-contracts.md` exactly, including the malformed-`:id` → 404 path) | Cypress specs for the six category tables — `e2e-engineer`'s job, next pipeline step |

## Addendum — cycle 1 → tdd-engineer exception (2026-08-07)

`tdd-engineer` was re-invoked mid-Phase-B (formal `requires-tdd-engineer` exception, no
human checkpoint) and added the 4 missing tests to `src/backend/tests/key-date.routes.test.ts`:

1. `PATCH /api/key-dates/:id responds 400 when the body fails schema validation`
2. `PATCH /api/key-dates/:id responds 400 when startDay is provided without startMonth`
3. `PATCH /api/key-dates/:id responds 400 when endDay is provided without endMonth`
4. `PATCH /api/key-dates/:id responds 400 when endDay/endMonth is not a real day-in-month (31/04)`

All 4 passed immediately (the implementation was already correct — only the test was
missing), no `backend-implementer` changes needed.

Re-verified:
- `bun run type-check` → 0 errors
- `bun test --coverage` → 404 pass, 0 fail, `src/backend/src/routes/key-date.routes.ts` now
  **100.00% / 100.00%** (Funcs/Lines)
- `src/frontend/src/key-date-settings-view.ts` re-checked: 94.87% *function* coverage but
  **100.00% line coverage** — the SonarCloud gate in this project's table above is line
  coverage, so this was already passing; the 94.87% figure is one untested arrow-function
  branch (the `duplicate-name` inline-error path, see "Criteria without verifiable coverage"
  above), not a line-coverage gap. No frontend change required.

Backend coverage gap: **closed**. Cycle 1 complete.

## Result (cycle 2): PASS ✅
## Layers implicated (cycle 2): none
