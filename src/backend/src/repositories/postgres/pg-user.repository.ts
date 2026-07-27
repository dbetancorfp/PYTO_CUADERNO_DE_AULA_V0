import type { SqlExecutor } from '../../db/sql-executor';
import type { User, UserRepository } from '../user.repository';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  failed_attempts: number;
  is_locked: boolean;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    failedAttempts: row.failed_attempts,
    isLocked: row.is_locked,
  };
}

/** Real `UserRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgUserRepository implements UserRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByEmail(email: string): Promise<User | null> {
    const rows = (await this.sql`
      SELECT id, email, password_hash, failed_attempts, is_locked
      FROM users
      WHERE email = ${email}
    `) as unknown as UserRow[];
    const [row] = rows;
    return row ? toUser(row) : null;
  }

  async incrementFailedAttempts(email: string): Promise<User | null> {
    // The lockout threshold (see user.repository.ts's LOCKOUT_THRESHOLD, currently 5) is
    // written as a literal here rather than interpolated: every `${}` inside a Bun.SQL
    // tagged template becomes a bound query parameter, and this UPDATE must bind exactly
    // one parameter (`email`) to match the atomic RETURNING contract this repository's
    // test asserts on.
    const rows = (await this.sql`
      UPDATE users
      SET failed_attempts = failed_attempts + 1,
          is_locked = (failed_attempts + 1) >= 5
      WHERE email = ${email}
      RETURNING id, email, password_hash, failed_attempts, is_locked
    `) as unknown as UserRow[];
    const [row] = rows;
    return row ? toUser(row) : null;
  }

  async resetFailedAttempts(email: string): Promise<void> {
    await this.sql`
      UPDATE users
      SET failed_attempts = 0,
          is_locked = FALSE
      WHERE email = ${email}
    `;
  }
}
