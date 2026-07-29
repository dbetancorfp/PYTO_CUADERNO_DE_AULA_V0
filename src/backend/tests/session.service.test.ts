// elementId: session-guard, logout-session (SessionService covers both non-visual
// responsibilities: resolving who's currently signed in, and ending a session — see
// use-cases.md UC-05/UC-06). New module, doesn't exist yet — expected to fail to resolve
// until backend-implementer creates src/backend/src/services/session.service.ts and
// src/backend/src/repositories/session.repository.ts (see api-contracts.md GET
// /api/auth/session, POST /api/auth/logout).
import { describe, it, expect } from 'bun:test';
import { SessionService } from '../src/services/session.service';
import type { SessionRepository, SessionUser } from '../src/repositories/session.repository';

function repositoryDouble(overrides: Partial<SessionRepository> = {}): SessionRepository {
  return {
    create: () => 'session-1',
    resolve: () => null,
    invalidate: () => {},
    ...overrides,
  };
}

describe('SessionService', () => {
  it('start() creates a session via the repository and returns its id', () => {
    const calls: { createdWith: SessionUser | null } = { createdWith: null };
    const repo = repositoryDouble({
      create: (user: SessionUser) => {
        calls.createdWith = user;
        return 'session-abc';
      },
    });
    const service = new SessionService(repo);

    const sessionId = service.start({ id: 'u1', fullName: 'Jane Doe' });

    expect(sessionId).toBe('session-abc');
    expect(calls.createdWith).toEqual({ id: 'u1', fullName: 'Jane Doe' });
  });

  it('resolve() returns the signed-in user for an active session id', () => {
    const repo = repositoryDouble({
      resolve: (sessionId: string) => (sessionId === 'session-abc' ? { id: 'u1', fullName: 'Jane Doe' } : null),
    });
    const service = new SessionService(repo);

    expect(service.resolve('session-abc')).toEqual({ id: 'u1', fullName: 'Jane Doe' });
  });

  it('resolve() returns null when no session_id is provided', () => {
    const service = new SessionService(repositoryDouble());

    expect(service.resolve(undefined)).toBeNull();
  });

  it('resolve() returns null when session_id matches no active session', () => {
    const service = new SessionService(repositoryDouble({ resolve: () => null }));

    expect(service.resolve('unknown-session')).toBeNull();
  });

  it('end() invalidates the session via the repository', () => {
    const calls: { invalidatedWith: string | null } = { invalidatedWith: null };
    const repo = repositoryDouble({
      invalidate: (sessionId: string) => {
        calls.invalidatedWith = sessionId;
      },
    });
    const service = new SessionService(repo);

    service.end('session-abc');

    expect(calls.invalidatedWith).toBe('session-abc');
  });

  it('end() does not throw when session_id is undefined (idempotent, per UC-06 A1)', () => {
    const service = new SessionService(repositoryDouble());

    expect(() => service.end(undefined)).not.toThrow();
  });

  it('a session resolved after end() returns null', () => {
    let active: SessionUser | null = { id: 'u1', fullName: 'Jane Doe' };
    const repo = repositoryDouble({
      resolve: () => active,
      invalidate: () => {
        active = null;
      },
    });
    const service = new SessionService(repo);

    service.end('session-abc');

    expect(service.resolve('session-abc')).toBeNull();
  });
});
