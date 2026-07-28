import type { SessionRepository, SessionUser } from '../session.repository';

/** In-process `SessionRepository` implementation — the real implementation, not a test
 * double (see tecnologias/tecnologia_bbdd.md "User sessions are not persisted to the
 * database"). One instance lives for the lifetime of the Express app (see app.ts's
 * composition root), shared across requests. */
export class InMemorySessionRepository implements SessionRepository {
  private readonly usersBySessionId = new Map<string, SessionUser>();

  create(user: SessionUser): string {
    const sessionId = crypto.randomUUID();
    this.usersBySessionId.set(sessionId, user);
    return sessionId;
  }

  resolve(sessionId: string): SessionUser | null {
    return this.usersBySessionId.get(sessionId) ?? null;
  }

  invalidate(sessionId: string): void {
    this.usersBySessionId.delete(sessionId);
  }
}
