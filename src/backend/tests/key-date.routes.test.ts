// elementId: academic-key-dates-table, holidays-table, public-holidays-table,
// free-disposal-days-table, evaluations-table, feoe-project-days-table (HTTP contract side
// of UC-02..UC-07 — see views/fechas-senaladas/api-contracts.md). One resource for all six
// categories: GET/POST /api/key-dates, PATCH/DELETE /api/key-dates/:id.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let cookie: string;

const VALID_CATEGORIES = [
  'academic_key_dates',
  'holidays',
  'public_holidays',
  'free_disposal_days',
  'evaluations',
  'feoe_project_days',
];

interface KeyDateBody {
  id: string;
  category: string;
  name: string;
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
  type: string | null;
}

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'key-dates@example.com',
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

async function createKeyDate(overrides: Partial<Record<string, unknown>> = {}): Promise<KeyDateBody> {
  const body = {
    category: 'holidays',
    name: `E2E Key Date ${Date.now()}-${Math.random()}`,
    startDay: 22,
    startMonth: 12,
    endDay: 7,
    endMonth: 1,
    ...overrides,
  };
  const response = await fetch(`${baseUrl}/api/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return (await response.json()) as KeyDateBody;
}

beforeAll(async () => {
  const user = await seededUser({});
  const app = createApp({ backend: 'memory', seedUsers: [user] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'key-dates@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);
});

afterAll(() => {
  server.close();
});

describe('elementId: academic-key-dates-table, holidays-table, public-holidays-table, free-disposal-days-table, evaluations-table, feoe-project-days-table', () => {
  it('GET /api/key-dates responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`);

    expect(response.status).toBe(401);
  });

  it('POST /api/key-dates creates a row and it then shows up in GET /api/key-dates', async () => {
    const created = await createKeyDate({ name: 'Vacaciones de Navidad.' });

    const response = await fetch(`${baseUrl}/api/key-dates`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { keyDates: KeyDateBody[] };

    expect(body.keyDates.some((k) => k.id === created.id && k.name === 'Vacaciones de Navidad.')).toBe(true);
  });

  it('POST /api/key-dates accepts every valid category', async () => {
    for (const category of VALID_CATEGORIES) {
      const created = await createKeyDate({ category, name: `Categoría ${category} ${Date.now()}-${Math.random()}` });
      expect(created.category).toBe(category);
    }
  });

  it('GET /api/key-dates?category=holidays only returns rows in that category', async () => {
    const created = await createKeyDate({ category: 'holidays', name: `Filtrada ${Date.now()}` });
    await createKeyDate({ category: 'evaluations', name: `Otra categoría ${Date.now()}` });

    const response = await fetch(`${baseUrl}/api/key-dates?category=holidays`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { keyDates: KeyDateBody[] };

    expect(body.keyDates.every((k) => k.category === 'holidays')).toBe(true);
    expect(body.keyDates.some((k) => k.id === created.id)).toBe(true);
  });

  it('GET /api/key-dates?category=unknown responds 400', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates?category=unknown`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates responds 400 for an invalid category', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'not-a-category', name: 'X', startDay: 1, startMonth: 1, endDay: 1, endMonth: 1 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates responds 400 for a missing/empty name', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'holidays', name: '', startDay: 1, startMonth: 1, endDay: 1, endMonth: 1 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates responds 400 for startDay outside 1-31', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'holidays', name: 'X', startDay: 32, startMonth: 1, endDay: 1, endMonth: 1 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates responds 400 for startMonth outside 1-12', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'holidays', name: 'X', startDay: 1, startMonth: 13, endDay: 1, endMonth: 1 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates responds 400 when startDay/startMonth is not a real day-in-month (31/02)', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'holidays', name: 'X', startDay: 31, startMonth: 2, endDay: 1, endMonth: 1 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates responds 400 when endDay/endMonth is not a real day-in-month (31/04)', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'holidays', name: 'X', startDay: 1, startMonth: 1, endDay: 31, endMonth: 4 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/key-dates persists type when provided and null when omitted', async () => {
    const withType = await createKeyDate({ category: 'public_holidays', name: `Con tipo ${Date.now()}`, type: 'Nacional' });
    const withoutType = await createKeyDate({ category: 'free_disposal_days', name: `Sin tipo ${Date.now()}` });

    expect(withType.type).toBe('Nacional');
    expect(withoutType.type).toBeNull();
  });

  it('POST /api/key-dates responds 409 for a duplicate (category, name, startDay, startMonth)', async () => {
    const name = `Duplicada ${Date.now()}`;
    await createKeyDate({ category: 'holidays', name, startDay: 5, startMonth: 6 });

    const response = await fetch(`${baseUrl}/api/key-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ category: 'holidays', name, startDay: 5, startMonth: 6, endDay: 6, endMonth: 6 }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('DUPLICATE_NAME');
  });

  it('PATCH /api/key-dates/:id renames a row', async () => {
    const created = await createKeyDate({ name: 'Nombre original' });

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Nombre renombrado' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as KeyDateBody;
    expect(body.name).toBe('Nombre renombrado');
  });

  it('PATCH /api/key-dates/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'X' }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/key-dates/:id responds 400 for an invalid date', async () => {
    const created = await createKeyDate({});

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startDay: 31, startMonth: 2 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/key-dates/:id responds 400 when the body fails schema validation', async () => {
    const created = await createKeyDate({});

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 123 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/key-dates/:id responds 400 when startDay is provided without startMonth', async () => {
    const created = await createKeyDate({});

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startDay: 10 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/key-dates/:id responds 400 when endDay is provided without endMonth', async () => {
    const created = await createKeyDate({});

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ endDay: 10 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/key-dates/:id responds 400 when endDay/endMonth is not a real day-in-month (31/04)', async () => {
    const created = await createKeyDate({});

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ endDay: 31, endMonth: 4 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/key-dates/:id responds 409 when the change collides with another row', async () => {
    const name = `Colisión PATCH ${Date.now()}`;
    await createKeyDate({ category: 'evaluations', name, startDay: 10, startMonth: 3 });
    const other = await createKeyDate({ category: 'evaluations', name: `Otra ${Date.now()}`, startDay: 11, startMonth: 3 });

    const response = await fetch(`${baseUrl}/api/key-dates/${other.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name, startDay: 10, startMonth: 3 }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('DUPLICATE_NAME');
  });

  it('DELETE /api/key-dates/:id deletes a row unconditionally', async () => {
    const created = await createKeyDate({});

    const response = await fetch(`${baseUrl}/api/key-dates/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
    const listResponse = await fetch(`${baseUrl}/api/key-dates`, { headers: { Cookie: cookie } });
    const listBody = (await listResponse.json()) as { keyDates: KeyDateBody[] };
    expect(listBody.keyDates.some((k) => k.id === created.id)).toBe(false);
  });

  it('DELETE /api/key-dates/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/key-dates/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});
