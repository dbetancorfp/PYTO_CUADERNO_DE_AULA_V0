// elementId: training-cycle-table, training-cycle-table-add-button,
// training-cycle-delete-blocked-message (HTTP contract side of UC-05 — see
// views/configuracion/api-contracts.md GET/POST /api/training-cycles, PATCH/DELETE
// /api/training-cycles/:id). New routes, don't exist yet — expected 404s until
// backend-implementer adds them.
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
    email: 'training-cycles@example.com',
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

async function createCycle(name: string): Promise<{ id: string; name: string }> {
  const response = await fetch(`${baseUrl}/api/training-cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name }),
  });
  return (await response.json()) as { id: string; name: string };
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
    body: JSON.stringify({ email: 'training-cycles@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);
});

afterAll(() => {
  server.close();
});

describe('elementId: training-cycle-table', () => {
  it('GET /api/training-cycles responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles`);

    expect(response.status).toBe(401);
  });

  it('POST /api/training-cycles creates a cycle and it then shows up in GET', async () => {
    const created = await createCycle('Desarrollo de Aplicaciones Web');
    expect(created.name).toBe('Desarrollo de Aplicaciones Web');

    const response = await fetch(`${baseUrl}/api/training-cycles`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { trainingCycles: { id: string; name: string }[] };

    expect(body.trainingCycles.some((c) => c.id === created.id && c.name === created.name)).toBe(true);
  });

  it('POST /api/training-cycles responds 409 for a duplicate name', async () => {
    await createCycle('Sistemas Microinformáticos');

    const response = await fetch(`${baseUrl}/api/training-cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Sistemas Microinformáticos' }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('DUPLICATE_NAME');
  });

  it('POST /api/training-cycles responds 400 for an empty name', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/training-cycles/:id renames a cycle', async () => {
    const created = await createCycle('Comercio');

    const response = await fetch(`${baseUrl}/api/training-cycles/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Comercio Renombrado' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe('Comercio Renombrado');
  });

  it('PATCH /api/training-cycles/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles/unknown-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'X' }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/training-cycles/:id responds 400 for an empty name', async () => {
    const created = await createCycle('Administración y Gestión');

    const response = await fetch(`${baseUrl}/api/training-cycles/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('DELETE /api/training-cycles/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles/unknown-id`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/training-cycles/:id deletes an unreferenced cycle', async () => {
    const created = await createCycle('Peluquería');

    const response = await fetch(`${baseUrl}/api/training-cycles/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
    const listResponse = await fetch(`${baseUrl}/api/training-cycles`, { headers: { Cookie: cookie } });
    const body = (await listResponse.json()) as { trainingCycles: { id: string }[] };
    expect(body.trainingCycles.some((c) => c.id === created.id)).toBe(false);
  });

  it('DELETE /api/training-cycles/:id responds 409 when a module of this cycle is selected by an academic year', async () => {
    const cycle = await createCycle('Estética');
    const moduleResponse = await fetch(`${baseUrl}/api/training-cycles/${cycle.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Estética Facial', course: 1 }),
    });
    const module = (await moduleResponse.json()) as { id: string };
    const yearResponse = await fetch(`${baseUrl}/api/academic-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Test Year Estética' }),
    });
    const year = (await yearResponse.json()) as { id: string };
    await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [module.id] }),
    });

    const response = await fetch(`${baseUrl}/api/training-cycles/${cycle.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; academicYears: { id: string; name: string }[] };
    expect(body.code).toBe('HAS_DEPENDENTS');
    expect(body.academicYears.some((y) => y.id === year.id)).toBe(true);
  });
});
