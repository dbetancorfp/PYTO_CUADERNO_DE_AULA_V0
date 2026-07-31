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

## Reopen pass — 2026-07-30

Missing element found after merge: neither settings screen had a way back to Dashboard.
Added `back-to-dashboard-link` (elementId), rendered by the existing shared
`renderSettingsNav` function alongside `teacher-nav-link`/`academic-year-nav-link`, so both
screens get it from the one call site. Navigates unconditionally to `/dashboard` via
`handleSettingsNavClick`.

- `ui-spec.json` / `functional-spec.json`: new component + elementSpec, both screens'
  `element_ids`, `total_elements` 23 → 24.
- `use-cases.md` UC-03: element added, new alternative flow A2, two new acceptance criteria
  (both now `[x]`).
- Unit tests (red → green): one new test per settings-view test file, asserting the click
  navigates to `/dashboard`.
- `uc-03-navigate-between-settings-screens.cy.ts`: new e2e test, both screens, real signed-in
  session — passing against the live `start:e2e` server.

Full suite re-run clean: `bun test` 279/279, `tsc --noEmit` clean, all three affected e2e
specs (`uc-03`, `uc-06-manage-modules`, `uc-07-select-modules-for-academic-year`) passing.

## Reopen pass — 2026-07-31 (three-mode Año académico redesign)

### Result: PASS ✅

### Layers implicated: none

Redesign of the Año académico screen from a four-section always-visible layout into three
modes (`normal` / `adding-year` / `adding-cycle` — see `functional-spec.json`'s
`appOverview` and UC-04 through UC-07). `tdd-engineer` rewrote
`training-cycle-management.test.ts`, `module-management.test.ts`,
`module-selection.test.ts` in full and extended `academic-year-settings-view.test.ts`;
`backend-implementer` added `AcademicYearService.listSelectedTrainingCycles` /
`listSelectedModulesForCycle` plus the two matching `GET` routes;
`frontend-implementer` rewrote `academic-year-settings-view.ts`'s mode/cascading logic and
extended `AcademicYearApiService`/`HttpAcademicYearApiService`. Dispatched concurrently per
CLAUDE.md's Phase B; both returned green on the first attempt — 0 Phase B cycles consumed.

### Supervisor notes adjudicated

`supervisor` reported `Layers implicated: none` with no additional notes this cycle
(unit tests PASS both sides; integration smoke test PASS — the two new endpoints verified
live against real Postgres, response shapes matched `api-contracts.md` exactly, and the
frontend's HTTP client calls matched the same routes/shapes). Nothing to adjudicate from
that report.

Separately, `backend-implementer` and `frontend-implementer`'s own Step-4 self-reports each
flagged inferences worth recording here since no later agent re-reads them:

| Note (who flagged it) | Resolution |
|---|---|
| Backend: introduced a narrower `SelectedTrainingCycle {id, name}` type instead of reusing `TrainingCycle` (which carries `teacherId`), to match `api-contracts.md`'s documented response shape and keep the ownership field unserialized, consistent with this file's existing `toPublicYear` pattern | Accepted — correct, matches sibling convention, verified in the diff (`academic-year.service.ts`) |
| Frontend: one pre-existing test in `academic-year-settings-view.test.ts` ("adding a new row and saving a unique name calls create()") directly contradicted the new UC-04 A4 spec (no per-row save on the draft academic-year row) — flagged rather than routed around | Confirmed a genuine leftover from before the 2026-07-30 reopen that didn't get removed when the three sibling test files were rewritten. Removed by the Orchestrator (acting as `tdd-engineer` for this fix) before re-running the suite; `module-selection.test.ts`'s "creates the academic year and persists exactly the in-progress selection" test already covers year creation under the new design |
| Frontend: `module-table-add-button`'s save preserves other cycles' selections for the year via an inferred `academicYearService.getSelection(yearId)` call (not explicitly required by any single test in isolation) | Accepted — necessary given `replaceSelection`'s full-replace semantics; exercised end-to-end by `module-management.test.ts`'s "persists it and selects it for the active academic year" test, which asserts the PUT body contains the new module id |
| Frontend: adding-cycle mode's save does *not* preseed the in-progress selection with the year's existing cross-cycle selection, unlike `module-table-add-button` (asymmetric) | Accepted as intentional, not a defect — `use-cases.md` UC-07's postcondition explicitly requires replace-not-merge semantics ("any previously-selected module not re-checked is removed"), and `module-selection.test.ts` asserts this exact replace behavior |
| Frontend: `module-selection-save-message` renders unconditionally rather than being mode-gated | Accepted — `functional-spec.json`'s `module-selection-save-message` elementSpec has no "hidden in normal mode" criterion (unlike `module-selection-table` itself, which does), and the message must stay visible after a successful save flips the mode back to `normal` |

### SOLID violations found

None new this cycle. Audited both diffs directly:

- `academic-year.service.ts`'s two new methods (`listSelectedTrainingCycles`,
  `listSelectedModulesForCycle`) compose only from already-injected dependencies
  (`academicYearModuleRepository`, `moduleRepository`) — no new constructor dependency, no
  `new ConcreteImpl()`, explicit types throughout (new exported `SelectedTrainingCycle`
  interface, no `any`).
