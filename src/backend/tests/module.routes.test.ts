// elementId: module-cycle-select, module-table, module-table-add-button,
// module-delete-blocked-message, module-edit-confirm-modal (HTTP contract side of UC-06 —
// see views/configuracion/api-contracts.md). New routes, don't exist yet — expected 404s
// until backend-implementer adds them.
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
    email: 'modules@example.com',
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
  const response = await fetch(`${baseUrl}/api/training-cycles/${cycleId}/modules`, {
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
    body: JSON.stringify({ email: 'modules@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);
  const cycleResponse = await fetch(`${baseUrl}/api/training-cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'DAW' }),
  });
  cycleId = ((await cycleResponse.json()) as { id: string }).id;
});

afterAll(() => {
  server.close();
});

describe('elementId: module-table', () => {
  it('POST .../modules responds 400 for course outside 1-3', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles/${cycleId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Programación', course: 4 }),
    });

    expect(response.status).toBe(400);
  });

  it('POST .../modules creates a module and it shows up in GET .../modules', async () => {
    const created = await createModule('Programación', 1);

    const response = await fetch(`${baseUrl}/api/training-cycles/${cycleId}/modules`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { modules: { id: string }[] };

    expect(body.modules.some((m) => m.id === created.id)).toBe(true);
  });

  it('POST .../modules responds 409 for a duplicate (name, course) within the cycle', async () => {
    await createModule('Bases de Datos', 2);

    const response = await fetch(`${baseUrl}/api/training-cycles/${cycleId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Bases de Datos', course: 2 }),
    });

    expect(response.status).toBe(409);
  });

  it('GET /api/modules lists modules across cycles with their cycle name', async () => {
    const created = await createModule('Entornos de Desarrollo', 1);

    const response = await fetch(`${baseUrl}/api/modules`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { modules: { id: string; trainingCycleName: string }[] };
    const found = body.modules.find((m) => m.id === created.id);

    expect(found).toBeDefined();
    expect(found?.trainingCycleName).toBe('DAW');
  });

  it('POST .../modules responds 404 for a nonexistent cycleId', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles/00000000-0000-0000-0000-000000000000/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Programación', course: 1 }),
    });

    expect(response.status).toBe(404);
  });

  it('GET .../modules responds 404 for a nonexistent cycleId', async () => {
    const response = await fetch(`${baseUrl}/api/training-cycles/00000000-0000-0000-0000-000000000000/modules`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});

describe('elementId: module-edit-confirm-modal', () => {
  it('PATCH /api/modules/:id saves immediately for an unreferenced module', async () => {
    const created = await createModule('Sistemas Informáticos', 1);

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Sistemas Informáticos II' }),
    });

    expect(response.status).toBe(200);
  });

  it('PATCH /api/modules/:id responds 409 HAS_DEPENDENTS, naming the academic year, when referenced and confirm is omitted', async () => {
    const created = await createModule('Aplicaciones Web', 1);
    const yearResponse = await fetch(`${baseUrl}/api/academic-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Test Year Modules' }),
    });
    const year = (await yearResponse.json()) as { id: string; name: string };
    await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [created.id] }),
    });

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Aplicaciones Web II' }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; academicYears: { id: string }[] };
    expect(body.code).toBe('HAS_DEPENDENTS');
    expect(body.academicYears.some((y) => y.id === year.id)).toBe(true);

    const confirmedResponse = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Aplicaciones Web II', confirm: true }),
    });
    expect(confirmedResponse.status).toBe(200);
  });

  it('PATCH /api/modules/:id responds 400 for an empty name', async () => {
    const created = await createModule('Programación de Servicios', 1);

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/modules/:id responds 400 for a course outside 1-3', async () => {
    const created = await createModule('Despliegue de Aplicaciones Web', 1);

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ course: 4 }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/modules/:id changes just the course when only course is submitted', async () => {
    const created = await createModule('Instalaciones de Telecomunicaciones', 1);

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ course: 2 }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { course: number; name: string };
    expect(body.course).toBe(2);
    expect(body.name).toBe('Instalaciones de Telecomunicaciones');
  });

  it('PATCH /api/modules/:id responds 404 for a nonexistent module id', async () => {
    const response = await fetch(`${baseUrl}/api/modules/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Nombre Cualquiera' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('elementId: module-delete-blocked-message', () => {
  it('DELETE /api/modules/:id deletes an unreferenced module', async () => {
    const created = await createModule('Formación y Orientación Laboral', 2);

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
  });

  it('DELETE /api/modules/:id responds 409 when referenced by an academic year', async () => {
    const created = await createModule('Empresa e Iniciativa Emprendedora', 2);
    const yearResponse = await fetch(`${baseUrl}/api/academic-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name: 'Test Year Mod Del' }),
    });
    const year = (await yearResponse.json()) as { id: string };
    await fetch(`${baseUrl}/api/academic-years/${year.id}/modules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [created.id] }),
    });

    const response = await fetch(`${baseUrl}/api/modules/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('HAS_DEPENDENTS');
  });

  it('DELETE /api/modules/:id responds 404 for a nonexistent module id', async () => {
    const response = await fetch(`${baseUrl}/api/modules/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});
