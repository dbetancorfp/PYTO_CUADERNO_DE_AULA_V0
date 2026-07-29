// elementId: (backend infrastructure — app.ts is the composition root, no single elementId;
// see tecnologias/tecnologia_bbdd.md "app.ts is the composition root")
//
// This file exists specifically to close, up front, the coverage gap runs 1 and 2 of this
// view both hit: reviewer's 100% gate failing on app.ts's 'postgres' backend-selection
// branch and pg-client.ts's createPgClient, because nothing exercised them (see
// views/login/review-report.md from the prior run and this session's tdd-engineer.md
// process fix, commits b6a539f/f200dbb).
import { describe, it, expect, afterAll, beforeAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import { createPgClient } from '../src/db/pg-client';
import { allocateTestPort } from './setup';

describe('createApp — composition root', () => {
  it('builds a working app when backend is "memory"', () => {
    // Full HTTP contract behavior is covered by auth.routes.test.ts (which does start a real
    // listener) — this only proves createApp itself doesn't throw for the memory backend.
    expect(() => createApp({ backend: 'memory' })).not.toThrow();
  });

  it('wires a PgUserRepository when backend is "postgres" and databaseUrl is provided, without connecting', () => {
    // Bun.SQL's constructor doesn't connect eagerly, so this proves the wiring (not
    // real connectivity, which supervisor's integration smoke test covers against the
    // real database once e2e-engineer's infra exists).
    expect(() =>
      createApp({ backend: 'postgres', databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/db' }),
    ).not.toThrow();
  });

  it('throws a clear error when backend is "postgres" and no databaseUrl is available', () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => createApp({ backend: 'postgres' })).toThrow(/DATABASE_URL/);
    } finally {
      if (originalDatabaseUrl !== undefined) process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('falls back to process.env.DATABASE_URL when backend is "postgres" and no explicit databaseUrl is passed', () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/db';

    try {
      expect(() => createApp({ backend: 'postgres' })).not.toThrow();
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});

describe('createPgClient', () => {
  it('returns a callable SqlExecutor without connecting', () => {
    const client = createPgClient('postgresql://user:pass@127.0.0.1:5432/db');

    expect(typeof client).toBe('function');
  });
});

// Reviewer's requires-tdd-engineer verdict (views/login/review-report.md, 2026-07-28):
// GET /login (src/app.ts's static-file route, wired by e2e-engineer after this view's
// original reviewer pass) had zero coverage — real, correctly-working code, just untested.
describe('createApp — GET /login static route', () => {
  const port = allocateTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: Server;

  beforeAll(async () => {
    const app = createApp({ backend: 'memory' });
    await new Promise<void>((resolve) => {
      server = app.listen(port, () => resolve());
    });
  });

  afterAll(() => {
    server.close();
  });

  it('serves the frontend index.html', async () => {
    const response = await fetch(`${baseUrl}/login`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    // index.html has no static view tags (see main.ts: each view is created via
    // document.createElement only after its service is wired, avoiding a connectedCallback-
    // before-service-is-set race) — the one static invariant is the bootstrap script itself.
    expect(await response.text()).toContain('<script type="module" src="/dist/main.js">');
  });
});

// e2e-engineer Step 0 (views/dashboard/review-report.md context): a browser hitting
// /dashboard directly (not via LoginView's client-side redirect) needs the server to serve
// index.html there too, same as /login — added proactively alongside its own test this
// time, per the /login precedent above (added post-reviewer, uncovered until the next
// cycle caught it).
describe('createApp — GET /dashboard static route', () => {
  const port = allocateTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: Server;

  beforeAll(async () => {
    const app = createApp({ backend: 'memory' });
    await new Promise<void>((resolve) => {
      server = app.listen(port, () => resolve());
    });
  });

  afterAll(() => {
    server.close();
  });

  it('serves the frontend index.html', async () => {
    const response = await fetch(`${baseUrl}/dashboard`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<script type="module" src="/dist/main.js">');
  });
});

// Same precedent as /dashboard above: a browser hitting either Configuración route
// directly needs the server to serve index.html there too.
describe('createApp — GET /configuracion/profesor and /configuracion/ano-academico static routes', () => {
  const port = allocateTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: Server;

  beforeAll(async () => {
    const app = createApp({ backend: 'memory' });
    await new Promise<void>((resolve) => {
      server = app.listen(port, () => resolve());
    });
  });

  afterAll(() => {
    server.close();
  });

  it('serves the frontend index.html for /configuracion/profesor', async () => {
    const response = await fetch(`${baseUrl}/configuracion/profesor`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<script type="module" src="/dist/main.js">');
  });

  it('serves the frontend index.html for /configuracion/ano-academico', async () => {
    const response = await fetch(`${baseUrl}/configuracion/ano-academico`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<script type="module" src="/dist/main.js">');
  });
});
