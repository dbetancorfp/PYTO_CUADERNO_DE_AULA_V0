// elementId: catalog-module-table, catalog-module-table-add-button (HTTP contract side of
// UC-05 — see views/configuracion/api-contracts.md). New routes, don't exist yet — expected
// 404s until backend-implementer adds them. No HAS_DEPENDENTS / confirm-flow cases here —
// catalog_modules has no FK relation to anything year-related, edit and delete are always
// immediate (unlike the old, now-dropped modules table).
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let cookie: string;
let cycleId: string;

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'catalog-modules@example.com',
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

async function createModule(name: string, course: number): Promise<{ id: string; name: string; course: number }> {
  const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${cycleId}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name, course }),
  });
  return (await response.json()) as { id: string; name: string; course: number };
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
    body: JSON.stringify({ email: 'catalog-modules@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);
  const cycleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'DAW' }),
  });
  cycleId = ((await cycleResponse.json()) as { id: string }).id;
});

afterAll(() => {
  server.close();
});

describe('elementId: catalog-module-table', () => {
  it('POST .../modules responds 400 for course outside 1-2', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${cycleId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Programación', course: 3 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST .../modules creates a module and it shows up in GET .../modules', async () => {
    const created = await createModule('Programación', 1);

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${cycleId}/modules`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { modules: { id: string }[] };

    expect(body.modules.some((m) => m.id === created.id)).toBe(true);
  });

  it('POST .../modules responds 409 for a duplicate (name, course) within the cycle', async () => {
    await createModule('Bases de Datos', 2);

    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/${cycleId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Bases de Datos', course: 2 }),
    });

    expect(response.status).toBe(409);
  });

  it('POST .../modules responds 404 for a nonexistent cycleId', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/00000000-0000-0000-0000-000000000000/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Programación', course: 1 }),
    });

    expect(response.status).toBe(404);
  });

  it('GET .../modules responds 404 for a nonexistent cycleId', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/training-cycles/00000000-0000-0000-0000-000000000000/modules`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/catalog/modules/:id saves immediately, unconditionally', async () => {
    const created = await createModule('Sistemas Informáticos', 1);

    const response = await fetch(`${baseUrl}/api/catalog/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Sistemas Informáticos II' }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string };
    expect(body.name).toBe('Sistemas Informáticos II');
  });

  it('PATCH /api/catalog/modules/:id responds 400 for an empty name', async () => {
    const created = await createModule('Programación de Servicios', 1);

    const response = await fetch(`${baseUrl}/api/catalog/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/catalog/modules/:id responds 400 for a course outside 1-2', async () => {
    const created = await createModule('Despliegue de Aplicaciones Web', 1);

    const response = await fetch(`${baseUrl}/api/catalog/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ course: 3 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/catalog/modules/:id changes just the course when only course is submitted', async () => {
    const created = await createModule('Instalaciones de Telecomunicaciones', 1);

    const response = await fetch(`${baseUrl}/api/catalog/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ course: 2 }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { course: number; name: string };
    expect(body.course).toBe(2);
    expect(body.name).toBe('Instalaciones de Telecomunicaciones');
  });

  it('PATCH /api/catalog/modules/:id responds 404 for a nonexistent module id', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/modules/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Nombre Cualquiera' }),
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/catalog/modules/:id deletes a module unconditionally', async () => {
    const created = await createModule('Formación y Orientación Laboral', 2);

    const response = await fetch(`${baseUrl}/api/catalog/modules/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
  });

  it('DELETE /api/catalog/modules/:id responds 404 for a nonexistent module id', async () => {
    const response = await fetch(`${baseUrl}/api/catalog/modules/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});
