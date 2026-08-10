// elementId: calendario-months, calendario-empty-state (HTTP contract side of UC-04, see
// views/calendario/api-contracts.md's "GET /api/calendario-modulo"). Exercises the real
// side effect end to end: seeding a key_date, assigning a módulo via the existing Año
// académico flow (POST /api/academic-years/selection), then reading its generated
// calendario_modulo snapshot back through this new route — proves UC-06 (seeding) and
// UC-04 (reading) actually wire together, not just each in isolation.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';
import type { User } from '../src/repositories/user.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let cookie: string;
let otherTeacherCookie: string;
let catalogCycleId: string;
let catalogModuleId: string;

interface CalendarioModuloEntryBody {
  id: string;
  category: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string | null;
}

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'calendario@example.com',
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

async function assignModuleToNewYear(startYear: number, moduleIds: string[]): Promise<string> {
  const response = await fetch(`${baseUrl}/api/academic-years/selection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ startYear, moduleIds }),
  });
  const body = (await response.json()) as { academicYear: { id: string } };
  return body.academicYear.id;
}

async function firstAcademicYearModuleId(academicYearId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/academic-years/${academicYearId}/modules`, { headers: { Cookie: cookie } });
  const body = (await response.json()) as { modules: { id: string }[] };
  return body.modules[0]!.id;
}

beforeAll(async () => {
  const user = await seededUser({});
  const otherUser = await seededUser({ id: 'teacher-2', email: 'other-calendario@example.com' });
  const app = createApp({ backend: 'memory', seedUsers: [user, otherUser] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'calendario@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);

  const otherLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'other-calendario@example.com', password: 'CorrectHorseBattery1' }),
  });
  otherTeacherCookie = extractSessionCookie(otherLoginResponse);

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

  // In-memory backend never auto-seeds key_dates (that's a Postgres-boot-only side
  // effect, see src/backend/src/index.ts) — seed one here so seedForModules has
  // something real to snapshot.
  await fetch(`${baseUrl}/api/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      category: 'holidays',
      name: 'Vacaciones de Navidad.',
      startDay: 22,
      startMonth: 12,
      endDay: 7,
      endMonth: 1,
      type: 'Vacaciones',
    }),
  });
});

afterAll(() => {
  server.close();
});

describe('elementId: calendario-months, calendario-empty-state', () => {
  it('GET /api/calendario-modulo responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=00000000-0000-0000-0000-000000000000`);

    expect(response.status).toBe(401);
  });

  it('GET /api/calendario-modulo responds 400 when academicYearModuleId is missing', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-modulo`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('GET /api/calendario-modulo responds 400 when academicYearModuleId is not a well-formed UUID', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=not-a-uuid`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('GET /api/calendario-modulo responds 404 for a well-formed but unknown academicYearModuleId', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=00000000-0000-0000-0000-000000000000`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('assigning a módulo (POST /api/academic-years/selection) snapshots key_dates into calendario_modulo, readable via GET', async () => {
    const academicYearId = await assignModuleToNewYear(2026, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: CalendarioModuloEntryBody[] };

    expect(response.status).toBe(200);
    expect(body.entries).toContainEqual(
      expect.objectContaining({
        category: 'holidays',
        name: 'Vacaciones de Navidad.',
        startDate: '2026-12-22',
        endDate: '2027-01-07',
        type: 'Vacaciones',
      }),
    );
  });

  it('extending an existing academic year (POST /api/academic-years/:id/modules) also snapshots the newly-added módulo', async () => {
    const academicYearId = await assignModuleToNewYear(2031, []);

    const extendResponse = await fetch(`${baseUrl}/api/academic-years/${academicYearId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ moduleIds: [catalogModuleId] }),
    });
    expect(extendResponse.status).toBe(200);

    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);
    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: CalendarioModuloEntryBody[] };

    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('another teacher cannot read a calendario_modulo snapshot they do not own', async () => {
    const academicYearId = await assignModuleToNewYear(2032, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: otherTeacherCookie },
    });
    expect(response.status).toBe(404);
  });

  it('deleting a módulo assignment removes its calendario_modulo rows (cascade) — GET 404s afterward', async () => {
    const academicYearId = await assignModuleToNewYear(2033, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const deleteResponse = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    expect(deleteResponse.status).toBe(204);

    const response = await fetch(`${baseUrl}/api/calendario-modulo?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(404);
  });
});
