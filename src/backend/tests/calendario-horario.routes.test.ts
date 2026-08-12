// elementId: calendario-months, calendario-legend, calendario-day-tooltip (HTTP contract
// side of UC-13, see views/calendario/api-contracts.md's "GET /api/calendario-horario").
// Exercises the real side effect end to end: assigning a módulo (POST
// /api/academic-years/selection, seeds calendario_modulo per UC-06), seeding one holiday
// key_date, saving a weekly schedule (PUT /api/academic-year-modules/:id/schedule, UC-12's
// new side effect), then reading the generated calendario_horario snapshot back through
// this new route — proves UC-12 (seeding) and UC-13 (reading) actually wire together.
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

interface CalendarioHorarioEntryBody {
  date: string;
  hours: number;
}

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'calendario-horario@example.com',
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
  const otherUser = await seededUser({ id: 'teacher-2', email: 'other-calendario-horario@example.com' });
  const app = createApp({ backend: 'memory', seedUsers: [user, otherUser] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'calendario-horario@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);

  const otherLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'other-calendario-horario@example.com', password: 'CorrectHorseBattery1' }),
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

  // In-memory backend never auto-seeds key_dates — seed one holiday so the business-day
  // exclusion (UC-12/A2) has something real to exclude against.
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

  // calendario_horario's walk range is [Inicio curso, Fin de curso] (2026-08-12 bugfix,
  // see calendario-horario.service.ts) — this key_date is what UC-06/A2 splits into those
  // two single-day calendario_modulo rows for a course-1 módulo, same real seed shape
  // (16/09-22/06) production data has.
  await fetch(`${baseUrl}/api/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      category: 'academic_key_dates',
      name: 'Inicio curso: 1º de Grado Superior de FP.',
      startDay: 16,
      startMonth: 9,
      endDay: 22,
      endMonth: 6,
      type: 'Curso escolar',
    }),
  });
});

afterAll(() => {
  server.close();
});

describe('elementId: calendario-months, calendario-legend, calendario-day-tooltip', () => {
  it('GET /api/calendario-horario responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=00000000-0000-0000-0000-000000000000`);

    expect(response.status).toBe(401);
  });

  it('GET /api/calendario-horario responds 400 when academicYearModuleId is missing', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-horario`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('GET /api/calendario-horario responds 400 when academicYearModuleId is not a well-formed UUID', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=not-a-uuid`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('GET /api/calendario-horario responds 404 for a well-formed but unknown academicYearModuleId', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=00000000-0000-0000-0000-000000000000`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('responds 200 with an empty array for a módulo that has never had its Horario saved', async () => {
    const academicYearId = await assignModuleToNewYear(2040, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: CalendarioHorarioEntryBody[] };

    expect(response.status).toBe(200);
    expect(body.entries).toEqual([]);
  });

  it('saving a schedule (PUT /api/academic-year-modules/:id/schedule) generates calendario_horario, readable via GET', async () => {
    const academicYearId = await assignModuleToNewYear(2026, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const putResponse = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 2 }] }), // every Monday, 2 hours
    });
    expect(putResponse.status).toBe(200);

    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: CalendarioHorarioEntryBody[] };

    expect(response.status).toBe(200);
    // 2026-09-21 is the first Monday on/after this módulo's Inicio curso (16/09/2026, a
    // Wednesday) — never 2026-09-07, which is a Monday but before Inicio curso (2026-08-12
    // bugfix).
    expect(body.entries).toContainEqual({ date: '2026-09-21', hours: 2 });
    expect(body.entries).not.toContainEqual(expect.objectContaining({ date: '2026-09-07' }));
    // 2026-12-28 is a Monday inside the seeded Navidad holiday range — excluded (UC-12/A2).
    expect(body.entries).not.toContainEqual(expect.objectContaining({ date: '2026-12-28' }));
  });

  it('saving a new schedule replaces the previous one in full — a removed weekday disappears', async () => {
    const academicYearId = await assignModuleToNewYear(2041, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 2 }] }),
    });
    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 5, hours: 3 }] }), // Monday -> Friday
    });

    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: CalendarioHorarioEntryBody[] };

    expect(body.entries.every((entry) => entry.hours === 3)).toBe(true);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('saving an all-blank schedule clears calendario_horario for that módulo', async () => {
    const academicYearId = await assignModuleToNewYear(2042, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 2 }] }),
    });
    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [] }),
    });

    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: CalendarioHorarioEntryBody[] };

    expect(body.entries).toEqual([]);
  });

  it('another teacher cannot read a calendario_horario snapshot they do not own', async () => {
    const academicYearId = await assignModuleToNewYear(2043, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);
    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 2 }] }),
    });

    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: otherTeacherCookie },
    });

    expect(response.status).toBe(404);
  });

  it('deleting a módulo assignment removes its calendario_horario rows (cascade) — GET 404s afterward', async () => {
    const academicYearId = await assignModuleToNewYear(2044, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);
    await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ schedule: [{ weekday: 1, hours: 2 }] }),
    });

    const deleteResponse = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    expect(deleteResponse.status).toBe(204);

    const response = await fetch(`${baseUrl}/api/calendario-horario?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(404);
  });
});
