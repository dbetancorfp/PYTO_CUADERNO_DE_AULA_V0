// elementId: teacher-full-name-input, teacher-save-name-button, teacher-name-save-message,
// teacher-current-password-input, teacher-new-password-input, teacher-repeat-password-input,
// teacher-save-password-button, teacher-password-save-message (HTTP contract side of
// UC-01/UC-02 — see views/configuracion/api-contracts.md PATCH /api/teacher/name, PATCH
// /api/teacher/password).
import { Router, type Request, type Response } from 'express';
import type { TeacherSettingsService } from '../services/teacher-settings.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function teacherSettingsRouter(
  teacherSettingsService: TeacherSettingsService,
  sessionService: SessionService,
): Router {
  const router = Router();

  router.patch('/name', requireAuth(sessionService), async (req: Request, res: Response) => {
    const { fullName } = req.body as { fullName?: unknown };
    if (!isNonEmptyString(fullName)) {
      res.status(400).json({ message: 'fullName is required' });
      return;
    }

    await teacherSettingsService.updateFullName(res.locals.teacherId as string, fullName);
    res.status(200).json({ message: 'Name updated' });
  });

  router.patch('/password', requireAuth(sessionService), async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };
    if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
      res.status(400).json({ message: 'currentPassword and newPassword are required' });
      return;
    }

    await teacherSettingsService.changePassword(res.locals.teacherId as string, currentPassword, newPassword);
    res.status(200).json({ message: 'Password updated' });
  });

  return router;
}
