// elementId: login-button (business-logic side of UC-01, see views/login/use-cases.md)
import type { UserRepository } from '../repositories/user.repository';

export type LoginResult =
  | { outcome: 'success' }
  | { outcome: 'invalid-credentials' }
  | { outcome: 'account-locked' };

/**
 * Business rule ordering (see views/login/use-cases.md UC-01):
 * 1. Unknown email -> invalid-credentials (never reveals whether the account exists).
 * 2. Locked account -> account-locked, checked BEFORE password verification, even when
 *    the password given is correct.
 * 3. Wrong password -> invalid-credentials, and the failed-attempt counter is incremented.
 *    Even the attempt that reaches the lockout threshold still reports
 *    invalid-credentials — the locked message only appears on the NEXT attempt.
 * 4. Correct password on a non-locked account -> success, and the counter is reset to 0.
 */
export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return { outcome: 'invalid-credentials' };
    }

    if (user.isLocked) {
      return { outcome: 'account-locked' };
    }

    const passwordMatches = await Bun.password.verify(password, user.passwordHash);
    if (!passwordMatches) {
      await this.userRepository.incrementFailedAttempts(email);
      return { outcome: 'invalid-credentials' };
    }

    await this.userRepository.resetFailedAttempts(email);
    return { outcome: 'success' };
  }

  /**
   * Looks up the display name for an account, for callers that already hold a successful
   * `login()` outcome for the same `email` and need it to start a session (see
   * views/login/use-cases.md UC-01's session postcondition). Kept as a separate method,
   * rather than folded into `login()`'s success result, because `LoginResult`'s `success`
   * variant is asserted elsewhere as exactly `{ outcome: 'success' }` with no extra fields.
   */
  async fullNameFor(email: string): Promise<string | null> {
    const user = await this.userRepository.findByEmail(email);
    return user ? user.fullName : null;
  }
}
