// elementId: evaluation-working-days-summary, evaluation-working-days-1,
// evaluation-working-days-2, evaluation-working-days-3 (HTTP contract side of UC-10, see
// views/calendario/api-contracts.md's "GET /api/calendario-evaluation-working-days").
// Mounted at /api/calendario-evaluation-working-days by app.ts. Same pattern as
// calendario-modulo.routes.ts: the id (`academicYearModuleId`) arrives as a query-string
// param, not a route `:id` param, so the UUID format is validated manually.
import { Router, type Request, type Response } from 'express';
import type { CalendarioModuloService } from '../services/calendario-modulo.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { UUID_PATTERN } from './require-valid-uuid';

export function calendarioEvaluationWorkingDaysRouter(
  calendarioModuloService: CalendarioModuloService,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (req: Request, res: Response) => {
    const { academicYearModuleId } = req.query as { academicYearModuleId?: string };
    if (academicYearModuleId === undefined || !UUID_PATTERN.test(academicYearModuleId)) {
      res.status(400).json({ message: 'academicYearModuleId must be a well-formed UUID' });
      return;
    }

    const entries = await calendarioModuloService.findEvaluationWorkingDaysForTeacher(
      res.locals.teacherId as string,
      academicYearModuleId,
    );
    if (entries === null) {
      res.status(404).json({ message: 'Academic year módulo not found' });
      return;
    }

    res.status(200).json({ entries });
  });

  return router;
}
