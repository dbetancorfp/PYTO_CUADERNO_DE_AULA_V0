# Review Report — login (session gap reopen) — 2026-07-28

## Result: PASS ✅ (2 cycles)

## Layers implicated: none

Cycle 1: FAIL, `requires-tdd-engineer` (`app.ts`'s `GET /login` static route had zero
coverage — closed by re-invoking `tdd-engineer` once, one test added to `app.test.ts`, no
implementation change). Cycle 2: PASS. GitHub issue #1 closed.

## Supervisor notes adjudicated

| Note | Resolution |
|------|------------|
| First supervisor pass this cycle: backend unit tests FAIL, 5 cases in `session.routes.test.ts` (Set-Cookie header invisible to `response.headers.get('set-cookie')`) | Resolved before reaching reviewer: root cause was `src/frontend/tests/dom-setup.ts`'s global happy-dom registration stripping `Set-Cookie` per spec for every `bun test` invocation (including backend-only runs), independently verified against native `fetch` and a live Postgres-backed instance (both correct). `tdd-engineer` fixed the shared preload (`dom-setup.ts` captures native `fetch` before registration, `src/backend/tests/setup.ts` restores it for backend tests). Re-run supervisor pass: backend 45/45, frontend 23/23, integration smoke test PASS. Nothing outstanding. |
| Cascading `bun run type-check` regression on 3 pre-existing files (`auth.routes.test.ts`, `auth.service.test.ts`, `pg-user.repository.test.ts`) after `User.fullName` became required | Resolved in the same `tdd-engineer` pass: fixtures/expectations in those 3 files now include `fullName`, without changing any existing assertion's meaning. `bun run type-check`: 0 errors, reconfirmed. |

## SOLID violations found

None. Full checklist reviewed for every file touched this cycle plus a fresh pass over
`app.ts` (composition root, audited whole-file regardless of diff scope):

- **SRP**: `SessionRepository`/`InMemorySessionRepository` — storage only. `SessionService`
  — session lifecycle only (start/resolve/end), same shape as the already-accepted
  `AuthService` pattern (one class, one cohesive responsibility, multiple methods). No class
  mixes HTTP, business logic, and data access.
- **OCP**: no type-switch growth pattern introduced.
- **LSP**: `InMemorySessionRepository` fully implements `SessionRepository`, no method
  throws or returns a different shape than the interface promises.
- **ISP**: `SessionRepository`'s 3 methods (`create`/`resolve`/`invalidate`) are all used by
  its only consumer (`SessionService`) — no fat interface.
