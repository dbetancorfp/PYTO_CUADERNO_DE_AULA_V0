import type { Server } from 'node:http';
import { SQL } from 'bun';
import { createApp } from './app';
import { createPgClient } from './db/pg-client';
import { bootstrapSchema } from './db/schema-bootstrap';
import { seedCatalogCurriculum } from './db/seed-catalog-curriculum';
import { seedKeyDates } from './db/seed-key-dates';

interface MainDeps {
  bootstrapSchema: typeof bootstrapSchema;
  seedCatalogCurriculum: typeof seedCatalogCurriculum;
  seedKeyDates: typeof seedKeyDates;
}

const defaultDeps: MainDeps = { bootstrapSchema, seedCatalogCurriculum, seedKeyDates };

// Exported (rather than run as a bare top-level script) and guarded by `import.meta.main`
// below so a unit test can `import { main }` and call it with controlled env vars — without
// this, importing this module would immediately call `app.listen()` for real. Behavior for
// the actual CLI entry point (`bun run src/backend/src/index.ts`) is unchanged: Bun sets
// `import.meta.main` to `true` only for the file it was invoked on directly, which calls
// `main()` with no arguments — the same `defaultDeps` used in production either way. `deps`
// exists only so a unit test can inject fakes for the postgres-only branch below without a
// real Postgres connection; production never passes it. Returns the listening `Server` so a
// test can close it afterward — production discards it.
export async function main(deps: MainDeps = defaultDeps): Promise<Server> {
  const backend = process.env.DATA_BACKEND === 'postgres' ? 'postgres' : 'memory';
  const databaseUrl = process.env.DATABASE_URL;
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  const app = createApp({ backend, databaseUrl });

  if (backend === 'postgres' && databaseUrl) {
    // Idempotent — see schema-bootstrap.ts. Applies every view's schema-changes.sql before
    // anything below touches the database.
    await deps.bootstrapSchema(new SQL(databaseUrl));
    // Idempotent — see seed-catalog-curriculum.ts. Keeps the shared catalog's official BOC
    // curriculum permanently present without depending on anyone remembering to run a script.
    await deps.seedCatalogCurriculum(createPgClient(databaseUrl));
    // Idempotent — see seed-key-dates.ts. Keeps the shared school calendar template
    // permanently present, same reasoning as seedCatalogCurriculum above.
    await deps.seedKeyDates(createPgClient(databaseUrl));
  }

  return app.listen(port, () => {
    console.log(`Backend listening on port ${port} (DATA_BACKEND=${backend})`);
  });
}

if (import.meta.main) {
  await main();
}
