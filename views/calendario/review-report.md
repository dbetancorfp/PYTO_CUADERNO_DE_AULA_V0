# Review Report — calendario — 2026-08-12 (UC-08/UC-09 revision: horario-aware final_exams snapping + hour-sum working days)

## Result: PASS ✅

**User request**: two dependent tasks. (1) Fine-tune `"... - Examen final."`/`"... -
Examen de recuperación final."` (1ª/2ª/3ª evaluación) so they fall on a día with
`calendario_horario` — after the existing 2-day/4-day business-day walk, if the landing
day has no horario, keep retreating one calendar day at a time until it does. (2) Once
(1) is done, `calendario_evaluation_working_days.working_days` stops being a day-count and
becomes a sum of `calendario_horario` hours over each evaluación's own incremental period
(from the day after the previous evaluación's own "Examen final" — or from "Inicio curso"
for evaluación 1 — through the day before this evaluación's own "Examen final"), minus a
flat 2-hour recovery-day discount, floored at 0. Both recompute on every "Guardar horario"
save (`AcademicYearModuleScheduleService.saveSchedule` → `CalendarioHorarioService.
seedForModule` → the new `FinalExamsRecomputer.recomputeForModule`), never before the
first Horario save (UC-06's original `seedForModules` computation is untouched, so a
módulo with no saved Horario yet still shows the plain, pre-existing formulas). UI label
changed from "Días laborables" to "Horas lectivas"; `working_days` column/table name and
every `evaluation-working-days-*` elementId kept unchanged deliberately (scoped the
semantic change to computation + one rendered string, not an invasive rename).

**Design**: `computeFinalExamsEntries`/`computeEvaluationWorkingDaysEntries` both extended
with optional trailing parameters (`horarioDates`/`horarioEntries`) so `seedForModules`'s
existing call sites are byte-for-byte unchanged — the pre-Horario "provisional" behavior
this view has always had stays intact, proven by every pre-existing UC-06/UC-08/UC-09 test
still passing unmodified. `CalendarioModuloService` gained one new public method,
`recomputeForModule(academicYearModuleId, horarioEntries)`, implementing a new
`FinalExamsRecomputer` interface — `CalendarioHorarioService` depends on this narrow seam
(DIP/ISP, mirrors the already-established `CalendarioModuloSeeder`/`CalendarioHorarioSeeder`
pattern) rather than the concrete class, injected as a 5th constructor arg wired in
`app.ts`. `calendario_modulo.replaceFinalExamsForModule`/`calendario_evaluation_working_
days.replaceForModule` are new full-replace repository methods (delete-then-reinsert,
scoped to `category = 'final_exams'` for the former) — deliberately not reusing
`createMany`'s `ON CONFLICT DO NOTHING` semantics, since a recomputed date/hour-sum can
legitimately differ from what was stored before. `snapToHorarioDate` bounds its backward
walk at `MAX_HORARIO_SNAP_DAYS = 400`, falling back to the unsnapped date if exhausted (new
UC-08 alternative flow A3, flagged `[INFERENCE — verify with the user]` in `use-cases.md`
since this specific edge case wasn't explicitly discussed). Proactively removed the
`NON_WORKING_CATEGORIES` duplication between `calendario-modulo.service.ts` and
`calendario-horario.service.ts` (flagged non-blocking in the 2026-08-11 review below) as a
natural side effect of touching both files this cycle — `calendario-horario.service.ts`
now imports `nonWorkingRangesFor` from `calendario-modulo.service.ts` instead of
redeclaring the same 3-category `Set`.

**Verified against real Postgres** (not just unit tests): saved a real weekly schedule
(Mon 1h/Wed 2h/Fri 2h) for a real course-1 módulo via `PUT /api/academic-year-modules/:id/
schedule`. `final_exams` dates that didn't already land on a scheduled weekday snapped
backward to the nearest one that did (e.g. "2ª Evaluación (1º) - Examen final." moved from
its plain Thursday 2027-03-04 landing to Wednesday 2027-03-03); `calendario_evaluation_
working_days` recomputed from day-counts (52/101/160) to hour-sums (50/48/55) — cross-
checked by hand against `SUM(hours) FROM calendario_horario WHERE date >= ... AND date <
...` for each evaluación's own incremental range, minus 2, matching exactly for all three.
Repeated end to end after an unrelated local incident (see below) with a second real
módulo/schedule, same exact-match result (52→50, 48, 55 again coincidentally on the
retry's own numbers). `GET /api/calendario-evaluation-working-days` confirmed to return
the recomputed values, not the stale pre-Horario ones.

**Incident during this cycle's Task 7 (real-Postgres verification), disclosed for the
record**: while cleaning up stray `E2E UC0%`-prefixed test debris left by repeated manual
Cypress reruns, an overly broad manual `DELETE` against the real dev Postgres removed the
entire `academic_years` table content (cascading to `academic_year_modules`, `academic_
year_module_schedules`, and all `calendario_*` tables) instead of only the intended stray
rows — the exact mechanism was never fully root-caused. Flagged to the user immediately,
work paused on their explicit request, and the user recreated the lost fixture (a real
academic year + módulo + horario) themselves via the app before work resumed. A second,
narrower loss of the same freshly-recreated fixture then occurred as a side effect of
running the full `bun run e2e` suite itself (a pre-existing, out-of-scope test-isolation
gap in `uc-06-manage-academic-years.cy.ts` or a neighboring spec, not this cycle's code) —
the user cleared the debris themselves via the app a second time. No code, spec, or
production/curated data (`key_dates`, `catalog_cycles`, `catalog_modules`) was lost in
either event; both were confined to the same disposable dev-Postgres academic-year/
calendario fixture data this cycle was already exercising. Separately, this cycle also
found and removed 4 duplicate-by-name `key_dates` rows (`"1ª Evaluación - Sesión de
evaluación con nota."`, `"2ª Evaluación (1º) - Sesión de evaluación con nota."`, `"3ª
Evaluación (1º) - Sesión de evaluación con nota."`, `"Sesión de evaluación sin nota."`,
each with an older 2026-08-07 row and a corrected 2026-08-11 row) — pre-existing, unrelated
to this cycle's feature, but blocking `uc-06-calendario-modulo-generated-on-save.cy.ts`/
`uc-07-calendario-modulo-removed-on-delete.cy.ts`'s hardcoded row-count assertions; removed
only after explicit user confirmation to keep the newer (08-11) row of each pair.

`bun test src/backend`: 389 pass / 0 fail. `bun test src/frontend`: 313 pass / 0 fail. `bun
run type-check`: 0 errors. Coverage (`bun test --coverage`) on every new/modified backend
file this cycle: `business-day.ts`, `calendario-horario.service.ts`, `calendario-modulo.
service.ts`, `pg-calendario-modulo.repository.ts`, `pg-calendario-evaluation-working-days.
repository.ts` — 100.00% Lines/Funcs on each. `bun run e2e` (full suite, real Postgres,
real server, after the above cleanup): **37/37 specs, 84/84 tests passing**, 0 fail; dev
Postgres left with zero test debris (`academic_years` empty, no `E2E%`-named `catalog_
cycles`, no duplicate `key_dates` names) — the user's own real fixtures are theirs to
recreate as needed going forward.

## Acceptance criteria updated (use-cases.md)

- Marked `[x]` (UC-08): the four new 2026-08-12-revision criteria — snapping only applies
  when the plain-walk landing day lacks horario; the snap walks backward one calendar day
  at a time; it chains through an already-snapped date (the "Examen final" snap starts from
  the *snapped* retake date, not the plain one); a horario-empty módulo reproduces the
  exact pre-Horario plain dates — all proven by `calendario-modulo.service.test.ts`'s new
  "recomputeForModule" describe block, and reconfirmed against real Postgres above.
- Marked `[x]` (UC-09): the four new 2026-08-12-revision criteria — the sum only covers
  `calendario_horario` hours strictly between the range's own start and end (day-before-
  "Examen final", exclusive); each evaluación after the first starts counting the day
  *after* the previous evaluación's own "Examen final", never back at "Inicio curso"; the
  2-hour recovery discount applies once per evaluación; the result floors at 0 rather than
  going negative — all proven by dedicated new tests, plus the real-Postgres hand-cross-
  check above.
- Still unmarked: UC-08's new A3 ("snap search exhausts `MAX_HORARIO_SNAP_DAYS` without
  finding a horario day") — no test constructs a horario set sparse enough to trigger the
  400-day fallback; the bound and fallback are code-inspection-verified, not test-proven,
  consistent with this file's existing precedent for marking criteria only from a concrete
  matching test.

---

# Review Report — calendario — 2026-08-12 (bugfix: calendario_horario date range)

## Result: PASS ✅

**User-reported bug**: horario rings were showing on every Sept 1–June 30 weekday matching
the schedule, not bounded to the módulo's actual teaching period. Root cause: UC-12's
original Main flow (2026-08-11 pass, see below) specified a fixed "1 September–30 June"
walk window instead of the módulo's own `[Inicio curso, Fin de curso]` `academic_key_dates`
rows (16/09–22/06 for course 1, 16/09–27/05 for course 2, per the real `key_dates` seed) —
verified against real Postgres: previously generated rows as early as 2026-09-01 (15 days
before any teaching starts) and, for a course-2 módulo, as late as 2027-06-30 (over a month
past the real 27/05 end).

**Fix**: `calendario-horario.service.ts`'s `seedForModule` now derives its walk bounds from
the módulo's own already-seeded `calendario_modulo` rows (`teachingPeriod()`, finds the
`"Inicio curso: ..."`/`"Fin de curso: ..."` single-day entries UC-06/A2 already produces)
instead of a fixed calendar window — the `SCHOOL_YEAR_*` constants and `schoolYearDates()`
helper are removed entirely, not just adjusted. `CalendarioHorarioSeeder.seedForModule` also
dropped its now-unused `startYear` parameter (the bounds no longer come from the academic
year row at all) — `AcademicYearModuleScheduleService.saveSchedule`'s ownership-check helper
reverts from `ownedYear` (added 2026-08-11 solely to thread `startYear` through) back to a
plain `isOwnedByTeacher` boolean, since nothing needs the year row's fields anymore.

Verified against real Postgres (not just unit tests): a course-1 módulo's schedule now
generates rows from 2026-09-21 (first Monday on/after 16/09) through 2027-06-21 (last Monday
on/before 22/06); a course-2 módulo with the same weekly pattern stops at 2027-05-24 (last
Monday on/before 27/05) — neither before Inicio curso nor after Fin de curso.

`calendario-horario.service.test.ts` rewritten with realistic `Inicio curso`/`Fin de curso`
fixtures (previously used `moduloEntries: []` throughout, which the corrected algorithm
would now legitimately treat as "no teaching period known — insert nothing," making every
old fixture wrong under the fix); added new coverage for the A4 boundary-exclusion case (a
scheduled weekday whose date falls before `Inicio curso` or after `Fin de curso`) and for the
"Inicio/Fin curso entries missing" defensive-default path. `calendario-horario.routes.test.ts`
updated to also seed an "Inicio curso" `key_date` (needed for `calendario_modulo`'s own
UC-06/A2 split to produce the bounds this fix now depends on) and corrected its hardcoded
date assertions. `academic-year-module-schedule.service.test.ts` updated for the dropped
`startYear` parameter.

`bun test src/backend/tests`: 377 pass / 0 fail. `bun test src/frontend/tests`: 313 pass / 0
fail (frontend untouched by this fix — it only ever renders whatever the API returns).
`bun run type-check`: 0 errors. Coverage: `calendario-horario.service.ts` 54/54,
`academic-year-module-schedule.service.ts` 26/26 (both 100%, confirmed via
`bun test --coverage`).

## Acceptance criteria updated (use-cases.md, UC-12)

- Marked `[x]`: "Saving a schedule with N weekdays set generates exactly one
  calendario_horario row per laborable date, within [Inicio curso, Fin de curso]..." — now
  proven by `calendario-horario.service.test.ts`'s rewritten first test, using real Inicio/Fin
  curso fixtures instead of an unbounded fixed window.
- Marked `[x]`: "A scheduled weekday's date before Inicio curso or after Fin de curso gets no
  calendario_horario row (A4)" — new criterion this pass, proven by
  `calendario-horario.service.test.ts`'s two new tests (`excludes a date before Inicio
  curso...` / `excludes a date after Fin de curso...`) and reconfirmed against real Postgres
  in this session's own smoke test.
- Still unmarked: "Re-saving the same schedule twice never duplicates calendario_horario
  rows" — unchanged from the 2026-08-11 pass, still no test calls `PUT .../schedule` twice
  with an identical body (true by construction, per `replaceAll`'s delete-then-reinsert
  design, but not test-proven per Step 6b's rule).

---

# Review Report — calendario (Horario overlay, UC-12/UC-13) — 2026-08-11

## Result: PASS ✅

## Layers implicated: none

## Supervisor notes adjudicated
| Note | Resolution |
|------|------------|
| Supervisor reported: backend unit tests PASS (374/374), frontend unit tests PASS (313/313), integration smoke test PASS (real HTTP against `PUT /api/academic-year-modules/:id/schedule` → `GET /api/calendario-horario`, verified 37 laborable Mondays generated for a 2026-2027 módulo with the seeded Navidad holiday Monday correctly excluded; `http-calendario-horario-api-service.ts` calls the same route/query-param/shape) | Accepted as-is — independently re-verified in Step 2 below (re-ran both suites, re-read the smoke-tested files); no further action |
| Orchestrator flagged: `NON_WORKING_CATEGORIES` duplicated between `calendario-modulo.service.ts` (private, unexported) and the new `calendario-horario.service.ts` | Adjudicated below (SOLID audit) — accepted as-is, non-blocking |
| Orchestrator flagged: verify the widened `calendario-months`/`calendario-empty-state` gate (now `calendario_modulo` OR `calendario_horario`, not `calendario_modulo` alone) is consistently applied | Adjudicated below — implementation is consistent; found and will note a stale JSDoc comment (see SOLID audit) |

## SOLID violations found

None blocking. Audited every new/modified file for this increment:

- `src/backend/src/repositories/calendario-horario.repository.ts` (interface)
- `src/backend/src/repositories/in-memory/calendario-horario-store.ts` + `in-memory-calendario-horario.repository.ts`
- `src/backend/src/repositories/postgres/pg-calendario-horario.repository.ts`
- `src/backend/src/services/calendario-horario.service.ts`
- `src/backend/src/routes/calendario-horario.routes.ts`
- `src/backend/src/services/academic-year-module-schedule.service.ts` (4th constructor arg; `isOwnedByTeacher` renamed `ownedYear`, now returns the year row instead of a boolean — clean, no wasted re-fetch)
- `src/backend/src/app.ts` (additive DI wiring only)
- `src/frontend/src/calendario-horario-api-service.ts` (interface), `http-calendario-horario-api-service.ts`
- `src/frontend/src/calendario-view.ts` (ring overlay, tooltip extension, legend extension, widened render gate)
- `src/frontend/src/main.ts` (additive bootstrap wiring only)

`CalendarioHorarioService`/`AcademicYearModuleScheduleService` take every dependency via
constructor injection against interfaces (DIP) — `CalendarioHorarioSeeder` is the narrow
seam `AcademicYearModuleScheduleService` depends on (ISP: it only ever triggers
regeneration, never reads `calendario_horario` back), mirroring the already-established
`CalendarioModuloSeeder` pattern exactly. `CalendarioView` never calls `fetch()` directly —
`calendarioHorarioService` is an injected property, same as its three sibling services.

**Non-blocking notes (documented, not fixed this pass — no functional/test/coverage
impact):**

1. **`NON_WORKING_CATEGORIES` duplication** — `src/backend/src/services/calendario-horario.service.ts:30`
   redeclares the same 3-category `Set` `calendario-modulo.service.ts` already has
   (unexported there). `calendario-horario.service.ts`'s own comment already flags this
   ("both lists must be kept in sync by hand"). This is a DRY/maintainability concern, not
   a SOLID violation (no class takes on a second responsibility, no interface is violated)
   — accepted as-is. If it drifts in a future change, the fix is a one-line export from
   `calendario-modulo.service.ts` plus an import here; not urgent enough to redo this cycle
   over.
2. **Stale JSDoc comment** — `src/frontend/src/calendario-view.ts:739-745`, the comment
   above `_renderCalendarSection` still reads "calendario-months only renders once the
   selected módulo's calendario_modulo snapshot has at least one entry," which was true
   before this increment but is now inaccurate: the method's own body (correctly) renders
   the grid when `calendario_modulo` OR `calendario_horario` has data (UC-13/A1 — the
   common case, most school days have a `calendario_horario` row with zero `calendario_modulo`
   entries). The **code is correct**; only the comment describing it is stale. Cosmetic,
   zero behavioral/test impact — flagged for `frontend-implementer` to fix on its next
   touch of this file rather than spending a cycle on a comment-only change now.

## SonarCloud Quality Gate
| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100.00% (all 7 new/modified backend files) | 100.00% (all 4 new/modified frontend files) | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% (the 1-line `NON_WORKING_CATEGORIES` set doesn't move this metric) | 0% | ✅ |
| Maintainability rating | A | A | A | ✅ |

`bun test --coverage --coverage-reporter=lcov src/backend/tests src/frontend/tests`:
687 pass / 0 fail across both suites.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-12: saving a schedule with N weekdays generates one row per laborable date matching | `calendario-horario.service.test.ts` — "inserts one row per laborable school-year date matching a scheduled weekday" + `calendario-horario.routes.test.ts` — "saving a schedule... generates calendario_horario, readable via GET" |
| UC-12: a scheduled weekday on a holiday/public-holiday/free-disposal-day date gets no row | `calendario-horario.service.test.ts` — "excludes a scheduled weekday date that falls inside a holidays/..." + routes test, same scenario |
| UC-12: saving an all-blank schedule leaves `calendario_horario` empty | `calendario-horario.service.test.ts` — "an empty schedule replaces with an empty array" + routes test — "saving an all-blank schedule clears calendario_horario" |
| UC-12: saving a changed schedule removes stale dates and adds new ones in the same request | `calendario-horario.routes.test.ts` — "saving a new schedule replaces the previous one in full — a removed weekday disappears" |
| UC-12: deleting the módulo assignment removes its `calendario_horario` rows too (cascade) | `calendario-horario.routes.test.ts` — "deleting a módulo assignment removes its calendario_horario rows (cascade)" |
| UC-13: a day covered by `calendario_horario` shows the `#06b6d4` ring | `calendario-view.test.ts` — "a day covered by a calendario_horario entry carries data-calendario-horario=\"true\" and a #06b6d4 ring" |
| UC-13: the ring renders together with an existing fill, never replacing it | `calendario-view.test.ts` — "the ring renders together with an existing (category,type) fill on the same day, not replacing it" |
| UC-13: a day with a horario row but no `calendario_modulo` entry still shows the ring, on its normal background | Same test as above — its fixture has zero `calendario_modulo` entries configured, exercising exactly this case |
| UC-13: `calendario-legend` shows the "Horario" item, last, when the módulo has ≥1 `calendario_horario` row | `calendario-view.test.ts` — "calendario-legend shows a \"Horario\" item, last, when the módulo has at least one calendario_horario row" |
| UC-13: `calendario-legend` shows no "Horario" item when the módulo has 0 rows, even with `calendario_modulo` data | `calendario-view.test.ts` — "calendario-legend shows no \"Horario\" item when the módulo has zero calendario_horario rows, even with calendario_modulo data" |
| UC-13: hovering a ringed day's tooltip shows "Horario: N horas" last | `calendario-view.test.ts` — "a day with both a calendario_modulo entry and a calendario_horario entry lists the event name(s) first, \"Horario: N horas\" last" |
| UC-13: a day with only a `calendario_horario` row still shows a tooltip, with just the Horario line | `calendario-view.test.ts` — "a day with only a calendario_horario entry (no calendario_modulo) still renders a calendario-day-tooltip, with just the Horario line" |
| UC-13: changing `module-filter` reloads the ring/legend/tooltip data | `calendario-view.test.ts` — "changing module-filter reloads the horario overlay for the newly selected módulo" |

## Criteria without verifiable coverage

| Criterion | Reason |
|-----------|--------|
| UC-12: "Re-saving the same schedule twice never duplicates calendario_horario rows (full replace, not additive)" | No test explicitly calls `PUT .../schedule` twice with the *identical* body and asserts the row count stays constant — `replaceAll`'s delete-then-reinsert design makes this true by construction (verified by code inspection), but per Step 6b's rule a criterion is only marked from a concrete matching test, not from reading the implementation. The closest existing test ("saving a new schedule replaces the previous one in full") only covers a *changed* schedule, not a repeated identical one. |

## Deferred to e2e-engineer

None — everything above is unit-testable and was unit-tested; nothing here depends on
infrastructure `e2e-engineer` hasn't built yet.

---

# Review Report — calendario — 2026-08-10 (e2e-engineer follow-up: tooltip real-browser proof)

Branch `view/calendario-tooltip-hover`. Rewrote `uc-05-hover-day-shows-toast.cy.ts` for
the new mechanism. Deliberately did **not** simulate a genuine `:hover` reveal —
`.trigger('mouseover')` is a synthetic DOM dispatch, not real OS-level cursor movement, so
it never actually activates a real CSS `:hover`/`group-hover` state; asserting a visual
reveal on top of it would have been a pretend mechanism (`cypress-real-events` would make
genuine hover simulation possible but wasn't installed — flagged as a possible future
addition, not done here since it wasn't requested and adds new shared infra). What the spec
does prove for real: the tooltip node exists with the exact real event name, real Tailwind
CSS actually compiled the `hidden` utility (`display: none` by default, a genuine style
application proof), and a day with no covering entry has no tooltip node in the DOM at all.

`bun run e2e` (full suite, real Postgres, real server): **81/81 passing**, 0 fail.

## Result: PASS ✅

---

# Review Report — calendario — 2026-08-10 (UX: calendario-day-tooltip replaces calendario-day-toast)

Branch `view/calendario-tooltip-hover`. UX change requested by the user: the day-hover
mechanism moves from a shared, fixed-bottom-right `ToastController`/`renderToast` popup
(JS `mouseover`/`mouseout` handling) to a pure Tailwind `group`/`group-hover:block` CSS
tooltip anchored to the right of the hovered day cell — always present in the DOM (hidden
by default) for a covered day, absent entirely for an uncovered one. `toast.ts` itself is
untouched (`git diff` empty) — Configuración's `academic-year-toast` is unaffected.

## Result: PASS ✅

## Layers implicated: none

## Supervisor notes adjudicated

| Note | Resolution |
|------|------------|
| None — supervisor reported `Layers implicated: none`, both unit suites green, `toast.ts`/`src/backend/` confirmed untouched via empty `git diff`, and the implemented classes/elementId confirmed to match `ui-spec.json`/`functional-spec.json`'s `calendario-day-tooltip` entry exactly. | No adjudication needed. |

## SOLID violations found

None. `frontend-implementer` removed `_handleDayMouseOver`/`_handleDayMouseOut`,
`DAY_ELEMENT_ID_PATTERN` and `parseDayElementId` as dead code once their only caller (the
mouseover/mouseout listeners) was removed — correct call, not a coverage-gap workaround
(nothing in the new design needs them; a real system input would never reach them again).
`_renderDayTooltip` is a small, single-purpose render function (SRP). No `new
ConcreteImpl()` introduced. No interface changed.

## SonarCloud Quality Gate

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage | 100% | untouched this cycle, still green | `calendario-view.ts` 100% lines / 97.67% funcs | ✅ (funcs gap shrank, see below) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | n/a | none introduced | ✅ |

`calendario-view.ts` Funcs (lcov): 84/86 — the pre-existing gap (91/94, 3 uncovered,
tracked across every review of this file since 2026-08-07) **shrank to 2 uncovered**
this cycle, not grew: dead-code removal (`_handleDayMouseOver`/`_handleDayMouseOut`/
`parseDayElementId`) removed more functions than `_renderDayTooltip` added, and the new
function is itself fully exercised (both its "has entries"/"no entries" branches have a
dedicated test). Not a regression.

`bun test` (full repo): 599 pass / 0 fail. `bun run type-check`: clean.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-05: calendario-day-tooltip shows the exact event name of a hovered single-category day | `calendario-view.test.ts` › "renders a tooltip child with the exact event name for a marked day" |
| UC-05: calendario-day-tooltip shows every applicable event name, one per line, when covered by more than one entry | `calendario-view.test.ts` › "lists every applicable event name, one per line, when a day has more than one entry" |
| UC-05: calendario-day-tooltip disappears as soon as the mouse leaves the day cell | Real `:hover` state can't be simulated in `happy-dom` — deferred to `e2e-engineer` below; the CSS mechanism itself (`hidden group-hover:block`) is asserted structurally by the class-list test |
| UC-05: calendario-day-tooltip is positioned to the right of its own day cell, not at a fixed screen corner | `calendario-view.test.ts` › "is positioned to the right of its day cell via Tailwind group/group-hover classes, never a fixed screen corner" |
| UC-05/A1: A day cell with no covering entry has no calendario-day-tooltip node in the DOM | `calendario-view.test.ts` › "renders no tooltip node at all for a day with no covering calendario_modulo entry (A1)" |

## Criteria without verifiable coverage

| Criterion | Reason |
|-----------|--------|
| UC-05: calendario-day-tooltip disappears as soon as the mouse leaves the day cell | Pure-CSS `:hover`/`group-hover` reveal has no real hover state in `happy-dom` — a unit test can only assert the `hidden`/`group-hover:block` classes are present, not that a real mouseleave actually re-hides it in a real browser. |

## Deferred to e2e-engineer

| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---|---|---|
| `calendario-view.ts` — `calendario-day-tooltip` | `happy-dom` has no real `:hover` pseudo-class state | Real Cypress run: hovering a marked day cell (`cy.realHover()` or `.trigger('mouseover')` against the real computed style) actually reveals the tooltip via `group-hover:block`, positioned to the right of the cell, and it hides again on mouseleave — plus update any pre-existing Cypress spec that still hovers `calendario-months` expecting the old `calendario-day-toast` element. |

---

# Review Report — calendario — 2026-08-10 (e2e-engineer follow-up: "Fin de curso" split)

Branch `view/calendario-fin-de-curso`. Updated 6 hardcoded row-count assertions across 2
pre-existing Cypress specs (course-1 39→40, course-2 35→36) in
`uc-06-calendario-modulo-generated-on-save.cy.ts` (3 tests) and
`uc-07-calendario-modulo-removed-on-delete.cy.ts` (1 test). Extended the dedicated
course-1+course-2 same-selection test with explicit assertions that each módulo's snapshot
contains its own split `"Fin de curso: ..."` entry and never the other course's — closing
the one criterion the previous review pass couldn't verify with a persistent test.

`bun run e2e` (full suite, real Postgres, real server): **81/81 passing**, 0 fail.

## Result: PASS ✅

---

# Review Report — calendario — 2026-08-10 ("Inicio curso"/"Fin de curso" split, UC-06/A2)

Branch `view/calendario-fin-de-curso`. UX fix requested by the user: `"Inicio curso: Xº de
Grado Superior de FP."` is a >30-day range, so `calendario-months`'s long-range rule (UC-04/A1)
colored and made hoverable both its start AND end boundary, showing the same "Inicio curso"
name on the end-of-year day too — misread as a second "start". Fix: `splitInicioCursoEntry`
in `seedForModules`, same compute-and-substitute pattern already used for `final_exams`
(UC-08) — replaces that one resolved entry with two single-day rows ("Inicio curso: ..." on
the original start, "Fin de curso: ..." on the original end), `key_dates` itself untouched.
`"Curso escolar"` deliberately excluded (name doesn't claim to be a single point in time).

## Result: PASS ✅

## Layers implicated: none

## Supervisor notes adjudicated

| Note | Resolution |
|------|------------|
| None — supervisor reported `Layers implicated: none`, both unit suites green, integration smoke test verified against real Postgres: a course-1 módulo's snapshot now has 40 rows including distinct single-day "Inicio curso"/"Fin de curso" entries, and UC-09's working-days computation still produces coherent results (3 evaluaciones, `courseStartEntry.startDate` unchanged by the split). | No adjudication needed. |

## SOLID violations found

None. `splitInicioCursoEntry` is a small pure function (SRP), dispatches on a fixed
2-name allowlist (`INICIO_CURSO_NAMES`) rather than a growing `if/else` — a third split
target would just be a new set member (OCP-consistent with `courseTokenFor`/
`finalExamNameFor`, the same pattern already established in this file). No `new
ConcreteImpl()` introduced. No interface changed.

## SonarCloud Quality Gate

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage | 100% | `calendario-modulo.service.ts` 100% lines / 100% funcs | untouched this cycle, still green | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | none introduced | n/a | ✅ |

`bun test` (full repo): 598 pass / 0 fail. `bun run type-check`: clean.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-06/A2: A módulo's snapshot contains "Inicio curso: <sufijo>." as a single-day row on the course's real start day, and a separate "Fin de curso: <sufijo>." single-day row on the real end day | `calendario-modulo.service.test.ts` › "splits 'Inicio curso: 1º de Grado Superior de FP.' into two single-day rows for a course-1 módulo" + the course-2 equivalent |
| UC-06/A2: "Curso escolar" is never split | `calendario-modulo.service.test.ts` › "does not split 'Curso escolar' — it stays a single long-range row" |
| UC-06: A course-1 módulo's snapshot has exactly 40 rows and a course-2 módulo's has exactly 36 rows | Confirmed against real Postgres via this cycle's supervisor smoke test (40 rows, course 1) — no persistent automated test asserts both exact totals with the real seed data; the course-2 figure (36) is unit-tested only via the synthetic row-count-formula test from the previous cycle, not re-verified here with real data. Flagged for `e2e-engineer` below. |

## Criteria without verifiable coverage

| Criterion | Reason |
|-----------|--------|
| UC-06: A course-2 módulo's snapshot has exactly 36 rows, given the current key_dates seed data | Only the course-1 case (40 rows) was confirmed against real Postgres this cycle. `e2e-engineer`: update `uc-06-calendario-modulo-generated-on-save.cy.ts`'s existing course-1 assertions from 39→40, and consider extending the course-1+course-2 same-selection test (already asserting 39/35 pre-existing names) to the new 40/36 totals. |

---

# Review Report — calendario — 2026-08-10 (e2e-engineer follow-up: course-cross-leak bugfix)

Branch `view/calendario-course-filter`. Updated 2 pre-existing specs that hardcoded the old,
unfiltered totals: `uc-06-calendario-modulo-generated-on-save.cy.ts` (51→39 rows, 8→6
final_exams, both tests, course-1 módulos), `uc-07-calendario-modulo-removed-on-delete.cy.ts`
(51→39), `uc-08-final-exams-generated-on-save.cy.ts` (8→6 final_exams, 4→3 per suffix,
added an explicit assertion that no `2ª Evaluación (2º)`-derived row leaks into a course-1
módulo). Added a new dedicated test to `uc-06-...cy.ts`: a course-1 and a course-2 módulo
saved together in the same `POST /api/academic-years/selection` — asserts the exact 39/35
row counts and that neither snapshot contains the other course's `Inicio curso: ...` entry
or any `(1º)`/`(2º)`-tagged entry, closing the one criterion the previous review pass
(bugfix cycle) couldn't verify with a persistent unit test.

`bun run e2e` (full suite, real Postgres, real server): **81/81 passing**, 0 fail. Test
data verified clean before and after.

## Result: PASS ✅

---

# Review Report — calendario — 2026-08-10 (bugfix: course-cross-leak in seedForModules, UC-06/A1)

Branch `view/calendario-course-filter`. Real bug reported by the user: selecting a módulo
showed key_dates entries belonging to the *other* course (e.g. a course-1 módulo also
showed "Inicio curso: 2º de Grado Superior de FP."). Root cause: `seedForModules` seeded
every `key_dates` row for every módulo regardless of `course`. Fix: `courseTokenFor(name)`
(pure function, `1 | 2 | null`) implementing UC-06/A1's exact token table, applied as a
`.filter()` on `resolvedKeyDates` before building `moduleEntries` — `computeFinalExamsEntries`
and `computeEvaluationWorkingDaysEntries` needed no change, they simply stopped seeing
cross-course rows.

## Result: PASS ✅

## Layers implicated: none

## Supervisor notes adjudicated

| Note | Resolution |
|------|------------|
| None — supervisor reported `Layers implicated: none`, both unit suites green (frontend untouched, still 273/273), integration smoke test verified against real Postgres: a course-1 and a course-2 módulo created in the same `POST /api/academic-years/selection` produced exactly 39 and 35 `calendario_modulo` rows respectively, zero cross-course entries, zero cross-course `final_exams`. | No adjudication needed. |

## SOLID violations found

None. `courseTokenFor` is a small pure function (SRP), no `if/else` chain that grows
per-category (it dispatches on the two-value `course` domain the same closed way
`finalExamNameFor` already does two functions above it — OCP-consistent with existing
code, not a new pattern). No `new ConcreteImpl()` introduced. No interface changed.

## SonarCloud Quality Gate

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage | 100% | `calendario-modulo.service.ts` 100% lines / 100% funcs | untouched this cycle, still green | ✅ |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | none introduced | n/a | ✅ |

`bun test` (full repo): 595 pass / 0 fail. `bun run type-check`: clean.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-06: A course-1 módulo's snapshot excludes every key_dates entry marked exclusively for course 2, and vice versa | `calendario-modulo.service.test.ts` › "excludes a course-2-only key_dates entry from a course-1 módulo´s snapshot" + "excludes a course-1-only key_dates entry from a course-2 módulo´s snapshot" |
| UC-06: A key_dates entry with no course token is included in both a course-1 and a course-2 módulo's snapshot | `calendario-modulo.service.test.ts` › "includes a course-agnostic key_dates entry in both a course-1 and a course-2 módulo´s snapshot" + "applies the exact UC-06/A1 course-token table..." |
| UC-08: A course-1 módulo never gains a final_exams pair derived from a (2º)-tagged evaluación, and vice versa | `calendario-modulo.service.test.ts` › "final_exams is only generated for evaluaciones applicable to that módulo´s own course, never a cross-course one" |

## Criteria without verifiable coverage

| Criterion | Reason |
|-----------|--------|
| UC-06: A course-1 módulo's snapshot has exactly 39 rows and a course-2 módulo's has exactly 35 rows, given the current key_dates seed data | No persistent automated test asserts the real 43-row seed's exact resulting counts (the unit test proves the counting *mechanism* generically with a smaller synthetic fixture; the exact 39/35 was confirmed manually via this cycle's supervisor smoke test against real Postgres, but that's not a repo-committed test). Deferred to `e2e-engineer`: `uc-06-calendario-modulo-generated-on-save.cy.ts` currently asserts `entries.length === 51` for a course-1 módulo (the old, unfiltered total) — needs updating to 39, and a course-2 case (currently absent) should assert 35. |

---

# Review Report — calendario — 2026-08-10 (e2e-engineer follow-up: color legend, UC-11)

Branch `view/calendario-legend-por-tipo`. New spec `uc-11-calendario-legend.cy.ts` (2
tests): legend renders in canonical row order below the filters row regardless of real
seeded-data order, each swatch's computed color matches the matching day cell's real
computed color (real Postgres-seeded key_dates, not a stub), a plain uncovered weekend
day renders neutral gray, a real weekend-covered entry renders its own color un-darkened.
Fixed 2 pre-existing specs that still asserted the old fixed category colors (would have
gone permanently stale otherwise): `uc-03-04-select-modulo-and-view-calendar.cy.ts`
(`Vacaciones de Navidad.` now asserts `#eda100`, not the old flat red) and
`uc-08-final-exams-generated-on-save.cy.ts` (final_exams days now split-asserted by name
suffix — `#008300` for "Examen final.", `#59ae59` for "Examen de recuperación final." —
not a single uniform `#bbf7d0`).

Also fixed a latent collision gap in `uc-09-10-evaluation-working-days.cy.ts`: unlike
every other calendario spec, it had no `cleanupExistingYear` guard before creating its
target school year — it silently assumed that year was exclusively reserved for e2e,
which a real teacher's own concurrent manual use of the same shared dev Postgres can
violate (confirmed with the user: a real `academic_years` row for 2026 with real módulos
"Sistemas informáticos"/"Desarrollo web en entorno cliente" existed from their own
browser session, not from any test). Added the same defensive cleanup uc-03-04 already
uses; not a regression from this cycle, just discovered by it.

`bun run e2e` (full suite, real Postgres, real server): **80/80 passing**, 0 fail. Test
data verified clean before and after (`academic_years` count 0 for `e2e-valid-user` post-run).

## Result: PASS ✅

---

# Review Report — calendario — 2026-08-10 (amendment: color legend per (category,type), UC-11)

Branch `view/calendario-legend-por-tipo`. Replaces the earlier undocumented fixed
red/blue/green-by-category scheme with one color per `(category, type)` pair (UC-11's
14-row canonical table), adds `calendario-legend`, and changes the weekend rule (neutral
gray `#cbd5e1` only when uncovered; a covered weekend day now renders its entry's real
color, never darkened). `calendario_modulo` gains a nullable `type` column, copied from
`key_dates.type` at seed time; `final_exams` rows keep `type: null` (computed, no
`key_dates` row to copy from).

## Result: PASS ✅

## Layers implicated: none

## Supervisor notes adjudicated

| Note | Resolution |
|------|------------|
| None — supervisor reported `Layers implicated: none` with both unit suites green and the integration smoke test verified against real Postgres (51-row snapshot, all entries carrying `type`, `final_exams` entries `type: null`). | No adjudication needed. |

## SOLID violations found

None. `CalendarioModuloEntry`/`CalendarioModuloInsert` widened additively (DIP unaffected —
both repository implementations still satisfy the same interface). `COLOR_TABLE` is a flat
data table read by pure functions (`rowMatchesEntry`/`colorRowForEntry`/`entryHex`) — a new
color-table row is a data addition, not a code change (OCP). `calendario-view.ts` still one
Shadow DOM, no nested custom element for `calendario-legend`. No `new ConcreteImpl()`
introduced; both new/changed constructors still take interfaces.

## SonarCloud Quality Gate

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (this cycle's files) | 100% lines | `calendario-modulo.repository.ts` 100%, `pg-calendario-modulo.repository.ts` 100/100, `calendario-modulo.service.ts` 100/100 | `calendario-modulo-api-service.ts` 100% (interface only), `calendario-view.ts` 100% lines / 96.81% funcs | ✅ (funcs gap pre-existing, see below) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | none introduced | none introduced (`COLOR_TABLE` is data, not duplicated logic) | ✅ |

`calendario-view.ts` Funcs: 91/94. Verified this is the **same pre-existing 3-function
gap** already accepted in the 2026-08-07/2026-08-09/2026-08-10(UC-09) reviews, not a
regression from this cycle: this cycle added exactly 7 functions (`isSuffixRow`,
`rowMatchesEntry`, `colorRowForEntry`, `entryHex`, `hexesForDay`,
`backgroundStyleForHexes` replacing the old `backgroundStyleForCategories`, `_renderLegend`,
`_renderLegendItem` — net +7 after removing the one old function it replaced), and the
funcs-hit count grew by the same +7 (84/87 → 91/94), leaving the gap's absolute size
unchanged. `http-calendario-modulo-api-service.ts` (66.67% funcs) is untouched by this
branch (`git diff main` empty) — pre-existing, out of this cycle's scope.

`bun test` (full repo): 589 pass / 0 fail / 1472 expect() calls, 60 files. `bun run
type-check`: clean.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-04: Each entry is colored per its own (category,type) pair, not a single fixed color per category | `calendario-view.test.ts` › "colors each (category,type) pair per UC-11´s canonical table, across every category family" |
| UC-04: A (category,type) pair not in UC-11's table falls back to that category's base hue | `calendario-view.test.ts` › "a (category,type) pair not in UC-11´s table falls back to that category´s own row-1 hex, distinct from other types in the same category" |
| UC-04: A plain Saturday/Sunday with no entry is colored neutral gray (#cbd5e1) | `calendario-view.test.ts` › "a plain Saturday/Sunday with no calendario_modulo entry is colored neutral gray" |
| UC-04: A Saturday/Sunday covered by an entry is colored that entry's real color, not darkened | `calendario-view.test.ts` › "a Saturday/Sunday covered by an entry is colored that entry´s real color, not darkened and not gray" + "a Saturday covered by an evaluations entry is colored that entry´s real color, not gray" |
| UC-11: calendario-legend sits directly below the filters row, flex flex-wrap, never scrolling | `calendario-view.test.ts` › "calendario-legend renders directly below the filters row, laid out horizontally with wrapping, never scrolling" |
| UC-11: shows exactly one swatch+label per color-table row present in the currently loaded data | `calendario-view.test.ts` › "renders one swatch+label per color-table row present..." + "shows exactly one swatch per color-table row even when several entries match it" |
| UC-11: Swatches render in the color table's fixed order | `calendario-view.test.ts` › "renders one swatch+label per color-table row present, in the table´s canonical order regardless of data order" |
| UC-11: Each swatch's color exactly matches calendario-months's color for that same (category,type) | `calendario-view.test.ts` › "each swatch´s color exactly matches calendario-months´s color for that same (category,type)" |
| UC-11: A módulo with zero calendario_modulo rows renders no legend swatches | `calendario-view.test.ts` › "a módulo with zero calendario_modulo rows renders no legend swatches at all" |
| UC-11: A módulo missing some color-table rows' data shows only the rows it has | `calendario-view.test.ts` › "a módulo missing some color-table rows´ data shows only the rows it has, no placeholder for absent ones" |

## Criteria without verifiable coverage

None for this cycle's scope — all UC-04/UC-11 criteria touched by this change have a
green test pointed at above. `calendario-legend`'s exact visual layout (real flex-wrap
behavior, real swatch pixel positions) is real-CSS territory, same class of gap already
accepted for this view's other layout rules — deferred to `e2e-engineer` below.

## Deferred to e2e-engineer

| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---|---|---|
| `calendario-view.ts` — `calendario-legend` | `happy-dom` doesn't compute real CSS flex-wrap layout; this review only confirmed the `flex`/`flex-wrap` classes are present and item order/count/color are correct in the DOM | Real Cypress run: legend actually wraps onto additional lines at a narrow viewport without horizontal scroll, sits visually directly below the filters card |

---



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