- **DIP**: `SessionService` receives `SessionRepository` via constructor (interface, not
  concrete type). `authRouter(authService: AuthService, sessionService: SessionService)`
  takes concrete service classes, not interfaces — **consistent with this view's own
  established, already-accepted precedent** (`authRouter(authService: AuthService)` was
  already this way before this cycle; services have exactly one implementation each, unlike
  repositories, so there's no polymorphism DIP is protecting here). Not a new violation.
  `app.ts` remains the sole composition root — nothing else constructs a concrete
  repository/service.
- **Explicit types**: no `any` introduced. `readSessionId`'s `req.cookies as Record<string,
  string | undefined> | undefined` is a boundary cast against `cookie-parser`'s untyped
  `req.cookies`, same interop pattern already accepted for `pg-user.repository.ts`'s
  `as unknown as UserRow[]`.
- **Naming**: descriptive throughout (`SessionUser`, `readSessionId`, `SESSION_COOKIE`).

**Non-blocking design note, accepted as-is**: `auth.routes.ts`'s login handler calls
`authService.fullNameFor(email)` after `authService.login(...)` already succeeded — a second
`findByEmail` read. Documented in `auth.service.ts`'s own comment: keeps `LoginResult`'s
`success` variant exactly `{ outcome: 'success' }` with no extra fields, which
`auth.service.test.ts`'s pre-existing, untouched assertion (`toEqual({ outcome: 'success'
})`) requires. A minor redundant read on an infrequent operation (login), not a correctness
or architecture defect. Accepted.

## SonarCloud Quality Gate

*Real SonarCloud still isn't wired up (`sonar-project.properties` pending — see
`tecnologias/tecnologia_qa.md`); metrics below are from `bun test --coverage
--coverage-reporter=lcov`, the same stand-in the prior review-report.md for this view used.*

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100% | 100% | ✅ |
| Coverage (funcs) | 100% | 100%, one documented artifact* | 94.44%** | ✅ (see note) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |

\* Backend func-coverage: `src/backend/src/app.ts` closed to 3/3 (100%) this cycle —
`tdd-engineer` added `app.test.ts`'s "GET /login static route" test, confirmed green
immediately (real, already-working code) and re-verified independently by both `supervisor`
and this pass. One remaining, non-blocking artifact:
- `src/backend/src/repositories/in-memory/in-memory-session.repository.ts` — 3/4 functions
  per bun's lcov output, but only 3 methods exist (`create`/`resolve`/`invalidate`), and
  `in-memory-session.repository.test.ts` exercises all 3 directly. The 4th counted
  "function" has no corresponding real method — a bun coverage-instrumentation artifact
  (class field initializer/implicit constructor counted separately), same category the
  prior `review-report.md` for this view already documented and accepted ("harmless
  func-count artifacts"). Non-blocking.

\*\* Frontend func-coverage: unchanged from the prior accepted state.
`src/frontend/src/login-view.ts` 17/18 — the same `disconnectedCallback` gap the prior
`review-report.md` already investigated and accepted (happy-dom 20.10.6 never invokes
`disconnectedCallback` in this test environment; the production code is correct and
CLAUDE.md-mandated). Unchanged this cycle — `frontend-implementer` made zero changes under
`src/frontend/src/` (session/logout are non-visual). Not re-litigated.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-01: successful response accompanied by a session identifying the signed-in user | `session.routes.test.ts` "POST /api/auth/login sets an HttpOnly session_id cookie on success", "GET /api/auth/session responds 200 with the full name for an active session" |
| UC-05: resolves to 'not signed in' when no session_id cookie present | `session.service.test.ts` "resolve() returns null when no session_id is provided", `session.routes.test.ts` "responds 401 when no session_id cookie is sent" |
| UC-05: resolves to 'not signed in' when session_id matches no active session | `session.service.test.ts` "resolve() returns null when session_id matches no active session", `session.routes.test.ts` "401 for a session_id cookie matching no active session", `in-memory-session.repository.test.ts` "resolve() returns null for an id that was never created" |
| UC-05: resolves to signed-in user's full_name for an active session | `session.routes.test.ts` "200 with the full name for an active session", `in-memory-session.repository.test.ts` "create() returns a session id that resolve() maps back to the same user" |
| UC-05: resolves to 'not signed in' for a session_id previously ended | `session.service.test.ts` "a session resolved after end() returns null", `session.routes.test.ts` "ended by logout no longer authenticates", `in-memory-session.repository.test.ts` "invalidate() makes a previously active session resolve to null afterward" |
| UC-06: after logout-session, session-guard resolves to 'not signed in' | same tests as the row above |
| UC-06: logout-session on an already-ended/unknown session_id doesn't error | `session.service.test.ts` "end() does not throw when session_id is undefined", `in-memory-session.repository.test.ts` "invalidate() on an unknown id does not throw", "invalidate() called twice on the same id does not throw", `session.routes.test.ts` "responds 200 even with no session_id cookie at all", "responds 200 for an already-ended session_id" |

## Criteria without verifiable coverage

None.

## Deferred to e2e-engineer

None — the `GET /login` gap is unit-testable now (real listener, real file already on
disk), not deferred; see `requires-tdd-engineer` above.
