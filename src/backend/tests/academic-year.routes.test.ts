// elementId: academic-year-table, academic-year-table-add-button,
// academic-year-delete-blocked-message, module-selection-table, module-selection-save-button
// (HTTP contract side of UC-04/UC-07 — see views/configuracion/api-contracts.md). New
// routes, don't exist yet — expected 404s until backend-implementer adds them.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let cookie: string;

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'academic-years@example.com',
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

async function createYear(name: string): Promise<{ id: string; name: string; isCurrent: boolean }> {
  const response = await fetch(`${baseUrl}/api/academic-years`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name }),
  });
  return (await response.json()) as { id: string; name: string; isCurrent: boolean };
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
    body: JSON.stringify({ email: 'academic-years@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);
});

afterAll(() => {
  server.close();
});

describe('elementId: academic-year-table', () => {
  it('POST /api/academic-years creates a year, never current on creation', async () => {
    const created = await createYear('2030/2031');

    expect(created.isCurrent).toBe(false);
  });

  it('POST /api/academic-years responds 409 for a duplicate name', async () => {
    await createYear('2031/2032');

    const response = await fetch(`${baseUrl}/api/academic-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '2031/2032' }),
    });

    expect(response.status).toBe(409);
  });

  it('PATCH /api/academic-years/:id renames a year', async () => {
    const year = await createYear('2041/2042');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '2041/2042 Renombrado' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe('2041/2042 Renombrado');
  });

  it('PATCH /api/academic-years/:id with neither name nor isCurrent returns the year unchanged', async () => {
    const year = await createYear('2042/2043');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; name: string; isCurrent: boolean };
    expect(body).toMatchObject({ id: year.id, name: '2042/2043', isCurrent: false });
  });

  it('PATCH /api/academic-years/:id with isCurrent:true un-marks the previously current year', async () => {
    const first = await createYear('2032/2033');
    const second = await createYear('2033/2034');

    await fetch(`${baseUrl}/api/academic-years/${first.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: true }),
    });
    await fetch(`${baseUrl}/api/academic-years/${second.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: true }),
    });

    const listResponse = await fetch(`${baseUrl}/api/academic-years`, { headers: { Cookie: cookie } });
    const body = (await listResponse.json()) as { academicYears: { id: string; isCurrent: boolean }[] };
    const firstRow = body.academicYears.find((y) => y.id === first.id);
    const secondRow = body.academicYears.find((y) => y.id === second.id);

    expect(firstRow?.isCurrent).toBe(false);
    expect(secondRow?.isCurrent).toBe(true);
  });

  it('DELETE /api/academic-years/:id responds 409 for the year marked current', async () => {
    const year = await createYear('2034/2035');
    await fetch(`${baseUrl}/api/academic-years/${year.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: true }),
    });

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('IS_CURRENT');
  });

  it('DELETE /api/academic-years/:id succeeds for a non-current year', async () => {
    const year = await createYear('2035/2036');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
  });

  it('POST /api/academic-years responds 400 for an empty name', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/academic-years/:id responds 400 for an empty name', async () => {
    const year = await createYear('2039/2040');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/academic-years/:id with neither name nor isCurrent responds 404 for a nonexistent id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/academic-years/:id responds 404 for a nonexistent id when renaming', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '2040/2041' }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/academic-years/:id responds 404 for a nonexistent id when marking current', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: true }),
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/academic-years/:id responds 404 for a nonexistent id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});

describe('elementId: module-selection-table, module-selection-save-button', () => {
  it('GET .../modules starts empty for a new academic year', async () => {
    const year = await createYear('2036/2037');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, { headers: { Cookie: cookie } });

    expect(await response.json()).toEqual({ moduleIds: [] });
  });

  it('PUT .../modules replaces the selection, GET reflects it', async () => {
    const year = await createYear('2037/2038');
    const cycleResponse = await fetch(`${baseUrl}/api/training-cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Ciclo Selección' }),
    });
    const cycle = (await cycleResponse.json()) as { id: string };
    const moduleResponse = await fetch(`${baseUrl}/api/training-cycles/${cycle.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Módulo Selección', course: 1 }),
    });
    const module = (await moduleResponse.json()) as { id: string };

    const putResponse = await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [module.id] }),
    });
    expect(putResponse.status).toBe(200);

    const getResponse = await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, { headers: { Cookie: cookie } });
    expect(await getResponse.json()).toEqual({ moduleIds: [module.id] });
  });

  it('PUT .../modules responds 404 when a submitted module id is not owned by this teacher', async () => {
    const year = await createYear('2038/2039');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: ['not-a-real-module'] }),
    });

    expect(response.status).toBe(404);
  });

  it('GET .../modules responds 404 for a nonexistent academic year id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000/modules`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('PUT .../modules responds 400 when moduleIds is not an array of strings', async () => {
    const year = await createYear('2039/2041');

    const response = await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: 'not-an-array' }),
    });

    expect(response.status).toBe(400);
  });
});
