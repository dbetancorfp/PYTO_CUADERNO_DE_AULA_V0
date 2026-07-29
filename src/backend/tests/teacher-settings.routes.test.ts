// elementId: teacher-full-name-input, teacher-save-name-button, teacher-name-save-message,
// teacher-current-password-input, teacher-new-password-input, teacher-repeat-password-input,
// teacher-save-password-button, teacher-password-save-message (HTTP contract side of
// UC-01/UC-02 — see views/configuracion/api-contracts.md PATCH /api/teacher/name, PATCH
// /api/teacher/password). New routes, don't exist yet — expected 404s until
// backend-implementer adds them.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'teacher-settings@example.com',
    fullName: 'Ana García',
    passwordHash: await Bun.password.hash('CorrectHorseBattery1'),
    failedAttempts: 0,
    isLocked: false,
    ...overrides,
  };
}

function extractSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/session_id=([^;]+)/);
  if (!match) throw new Error(`no session_id cookie in response: ${setCookie}`);
  return `session_id=${match[1]}`;
}

async function loginAndGetCookie(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'teacher-settings@example.com', password: 'CorrectHorseBattery1' }),
  });
  return extractSessionCookie(response);
}

beforeAll(async () => {
  const user = await seededUser({});
  // Dedicated to the one test that actually changes a password — kept separate so that
  // mutation doesn't affect any other test's login-with-original-password expectations.
  const passwordChangeUser = await seededUser({
    id: 'teacher-2',
    email: 'teacher-password-change@example.com',
  });
  const app = createApp({ backend: 'memory', seedUsers: [user, passwordChangeUser] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
});

afterAll(() => {
  server.close();
});

describe('elementId: teacher-save-name-button', () => {
  it('PATCH /api/teacher/name responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/teacher/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Nuevo Nombre' }),
    });

    expect(response.status).toBe(401);
  });

  it('PATCH /api/teacher/name responds 200 and updates the name for a valid session', async () => {
    const cookie = await loginAndGetCookie();

    const response = await fetch(`${baseUrl}/api/teacher/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ fullName: 'Nuevo Nombre' }),
    });

    expect(response.status).toBe(200);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookie } });
    expect(await sessionResponse.json()).toEqual({ fullName: 'Nuevo Nombre' });
  });

  it('PATCH /api/teacher/name responds 400 when fullName is empty', async () => {
    const cookie = await loginAndGetCookie();

    const response = await fetch(`${baseUrl}/api/teacher/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ fullName: '' }),
    });

    expect(response.status).toBe(400);
  });
});

describe('elementId: teacher-save-password-button', () => {
  it('PATCH /api/teacher/password responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/teacher/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'CorrectHorseBattery1', newPassword: 'NewPassword2' }),
    });

    expect(response.status).toBe(401);
  });

  it('PATCH /api/teacher/password responds 401 with a wrong current password, without changing it', async () => {
    const cookie = await loginAndGetCookie();

    const response = await fetch(`${baseUrl}/api/teacher/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: 'TheWrongPassword1', newPassword: 'NewPassword2' }),
    });

    expect(response.status).toBe(401);

    // the old password still works
    const loginAgain = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher-settings@example.com', password: 'CorrectHorseBattery1' }),
    });
    expect(loginAgain.status).toBe(200);
  });

  it('PATCH /api/teacher/password responds 200 and the new password works for the next login', async () => {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher-password-change@example.com', password: 'CorrectHorseBattery1' }),
    });
    const cookie = extractSessionCookie(loginResponse);

    const response = await fetch(`${baseUrl}/api/teacher/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ currentPassword: 'CorrectHorseBattery1', newPassword: 'BrandNewPassword3' }),
    });

    expect(response.status).toBe(200);

    const loginWithNewPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher-password-change@example.com', password: 'BrandNewPassword3' }),
    });
    expect(loginWithNewPassword.status).toBe(200);
  });

  it('PATCH /api/teacher/password responds 400 when currentPassword is missing', async () => {
    const cookie = await loginAndGetCookie();

    const response = await fetch(`${baseUrl}/api/teacher/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ newPassword: 'NewPassword2' }),
    });

    expect(response.status).toBe(400);
  });
});
