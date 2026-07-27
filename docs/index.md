# Cuaderno de Aula

A **Cuaderno de Aula** web application for teachers in the Canary Islands (Spain) public
education system, built one view at a time through a pipeline of
[Claude Code](https://claude.com/claude-code) agents coordinated by an **Orchestrator**
agent, backed by a real PostgreSQL database.

A "cuaderno de aula" is the day-to-day classroom register a teacher keeps per group and
subject: learning situations delivered, marks against each evaluation criterion, and the
resulting degree of competency acquisition — consistent with the evaluation model set out
in Decreto 211/2022 and Orden de 31 de mayo de 2023 (Canary Islands), and with what feeds
the individual student file in the region's own school-management platforms (Pincel Ekade,
ProIDEAC). Each view (student/group management, evaluation criteria, grading, learning
situations, reports, etc.) is specified in natural language by the user and carried through
the pipeline below into working, tested code — no visual mockup, no predefined UI.

## Getting started

Talk to the Orchestrator:

```
/orchestrator
```

And give it a view to design:

```
read views/<view>/description_<view>.md, tables: [...]
```

From there, the Orchestrator runs the rest of the pipeline's agents — stopping to ask for
your review during the design phase, and running autonomously (up to 10 cycles) during the
build phase.

See [Pipeline](pipeline.md) for the two phases and the agents involved, and
[Architecture](architecture.md) for the technical stack decisions.

## Project status

- ✅ Pipeline skeleton (agents, schemas, folder structure)
- ✅ First view built end to end: `login` (backend, frontend, unit tests, Cypress specs)
- ⏳ `DATABASE_URL` pending configuration — see `.env.example`
- ⏳ RAG (`knowledge_base` with pgvector + embeddings) — designed, not built yet
- ⏳ CI limited to the docs deploy workflow (`deploy-docs.yml`) — no test/E2E workflow yet

## Source of truth

The project's full rules live in
[`CLAUDE.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/CLAUDE.md)
at the repository root — this documentation summarizes it for human reading, but
`CLAUDE.md` wins in case of discrepancy.
