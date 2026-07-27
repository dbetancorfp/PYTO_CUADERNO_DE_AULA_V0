# QA technologies (testing and quality)

Source: `package.json`, `.github/workflows/`, `sonar-project.properties`,
`lib/agents/reviewer/`, `lib/agents/tdd-engineer/`.

## Unit tests

- **`bun test`** (Bun's native runner, Jest-compatible API: `describe`/`it`/`expect`). Run
  with `--max-workers=1` (avoids race conditions between tests that share state/port on the
  backend).
- Every `describe()` references an `elementId` (mandatory `CLAUDE.md` convention) to trace
  each test back to the view element it verifies.
- **`@happy-dom/global-registrator`** — simulated DOM to test Web Components (Shadow DOM,
  `customElements`) inside `bun test`, without a real browser.
- Backend: Postgres repositories are tested with a custom `Bun.SQL` double
  (`src/backend/tests/helpers/fake-sql.ts`), not against a real database in unit tests.
  `tdd-engineer` creates this file once (the first view that needs a repository double) and
  reuses it for every subsequent view — see `tdd-engineer.md`'s "Postgres repositories
  always get their own unit test". This is mandatory, not optional: skipping it is exactly
  what makes `reviewer`'s 100% coverage gate fail on real, necessary Postgres-repository
  code that neither implementer can fix themselves — see `reviewer.md`'s
  `requires-tdd-engineer` verdict for the recovery path if it's ever missed.
- Coverage: `bun test --coverage --coverage-reporter=lcov` → `coverage/lcov.info`,
  consumed by SonarCloud. **Gate: 100% coverage** (see `lib/agents/reviewer/`).

## End-to-end tests

- **Cypress** — specs per use case in `src/frontend/cypress/e2e/uc-XX-*.cy.ts`, main flow +
  critical alternative flow per use case. Config: `cypress.config.ts` (repo root).
- `includeShadowDom: true` (required because of each component's Shadow DOM).
- **`start-server-and-test`** orchestrates starting the Express server in `DATA_BACKEND=
  postgres` mode + `cypress run` in a single command — wired up as `package.json`'s `e2e`
  script (`build` → `db:seed:e2e` → server up → `cypress run` → server down).
- Deterministic data seeded before each suite against real Postgres via
  `scripts/db-seed-e2e.ts` (`bun run db:seed:e2e`) — no network mocking in e2e. `e2e-engineer`
  creates/extends this script the first time a view needs seeded fixtures; see
  `e2e-engineer.md`'s Step 0, which also creates the Cypress config, the frontend build
  wiring, and the static-serving route the first time any of them is missing — no other
  agent in the pipeline owns that infrastructure.
- No CI workflow for Cypress (explicit in `CLAUDE.md`): e2e only runs locally, unlike unit
  tests, which do run in GitHub Actions.

### Runbook — backend port stuck after a killed e2e run

Seen during the Login e2e run: `start:e2e`'s server on port 3000 stayed listening after a
kill attempt and immediately respawned when a new one was started, blocking every later
`bun run e2e` on that port until the run was moved to 3050 instead.

1. Find what's actually listening: `lsof -i :3000` (or `ss -ltnp | grep 3000`) — get the real
   PID, don't assume it's the process you last started.
2. Kill that PID directly: `kill -9 <pid>`. If it respawns immediately, something else
   (a watcher, a leftover `start-server-and-test` supervisor, a duplicate instance from an
   earlier run) is restarting it — find and kill *that* parent process too, not just the
   child; killing the child alone loops forever.
3. Confirm the port is actually free before retrying: `lsof -i :3000 || echo free`. Don't
   just re-run `bun run e2e` and assume the kill worked.
4. If the port still won't release (rare — e.g. the OS holding it in `TIME_WAIT`), don't keep
   fighting it: run on a different port for that session (`PORT=3050 bun run start:e2e`,
   matching `cypress.config.ts`'s `baseUrl`) instead of blocking on the original one.
5. This is dev-environment friction, not a pipeline defect — no agent role should try to
   "fix" a stuck port; it's a manual step same as any other local process hygiene.

## Static analysis / code quality

- **Strict TypeScript** via `tsc --noEmit` (`type-check` script in `package.json`) — a type
  gate with no JS emitted (the real JS comes from `bun build`).
- **SonarCloud** (`sonarsource/sonarcloud-github-action`) — bugs, vulnerabilities, code
  smells, code duplication, and **100% coverage**, on every push to `main` and every PR.
  Configured via `sonar-project.properties` (excludes pipeline-generated artifacts,
  `docs/`, `dist/`, `site/`, non-code files) — **this file doesn't exist in the repo yet**;
  it gets created once SonarCloud is actually wired up (via `/ci-setup` or by hand).
  Complements (doesn't replace) `reviewer`'s SOLID review — SonarCloud doesn't detect
  object-oriented design violations.
- **SOLID** principles reviewed as an explicit checklist, audited by `reviewer`, which
  rejects the code and makes the Orchestrator re-invoke the implicated implementer(s)
  (`backend-implementer` and/or `frontend-implementer`) until it complies — or, for the one
  case neither implementer can fix (real, necessary code with no test at all, most often a
  Postgres repository), re-invokes `tdd-engineer` instead (`Layers implicated:
  requires-tdd-engineer`, see `reviewer.md`).

## CI/CD

- **GitHub Actions**:
  - `.github/workflows/ci.yml` — on-demand output of `/ci-setup`, **not generated yet**.
    Once generated: on push/PR, spins up a `postgres:16` service container, installs with
    `bun install --frozen-lockfile`, runs `bun test` with coverage, publishes to
    SonarCloud.
  - `.github/workflows/deploy-docs.yml` — **already exists and is active**: on changes to
    `docs/**`/`mkdocs.yml`, runs `mkdocs build --strict` (Python) →
    `actions/upload-pages-artifact` → `actions/deploy-pages` (GitHub Pages).
- There is no deployment pipeline for the application itself (only for the documentation).

## Agent-driven QA process (methodology, not a tool)

- **TDD is mandatory** (`CLAUDE.md`): tests red before implementation — `tdd-engineer`
  generates the tests from `functional-spec.json`'s acceptance criteria; `backend-implementer` and `frontend-implementer` write the minimal code to turn them green, in
  parallel, gated by `supervisor`.
- **Explicit human review** during the design phase (view-designer → requirement-architect
  → tdd-engineer): the Orchestrator doesn't move from one agent to the next without user
  approval.
- **Autonomous loop** during the build phase: `backend-implementer` + `frontend-implementer` (parallel) → `supervisor` (per-layer unit tests + integration/contract smoke
  test between the two) → `reviewer` (SOLID + SonarCloud, 100% coverage) → `e2e-engineer`,
  with an automatic, layer-targeted cycle restart on any failure (up to 10 cycles) — see
  `lib/agents/orchestrator/orchestrator.md`.
