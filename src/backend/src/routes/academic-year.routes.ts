// elementId: academic-year-table, academic-year-table-add-button,
// academic-year-delete-blocked-message, module-selection-table, module-selection-save-button
// (HTTP contract side of UC-04/UC-07 — see views/configuracion/api-contracts.md).
import { Router, type Request, type Response } from 'express';
import type { AcademicYear } from '../repositories/academic-year.repository';
import type { AcademicYearService } from '../services/academic-year.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';

// academic_years.name is VARCHAR(20) (see views/configuracion/schema-changes.sql) — reject
// oversized names here with a handled 400 instead of letting them crash Postgres uncaught.
function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 20;
}

// api-contracts.md documents academic-year responses as { id, name, isCurrent } —
// teacherId is an internal ownership detail, never serialized to the client.
function toPublicYear(year: AcademicYear): Omit<AcademicYear, 'teacherId'> {
  const { teacherId: _teacherId, ...publicYear } = year;
  return publicYear;
}

export function academicYearRouter(
  academicYearService: AcademicYearService,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (_req: Request, res: Response) => {
    const academicYears = await academicYearService.list(res.locals.teacherId as string);
    res.status(200).json({ academicYears: academicYears.map(toPublicYear) });
  });

  router.post('/', async (req: Request, res: Response) => {
    const { name } = req.body as { name?: unknown };
    if (!isValidName(name)) {
      res.status(400).json({ message: 'name is required' });
      return;
    }

    const year = await academicYearService.create(res.locals.teacherId as string, name);
    res.status(201).json(toPublicYear(year));
  });

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { name, isCurrent } = req.body as { name?: unknown; isCurrent?: unknown };
    if (name !== undefined && !isValidName(name)) {
      res.status(400).json({ message: 'name must be a non-empty string' });
      return;
    }

    const teacherId = res.locals.teacherId as string;
    const id = req.params.id;
    let year: AcademicYear | null = null;

    if (isValidName(name)) {
      year = await academicYearService.rename(teacherId, id, name);
      if (year === null) {
        res.status(404).json({ message: 'Academic year not found' });
        return;
      }
    }

    if (isCurrent === true) {
      year = await academicYearService.setCurrent(teacherId, id);
      if (year === null) {
        res.status(404).json({ message: 'Academic year not found' });
        return;
      }
    }

    if (year === null) {
      const years = await academicYearService.list(teacherId);
      year = years.find((existing) => existing.id === id) ?? null;
      if (year === null) {
        res.status(404).json({ message: 'Academic year not found' });
        return;
      }
    }

    res.status(200).json(toPublicYear(year));
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await academicYearService.delete(res.locals.teacherId as string, req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Academic year not found' });
      return;
    }
    res.status(204).send();
  });

  router.get('/:id/modules', async (req: Request<{ id: string }>, res: Response) => {
    const moduleIds = await academicYearService.getSelection(res.locals.teacherId as string, req.params.id);
    if (moduleIds === null) {
      res.status(404).json({ message: 'Academic year not found' });
      return;
    }
    res.status(200).json({ moduleIds });
  });

  router.put('/:id/modules', async (req: Request<{ id: string }>, res: Response) => {
    const { moduleIds } = req.body as { moduleIds?: unknown };
    if (!Array.isArray(moduleIds) || !moduleIds.every((entry) => typeof entry === 'string')) {
      res.status(400).json({ message: 'moduleIds must be an array of strings' });
      return;
    }

    const result = await academicYearService.replaceSelection(res.locals.teacherId as string, req.params.id, moduleIds);
    if (result === null) {
      res.status(404).json({ message: 'Academic year not found, or one of moduleIds is not owned by this teacher' });
      return;
    }
    res.status(200).json({ moduleIds: result });
  });

  return router;
}
