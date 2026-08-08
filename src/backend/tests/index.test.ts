// Backend composition-root entrypoint. `main()` is exported and guarded by
// `import.meta.main` (see src/backend/src/index.ts) specifically so it can be called here
// with controlled env vars instead of only ever running for real via the CLI. The
// postgres-only branch takes injected fakes for bootstrapSchema/seedCatalogCurriculum/
// seedKeyDates instead of touching a real Postgres connection.
import { describe, it, expect, afterEach } from 'bun:test';
import type { Server } from 'node:http';
import { main } from '../src/index';
import { allocateTestPort } from './setup';

const originalEnv = { ...process.env };
let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
  process.env = { ...originalEnv };
});

describe('main (DATA_BACKEND=memory)', () => {
  it('starts listening with the in-memory backend when DATA_BACKEND is unset', async () => {
    const port = allocateTestPort();
    process.env.DATA_BACKEND = undefined;
    process.env.DATABASE_URL = undefined;
    process.env.PORT = String(port);

    server = await main();

    const response = await fetch(`http://127.0.0.1:${port}/api/auth/session`);
    expect(response.status).toBe(401);
  });
});

describe('main (DATA_BACKEND=postgres)', () => {
  it('applies the schema and seeds the catalog/key-dates before listening', async () => {
    const port = allocateTestPort();
    process.env.DATA_BACKEND = 'postgres';
    process.env.DATABASE_URL = 'postgres://fake-host-never-contacted/app';
    process.env.PORT = String(port);

    const calls: string[] = [];
    server = await main({
      bootstrapSchema: async () => {
        calls.push('bootstrapSchema');
      },
      seedCatalogCurriculum: async () => {
        calls.push('seedCatalogCurriculum');
      },
      seedKeyDates: async () => {
        calls.push('seedKeyDates');
      },
    });

    expect(calls).toEqual(['bootstrapSchema', 'seedCatalogCurriculum', 'seedKeyDates']);

    const response = await fetch(`http://127.0.0.1:${port}/api/auth/session`);
    expect(response.status).toBe(401);
  });
});
