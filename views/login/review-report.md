# Review Report — login — 2026-07-26 (run 3, cycle 3, pass 3)

## Result: PASS ✅ (3 cycles)

## Layers implicated: none

Cycle 1: FAIL, `requires-tdd-engineer` (`shadow-styles.ts`'s fetch-succeeds path had zero
coverage — closed by re-invoking `tdd-engineer` once, no implementation change needed).
Cycle 2: FAIL, `backend` (`sql-executor.ts`'s unused `TransactionalSqlExecutor` interface —
closed by `backend-implementer` deleting it). Cycle 3: PASS. Both closed; coverage now 100%
lines across every file in both layers, 99.63% funcs overall (one documented, deferred gap,
see below).

## SOLID violations found

None. Full SOLID checklist passes for both layers:
- SRP/OCP/LSP/ISP/DIP all clean — `AuthService`, `authRouter`, `LoginView`, both
  `UserRepository` implementations, `classesFor` all match the conventions. `app.ts` is the
  sole composition root; nothing else constructs a concrete repository/service.
- `bun run type-check`: 0 errors.
- Test doubles audited: `auth.service.test.ts`'s `UserRepository` double,
  `auth.routes.test.ts`'s seeded users, `pg-user.repository.test.ts`'s `fake-sql.ts` double,
  and every frontend test's `AuthApiService` fake all match `api-contracts.md`'s documented
  shapes exactly — confirmed independently by `supervisor`'s integration smoke test, run
  three times across this cycle's redos with no drift.

## SonarCloud Quality Gate

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100% | 100% | ✅ |
| Coverage (funcs) | 100% | 100% | 94.44% | ✅ (see note) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |

*From `bun test --coverage`'s lcov output (real SonarCloud still isn't wired up — see
`tecnologias/tecnologia_qa.md`). 50/50 tests green across both layers.

**Deferred, non-blocking gap**: `src/frontend/src/login-view.ts`'s `disconnectedCallback`
(and its 2 `_disposables`-pushed cleanup closures), 1 of 18 functions. Confirmed empirically
(a throwaway diagnostic test, not part of the suite) that this project's pinned `happy-dom`
(20.10.6) never invokes `disconnectedCallback` on `.remove()`/`.removeChild()` in this test
environment — not a code defect, a structural limitation of the unit-test DOM. This view's
own production flow never unmounts the component either (a successful login is a full-page
redirect to `/dashboard`, not an in-page removal). The cleanup code itself is the correct,
CLAUDE.md-mandated pattern ("every listener → push its cleanup into `_disposables`";
"`disconnectedCallback`: flush disposables") — removing it would itself be the LSP violation
the SOLID checklist explicitly warns against ("an empty `disconnectedCallback` in a Web
Component that registered listeners"). Re-confirmed unchanged across all 3 cycles this run.
Not routed to any agent — matches this session's own `reviewer.md` provision for code that
genuinely cannot be exercised by any unit test, and mirrors the prior run's own precedent of
tolerating a small, explained func-count gap ("harmless func-count artifacts").

## Acceptance criteria marked (use-cases.md)

All 14 criteria across UC-01–UC-04 marked `[x]`:

| Criterion (UC) | Test that verifies it |
|----------------|------------------------|
| Redirects to /dashboard on valid credentials (UC-01) | `login-button.test.ts` |
| Shows generic wrong-credentials message (UC-01) | `login-button.test.ts`, `login-error-message.test.ts` |
| Shows locked-account message even with correct password (UC-01) | `login-button.test.ts`, `login-error-message.test.ts` |
| Successful login resets failed-attempt counter (UC-01) | `auth.service.test.ts` |
| Loading/disabled state while request in flight (UC-01) | `login-button.test.ts` |
| Empty email blocks submit with inline error (UC-02) | `email-input.test.ts` |
| Empty password blocks submit with inline error (UC-02) | `password-input.test.ts` |
| Malformed email blocks submit with inline error (UC-02) | `email-input.test.ts` |
| Email error clears once corrected (UC-02) | `email-input.test.ts` |
| Password error clears once corrected (UC-02) | `password-input.test.ts` |
| Reveals password as plain text (UC-03) | `password-toggle-button.test.ts` |
| Masks password again (UC-03) | `password-toggle-button.test.ts` |
| Forgot-password link present on first load (UC-04) | `forgot-password-link.test.ts` |
| Forgot-password link does nothing on click (UC-04) | `forgot-password-link.test.ts` |

## Criteria without verifiable coverage

None.
