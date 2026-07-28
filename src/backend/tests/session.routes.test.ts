// elementId: login-button (session side effect), session-guard, logout-session — HTTP
// contract side of UC-01's new acceptance criterion plus UC-05/UC-06 (see api-contracts.md
// POST /api/auth/login's Set-Cookie, GET /api/auth/session, POST /api/auth/logout). New
// routes, don't exist yet — expected 404s until backend-implementer adds them.
//
// `User` doesn't have `full_name`/`fullName` yet either (schema-changes.sql adds the column,
// backend-implementer adds the field) — `SeededUser` extends it locally here rather than
// editing the shared production type, so this file type-checks against today's `User` while
// still describing the shape the implementation will have.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

type SeededUser = User & { fullName: string };

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;

async function seededUser(overrides: Partial<SeededUser>): Promise<SeededUser> {
  return {
    id: 'u1',
    email: 'session-user@example.com',
    fullName: 'Jane Doe',
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
    body: JSON.stringify({ email: 'session-user@example.com', password: 'CorrectHorseBattery1' }),
  });
  return extractSessionCookie(response);
}

beforeAll(async () => {
  const user = await seededUser({});
  const app = createApp({ backend: 'memory', seedUsers: [user] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
});

afterAll(() => {
  server.close();
});

describe('elementId: login-button (session side effect)', () => {
  it('POST /api/auth/login sets an HttpOnly session_id cookie on success', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'session-user@example.com', password: 'CorrectHorseBattery1' }),
    });

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('session_id=');
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  it('POST /api/auth/login does not set a session_id cookie on wrong credentials', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'session-user@example.com', password: 'WrongPassword1' }),
    });

    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('elementId: session-guard', () => {
  it('GET /api/auth/session responds 401 when no session_id cookie is sent', async () => {
    const response = await fetch(`${baseUrl}/api/auth/session`);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Not authenticated' });
  });

  it('GET /api/auth/session responds 401 for a session_id cookie matching no active session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: 'session_id=does-not-exist' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Not authenticated' });
  });

  it('GET /api/auth/session responds 200 with the full name for an active session', async () => {
    const cookie = await loginAndGetCookie();

    const response = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fullName: 'Jane Doe' });
  });
});

describe('elementId: logout-session', () => {
  it('POST /api/auth/logout responds 200 and clears the session_id cookie', async () => {
    const cookie = await loginAndGetCookie();

    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Logged out' });
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('session_id=;');
  });

  it('a session_id ended by logout no longer authenticates against GET /api/auth/session', async () => {
    const cookie = await loginAndGetCookie();
    await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });

    const response = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(401);
  });

  it('POST /api/auth/logout responds 200 even with no session_id cookie at all (idempotent)', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Logged out' });
  });

  it('POST /api/auth/logout responds 200 for an already-ended session_id (idempotent)', async () => {
    const cookie = await loginAndGetCookie();
    await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });

    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
  });
});
