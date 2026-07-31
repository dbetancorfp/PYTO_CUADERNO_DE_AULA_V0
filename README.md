# Cuaderno de Aula

A **Cuaderno de Aula** web application for teachers in the Canary Islands (Spain) public
education system, built one view at a time through a pipeline of
[Claude Code](https://claude.com/claude-code) agents coordinated by a conversational
**Orchestrator**, backed by a real PostgreSQL database.

A "cuaderno de aula" is the day-to-day classroom register a teacher keeps per group and
subject: learning situations delivered, marks against each evaluation criterion, and the
resulting degree of competency acquisition — consistent with the evaluation model set out
in Decreto 211/2022 and Orden de 31 de mayo de 2023 (Canary Islands), and with what feeds
the individual student file in the region's own school-management platforms (Pincel Ekade,
ProIDEAC). Each view is specified in natural language by the user and carried through the
pipeline into working, tested code — no visual mockup, no predefined UI.

📖 **Full documentation:** https://dbetancorfp.github.io/PYTO_CUADERNO_DE_AULA_V0/

📋 **Project rules and architecture:** [`CLAUDE.md`](CLAUDE.md)

## Getting started

Open this repository in Claude Code and talk to the Orchestrator:

```
/orchestrator
```

Then give it a view to design:

```
read views/<view>/description_<view>.md, tables: [...]
```

From there, the Orchestrator runs the rest of the pipeline's agents — stopping to ask for
your review during the design phase, and running autonomously (up to 10 cycles) during the
build phase. See the [pipeline docs](https://dbetancorfp.github.io/PYTO_CUADERNO_DE_AULA_V0/pipeline/)
for details.

## Running the app

Backend and frontend aren't two separate servers — the Bun+Express backend also serves the
built frontend as static files from the same origin. There's no separate frontend dev
server to start.

**Prerequisites:** [Bun](https://bun.sh) installed.

```bash
bun install
```

### Option A — in-memory backend (no database needed)

Fastest way to run the app locally; data resets every time the process restarts.

```bash
bun run build        # compiles src/frontend/src → dist (JS) + Tailwind CSS
bun run src/backend/src/index.ts
```

Open http://localhost:3000.

### Option B — real PostgreSQL backend

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to a real Postgres 16 instance.
2. Load the env vars and start with `DATA_BACKEND=postgres`:

   ```bash
   bun run build
   set -a && source .env && set +a
   DATA_BACKEND=postgres PORT=3000 bun run src/backend/src/index.ts
   ```

Open http://localhost:3000.

### Iterating on the frontend

Frontend changes need a rebuild (`bun run build`) before they show up — there's no
hot-reload dev server yet. Restart the backend process to pick up backend changes.

### Tests

```bash
bun test              # unit tests (backend + frontend)
bun run e2e            # full Cypress suite: build + seed + serve + run + teardown
                        # (requires DATABASE_URL — seeds/tears down real Postgres rows)
```

## Status

- ✅ Pipeline skeleton (agents, schemas, folder structure)
- ✅ First view built end to end: `login` (backend, frontend, unit tests, Cypress specs)
- ⏳ `DATABASE_URL` pending configuration — see [`.env.example`](.env.example)
- ⏳ RAG (`knowledge_base` with pgvector + embeddings) — designed, not built yet
- ⏳ CI limited to the docs deploy workflow (`deploy-docs.yml`) — no test/E2E workflow yet

## License

Not yet specified.
