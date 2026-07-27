import { LOCKOUT_THRESHOLD, type User, type UserRepository } from '../user.repository';

/** In-memory double for `UserRepository` — used in unit tests and `DATA_BACKEND=memory`
 * mode (see tecnologias/tecnologia_bbdd.md "Data access pattern"). */
export class InMemoryUserRepository implements UserRepository {
  private readonly usersByEmail = new Map<string, User>();

  constructor(seedUsers: User[] = []) {
    for (const user of seedUsers) {
      this.usersByEmail.set(user.email, user);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async incrementFailedAttempts(email: string): Promise<User | null> {
    const user = this.usersByEmail.get(email);
    if (!user) return null;

    const failedAttempts = user.failedAttempts + 1;
    const updated: User = {
      ...user,
      failedAttempts,
      isLocked: failedAttempts >= LOCKOUT_THRESHOLD,
    };
    this.usersByEmail.set(email, updated);
    return updated;
  }

  async resetFailedAttempts(email: string): Promise<void> {
    const user = this.usersByEmail.get(email);
    if (!user) return;

    this.usersByEmail.set(email, { ...user, failedAttempts: 0, isLocked: false });
  }
}
