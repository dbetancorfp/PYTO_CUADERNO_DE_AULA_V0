// elementId: session-guard, logout-session (see views/login/use-cases.md UC-05/UC-06)
import type { SessionRepository, SessionUser } from '../repositories/session.repository';

export class SessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  /** Starts a session for `user` and returns its session id (see UC-01's session side
   * effect). */
  start(user: SessionUser): string {
    return this.sessionRepository.create(user);
  }

  /** Resolves `sessionId` to the signed-in user, or `null` when it's missing or matches no
   * active session (see UC-05 — a missing/invalid/ended session is never distinguishable). */
  resolve(sessionId: string | undefined): SessionUser | null {
    if (!sessionId) return null;
    return this.sessionRepository.resolve(sessionId);
  }

  /** Ends the session matching `sessionId`, if any. No-op when `sessionId` is missing or
   * already ended (idempotent, see UC-06 A1). */
  end(sessionId: string | undefined): void {
    if (!sessionId) return;
    this.sessionRepository.invalidate(sessionId);
  }
}
