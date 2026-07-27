// Domain shape + repository interface for the `users` table (see
// views/login/schema-changes.sql). Two implementations exist per DIP: in-memory
// (repositories/in-memory/) and Postgres (repositories/postgres/) — see
// tecnologias/tecnologia_bbdd.md "Data access pattern".

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  failedAttempts: number;
  isLocked: boolean;
}

/** Consecutive failed attempts after which an account is locked (see
 * views/login/api-contracts.md POST /api/auth/login, 403). */
export const LOCKOUT_THRESHOLD = 5;

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  /**
   * Atomically increments `failedAttempts` for the account matching `email` and computes
   * `isLocked` from `LOCKOUT_THRESHOLD`. Returns the updated user, or `null` if no account
   * matches `email` (existence of the account is never revealed to the caller either way —
   * see views/login/api-contracts.md).
   */
  incrementFailedAttempts(email: string): Promise<User | null>;
  /** Resets `failedAttempts` to zero for the account matching `email`. No-op if none matches. */
  resetFailedAttempts(email: string): Promise<void>;
}
