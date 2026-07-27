# Code technologies (backend, language, architecture, pipeline)

Source: `package.json`, `src/backend/`, `lib/`, `CLAUDE.md`.

## Language and runtime

- **TypeScript** (compiler `^6.0.3`) in `strict` mode for all production code (backend +
  frontend + `lib/`). `CLAUDE.md` rule: no `any`, no implicit returns, no untyped
  parameters.
- **Bun** as the only runtime — no Node.js in production. Bun covers: running the server,
  the test runner, bundling (`bun build`), the package manager (`bun.lock`), the native SQL
  client (`Bun.SQL`), and password hashing (`Bun.password`).
- Native ES modules (`"type": "module"` in `package.json`).

## Backend

- **Express `^5.2.1`** — HTTP router. Express 5 automatically forwards exceptions from
  `async` handlers to the global error middleware (`app.ts`), no manual `try/catch` needed
  in every route.
- **`cookie-parser`** — session via a `session_id` cookie (no JWT, no `express-session`).
- One Express router per entity in `src/backend/src/routes/` + `multipart.ts` for file
  uploads (when a view needs them) + `error.ts` (centralized mapping of domain error codes
  → HTTP status, `STATUS_MAP` table).
- **Layered architecture**: `routes/` (HTTP) → `services/` (business logic) →
  `repositories/` (data access, interface + swappable implementation — see
  `tecnologia_bbdd.md`). Single composition root in `app.ts` (Dependency Inversion).
- **`pdfkit`** — available for real PDF generation when a view requires it.
- **`yaml`** — parsing YAML-imported data.
- Domain errors as classes with a `code` (string) + optional `role`, centrally mapped to
  HTTP status (400/401/403/404/409/423/500) in `routes/error.ts` — no handler decides the
  HTTP status directly.

## Validation

- **Zod** — used to validate the agent pipeline's JSON artifacts (`lib/schemas/*.schema.js`:
  `UISpecSchema`, `FunctionalSpecSchema`). Zod is **not** used to validate HTTP payloads at
  runtime — input validation there is manual (explicit checks in services/routes).

## Agent-driven generation pipeline (Claude Code)

- The **Orchestrator** (`lib/agents/orchestrator/orchestrator.md`) is the single
  conversational entry point: it decides which agent to run next, manages human review
  during the design phase, and the autonomous loop during the build phase.
- Every subordinate agent is a **Markdown role** (`lib/agents/<agent>/<agent>.md`) that
  Claude Code reads and runs directly in-session — no separate orchestration process, no
  intermediate database; each agent reads/writes directly to the repository's filesystem
  (`views/<view>/`, `src/{backend,frontend}/`).
- Entry via **slash commands** (`.claude/commands/*.md`, one-line pointers to the role) or
  the `Skill` tool.
- No agent today has a standalone `.js` script that calls the Anthropic API on its own —
  all of them, including the Orchestrator, run as a Markdown role inside a Claude Code
  session.
- `lib/tools/rag-client.js` doesn't exist yet: the `knowledge_base` (pgvector + embeddings)
  was designed during the project's kickoff conversation but is pending to be built — it
  will be documented here once real code exists, not before.
- `cli/commands/commit.md` — the only file left from a previous standalone CLI; it's the
  prompt for the `/commit` skill, not JS code.

## Code conventions

- Naming: `kebab-case.ts` for files, `PascalCase` for classes, domain events as
  `app:verb-noun`.
- **SOLID** principles are mandatory for all generated code, verified by `reviewer`.
- Language: all code, types, names, comments, error messages, logs and commits in
  **English**; domain vocabulary and UI strings may use the concrete project's own
  language when they reflect real usage.
