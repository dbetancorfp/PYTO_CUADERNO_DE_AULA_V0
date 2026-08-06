// Manual CLI entry point for src/backend/src/db/seed-catalog-curriculum.ts — that function
// now also runs automatically on every DATA_BACKEND=postgres server boot (see index.ts), so
// this script is only needed to seed a database without starting the server (e.g. a fresh
// environment before first boot). Idempotent, safe to re-run.
import { createPgClient } from '../src/backend/src/db/pg-client';
import { seedCatalogCurriculum } from '../src/backend/src/db/seed-catalog-curriculum';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the catalog curriculum.');
}

await seedCatalogCurriculum(createPgClient(databaseUrl));
console.log('Catalog curriculum seeded.');
