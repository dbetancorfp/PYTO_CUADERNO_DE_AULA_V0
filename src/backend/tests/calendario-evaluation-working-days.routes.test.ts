// elementId: evaluation-working-days-summary, evaluation-working-days-1 (HTTP contract
// side of UC-09/UC-10, see views/calendario/api-contracts.md's "GET
// /api/calendario-evaluation-working-days"). Exercises the real side effect end to end:
// seeding key_dates (course start + one evaluación), assigning a módulo via the existing
// Año académico flow, then reading the generated calendario_evaluation_working_days back
// through this new route.
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

interface WorkingDaysEntryBody {
  id: string;
  academicYearModuleId: string;
  evaluationNumber: number;
  workingDays: number;
}

async function seededUser(overrides: Partial<User>): Promise<User> {
  return {
    id: 'teacher-1',
    email: 'calendario-wd@example.com',
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
  const otherUser = await seededUser({ id: 'teacher-2', email: 'other-calendario-wd@example.com' });
  const app = createApp({ backend: 'memory', seedUsers: [user, otherUser] });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'calendario-wd@example.com', password: 'CorrectHorseBattery1' }),
  });
  cookie = extractSessionCookie(loginResponse);

  const otherLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'other-calendario-wd@example.com', password: 'CorrectHorseBattery1' }),
  });
  otherTeacherCookie = extractSessionCookie(otherLoginResponse);

  const cycleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Desarrollo de Aplicaciones Web (WD)' }),
  });
  catalogCycleId = ((await cycleResponse.json()) as { id: string }).id;

  const moduleResponse = await fetch(`${baseUrl}/api/catalog/training-cycles/${catalogCycleId}/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Programación', course: 1 }),
  });
  catalogModuleId = ((await moduleResponse.json()) as { id: string }).id;

  // In-memory backend never auto-seeds key_dates — seed the course-start entry and one
  // evaluación so seedForModules has something real to compute working days from.
  await fetch(`${baseUrl}/api/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      category: 'academic_key_dates',
      name: '1º de Grado Superior de FP.',
      startDay: 16,
      startMonth: 9,
      endDay: 22,
      endMonth: 6,
    }),
  });
  await fetch(`${baseUrl}/api/key-dates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      category: 'evaluations',
      name: '1ª Evaluación - Último día para poner notas.',
      startDay: 11,
      startMonth: 12,
      endDay: 11,
      endMonth: 12,
    }),
  });
});

afterAll(() => {
  server.close();
});

describe('elementId: evaluation-working-days-summary', () => {
  it('GET /api/calendario-evaluation-working-days responds 401 with no session', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days?academicYearModuleId=00000000-0000-0000-0000-000000000000`);

    expect(response.status).toBe(401);
  });

  it('GET /api/calendario-evaluation-working-days responds 400 when academicYearModuleId is missing', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('GET /api/calendario-evaluation-working-days responds 400 when academicYearModuleId is not a well-formed UUID', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days?academicYearModuleId=not-a-uuid`, { headers: { Cookie: cookie } });

    expect(response.status).toBe(400);
  });

  it('GET /api/calendario-evaluation-working-days responds 404 for a well-formed but unknown academicYearModuleId', async () => {
    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days?academicYearModuleId=00000000-0000-0000-0000-000000000000`, {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(404);
  });

  it('assigning a módulo snapshots calendario_evaluation_working_days, readable via GET', async () => {
    const academicYearId = await assignModuleToNewYear(2026, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    const body = (await response.json()) as { entries: WorkingDaysEntryBody[] };

    expect(response.status).toBe(200);
    expect(body.entries).toContainEqual(
      expect.objectContaining({ evaluationNumber: 1, workingDays: 56 }),
    );
  });

  it('another teacher cannot read a calendario_evaluation_working_days snapshot they do not own', async () => {
    const academicYearId = await assignModuleToNewYear(2032, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: otherTeacherCookie },
    });
    expect(response.status).toBe(404);
  });

  it('deleting a módulo assignment removes its calendario_evaluation_working_days rows (cascade) — GET 404s afterward', async () => {
    const academicYearId = await assignModuleToNewYear(2033, [catalogModuleId]);
    const academicYearModuleId = await firstAcademicYearModuleId(academicYearId);

    const deleteResponse = await fetch(`${baseUrl}/api/academic-year-modules/${academicYearModuleId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    expect(deleteResponse.status).toBe(204);

    const response = await fetch(`${baseUrl}/api/calendario-evaluation-working-days?academicYearModuleId=${academicYearModuleId}`, {
      headers: { Cookie: cookie },
    });
    expect(response.status).toBe(404);
  });
});
