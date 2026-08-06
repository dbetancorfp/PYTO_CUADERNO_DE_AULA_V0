# Cuaderno de Aula

A **Cuaderno de Aula** web application for Vocational Training (Formación Profesional)
teachers in the Canary Islands (Spain) public education system, built one view at a time
through a pipeline of [Claude Code](https://claude.com/claude-code) agents coordinated by
an **Orchestrator** agent, backed by a real PostgreSQL database.

A "cuaderno de aula" is the day-to-day classroom register a teacher keeps per training
cycle (*ciclo formativo*) and professional module (*módulo profesional*): recording the
work units and learning situations delivered, planning and grading tasks, projects and
objective tests, marking student performance against each evaluation criterion, and
tracking the resulting degree of competency acquisition — consistent with the evaluation
model for Vocational Training set out in Ley Orgánica 3/2022, Real Decreto 659/2023, and the
Canary Islands' own annual evaluation-instructions resolution for Formación Profesional,
which also governs the FEOE (work-placement) phase. In the region's own school-management
platforms (Pincel Ekade, ProIDEAC) this register is what feeds each student's individual
file. Each view (student/group management, evaluation criteria, grading, learning
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
- ✅ Three views built end to end: `login`, `dashboard`, `configuracion` (backend, frontend,
  unit tests, Cypress specs) — see [Database](database.md) for the schema they've built up
- ✅ `DATABASE_URL` configured — the application database is real and live
- ✅ CI: `ci.yml` (build/test), `e2e.yml` (Cypress), `deploy-docs.yml` (this site)
- ⏳ RAG (`knowledge_base` with pgvector + embeddings) — designed, not built yet

## Source of truth

The project's full rules live in
[`CLAUDE.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/CLAUDE.md)
at the repository root — this documentation summarizes it for human reading, but
`CLAUDE.md` wins in case of discrepancy.
