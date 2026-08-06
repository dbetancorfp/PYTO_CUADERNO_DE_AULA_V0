// elementId: academic-year-table, academic-year-table-add-button,
// training-cycle-table-add-cycle-button, module-table, module-selection-save-button
// (HTTP contract side of UC-06/UC-07/UC-08/UC-09 — see views/configuracion/api-contracts.md
// "Academic years" / "Academic year módulo selection" sections). New routes, don't exist
// yet — expected 404s until backend-implementer adds them.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let cookie: string;
let catalogCycleId: string;
let catalogModuleId: string;
let catalogModule2Id: string;

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

async function createAcademicYear(startYear: number, moduleIds: string[] = []): Promise<{ id: string; startYear: number }> {
  const response = await fetch(`${baseUrl}/api/academic-years/selection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ startYear, moduleIds }),
  });
  const body = (await response.json()) as { academicYear: { id: string; startYear: number } };
  return body.academicYear;
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

  const cycleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Desarrollo de Aplicaciones Web' }),
  });
  catalogCycleId = ((await cycleResponse.json()) as { id: string }).id;

  const moduleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles/${catalogCycleId}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Programación', course: 1 }),
  });
  catalogModuleId = ((await moduleResponse.json()) as { id: string }).id;

  const module2Response = await fetch(`${baseUrl}/api/catalog/training-cycles/${catalogCycleId}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Base de datos', course: 1 }),
  });
  catalogModule2Id = ((await module2Response.json()) as { id: string }).id;
});

afterAll(() => {
  server.close();
});

describe('elementId: academic-year-table', () => {
  it('GET /api/academic-years responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years`);

    expect(response.status).toBe(401);
  });

  it('POST /api/academic-years/selection creates a year and it then shows up in GET', async () => {
    const created = await createAcademicYear(2030);
    expect(created.startYear).toBe(2030);

    const response = await fetch(`${baseUrl}/api/academic-years`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { academicYears: { id: string; startYear: number; isCurrent: boolean }[] };

    expect(body.academicYears.some((y) => y.id === created.id && y.startYear === 2030 && y.isCurrent === false)).toBe(true);
  });

  it('POST /api/academic-years/selection responds 409 for a duplicate startYear', async () => {
    await createAcademicYear(2031);

    const response = await fetch(`${baseUrl}/api/academic-years/selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 2031, moduleIds: [] }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('DUPLICATE_NAME');
  });

  it('POST /api/academic-years/selection responds 400 for a non-integer startYear', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 'not-a-year', moduleIds: [] }),
    });

    expect(response.status).toBe(400);
  });

  it('POST /api/academic-years/selection responds 404 for an unknown moduleId', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 2032, moduleIds: ['00000000-0000-0000-0000-000000000000'] }),
    });

    expect(response.status).toBe(404);
  });

  it('POST /api/academic-years/selection creates the initial módulo assignments', async () => {
    const created = await createAcademicYear(2033, [catalogModuleId]);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}/modules`, { headers: { Cookie: cookie } });
    const body = (await response.json()) as { modules: { catalogModuleId: string }[] };

    expect(body.modules.some((m) => m.catalogModuleId === catalogModuleId)).toBe(true);
  });

  it('GET /api/academic-years/:id/modules responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/unknown-id/modules`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(404);
  });

  it('GET /api/academic-years/:id/modules responds 404 for a well-formed id that matches no academic year', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000/modules`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/academic-years/:id renames startYear', async () => {
    const created = await createAcademicYear(2034);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 2035 }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { startYear: number };
    expect(body.startYear).toBe(2035);
  });

  it('PATCH /api/academic-years/:id responds 409 renaming to a startYear this teacher already has', async () => {
    const a = await createAcademicYear(2036);
    await createAcademicYear(2037);

    const response = await fetch(`${baseUrl}/api/academic-years/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 2037 }),
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('DUPLICATE_NAME');
  });

  it('PATCH /api/academic-years/:id responds 400 for a non-integer startYear', async () => {
    const created = await createAcademicYear(2038);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 'not-a-year' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/academic-years/:id responds 400 for a non-boolean isCurrent', async () => {
    const created = await createAcademicYear(2039);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: 'yes' }),
    });

    expect(response.status).toBe(400);
  });

  it('PATCH /api/academic-years/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/unknown-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 2040 }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/academic-years/:id responds 404 for a well-formed id that matches no academic year', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ startYear: 2040 }),
    });

    expect(response.status).toBe(404);
  });

  it('PATCH /api/academic-years/:id marks a row current, unmarking the previously current one', async () => {
    const a = await createAcademicYear(2041);
    const b = await createAcademicYear(2042);

    await fetch(`${baseUrl}/api/academic-years/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: true }),
    });
    const secondResponse = await fetch(`${baseUrl}/api/academic-years/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ isCurrent: true }),
    });
    expect(secondResponse.status).toBe(200);

    const listResponse = await fetch(`${baseUrl}/api/academic-years`, { headers: { Cookie: cookie } });
    const body = (await listResponse.json()) as { academicYears: { id: string; isCurrent: boolean }[] };
    const rowA = body.academicYears.find((y) => y.id === a.id);
    const rowB = body.academicYears.find((y) => y.id === b.id);
    expect(rowA?.isCurrent).toBe(false);
    expect(rowB?.isCurrent).toBe(true);
  });

  it('DELETE /api/academic-years/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/unknown-id`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/academic-years/:id responds 404 for a well-formed id that matches no academic year', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/academic-years/:id deletes a year with no módulos assigned', async () => {
    const created = await createAcademicYear(2043);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
    const listResponse = await fetch(`${baseUrl}/api/academic-years`, { headers: { Cookie: cookie } });
    const body = (await listResponse.json()) as { academicYears: { id: string }[] };
    expect(body.academicYears.some((y) => y.id === created.id)).toBe(false);
  });

  it('DELETE /api/academic-years/:id responds 409 HAS_DEPENDENTS when módulos are still assigned', async () => {
    const created = await createAcademicYear(2044, [catalogModuleId]);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('HAS_DEPENDENTS');
  });
});