- `academic-year.routes.ts`'s two new routes are thin wrappers matching the existing
  sibling routes' shape exactly (404-on-`null`, `res.locals.teacherId` pattern).
- `academic-year-settings-view.ts` remains a single custom element with every table's logic
  inline — this is the pre-accepted "no nested Shadow DOM" tradeoff from prior passes (see
  the 2026-07-29 report), not a new SRP violation; the new mode/cascading logic follows the
  same event-delegation and disposables patterns already in place. Every new async cascading
  load (`_loadNormalMode`, `_loadNormalModules`, `_loadAddingModeCycles`,
  `_loadSelectionCycleModules`) guards against stale responses after a mode/selection change
  mid-flight — good defensive handling, not present before this cycle because the prior
  design had no concurrent cascading loads to race.
- DIP intact: all four services (`session`, `trainingCycle`, `module`, `academicYear`)
  remain injected via setters; no direct `fetch()` in the component.

### Coverage

`bun test --coverage`: **317 pass, 0 fail**. Every file touched this cycle shows
**100.00% line coverage**:

| File | Lines |
|------|-------|
| `src/backend/src/services/academic-year.service.ts` | 100.00% |
| `src/backend/src/routes/academic-year.routes.ts` | 100.00% |
| `src/frontend/src/academic-year-settings-view.ts` | 100.00% (LF:863 LH:863 per lcov) |

Bun's own text-reporter shows `academic-year-settings-view.ts` at 96.08% **function**
coverage (98/102) — cross-checked directly against the lcov data (`FN:`/`FNDA:` entries):
every named private method has at least one recorded hit; the discrepancy is the same
pre-existing bun/lit-html anonymous-closure-counting artifact already noted in the
2026-07-29 report for this same file (94–95% function coverage on `dashboard-view.ts`,
`login-view.ts`, `teacher-settings-view.ts` — untouched this cycle — shows the same pattern).
Bun's lcov output doesn't emit branch data (`BRDA`/`BRF`/`BRH`) at all in this version, so
line coverage is the only concrete, actionable signal available pre-SonarCloud — treated as
the gate, consistent with prior passes.

