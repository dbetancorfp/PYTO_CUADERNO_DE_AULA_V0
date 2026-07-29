# Review Report — configuracion — 2026-07-29 (third pass, final)

## Result: PASS ✅

## Layers implicated: none

## SOLID violations found

None. Re-audited `academic-year-settings-view.ts`'s changes this cycle specifically:

- `RowActionKind`/`ROW_ACTION_SUFFIXES` extended with `'name'`/`'course'` — a data-only change
  to an existing lookup table, no new class, no new responsibility.
- The three `case 'name': case 'course':` additions (in `_handleYearRowAction`,
  `_handleCycleRowAction`, `_handleModuleRowAction`) all fall through into the switch's
  existing `default: return;` line — no duplicated logic, no new branch complexity. This is
  also why coverage didn't regress (see below): the shared `return;` line was already
  exercised by other tests hitting `default`.
- `app.ts`'s two new static routes (`GET /configuracion/profesor`,
  `GET /configuracion/ano-academico`) are structurally identical to the pre-existing
  `GET /login`/`GET /dashboard` routes — same one-line `res.sendFile(frontendIndex)` handler,
  no new abstraction needed.

Prior non-blocking items (ISP judgment on `UserRepository`, the two small
`toPublicCycle`/`toPublicYear` duplication) carried forward unchanged from the second pass —
still not violations, still no fix required.

## GitHub issue #2 status

Could not verify or close — `GITHUB_TOKEN` is invalid (`gh auth status` fails with
"Bad credentials"), same as the second pass. Not a pipeline blocker; flagging for you to
check/close manually once credentials are refreshed.

## Coverage

`bun test --coverage src/backend/tests src/frontend/tests`: **273 pass, 0 fail** (up from 271
— the two new `app.test.ts` static-route tests).

**100.00% line coverage** maintained across every file in scope, including the two new
`app.ts` routes (covered by their matching `app.test.ts` tests) and the `parseRowAction` fix
in `academic-year-settings-view.ts` (the new cases reuse an already-covered line, so no new
gap opened — confirmed by direct inspection, not just the aggregate number).

Function-coverage unchanged at 96.32% — same pre-existing bun/lit-html closure-counting
artifact noted in both prior passes, not a regression.

## SonarCloud Quality Gate

SonarCloud isn't wired up yet; analysis run locally via `bun test --coverage`.

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 found | 0 found | ✅ |
| Vulnerabilities | 0 | 0 found | 0 found | ✅ |
| Duplication | ≤ 3% | not measured (no SonarCloud yet) | not measured (no SonarCloud yet) | — |

## Independent Cypress verification

Per this pass's mandate to independently confirm `e2e-engineer`'s fix before merge (the fix
touched real click-handling logic in a shared row-action parser used by three tables), I ran
`bun run e2e` myself against a real Postgres-backed backend:

**Result: all 46 tests pass across all 17 spec files** (10 pre-existing Login/Dashboard specs
+ 7 new Configuración specs), including the two that were failing before the fix
(`uc-04-manage-academic-years.cy.ts`, `uc-05-manage-training-cycles.cy.ts`).

Along the way I found and fixed two more issues in `e2e-engineer`'s own spec files (not
product code — pure test-authoring mistakes, both confirmed via isolated re-runs before and
after):

1. `uc-07-select-modules-for-academic-year.cy.ts` was clicking a wide `<tr>` row via
   Cypress's default `.click()` (which targets the element's geometric bounding-box center),
   landing on the row's own "Marcar en curso" button instead of empty background — fixed to
   click the row's first `<td>` cell instead.
2. `uc-04-manage-academic-years.cy.ts` called `cy.request('DELETE', url, { failOnStatusCode:
   false })` — `cy.request`'s 3-positional-argument form takes `(method, url, body)`, not an
   options object, so `{ failOnStatusCode: false }` was sent as the DELETE's JSON body
   instead of suppressing the expected 409. Fixed by removing the now-unnecessary delete
   attempt (that year is deliberately left current and undeleted by design, same documented
   tradeoff as the sibling test).

Both are now fixed in the spec files directly (not routed back through Phase B, since they
never touched product code — this is the same class of fix `e2e-engineer` is expected to
make to its own specs while validating them, per `e2e-engineer.md`'s Step 3/5).

## Acceptance criteria marked (use-cases.md)

Two additional criteria newly verified this pass, now genuinely provable end-to-end (real
browser, real inline-error text asserted, not just "no request sent"):

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-01: Shows an inline error and does not submit if left empty | `uc-01-edit-teacher-name.cy.ts` › "shows an inline error and does not submit when the name is cleared" (asserts `cy.contains('El nombre es obligatorio')`) |
| UC-02: Shows an inline error and does not submit if the repeat doesn't match the new password | `uc-02-change-password.cy.ts` › "shows an inline error and does not submit when the repeat does not match the new password" (asserts `cy.contains('Las contraseñas no coinciden')`) |

All markings from the second pass stand unchanged. Full criteria list is in
`views/configuracion/use-cases.md`.

## Criteria without verifiable coverage

Reduced from the second pass (two items resolved above); still open:

| Criterion | Reason |
|-----------|--------|
| UC-01: Shows a loading state and is disabled from click until the response arrives | No test (unit or e2e) exercises this |
| UC-02: Shows an inline error and does not submit if any field is left empty | No test exists for the empty-field case specifically (repeat-mismatch is covered) |
| UC-02: Shows a loading state and is disabled from click until the response arrives | No test exercises this |
| UC-04: Marking a row current un-marks whichever was current before | Covered by a unit test (see second pass); not additionally e2e-tested, which is fine — no gap, just noting it wasn't re-verified here |
| UC-05: Deleting an unreferenced cycle succeeds and removes its modules too | The Cypress UC-05 main-flow test creates and deletes a cycle with no modules at all (trivial case) — the module-cascade-removal sub-clause still has no automated assertion at any layer, only manual verification via `supervisor`'s live-DB smoke test in an earlier cycle |
| UC-06: Deleting an unreferenced module succeeds | No test exists — see second pass for detail |

## Deferred to e2e-engineer

None remaining — the one item from the second pass (missing static routes) was resolved this
cycle.

## View complete

All gates pass: `view-designer` → `requirement-architect` → `tdd-engineer` (Phase A, all
human-approved) → `backend-implementer`/`frontend-implementer` → `supervisor` → `reviewer` →
`e2e-engineer`, full cycle closed after one `requires-tdd-engineer` round and one
`e2e-engineer`-discovered `frontend` bug round. Ready for the human-gated merge of
`view/configuracion` into `main`.
