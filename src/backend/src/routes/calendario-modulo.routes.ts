// elementId: calendario-months, calendario-empty-state (HTTP contract side of UC-04, see
// views/calendario/api-contracts.md's "GET /api/calendario-modulo"). Mounted at
// /api/calendario-modulo by app.ts. Unlike every other router in this app, the id here
// (`academicYearModuleId`) arrives as a query-string param, not a route `:id` param — so
// `router.param('id', requireValidUuidParam)` doesn't apply; the UUID format is validated
// manually with the same pattern, reused from require-valid-uuid.ts.
import { Router, type Request, type Response } from 'express';
import type { CalendarioModuloService } from '../services/calendario-modulo.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { UUID_PATTERN } from './require-valid-uuid';

export function calendarioModuloRouter(calendarioModuloService: CalendarioModuloService, sessionService: SessionService): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (req: Request, res: Response) => {
    const { academicYearModuleId } = req.query as { academicYearModuleId?: string };
    if (academicYearModuleId === undefined || !UUID_PATTERN.test(academicYearModuleId)) {
      res.status(400).json({ message: 'academicYearModuleId must be a well-formed UUID' });
      return;
    }

    const entries = await calendarioModuloService.findForTeacher(res.locals.teacherId as string, academicYearModuleId);
    if (entries === null) {
      res.status(404).json({ message: 'Academic year módulo not found' });
      return;
    }

    res.status(200).json({ entries });
  });

  return router;
}
