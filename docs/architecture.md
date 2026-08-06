# Architecture

## Tech stack

| Layer | Technology |
|-------|------------|
| Agent execution | Claude Code — slash commands point to a role file in `lib/agents/*/*.md` |
| Coordination | Orchestrator agent (`lib/agents/orchestrator/`) |
| Artifact storage | Local filesystem (`views/`, `src/`) |
| Application database | PostgreSQL 16, real and live — `DATABASE_URL` configured |
| Postgres client | `Bun.SQL` native driver — no `pg`/node-postgres, no ORM |
| Backend | Bun + Express 5 + TypeScript |
| Pipeline artifact validation | Zod (`lib/schemas/`) |
| Frontend | Native Web Components + lit-html + Tailwind CSS 3.x + TypeScript |
| Frontend build | `bun build` + Tailwind CLI |
| Unit tests | `bun test` |
| E2E tests | Cypress |
| Code quality | SOLID (audited by the `reviewer` agent) + SonarCloud (100% coverage) |
| CI/CD | GitHub Actions |
| Docs | MkDocs + Material for MkDocs → GitHub Pages |

Full detail per layer in `tecnologias/` (repo root):
[`tecnologia_bbdd.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/tecnologias/tecnologia_bbdd.md),
[`tecnologia_code.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/tecnologias/tecnologia_code.md),
[`tecnologia_front.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/tecnologias/tecnologia_front.md),
[`tecnologia_qa.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/tecnologias/tecnologia_qa.md),
[`tecnologia_ux.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/tecnologias/tecnologia_ux.md).

(These five files keep their Spanish `tecnologia_*` filenames as an established repo
convention; their content is in English like the rest of the documentation.)

## Repository structure

```
views/
  <view-name>/
    description_<view-name>.md      # user input
    ui-spec.json                    # view-designer output
    functional-spec.json            # view-designer output
    use-cases.md                    # requirement-architect output
    api-contracts.md                # requirement-architect output
    schema-changes.sql              # requirement-architect output (if needed)
    review-report.md                # reviewer output

src/
  backend/
    src/                            # backend-implementer output
    tests/                          # tdd-engineer output (+ tests/helpers/fake-sql.ts, shared)
  frontend/
    src/                            # frontend-implementer output (Web Components)
    src/main.ts                     # e2e-engineer output (first use) — bootstrap entry
    index.html                      # e2e-engineer output (first use)
    dist/                           # bun build output
    tests/                          # tdd-engineer output
    cypress/e2e/                    # e2e-engineer output

lib/
  agents/          # one subdirectory per agent — .md only
  schemas/         # ui-spec.schema.js, functional-spec.schema.js (Zod)
  patterns/        # reusable structural templates (see "Pattern library")

scripts/
  db-seed-e2e.ts   # e2e-engineer output (first use) — deterministic Cypress fixtures

.claude/commands/  # one-line pointers to lib/agents/*/*.md
.claude/agents/    # Task-tool subagent defs — only backend-implementer + frontend-implementer, for genuine parallel dispatch (see Pipeline)
cli/commands/      # commit.md — the /commit slash command's role file (not a pipeline agent)
tecnologias/       # detailed stack decisions per layer
docs/              # this documentation (MkDocs)
.github/workflows/ # ci-setup output (on-demand) — ci.yml, e2e.yml, deploy-docs.yml
cypress.config.ts  # e2e-engineer output (first use)
tailwind.config.js # e2e-engineer output (first use)
```

## Pattern library

`lib/patterns/` holds structural templates — not runnable code — for shapes that repeat
across different views: backend CRUD (repository + service + route), cascading select,
reactive filter, inline-edit CRUD table. `backend-implementer` and `frontend-implementer`
check them (each only its own layer's patterns) before writing a service or component that
fits one of those shapes.

This was chosen over RAG/few-shot from prior views because, for this project, views are
meant to be very different from each other in content — what repeats is structural *shape*,
not the view itself. See [Pipeline](pipeline.md#rag-planned-not-built) for the reasoning
behind why RAG itself remains unbuilt.

## Frontend: Web Components

One file per component. Shadow DOM always open. Render with lit-html only — never
`innerHTML`. The hard constraint is **no nested Shadow DOM**: `data-element-id` must sit on
the native element for Cypress's and the unit tests' selectors to work, and a second nested
shadow root breaks both.

See the "Frontend: Web Components" section of
[`CLAUDE.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/CLAUDE.md)
for the full component skeleton and naming conventions.
