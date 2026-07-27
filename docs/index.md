# PYTO Base Para Generar Proyectos

A generic, domain-agnostic framework for generating web applications one view at a time,
through a pipeline of [Claude Code](https://claude.com/claude-code) agents coordinated by
an **Orchestrator** agent, backed by a real PostgreSQL database.

It does not generate a concrete application by itself: every use of this framework starts a
new project, view by view, from natural-language descriptions the user writes — no visual
mockup, no predefined domain.

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
- ⏳ `DATABASE_URL` pending configuration — see `.env.example`
- ⏳ RAG (`knowledge_base` with pgvector + embeddings) — designed, not built yet
- ⏳ No view generated yet

## Source of truth

The project's full rules live in
[`CLAUDE.md`](https://github.com/dbetancorfp/PYTO_CUADERNO_DE_AULA_V0/blob/main/CLAUDE.md)
at the repository root — this documentation summarizes it for human reading, but
`CLAUDE.md` wins in case of discrepancy.
