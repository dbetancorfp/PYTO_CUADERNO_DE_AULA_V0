import { createApp } from './app';
import { createPgClient } from './db/pg-client';
import { seedCatalogCurriculum } from './db/seed-catalog-curriculum';

const backend = process.env.DATA_BACKEND === 'postgres' ? 'postgres' : 'memory';
const databaseUrl = process.env.DATABASE_URL;
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp({ backend, databaseUrl });

if (backend === 'postgres' && databaseUrl) {
  // Idempotent — see seed-catalog-curriculum.ts. Keeps the shared catalog's official BOC
  // curriculum permanently present without depending on anyone remembering to run a script.
  await seedCatalogCurriculum(createPgClient(databaseUrl));
}

app.listen(port, () => {
  console.log(`Backend listening on port ${port} (DATA_BACKEND=${backend})`);
});
