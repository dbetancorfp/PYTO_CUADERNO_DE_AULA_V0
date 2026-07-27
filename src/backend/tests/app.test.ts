// elementId: (backend infrastructure — app.ts is the composition root, no single elementId;
// see tecnologias/tecnologia_bbdd.md "app.ts is the composition root")
//
// This file exists specifically to close, up front, the coverage gap runs 1 and 2 of this
// view both hit: reviewer's 100% gate failing on app.ts's 'postgres' backend-selection
// branch and pg-client.ts's createPgClient, because nothing exercised them (see
// views/login/review-report.md from the prior run and this session's tdd-engineer.md
// process fix, commits b6a539f/f200dbb).
import { describe, it, expect } from 'bun:test';
import { createApp } from '../src/app';
import { createPgClient } from '../src/db/pg-client';

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
