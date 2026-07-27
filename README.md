# Cuaderno de Aula

A **Cuaderno de Aula** (a teacher's digital classroom notebook) — attendance, grades and
continuous evaluation, per-student observations, and incidents — generated one view at a
time with the `PYTO_BASE_PARA_GENERAR_PROYECTOS` agent-pipeline framework: a pipeline of
[Claude Code](https://claude.com/claude-code) agents coordinated by a conversational
**Orchestrator**, backed by a real PostgreSQL database.

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

## Status

- ✅ Pipeline skeleton (agents, schemas, folder structure)
- ✅ `login` view generated (Phase A + B complete, `reviewer` PASS, Cypress green)
- ⏳ `DATABASE_URL` — configure your own; see [`.env.example`](.env.example)
- ⏳ RAG (`knowledge_base` with pgvector + embeddings) — designed, not built yet
- ⏳ Cuaderno de Aula's own domain views (students, groups, grades, attendance…) — not yet designed

## License

Not yet specified.
