// Applies every view's incremental `schema-changes.sql`, in dependency order, against a
// real Postgres database. This is the mechanism tecnologias/tecnologia_bbdd.md documents
// under "Client / driver" ("`schema-bootstrap.ts` — applies a view's incremental DDL via
// `sql.file()`") — it existed only as documentation until now, which is why a fresh
// Postgres database (e.g. CI's `e2e.yml` job, or a first-time local setup) had no tables at
// all: nothing ever called `sql.file()` on any `schema-changes.sql`. Called from both
// `index.ts` (every `DATA_BACKEND=postgres` boot — idempotent, self-healing) and
// `scripts/db-seed-e2e.ts` (which needs the schema in place before it seeds, and runs
// before the server itself boots in the `e2e` script chain).
import { SQL } from 'bun';

// login creates `users`; configuracion's `academic_years` references it. calendario's
// `calendario_modulo` references configuracion's `academic_year_modules`. fechas-senaladas
// has no cross-view dependency. Order matters here; nothing else does.
const SCHEMA_FILES_IN_ORDER: readonly string[] = [
  'views/login/schema-changes.sql',
  'views/configuracion/schema-changes.sql',
  'views/fechas-senaladas/schema-changes.sql',
  'views/calendario/schema-changes.sql',
];

export async function bootstrapSchema(databaseUrl: string): Promise<void> {
  const sql = new SQL(databaseUrl);
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  for (const relativePath of SCHEMA_FILES_IN_ORDER) {
    await sql.file(relativePath);
  }
}