`http-academic-year-api-service.ts`'s two new methods
(`listTrainingCyclesForYear`/`listModulesForYearAndCycle`) are not unit-tested directly —
same as every other method in every `http-*-api-service.ts` file in this project (thin
`fetch()` wrappers, verified instead by `supervisor`'s integration smoke test and
`e2e-engineer`'s Cypress run); not a new gap, not flagged.

### SonarCloud Quality Gate

SonarCloud isn't wired up yet; analysis run locally via `bun test --coverage`, same as
every prior pass.

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% | 100.00% | ✅ |
| Bugs | 0 | 0 found | 0 found | ✅ |
| Vulnerabilities | 0 | 0 found | 0 found | ✅ |
| Duplication | ≤ 3% | not measured (no SonarCloud yet) | not measured (no SonarCloud yet) | — |

### Acceptance criteria marked (use-cases.md)

Every previously-`[ ]` box across UC-04–UC-07 is now `[x]` — the entire delta this reopen
introduced:

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-04: On load, the row marked current is selected by default | `academic-year-settings-view.test.ts` › "the row marked current is selected by default on load" |
| UC-04: Selecting a row cascades to training-cycle-table then module-table | `academic-year-settings-view.test.ts` › "selecting a row reloads training-cycle-table to that year's cycles, then, once a cycle auto-selects, module-table to that cycle's modules" |
| UC-04: `academic-year-table-add-button` opens a draft row, no independent save | `academic-year-settings-view.test.ts` › "opens a draft row with only a name input and Cancelar, no independent save button" |
| UC-04: Opening the draft switches training-cycle-table/module-table/module-selection-table | `academic-year-settings-view.test.ts` › "switches training-cycle-table to its complete unfiltered list, hides module-table, and shows module-selection-table scoped to the first cycle" |
| UC-04: Cancelling the draft restores the previous year's normal view | `academic-year-settings-view.test.ts` › "discards the draft name and the in-progress selection, restoring the previously-selected year's normal filtered view" |
| UC-05: Normal mode shows only year-selected cycles, first selected | `training-cycle-management.test.ts` › "shows only the cycles the selected academic year's listTrainingCyclesForYear returns" + "selects the first cycle by default and reloads module-table via listModulesForYearAndCycle" |
| UC-05: Adding-year/adding-cycle mode shows the complete cycle list | `training-cycle-management.test.ts` › "adding-year mode shows the complete cycle list instead of the year-filtered one" + "...selects the first cycle in the complete list by default" |
| UC-05: Deleting an unreferenced cycle removes its modules too | `training-cycle-management.test.ts` › "deleting an unreferenced cycle succeeds and it disappears, along with its modules" (module cascade itself enforced server-side, already covered by `training-cycle.routes.test.ts`) |
| UC-05: Normal mode row-select reloads module-table for that cycle/year | `training-cycle-management.test.ts` › "selecting a different row reloads module-table for that cycle and the selected year" |
| UC-05: Adding mode row-select swaps module-selection-table without losing checks | `training-cycle-management.test.ts` › "selecting a different cycle in adding-year mode swaps module-selection-table without losing checks made under the previous cycle" |
| UC-05: Saving a new cycle in normal mode enters adding-cycle mode | `training-cycle-management.test.ts` › "saving a new cycle while an academic year is selected selects it and switches module-table off / module-selection-table on" |
| UC-06: Hidden during adding-year/adding-cycle mode | `module-management.test.ts` › "is hidden while adding-year mode is active" + "is hidden while adding-cycle mode is active" |
| UC-06: Prompts to pick/create a cycle when none selected | `module-management.test.ts` › "shows nothing and prompts to pick/create a cycle when no cycle is selected" |
| UC-06: Shows the selected cycle's year-selected modules | `module-management.test.ts` › "shows one row per module of the selected cycle that's selected for the selected academic year" |
| UC-06: Add-button disabled without a selected cycle | `module-management.test.ts` › "is disabled while no cycle is selected" |
| UC-06: Adding a module persists and selects it for the active year | `module-management.test.ts` › "adding a row and saving a unique (name, course) persists it and selects it for the active academic year" |
| UC-06: Deleting an unreferenced module succeeds | `module-management.test.ts` › "deleting an unreferenced module succeeds and it disappears from the table" |
| UC-07: all eleven criteria (hidden in normal mode, in-progress checked state, non-persisting toggle, cycle-switch persistence, add-button fusion/availability, new-module default-checked, loading state, adding-year create+persist, adding-cycle persist-only, duplicate-name handling) | `module-selection.test.ts` — one matching test per criterion, all green (see file for exact titles) |

All markings from prior passes stand unchanged.

### Criteria without verifiable coverage

Unchanged from the 2026-07-30 reopen pass — none of this cycle's new work; carried forward:

| Criterion | Reason |
|-----------|--------|
| UC-01: Shows a loading state and is disabled from click until the response arrives | No test (unit or e2e) exercises this |
| UC-02: Shows an inline error and does not submit if any field is left empty | No test exists for the empty-field case specifically |
| UC-02: Shows a loading state and is disabled from click until the response arrives | No test exercises this |

### Deferred to e2e-engineer

None from this pass's unit-level work — the redesign's real-browser verification (mode
switching, cascading loads against a live backend, the two-request adding-year save) is
`e2e-engineer`'s job next; UC-04 through UC-07's existing Cypress specs
(`uc-04-manage-academic-years.cy.ts`, `uc-05-manage-training-cycles.cy.ts`,
`uc-06-manage-modules.cy.ts`, `uc-07-select-modules-for-academic-year.cy.ts`) predate this
redesign and will need updating for the new three-mode DOM shape (`module-cycle-select` no
longer exists, `module-selection-table` is no longer always-visible) — flagging this
explicitly so `e2e-engineer` doesn't assume the old specs still apply as-is.

### e2e-engineer result — 2026-07-31

All four flagged specs rewritten for the three-mode DOM (`module-cycle-select` selectors
removed, cycle selection now via `training-cycle-table` row clicks, `module-selection-table`
assertions gated to adding-year/adding-cycle mode). `uc-04-manage-academic-years.cy.ts`'s
main flow now exercises the full adding-year create+persist round trip end to end (real
`POST /api/academic-years` + `PUT /api/academic-years/:id/modules`); `uc-05` covers the
adding-cycle mode transition (UC-05 A5); `uc-06` covers normal-mode module-table scoped to
both cycle and year; `uc-07` covers its two remaining distinct alternative flows (zero-module
fused add-button, duplicate year name).

`bun run e2e`: **47/47 passing**, full chain (build → seed → serve → run → teardown) green,
server confirmed torn down after. One issue found and fixed along the way — not product
code: `uc-04`'s cancel-draft test deleted an academic year while it was still marked
current, without first re-marking a throwaway year current (the same cleanup pattern every
sibling test already uses) — fixed by applying that same pattern.

**View complete.** All gates pass for this reopen: `tdd-engineer` → `backend-implementer`/
`frontend-implementer` (0 Phase B cycles consumed, both green on first attempt) →
`supervisor` → `reviewer` → `e2e-engineer`. Ready for the human-gated merge of
`view/configuracion` into `main`.
