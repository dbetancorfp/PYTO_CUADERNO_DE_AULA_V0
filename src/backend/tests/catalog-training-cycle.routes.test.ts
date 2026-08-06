// elementId: catalog-training-cycle-table, catalog-training-cycle-table-add-button
// (HTTP contract side of UC-04 — see views/configuracion/api-contracts.md GET/POST
// /api/catalog/training-cycles, PATCH/DELETE /api/catalog/training-cycles/:id). Delete IS
// dependency-blocked (409 HAS_DEPENDENTS, fix for #4, 2026-08-06) when some academic year
// still has one of the cycle's módulos assigned — cascading past that would otherwise
// violate academic_year_modules_catalog_module_id_fkey.
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
    email: 'catalog-training-cycles@example.com',
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
  const response = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
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
    body: JSON.stringify({ email: 'catalog-training-cycles@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);
});

afterAll(() => {
  server.close();
});

describe('elementId: catalog-training-cycle-table', () => {
  it('GET /api/catalog/training-cycles responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles`);

    expect(response.status).toBe(401);
  });

  it('POST /api/catalog/training-cycles creates a cycle and it then shows up in GET', async () => {
    const created = await createCycle('Desarrollo de Aplicaciones Web');
    expect(created.name).toBe('Desarrollo de Aplicaciones Web');

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { trainingCycles: { id: string; name: string }[] };

    expect(body.trainingCycles.some((c) => c.id === created.id && c.name === created.name)).toBe(true);
  });

  it('POST /api/catalog/training-cycles responds 409 for a duplicate name', async () => {
    await createCycle('Sistemas Microinformáticos');

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Sistemas Microinformáticos' }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('DUPLICATE_NAME');
  });

  it('POST /api/catalog/training-cycles responds 400 for an empty name', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/catalog/training-cycles/:id renames a cycle', async () => {
    const created = await createCycle('Comercio');

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Comercio Renombrado' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe('Comercio Renombrado');
  });

  it('PATCH /api/catalog/training-cycles/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/unknown-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'X' }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/catalog/training-cycles/:id responds 400 for an empty name', async () => {
    const created = await createCycle('Administración y Gestión');

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('DELETE /api/catalog/training-cycles/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/unknown-id`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/catalog/training-cycles/:id cascade-deletes its módulos when none is assigned to an academic year', async () => {
    const created = await createCycle('Peluquería');
    await fetch(`${baseUrl}/api/catalog/training-cycles/${created.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Estética Facial', course: 1 }),
    });

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
    const listResponse = await fetch(`${baseUrl}/api/catalog/training-cycles`, { headers: { Cookie: cookie } });
    const body = (await listResponse.json()) as { trainingCycles: { id: string }[] };
    expect(body.trainingCycles.some((c) => c.id === created.id)).toBe(false);
  });

  it('DELETE /api/catalog/training-cycles/:id responds 409 HAS_DEPENDENTS when a módulo of the cycle is assigned to an academic year', async () => {
    const created = await createCycle('Estética Integral');
    const moduleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles/${created.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Anatomía Aplicada', course: 1 }),
    });
    const module = (await moduleResponse.json()) as { id: string };

    const selectionResponse = await fetch(`${baseUrl}/api/academic-years/selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 4002, moduleIds: [module.id] }),
    });
    const year = ((await selectionResponse.json()) as { academicYear: { id: string } }).academicYear;

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('HAS_DEPENDENTS');

    const modulesResponse = await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, { headers: { Cookie: cookie } });
    const assignmentId = ((await modulesResponse.json()) as { modules: { id: string }[] }).modules[0]!.id;
    await fetch(`${baseUrl}/api/academic-year-modules/${assignmentId}`, { method: 'DELETE', headers: { Cookie: cookie } });
    await fetch(`${baseUrl}/api/academic-years/${year.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  });
});
