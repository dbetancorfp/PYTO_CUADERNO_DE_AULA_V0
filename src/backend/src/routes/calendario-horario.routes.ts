// elementId: calendario-months, calendario-legend, calendario-day-tooltip (HTTP contract
// side of UC-13, see views/calendario/api-contracts.md's "GET /api/calendario-horario").
// Mounted at /api/calendario-horario by app.ts. Same query-param-not-route-param UUID
// validation pattern as calendario-modulo.routes.ts — the id here
// (`academicYearModuleId`) arrives as a query-string param, not a route `:id` param.
import { Router, type Request, type Response } from 'express';
import type { CalendarioHorarioService } from '../services/calendario-horario.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { UUID_PATTERN } from './require-valid-uuid';

export function calendarioHorarioRouter(calendarioHorarioService: CalendarioHorarioService, sessionService: SessionService): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (req: Request, res: Response) => {
    const { academicYearModuleId } = req.query as { academicYearModuleId?: string };
    if (academicYearModuleId === undefined || !UUID_PATTERN.test(academicYearModuleId)) {
      res.status(400).json({ message: 'academicYearModuleId must be a well-formed UUID' });
      return;
    }

    const entries = await calendarioHorarioService.findForTeacher(res.locals.teacherId as string, academicYearModuleId);
    if (entries === null) {
      res.status(404).json({ message: 'Academic year módulo not found' });
      return;
    }

    res.status(200).json({ entries });
  });

  return router;
}
