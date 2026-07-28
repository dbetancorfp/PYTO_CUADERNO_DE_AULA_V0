// elementId: (backend infrastructure — no single elementId; backs email-input/
// password-input/login-button's server-side data needs, see api-contracts.md)
import { describe, it, expect } from 'bun:test';
import { createFakeSql, sqlTextOf } from './helpers/fake-sql';
import { PgUserRepository } from '../src/repositories/postgres/pg-user.repository';

describe('PgUserRepository', () => {
  it('findByEmail maps the returned row to the domain User shape', async () => {
    const fakeSql = createFakeSql([
      [
        {
          id: 'u1',
          email: 'ana@example.com',
          password_hash: 'hash1',
          failed_attempts: 2,
          is_locked: false,
          full_name: 'Ana García',
        },
      ],
    ]);
    const repo = new PgUserRepository(fakeSql);

    const user = await repo.findByEmail('ana@example.com');

    expect(user).toEqual({
      id: 'u1',
      email: 'ana@example.com',
      passwordHash: 'hash1',
      failedAttempts: 2,
      isLocked: false,
      fullName: 'Ana García',
    });
    expect(fakeSql.calls).toHaveLength(1);
    expect(sqlTextOf(fakeSql.calls[0])).toContain('SELECT');
    expect(sqlTextOf(fakeSql.calls[0])).toContain('FROM users');
    expect(fakeSql.calls[0].values).toEqual(['ana@example.com']);
  });

  it('findByEmail returns null when no row matches', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgUserRepository(fakeSql);

    const user = await repo.findByEmail('nobody@example.com');

    expect(user).toBeNull();
  });

  it('incrementFailedAttempts sends an atomic UPDATE ... RETURNING with the lockout threshold', async () => {
    const fakeSql = createFakeSql([
      [
        {
          id: 'u1',
          email: 'ana@example.com',
          password_hash: 'hash1',
          failed_attempts: 5,
          is_locked: true,
          full_name: 'Ana García',
        },
      ],
    ]);
    const repo = new PgUserRepository(fakeSql);

    const user = await repo.incrementFailedAttempts('ana@example.com');

    expect(user).toEqual({
      id: 'u1',
      email: 'ana@example.com',
      passwordHash: 'hash1',
      failedAttempts: 5,
      isLocked: true,
      fullName: 'Ana García',
    });
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('failed_attempts');
    expect(sql).toContain('is_locked');
    expect(sql).toContain('RETURNING');
    expect(fakeSql.calls[0].values).toEqual(['ana@example.com']);
  });

  it('incrementFailedAttempts returns null when the email matches no row', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgUserRepository(fakeSql);

    const user = await repo.incrementFailedAttempts('nobody@example.com');

    expect(user).toBeNull();
  });

  it('resetFailedAttempts sets failed_attempts back to zero for the given email', async () => {
    const fakeSql = createFakeSql([[]]);
    const repo = new PgUserRepository(fakeSql);

    await repo.resetFailedAttempts('ana@example.com');

    expect(fakeSql.calls).toHaveLength(1);
    const sql = sqlTextOf(fakeSql.calls[0]);
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('failed_attempts');
    expect(fakeSql.calls[0].values).toEqual(['ana@example.com']);
  });

  // Session gap (reopen, see views/login/schema-changes.sql): users.full_name is a new
  // column. findByEmail must select and map it so session-guard can resolve a display name.
  it('findByEmail includes full_name in the row-to-domain mapping', async () => {
    const fakeSql = createFakeSql([
      [
        {
          id: 'u1',
          email: 'ana@example.com',
          password_hash: 'hash1',
          failed_attempts: 2,
          is_locked: false,
          full_name: 'Ana García',
        },
      ],
    ]);
    const repo = new PgUserRepository(fakeSql);

    const user = await repo.findByEmail('ana@example.com');

    expect(user).toEqual({
      id: 'u1',
      email: 'ana@example.com',
      passwordHash: 'hash1',
      failedAttempts: 2,
      isLocked: false,
      fullName: 'Ana García',
    });
    expect(sqlTextOf(fakeSql.calls[0])).toContain('full_name');
  });
});
