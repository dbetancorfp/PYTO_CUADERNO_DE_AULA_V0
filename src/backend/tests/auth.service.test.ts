// elementId: login-button (business-logic side of UC-01's main + alternative flows)
import { describe, it, expect } from 'bun:test';
import { AuthService } from '../src/services/auth.service';
import type { User, UserRepository } from '../src/repositories/user.repository';

function repositoryDouble(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: async () => null,
    incrementFailedAttempts: async () => null,
    resetFailedAttempts: async () => {},
    ...overrides,
  };
}

async function userWith(overrides: Partial<User>): Promise<User> {
  return {
    id: 'u1',
    email: 'ana@example.com',
    passwordHash: await Bun.password.hash('CorrectHorseBattery1'),
    failedAttempts: 0,
    isLocked: false,
    ...overrides,
  };
}

describe('elementId: login-button', () => {
  it('returns success and resets the failed-attempt counter for correct credentials', async () => {
    const user = await userWith({});
    const calls: { resetCalledWith: string | null } = { resetCalledWith: null };
    const repo = repositoryDouble({
      findByEmail: async (email) => (email === user.email ? user : null),
      resetFailedAttempts: async (email) => {
        calls.resetCalledWith = email;
      },
    });
    const service = new AuthService(repo);

    const result = await service.login(user.email, 'CorrectHorseBattery1');

    expect(result).toEqual({ outcome: 'success' });
    expect(calls.resetCalledWith).toBe(user.email);
  });

  it('returns invalid-credentials and increments the failed-attempt counter for a wrong password', async () => {
    const user = await userWith({});
    const calls: { incrementCalledWith: string | null } = { incrementCalledWith: null };
    const repo = repositoryDouble({
      findByEmail: async (email) => (email === user.email ? user : null),
      incrementFailedAttempts: async (email) => {
        calls.incrementCalledWith = email;
        return { ...user, failedAttempts: user.failedAttempts + 1 };
      },
    });
    const service = new AuthService(repo);

    const result = await service.login(user.email, 'TheWrongPassword1');

    expect(result).toEqual({ outcome: 'invalid-credentials' });
    expect(calls.incrementCalledWith).toBe(user.email);
  });

  it('returns invalid-credentials for an email that matches no account, without touching the repository counters', async () => {
    let incrementCalled = false;
    const repo = repositoryDouble({
      findByEmail: async () => null,
      incrementFailedAttempts: async () => {
        incrementCalled = true;
        return null;
      },
    });
    const service = new AuthService(repo);

    const result = await service.login('nobody@example.com', 'Whatever1');

    expect(result).toEqual({ outcome: 'invalid-credentials' });
    expect(incrementCalled).toBe(false);
  });

  it('returns account-locked for a locked account even with the correct password, without incrementing further', async () => {
    const user = await userWith({ isLocked: true, failedAttempts: 5 });
    let incrementCalled = false;
    const repo = repositoryDouble({
      findByEmail: async (email) => (email === user.email ? user : null),
      incrementFailedAttempts: async () => {
        incrementCalled = true;
        return user;
      },
    });
    const service = new AuthService(repo);

    const result = await service.login(user.email, 'CorrectHorseBattery1');

    expect(result).toEqual({ outcome: 'account-locked' });
    expect(incrementCalled).toBe(false);
  });

  it('still returns invalid-credentials (not account-locked) on the very attempt that reaches the lockout threshold', async () => {
    // Business rule (use-cases.md UC-01): the lock message only shows on the NEXT attempt —
    // the 5th failure itself still gets the generic wrong-credentials message.
    const user = await userWith({ failedAttempts: 4, isLocked: false });
    const repo = repositoryDouble({
      findByEmail: async (email) => (email === user.email ? user : null),
      incrementFailedAttempts: async () => ({ ...user, failedAttempts: 5, isLocked: true }),
    });
    const service = new AuthService(repo);

    const result = await service.login(user.email, 'TheWrongPassword1');

    expect(result).toEqual({ outcome: 'invalid-credentials' });
  });
});
