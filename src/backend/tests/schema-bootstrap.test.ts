// Verifies bootstrapSchema applies pgcrypto + every view's schema-changes.sql, in the right
// dependency order, without touching a real Postgres database — a local fake standing in
// for schema-bootstrap.ts's SchemaSqlClient (tagged-template call + .file()), since the
// shared fake-sql.ts helper (src/backend/tests/helpers/fake-sql.ts) only covers the
// narrower SqlExecutor shape repositories use.
import { describe, it, expect } from 'bun:test';
import { bootstrapSchema, type SchemaSqlClient } from '../src/db/schema-bootstrap';

interface FakeSchemaSqlCalls {
  taggedTemplateCalls: string[];
  fileCalls: string[];
}

function createFakeSchemaSql(): SchemaSqlClient & FakeSchemaSqlCalls {
  const taggedTemplateCalls: string[] = [];
  const fileCalls: string[] = [];

  const fakeSql = ((strings: TemplateStringsArray) => {
    taggedTemplateCalls.push(strings.join(''));
    return Promise.resolve([]);
  }) as SchemaSqlClient & FakeSchemaSqlCalls;

  fakeSql.file = (filename: string) => {
    fileCalls.push(filename);
    return Promise.resolve([]);
  };
  fakeSql.taggedTemplateCalls = taggedTemplateCalls;
  fakeSql.fileCalls = fileCalls;

  return fakeSql;
}

describe('bootstrapSchema', () => {
  it('enables pgcrypto before applying any schema file', async () => {
    const sql = createFakeSchemaSql();

    await bootstrapSchema(sql);

    expect(sql.taggedTemplateCalls).toHaveLength(1);
    expect(sql.taggedTemplateCalls[0]).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  });

  it('applies every view\'s schema-changes.sql in dependency order', async () => {
    const sql = createFakeSchemaSql();

    await bootstrapSchema(sql);

    expect(sql.fileCalls).toEqual([
      'views/login/schema-changes.sql',
      'views/configuracion/schema-changes.sql',
      'views/fechas-senaladas/schema-changes.sql',
      'views/calendario/schema-changes.sql',
    ]);
  });
});
