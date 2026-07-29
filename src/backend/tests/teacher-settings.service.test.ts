// elementId: teacher-full-name-input, teacher-save-name-button, teacher-current-password-input,
// teacher-new-password-input, teacher-save-password-button (business-logic side of UC-01/UC-02,
// see views/configuracion/use-cases.md). New module, doesn't exist yet.
import { describe, it, expect } from 'bun:test';
import { TeacherSettingsService } from '../src/services/teacher-settings.service';
import { DomainError } from '../src/errors/domain-error';
import type { User, UserRepository } from '../src/repositories/user.repository';

function repositoryDouble(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findByEmail: async () => null,
    findById: async () => null,
    incrementFailedAttempts: async () => null,
    resetFailedAttempts: async () => {},
    updateFullName: async () => {},
    updatePasswordHash: async () => {},
    ...overrides,
  };
}

async function userWith(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'ana@example.com',
    fullName: 'Ana García',
    passwordHash: await Bun.password.hash('CorrectHorseBattery1'),
    failedAttempts: 0,
    isLocked: false,
    ...overrides,
  };
}

describe('TeacherSettingsService — updateFullName', () => {
  it('updates the full name for the given teacher id', async () => {
    const calls: { updatedWith: [string, string] | null } = { updatedWith: null };
    const repo = repositoryDouble({
      updateFullName: async (id, fullName) => {
        calls.updatedWith = [id, fullName];
      },
    });
    const service = new TeacherSettingsService(repo);

    await service.updateFullName('teacher-1', 'Nuevo Nombre');

    expect(calls.updatedWith).toEqual(['teacher-1', 'Nuevo Nombre']);
  });
});

describe('TeacherSettingsService — changePassword', () => {
  it('updates the password hash when the current password matches', async () => {
    const user = await userWith({});
    const calls: { updatedId: string | null; updatedHash: string | null } = {
      updatedId: null,
      updatedHash: null,
    };
    const repo = repositoryDouble({
      findById: async (id) => (id === user.id ? user : null),
      updatePasswordHash: async (id, passwordHash) => {
        calls.updatedId = id;
        calls.updatedHash = passwordHash;
      },
    });
    const service = new TeacherSettingsService(repo);

    await service.changePassword(user.id, 'CorrectHorseBattery1', 'NewPassword2');

    expect(calls.updatedId).toBe(user.id);
    expect(calls.updatedHash).not.toBeNull();
    expect(calls.updatedHash).not.toBe(user.passwordHash);
    // the stored value really is a hash of the new password, not the plaintext
    expect(await Bun.password.verify('NewPassword2', calls.updatedHash!)).toBe(true);
  });

  it('throws DomainError(INVALID_CREDENTIALS) when the current password does not match, without updating anything', async () => {
    const user = await userWith({});
    let updateCalled = false;
    const repo = repositoryDouble({
      findById: async (id) => (id === user.id ? user : null),
      updatePasswordHash: async () => {
        updateCalled = true;
      },
    });
    const service = new TeacherSettingsService(repo);

    await expect(service.changePassword(user.id, 'TheWrongPassword1', 'NewPassword2')).rejects.toThrow(
      DomainError,
    );
    expect(updateCalled).toBe(false);
  });

  it('the rejected error carries code INVALID_CREDENTIALS', async () => {
    const user = await userWith({});
    const repo = repositoryDouble({ findById: async (id) => (id === user.id ? user : null) });
    const service = new TeacherSettingsService(repo);
    let caught: unknown = null;

    try {
      await service.changePassword(user.id, 'TheWrongPassword1', 'NewPassword2');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe('INVALID_CREDENTIALS');
  });
});
