// elementId: teacher-full-name-input, teacher-save-name-button, teacher-current-password-input,
// teacher-new-password-input, teacher-save-password-button (business-logic side of UC-01/UC-02,
// see views/configuracion/use-cases.md).
import { DomainError } from '../errors/domain-error';
import type { UserRepository } from '../repositories/user.repository';

export class TeacherSettingsService {
  constructor(private readonly userRepository: UserRepository) {}

  /** UC-01: updates the signed-in teacher's full_name. */
  async updateFullName(teacherId: string, fullName: string): Promise<void> {
    await this.userRepository.updateFullName(teacherId, fullName);
  }

  /**
   * UC-02: re-verifies `currentPassword` against `users.password_hash` (same mechanism as
   * Login's `AuthService.login`) before accepting `newPassword`. No lockout/attempt-tracking
   * here — the teacher is already authenticated, unlike Login's public endpoint.
   */
  async changePassword(teacherId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(teacherId);
    const currentPasswordMatches =
      user !== null && (await Bun.password.verify(currentPassword, user.passwordHash));

    if (!currentPasswordMatches) {
      throw new DomainError('INVALID_CREDENTIALS', 'Incorrect current password');
    }

    const passwordHash = await Bun.password.hash(newPassword);
    await this.userRepository.updatePasswordHash(teacherId, passwordHash);
  }
}
