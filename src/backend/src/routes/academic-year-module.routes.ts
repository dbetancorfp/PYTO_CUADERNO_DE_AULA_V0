// elementId: module-table (HTTP contract side of UC-09's row-level Quitar — see
// views/configuracion/api-contracts.md "DELETE /api/academic-year-modules/:id"). Mounted at
// /api/academic-year-modules by app.ts. Deletes only the `academic_year_modules` row —
// never the underlying `catalog_modules` row.
import { Router, type Request, type Response } from 'express';
import type { AcademicYearService } from '../services/academic-year.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { requireValidUuidParam } from './require-valid-uuid';

export function academicYearModuleRouter(
  academicYearService: AcademicYearService,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.use(requireAuth(sessionService));
  router.param('id', requireValidUuidParam);

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await academicYearService.removeModule(res.locals.teacherId as string, req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Academic year módulo assignment not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
