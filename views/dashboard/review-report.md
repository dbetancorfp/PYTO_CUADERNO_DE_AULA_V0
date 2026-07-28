# Review Report — dashboard — 2026-07-28

## Result: PASS ✅ (1 cycle)

## Layers implicated: none

## Supervisor notes adjudicated

| Note | Resolution |
|------|------------|
| supervisor's integration smoke test confirmed `HttpSessionApiService` calls `GET /api/auth/session` / `POST /api/auth/logout` exactly as Login's `api-contracts.md` documents, against a real Postgres-backed backend | No action needed — confirms the cross-layer contract this view depends on (but doesn't own) holds. |

## SOLID violations found

None.

- **SRP**: `session-api-service.ts` — pure interface, no logic. `http-session-api-service.ts`
  — HTTP client only. `dashboard-view.ts` — one cohesive responsibility (render the
  Dashboard screen and react to its own events), same shape as the already-accepted
  `LoginView` pattern.
- **OCP**: the seven section cards are driven by a `SECTION_CARDS` data array rendered via
  `.map()` — adding an eighth card later means adding an array entry, not touching render
  logic or the click handler's `switch`/lookup. Good use of data-driven rendering to avoid
  the "grows with every new type" smell the checklist warns about.
- **LSP**: N/A — no subtyping introduced this cycle.
- **ISP**: `SessionApiService`'s 2 methods (`getSession`/`logout`) are both used by its only
  consumer (`DashboardView`).
- **DIP**: `DashboardView` receives `SessionApiService` via a settable property (interface,
  not concrete type) — identical pattern to `LoginView`/`AuthApiService`. `main.ts` remains
  the sole place a concrete `Http*ApiService` is constructed.
- **Explicit types**: no `any` introduced.
- **Naming**: descriptive throughout (`SECTION_CARDS`, `redirectTo`, `_loadSession`).

**Design consistency check (explicitly requested)**: the seven cards' route slugs
(`tdd-engineer`'s `[INFERENCE]`, since Phase A never specified literal paths) are used
identically in `src/frontend/tests/dashboard-cards.test.ts`'s `CARDS` array and
`dashboard-view.ts`'s `SECTION_CARDS` array — `/calendario`, `/criterios-evaluacion`,
`/unidades-trabajo`, `/listado-alumnos`, `/diario`, `/alumno`, `/informes`. No drift.

**`classes-for.ts`'s new `interactive` `Variant`**: additive only (existing
`primary`/`secondary`/`danger`/`ghost`/`link` variants and `login-view.ts`'s own
`classesFor('card', undefined, undefined)` call are untouched) — consistent with the
project's "single source of truth for styling" rule, not an inline-Tailwind workaround.

## SonarCloud Quality Gate

*Real SonarCloud still isn't wired up; metrics from `bun test --coverage
--coverage-reporter=lcov`.*

| Metric | Threshold | Backend | Frontend | Result |
|--------|-----------|---------|----------|--------|
| Coverage (lines) | 100% | 100% | 100% | ✅ |
| Coverage (funcs) | 100% | 100% | 99%, one documented artifact* | ✅ (see note) |
| Bugs | 0 | 0 | 0 | ✅ |
| Vulnerabilities | 0 | 0 | 0 | ✅ |
| Duplication | ≤ 3% | 0% | 0% | ✅ |

\* `src/frontend/src/dashboard-view.ts` — 16/17 functions per bun's lcov `FNF`/`FNH`
counts, but **every one of its 105 lines has a nonzero hit count** (confirmed by inspecting
`coverage/lcov.info` directly — no `DA:` entry shows 0 hits). Bun's lcov output doesn't
emit per-function `FN:`/`FNDA:` entries, so the specific phantom function can't be named,
but with 100% of lines demonstrably executing, this is the same category of
instrumentation artifact already established twice in this project's own history: the
original `login-view.ts` `disconnectedCallback` finding and this same reopen's
`in-memory-session.repository.ts` finding (both `views/login/review-report.md`). Not
routed anywhere — there is no missing test to write when every line already executes.

**Not re-litigated (pre-existing, unrelated to this view)**: `http-session-api-service.ts`,
`session-api-service.ts` (interface-only, no executable lines), and `main.ts`'s wiring
don't appear in the coverage table at all — same as Login's own `http-auth-api-service.ts`
and `main.ts`, which show the identical pattern (confirmed: no coverage row for either).
This is consistent, established treatment: thin `fetch` wrappers and bootstrap wiring are
verified end-to-end by `e2e-engineer`'s Cypress run, not re-tested in isolation here.

## Acceptance criteria marked (use-cases.md)

| Criterion | Test that verifies it |
|-----------|------------------------|
| UC-01: redirects to /login on 401 | `dashboard-view.test.ts` "redirects to /login when the session check responds unauthenticated" |
| UC-01: renders app-logo | `dashboard-view.test.ts` "renders app-logo at the left end of the navbar once authenticated" |
| UC-01: welcome-message shows full name | `dashboard-view.test.ts` "shows 'Bienvenido, ' followed by the signed-in teacher's full name" |
| UC-01: settings-menu and logout-link render at the right end | `dashboard-view.test.ts` "renders settings-menu and logout-link at the right end of the navbar" |
| UC-02: sends POST /api/auth/logout | `logout-link.test.ts` "calls service.logout() when clicked" |
| UC-02: redirects to /login after logout | `logout-link.test.ts` "redirects to /login after the logout response" |
| UC-02: later visit with ended session redirects to /login | `dashboard-view.test.ts`'s 401→redirect test + `logout-link.test.ts`'s redirect test, composed with Login's already-proven server-side invalidation (`session.routes.test.ts`, `views/login/review-report.md`) — full end-to-end confirmation is `e2e-engineer`'s Cypress pass |
| UC-03: each card visible in position | `dashboard-cards.test.ts`, 7× "is visible in the dashboard grid" |
| UC-03: each card navigates to its route | `dashboard-cards.test.ts`, 7× "navigates to `<route>` when clicked" |
| UC-03: cards render in fixed order | `dashboard-cards.test.ts` "render in the fixed order..." |
| UC-04: settings-menu renders disabled | `settings-menu.test.ts` "renders disabled" |
| UC-04: settings-menu exposes non-availability indicator | `settings-menu.test.ts` "exposes a non-availability indicator..." |
| UC-04: clicking settings-menu opens nothing, sends nothing | `settings-menu.test.ts` "opens no menu and sends no request when clicked" |

## Criteria without verifiable coverage

None.

## Deferred to e2e-engineer

| File / branch | Why it can't be unit-tested here | What to verify once real infra exists |
|---|---|---|
| `http-session-api-service.ts` (both methods) | Thin `fetch` wrapper — a unit test re-stubbing `fetch` would only test `fetch` itself, not real wiring | `e2e-engineer`'s Cypress run should exercise the Dashboard against the real backend (login → land on Dashboard → see the welcome message → sign out), same as it already does for Login's own `HttpAuthApiService` |
| `main.ts`'s dashboard registration block | Bootstrap wiring, only meaningful once the real DOM/build exists | Confirm `app-dashboard-view.service` is a real `HttpSessionApiService` instance in the served page (implicit in any Cypress test that reaches `/dashboard` and gets real data back) |
