// elementId: (backend infrastructure — no single elementId; shared Express middleware every
// Configuración route uses to identify the signed-in teacher, per
// views/configuracion/api-contracts.md's "requires a valid session... only ever
// reads/writes the signed-in teacher's own rows" rule repeated on every endpoint). New
// module, doesn't exist yet.
//
// SessionUser widens from { fullName } to { id, fullName } as part of this same cycle —
// requireAuth is what Configuración's routes use to read the teacher's id out of the
// resolved session (via res.locals.teacherId), instead of each route re-resolving the
// session cookie inline the way auth.routes.ts's own GET /session handler still does.
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { Server } from 'node:http';
import { requireAuth } from '../src/routes/require-auth';
import { SessionService } from '../src/services/session.service';
import { InMemorySessionRepository } from '../src/repositories/in-memory/in-memory-session.repository';
import { allocateTestPort } from './setup';

const port = allocateTestPort();
const baseUrl = `http://127.0.0.1:${port}`;
let server: Server;
let sessionService: SessionService;

beforeAll(async () => {
  sessionService = new SessionService(new InMemorySessionRepository());
  const app = express();
  app.use(cookieParser());
  app.get('/protected', requireAuth(sessionService), (_req, res) => {
    res.status(200).json({ teacherId: res.locals.teacherId });
  });
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
});

afterAll(() => {
  server.close();
});

describe('requireAuth', () => {
  it('responds 401 when no session_id cookie is sent', async () => {
    const response = await fetch(`${baseUrl}/protected`);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Not authenticated' });
  });

  it('responds 401 when session_id matches no active session', async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Cookie: 'session_id=does-not-exist' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Not authenticated' });
  });

  it('calls the next handler with res.locals.teacherId set, for a valid session', async () => {
    const sessionId = sessionService.start({ id: 'teacher-1', fullName: 'Jane Doe' });

    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Cookie: `session_id=${sessionId}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teacherId: 'teacher-1' });
  });
});
