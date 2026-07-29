// elementId: module-cycle-select, module-table, module-table-add-button,
// module-delete-blocked-message, module-edit-confirm-modal (HTTP contract side of UC-06 —
// see views/configuracion/api-contracts.md). Split into two router factories, mounted at two
// different prefixes by app.ts: `cycleModulesRouter` under
// /api/training-cycles/:cycleId/modules (cycle-scoped create/list) and `moduleRouter` under
// /api/modules (flat cross-cycle list, rename/re-course, delete — id-scoped, no cycleId in
// the path, matching api-contracts.md's PATCH/DELETE /api/modules/:id).
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { ModuleService } from '../services/module.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';

const courseSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** GET/POST /api/training-cycles/:cycleId/modules — must be mounted with Express's
 * `mergeParams: true` so `req.params.cycleId` is visible here. */
export function cycleModulesRouter(moduleService: ModuleService, sessionService: SessionService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth(sessionService));

  router.get('/', async (req: Request<{ cycleId: string }>, res: Response) => {
    const modules = await moduleService.listForCycle(res.locals.teacherId as string, req.params.cycleId);
    if (modules === null) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(200).json({ modules });
  });

  router.post('/', async (req: Request<{ cycleId: string }>, res: Response) => {
    const { name, course } = req.body as { name?: unknown; course?: unknown };
    const courseResult = courseSchema.safeParse(course);
    if (!isNonEmptyString(name) || !courseResult.success) {
      res.status(400).json({ message: 'name is required and course must be 1, 2 or 3' });
      return;
    }

    const module = await moduleService.create(res.locals.teacherId as string, req.params.cycleId, name, courseResult.data);
    if (module === null) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(201).json(module);
  });

  return router;
}

/** GET /api/modules (flat), PATCH/DELETE /api/modules/:id. */
export function moduleRouter(moduleService: ModuleService, sessionService: SessionService): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (_req: Request, res: Response) => {
    const modules = await moduleService.listForTeacher(res.locals.teacherId as string);
    res.status(200).json({ modules });
  });

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { name, course, confirm } = req.body as { name?: unknown; course?: unknown; confirm?: unknown };

    const changes: { name?: string; course?: number } = {};
    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        res.status(400).json({ message: 'name must be a non-empty string' });
        return;
      }
      changes.name = name;
    }
    if (course !== undefined) {
      const courseResult = courseSchema.safeParse(course);
      if (!courseResult.success) {
        res.status(400).json({ message: 'course must be 1, 2 or 3' });
        return;
      }
      changes.course = courseResult.data;
    }

    const module = await moduleService.update(res.locals.teacherId as string, req.params.id, changes, confirm === true);
    if (module === null) {
      res.status(404).json({ message: 'Module not found' });
      return;
    }
    res.status(200).json(module);
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await moduleService.delete(res.locals.teacherId as string, req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Module not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
