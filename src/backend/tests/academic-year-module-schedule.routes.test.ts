// elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select,
// schedule-thursday-select, schedule-friday-select, schedule-save-button,
// schedule-save-message (HTTP contract side of UC-11 — see
// views/configuracion/api-contracts.md "Horario" section). New routes, don't exist yet —
// expected 404s until backend-implementer mounts GET/PUT /:id/schedule on the existing
// /api/academic-year-modules router (academic-year-module.routes.ts).
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let cookie: string;
let academicYearModuleId: string;

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'schedule@example.com',
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

beforeAll(async () => {
  const user = await seededUser({});
  const app = createApp({ backend: 'memory', seedUsers: [user] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'schedule@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);

  const cycleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Desarrollo de Aplicaciones Web' }),
  });
  const cycleId = ((await cycleResponse.json()) as { id: string }).id;

  const moduleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles/${cycleId}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Programación', course: 1 }),
  });
  const catalogModuleId = ((await moduleResponse.json()) as { id: string }).id;

  const yearResponse = await fetch(`${baseUrl}/api/academic-years/selection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ startYear: 2026, moduleIds: [catalogModuleId] }),
  });
  const yearBody = (await yearResponse.json()) as { academicYear: { id: string } };

  const modulesResponse = await fetch(`${baseUrl}/api/academic-years/${yearBody.academicYear.id}/modules`, {
    headers: { Cookie: cookie },
  });
  const modulesBody = (await modulesResponse.json()) as { modules: { id: string }[] };
  academicYearModuleId = modulesBody.modules[0]!.id;
});

afterAll(() => {
  server.close();
});

describe('elementId: schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select, schedule-thursday-select, schedule-friday-select', () => {
  it('GET /api/academic-year-modules/:id/schedule responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`);

    expect(response.status).toBe(401);
  });

  it('GET /api/academic-year-modules/:id/schedule responds 200 with an empty array for a módulo with no saved schedule', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { schedule: { weekday: number; hours: number }[] };
    expect(body.schedule).toEqual([]);
  });

  it('GET /api/academic-year-modules/:id/schedule responds 404 for a well-formed id that matches no assignment', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/00000000-0000-0000-0000-000000000000/schedule`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});

describe('elementId: schedule-save-button', () => {
  it('PUT /api/academic-year-modules/:id/schedule responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: [] }),
    });

    expect(response.status).toBe(401);
  });

  it('PUT /api/academic-year-modules/:id/schedule persists the full weekly schedule, reflected on the next GET', async () => {
    const putResponse = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 2 }, { weekday: 5, hours: 3 }] }),
    });

    expect(putResponse.status).toBe(200);
    const putBody = (await putResponse.json()) as { schedule: { weekday: number; hours: number }[] };
    expect(putBody.schedule.slice().sort((a, b) => a.weekday - b.weekday)).toEqual([
      { weekday: 1, hours: 2 },
      { weekday: 5, hours: 3 },
    ]);

    const getResponse = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      headers: { Cookie: cookie },
    });
    const getBody = (await getResponse.json()) as { schedule: { weekday: number; hours: number }[] };
    expect(getBody.schedule.slice().sort((a, b) => a.weekday - b.weekday)).toEqual([
      { weekday: 1, hours: 2 },
      { weekday: 5, hours: 3 },
    ]);
  });

  it('PUT /api/academic-year-modules/:id/schedule removes a weekday left out of a later save (full replace, not a partial patch)', async () => {
    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 2, hours: 1 }, { weekday: 4, hours: 2 }] }),
    });

    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 2, hours: 3 }] }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { schedule: { weekday: number; hours: number }[] };
    expect(body.schedule).toEqual([{ weekday: 2, hours: 3 }]);
  });

  it('PUT /api/academic-year-modules/:id/schedule responds 400 when schedule is missing', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it('PUT /api/academic-year-modules/:id/schedule responds 400 when schedule is not an array', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: 'nope' }),
    });

    expect(response.status).toBe(400);
  });

  it('PUT /api/academic-year-modules/:id/schedule responds 400 for a weekday outside 1-5', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 6, hours: 1 }] }),
    });

    expect(response.status).toBe(400);
  });

  it('PUT /api/academic-year-modules/:id/schedule responds 400 for hours outside 1-3', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 4 }] }),
    });

    expect(response.status).toBe(400);
  });

  it('PUT /api/academic-year-modules/:id/schedule responds 400 when the same weekday appears twice', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 1 }, { weekday: 1, hours: 2 }] }),
    });

    expect(response.status).toBe(400);
  });

  it('PUT /api/academic-year-modules/:id/schedule with an empty array clears every previously saved weekday', async () => {
    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 3, hours: 1 }] }),
    });

    const response = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [] }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { schedule: { weekday: number; hours: number }[] };
    expect(body.schedule).toEqual([]);
  });

  it('PUT /api/academic-year-modules/:id/schedule responds 404 for a well-formed id that matches no assignment', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/00000000-0000-0000-0000-000000000000/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [] }),
    });

    expect(response.status).toBe(404);
  });
});
