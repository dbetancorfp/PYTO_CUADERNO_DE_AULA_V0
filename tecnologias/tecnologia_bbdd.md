# Database technologies

Source: `src/backend/src/db/`, `src/backend/src/repositories/`, `views/<view>/schema-changes.sql`.

## Engine

- **PostgreSQL 16** — the only supported engine. The database is real and lives
  continuously (it isn't recreated per project): each view can contribute incremental
  `schema-changes.sql` (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS`) when it needs new tables or columns — there is no single monolithic `schema.sql`
  rewritten from scratch on every iteration (see `lib/agents/requirement-architect/`).
- **`pgcrypto`** extension enabled (`CREATE EXTENSION IF NOT EXISTS pgcrypto`) for SQL
  hashing functions and UUID generation (`gen_random_uuid()`), although application
  password hashing happens in the Bun layer (see below), not in PostgreSQL.
- Domain rules that span multiple tables (composite uniqueness, invariants a simple `CHECK`
  can't express) are implemented as **functions + triggers** when needed, not just
  `CHECK`/`UNIQUE`.
- No `ENUM` types: closed domains are enforced with `CHECK` on `VARCHAR`, by explicit
  project decision (see `CLAUDE.md`).

## Client / driver

- **`Bun.SQL`** (Bun's native SQL client, `import { SQL } from 'bun'`) — **no**
  `pg`/`node-postgres`, no ORM (Prisma, Drizzle, TypeORM...). It's the project's only data
  access package.
- `src/backend/src/db/pg-client.ts` — minimal factory: `createPgClient(databaseUrl) → new
  SQL(databaseUrl)`.
- `src/backend/src/db/sql-executor.ts` — two structural interfaces of our own (not Bun's)
  that scope the surface repositories need:
  - `SqlExecutor`: tagged-template signature (`` sql`SELECT ...${value}` ``) — allows safe
    query parameterization (no string concatenation) and lets the real client be swapped
    for a test double.
  - `TransactionalSqlExecutor`: adds `sql.begin(fn)` for multi-statement atomic
    transactions (only for writes that require atomicity across several tables).
- `src/backend/src/db/schema-bootstrap.ts` — applies a view's incremental DDL
  (`schema-changes.sql`) via `sql.file()`.

## Data access pattern

- **Repository pattern** with dependency inversion (DIP): every entity has an interface in
  `src/backend/src/repositories/*.repository.ts` (e.g. `EntityRepository`) and **two
  implementations**:
  - `src/backend/src/repositories/postgres/pg-*.repository.ts` — real implementation
    against Postgres via `Bun.SQL`.
  - `src/backend/src/repositories/in-memory/in-memory-*.repository.ts` — in-memory double
    (a `Map`/array per entity in `store.ts`), used in unit tests and in `DATA_BACKEND=memory`
    mode.
- `src/backend/src/app.ts` is the **composition root**: `buildRepositories(deps)` decides
  which implementation to inject based on `AppDeps.backend` (`'memory' | 'postgres'`).
  Routes and services only know the interfaces, never the concrete `Pg*`/`InMemory*`
  classes.
- Backend selection at runtime via environment variables (`src/backend/src/db/env.ts`):
  `DATA_BACKEND=memory|postgres` + `DATABASE_URL` (required if `postgres`, **still pending
  configuration in this project** — see `.env.example`) + `PORT`.
- User sessions are **not** persisted to the database: they live in an in-process `Map`
  (`InMemorySessionRepository`), shared regardless of the chosen data backend.

## Credential security

- Passwords: **`Bun.password`**, called with no explicit `algorithm` option — this defaults
  to **argon2id** (Bun's own default, not bcrypt), verified automatically by
  `Bun.password.verify` regardless of which algorithm produced the hash. Hashing and
  verification happen in the application layer (`AuthService`), not in SQL.
- Account lockout after a configurable number of failed attempts, tracked at the row level
  (columns like `failed_login_attempts`/`account_locked` on whatever user entity each
  project defines) — logic lives in `AuthService`, not in triggers.

## Scripts and environments

- `bun run db:setup` — applies the accumulated DDL against `DATABASE_URL`; an environment
  variable forces a full reset in local/test.
- `bun run db:seed:e2e` (`scripts/db-seed-e2e.ts`) — deterministic data for Cypress,
  created/extended by `e2e-engineer` the first time a view needs seeded fixtures (see
  `tecnologias/tecnologia_qa.md`).
- CI (`.github/workflows/ci.yml`, `e2e.yml` — on-demand outputs of `/ci-setup`, **not
  generated yet**; only `deploy-docs.yml` exists today): a `postgres:16` service container
  on GitHub Actions (no Testcontainers) to run `bun test` against a real database.
- Unit tests for Postgres repositories use a custom `Bun.SQL` double
  (`src/backend/tests/helpers/fake-sql.ts`), not a real database or Testcontainers —
  created once by `tdd-engineer`, mandatory for every new Postgres repository (see
  `lib/agents/tdd-engineer/tdd-engineer.md`).

## Bulk data import

When a view needs bulk data ingestion (CSV/JSON/YAML), the pattern is a parsing service
(`<entity>-parser.service.ts`) + an importer (`<entity>-importer.ts`) that talk to that
view's tables through its repositories — never direct SQL from the import layer. The
**`yaml`** package is available for YAML formats.
