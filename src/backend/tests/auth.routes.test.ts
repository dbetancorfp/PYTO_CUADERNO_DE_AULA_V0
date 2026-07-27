// elementId: login-button (HTTP contract side of UC-01 — see api-contracts.md POST /api/auth/login)
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
    id: 'u1',
    email: 'e2e-valid-user@example.com',
    passwordHash: await Bun.password.hash('CorrectHorseBattery1'),
    failedAttempts: 0,
    isLocked: false,
    ...overrides,
  };
}

beforeAll(async () => {
  const validUser = await seededUser({});
  const lockedUser = await seededUser({
    id: 'u2',
    email: 'e2e-locked-user@example.com',
    failedAttempts: 5,
    isLocked: true,
  });
  const app = createApp({ backend: 'memory', seedUsers: [validUser, lockedUser] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
});

afterAll(() => {
  server.close();
});

describe('elementId: login-button', () => {
  it('POST /api/auth/login responds 200 with a success message for valid credentials', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-valid-user@example.com', password: 'CorrectHorseBattery1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Login successful' });
  });

  it('POST /api/auth/login responds 401 with the generic message for a wrong password', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-valid-user@example.com', password: 'TheWrongPassword1' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Incorrect email or password' });
  });

  it('POST /api/auth/login responds 401 with the same generic message for an unknown email', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'Whatever1' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Incorrect email or password' });
  });

  it('POST /api/auth/login responds 403 with the locked-account message, even with the correct password', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-locked-user@example.com', password: 'CorrectHorseBattery1' }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: 'This account has been locked due to too many failed attempts. Contact support.',
    });
  });

  it('POST /api/auth/login responds 400 when email is missing', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Whatever1' }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/auth/login responds 400 when password is missing', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-valid-user@example.com' }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/auth/login responds 400 when email is an empty string', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: 'Whatever1' }),
    });

    expect(response.status).toBe(400);
  });
});
