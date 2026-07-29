// Domain shape + repository interface for server-side sessions (see
// views/login/schema-changes.sql's comment and tecnologias/tecnologia_bbdd.md "User
// sessions are not persisted to the database"). Unlike `UserRepository`, this has a single
// implementation (`InMemorySessionRepository`, repositories/in-memory/) — sessions live in
// an in-process store by design, never in Postgres.

export interface SessionUser {
  id: string;
  fullName: string;
}

export interface SessionRepository {
  /** Starts a new session for `user` and returns its opaque session id. */
  create(user: SessionUser): string;
  /** Resolves `sessionId` to the signed-in user, or `null` if it matches no active session. */
  resolve(sessionId: string): SessionUser | null;
  /** Ends the session matching `sessionId`, if any. No-op if it doesn't match one (idempotent,
   * see views/login/use-cases.md UC-06 A1). */
  invalidate(sessionId: string): void;
}