describe('elementId: training-cycle-table-add-cycle-button, module-selection-save-button (extend-existing)', () => {
  it('POST /api/academic-years/:id/modules adds módulos to an already-existing year', async () => {
    const created = await createAcademicYear(2045, [catalogModuleId]);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [catalogModule2Id] }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { addedCount: number };
    expect(body.addedCount).toBe(1);

    const listResponse = await fetch(`${baseUrl}/api/academic-years/${created.id}/modules`, { headers: { Cookie: cookie } });
    const listBody = (await listResponse.json()) as { modules: { catalogModuleId: string }[] };
    expect(listBody.modules.map((m) => m.catalogModuleId).sort()).toEqual([catalogModuleId, catalogModule2Id].sort());
  });

  it('POST /api/academic-years/:id/modules responds 404 for an unknown academic year id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/unknown-id/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [catalogModuleId] }),
    });

    expect(response.status).toBe(404);
  });

  it('POST /api/academic-years/:id/modules responds 404 for a well-formed id that matches no academic year', async () => {
    const response = await fetch(`${baseUrl}/api/academic-years/00000000-0000-0000-0000-000000000000/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [catalogModuleId] }),
    });

    expect(response.status).toBe(404);
  });

  it('POST /api/academic-years/:id/modules responds 400 when moduleIds is missing', async () => {
    const created = await createAcademicYear(2046);

    const response = await fetch(`${baseUrl}/api/academic-years/${created.id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});

describe('elementId: module-table', () => {
  it('DELETE /api/academic-year-modules/:id removes the assignment', async () => {
    const created = await createAcademicYear(2047, [catalogModuleId]);
    const listResponse = await fetch(`${baseUrl}/api/academic-years/${created.id}/modules`, { headers: { Cookie: cookie } });
    const listBody = (await listResponse.json()) as { modules: { id: string }[] };
    const assignmentId = listBody.modules[0]!.id;

    const response = await fetch(`${baseUrl}/api/academic-year-modules/${assignmentId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(204);
    const afterResponse = await fetch(`${baseUrl}/api/academic-years/${created.id}/modules`, { headers: { Cookie: cookie } });
    const afterBody = (await afterResponse.json()) as { modules: { id: string }[] };
    expect(afterBody.modules.some((m) => m.id === assignmentId)).toBe(false);
  });

  it('DELETE /api/academic-year-modules/:id responds 404 for an unknown id', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/unknown-id`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('DELETE /api/academic-year-modules/:id responds 404 for a well-formed id that matches no assignment', async () => {
    const response = await fetch(`${baseUrl}/api/academic-year-modules/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });
});
