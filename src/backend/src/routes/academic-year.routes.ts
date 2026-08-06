// elementId: academic-year-table, academic-year-table-add-button,
// training-cycle-table-add-cycle-button, module-table, module-selection-save-button
// (HTTP contract side of UC-06/UC-07/UC-08/UC-09 — see views/configuracion/api-contracts.md
// "Academic years" / "Academic year módulo selection" sections). Mounted at
// /api/academic-years by app.ts. `teacherId` is stripped from every AcademicYear before it's
// serialized — internal only, never sent to the client (same pattern the old teacher-scoped
// catalog routes used before that catalog became global).
import { Router, type Request, type Response } from 'express';
import type { AcademicYear } from '../repositories/academic-year.repository';
import type { AcademicYearService } from '../services/academic-year.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { requireValidUuidParam } from './require-valid-uuid';

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toPublicAcademicYear(year: AcademicYear): { id: string; startYear: number; isCurrent: boolean } {
  return { id: year.id, startYear: year.startYear, isCurrent: year.isCurrent };
}

export function academicYearRouter(academicYearService: AcademicYearService, sessionService: SessionService): Router {
  const router = Router();
  router.use(requireAuth(sessionService));
  router.param('id', requireValidUuidParam);

  router.get('/', async (_req: Request, res: Response) => {
    const academicYears = await academicYearService.list(res.locals.teacherId as string);
    res.status(200).json({ academicYears: academicYears.map(toPublicAcademicYear) });
  });

  router.post('/selection', async (req: Request, res: Response) => {
    const { startYear, moduleIds } = req.body as { startYear?: unknown; moduleIds?: unknown };
    if (!Number.isInteger(startYear) || !isArrayOfStrings(moduleIds)) {
      res.status(400).json({ message: 'startYear must be an integer and moduleIds must be an array of strings' });
      return;
    }

    const result = await academicYearService.createWithSelection(
      res.locals.teacherId as string,
      startYear as number,
      moduleIds,
    );
    if (result === null) {
      res.status(404).json({ message: 'Some moduleIds entry does not match an existing catalog module' });
      return;
    }
    res.status(201).json({ academicYear: toPublicAcademicYear(result.academicYear), moduleCount: result.moduleCount });
  });

  router.get('/:id/modules', async (req: Request<{ id: string }>, res: Response) => {
    const modules = await academicYearService.listModules(res.locals.teacherId as string, req.params.id);
    if (modules === null) {
      res.status(404).json({ message: 'Academic year not found' });
      return;
    }
    res.status(200).json({ modules });
  });

  router.post('/:id/modules', async (req: Request<{ id: string }>, res: Response) => {
    const { moduleIds } = req.body as { moduleIds?: unknown };
    if (!isArrayOfStrings(moduleIds)) {
      res.status(400).json({ message: 'moduleIds must be an array of strings' });
      return;
    }

    const result = await academicYearService.extendSelection(res.locals.teacherId as string, req.params.id, moduleIds);
    if (result === null) {
      res.status(404).json({ message: 'Academic year not found, or some moduleIds entry does not match an existing catalog module' });
      return;
    }
    res.status(200).json({ addedCount: result.addedCount });
  });

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { startYear, isCurrent } = req.body as { startYear?: unknown; isCurrent?: unknown };
    if (startYear !== undefined && !Number.isInteger(startYear)) {
      res.status(400).json({ message: 'startYear must be an integer' });
      return;
    }
    if (isCurrent !== undefined && typeof isCurrent !== 'boolean') {
      res.status(400).json({ message: 'isCurrent must be a boolean' });
      return;
    }

    const updated = await academicYearService.update(res.locals.teacherId as string, req.params.id, {
      startYear: startYear as number | undefined,
      isCurrent: isCurrent as boolean | undefined,
    });
    if (updated === null) {
      res.status(404).json({ message: 'Academic year not found' });
      return;
    }
    res.status(200).json(toPublicAcademicYear(updated));
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await academicYearService.delete(res.locals.teacherId as string, req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Academic year not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
