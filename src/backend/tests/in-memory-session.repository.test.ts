// elementId: session-guard, logout-session — direct unit test of InMemorySessionRepository,
// the concrete store backing SessionService. Sessions are never persisted to Postgres (see
// tecnologias/tecnologia_bbdd.md "User sessions are not persisted to the database"), so
// unlike PgUserRepository this has no fake-sql.ts-backed counterpart — this in-memory class
// IS the real implementation, not a test double, per description_login.md's Session section.
import { describe, it, expect } from 'bun:test';
import { InMemorySessionRepository } from '../src/repositories/in-memory/in-memory-session.repository';

describe('InMemorySessionRepository', () => {
  it('create() returns a session id that resolve() maps back to the same user', () => {
    const repo = new InMemorySessionRepository();

    const sessionId = repo.create({ fullName: 'Jane Doe' });

    expect(repo.resolve(sessionId)).toEqual({ fullName: 'Jane Doe' });
  });

  it('create() returns a different id for each session', () => {
    const repo = new InMemorySessionRepository();

    const first = repo.create({ fullName: 'Jane Doe' });
    const second = repo.create({ fullName: 'John Smith' });

    expect(first).not.toBe(second);
  });

  it('resolve() returns null for an id that was never created', () => {
    const repo = new InMemorySessionRepository();

    expect(repo.resolve('never-created')).toBeNull();
  });

  it('invalidate() makes a previously active session resolve to null afterward', () => {
    const repo = new InMemorySessionRepository();
    const sessionId = repo.create({ fullName: 'Jane Doe' });

    repo.invalidate(sessionId);

    expect(repo.resolve(sessionId)).toBeNull();
  });

  it('invalidate() on an unknown id does not throw (idempotent, per UC-06 A1)', () => {
    const repo = new InMemorySessionRepository();

    expect(() => repo.invalidate('never-created')).not.toThrow();
  });

  it('invalidate() called twice on the same id does not throw', () => {
    const repo = new InMemorySessionRepository();
    const sessionId = repo.create({ fullName: 'Jane Doe' });

    repo.invalidate(sessionId);

    expect(() => repo.invalidate(sessionId)).not.toThrow();
  });
});
