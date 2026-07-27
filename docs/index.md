# Cuaderno de Aula

A **Cuaderno de Aula** (a teacher's digital classroom notebook) — attendance, grades and
continuous evaluation, per-student observations, and incidents, in the spirit of official
platforms like the Canary Islands' **Pincel Ekade** — generated one view at a time through a
pipeline of [Claude Code](https://claude.com/claude-code) agents coordinated by an
**Orchestrator** agent, backed by a real PostgreSQL database. Built on the generic,
domain-agnostic `PYTO_BASE_PARA_GENERAR_PROYECTOS` agent-pipeline framework.

Every view still starts from a natural-language description the user writes — no visual
mockup — but every view built here targets this one concrete domain (see `CLAUDE.md`'s
"Project" section for the full domain framing).

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
- ✅ `login` view generated (Phase A + B complete, `reviewer` PASS, Cypress green)
- ⏳ `DATABASE_URL` — configure your own; see `.env.example`
- ⏳ RAG (`knowledge_base` with pgvector + embeddings) — designed, not built yet
- ⏳ Cuaderno de Aula's own domain views (students, groups, grades, attendance…) — not yet designed

## Source of truth

The project's full rules live in
[`CLAUDE.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/CLAUDE.md)
at the repository root — this documentation summarizes it for human reading, but
`CLAUDE.md` wins in case of discrepancy.
