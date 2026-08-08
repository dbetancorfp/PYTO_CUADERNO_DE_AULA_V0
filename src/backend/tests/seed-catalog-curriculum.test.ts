// Backend infrastructure — verifies the embedded BOC curriculum seed data itself (two
// ciclos, DAM and DAW, each 1º's 8 shared módulos plus its own 2º módulos) without touching
// a real database, same fake-sql pattern as seed-key-dates.test.ts.
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { seedCatalogCurriculum } from '../src/db/seed-catalog-curriculum';

describe('seedCatalogCurriculum', () => {
  it('inserts both cycles and every módulo, one call each, in order', async () => {
    const responses: Record<string, unknown>[][] = [];
    responses[0] = [{ id: 'cycle-dam' }]; // DAM's "INSERT INTO catalog_cycles ... RETURNING id"
    responses[17] = [{ id: 'cycle-daw' }]; // DAW's, after DAM's cycle + 16 módulo inserts
    const fakeSql = createFakeSql(responses);

    await seedCatalogCurriculum(fakeSql);

    // 2 cycle inserts + (8 shared + 8 DAM-specific) + (8 shared + 7 DAW-specific) módulos.
    expect(fakeSql.calls).toHaveLength(33);
    expect(sqlTextOf(fakeSql.calls[0]!)).toContain('INSERT INTO catalog_cycles');
    expect(fakeSql.calls[0]!.values).toContain('Desarrollo de Aplicaciones Multiplataforma');
    expect(sqlTextOf(fakeSql.calls[17]!)).toContain('INSERT INTO catalog_cycles');
    expect(fakeSql.calls[17]!.values).toContain('Desarrollo de Aplicaciones Web');

    for (const call of [...fakeSql.calls.slice(1, 17), ...fakeSql.calls.slice(18)]) {
      expect(sqlTextOf(call)).toContain('INSERT INTO catalog_modules');
    }
  });

  it('DAM módulo inserts reference the id returned by DAM\'s own cycle insert', async () => {
    const responses: Record<string, unknown>[][] = [];
    responses[0] = [{ id: 'cycle-dam' }];
    responses[17] = [{ id: 'cycle-daw' }];
    const fakeSql = createFakeSql(responses);

    await seedCatalogCurriculum(fakeSql);

    expect(fakeSql.calls[1]!.values).toContain('cycle-dam');
    expect(fakeSql.calls[18]!.values).toContain('cycle-daw');
  });
});
