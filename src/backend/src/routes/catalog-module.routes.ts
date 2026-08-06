// elementId: catalog-module-table, catalog-module-table-add-button (HTTP contract side of
// UC-05 — see views/configuracion/api-contracts.md). Split into two router factories,
// mounted at two different prefixes by app.ts: `catalogCycleModulesRouter` under
// /api/catalog/training-cycles/:cycleId/modules (cycle-scoped create/list) and
// `catalogModuleRouter` under /api/catalog/modules (rename/re-course, delete — id-scoped, no
// cycleId in the path). No confirm-flow for edits — always immediate. Delete IS
// dependency-blocked (409 HAS_DEPENDENTS) as of the 2026-08-06 fix for #4 — see
// CatalogModuleService.delete.
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CatalogModuleService } from '../services/catalog-module.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';

const courseSchema = z.union([z.literal(1), z.literal(2)]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** GET/POST /api/catalog/training-cycles/:cycleId/modules — must be mounted with Express's
 * `mergeParams: true` so `req.params.cycleId` is visible here. */
export function catalogCycleModulesRouter(
  catalogModuleService: CatalogModuleService,
  sessionService: SessionService,
): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth(sessionService));

  router.get('/', async (req: Request<{ cycleId: string }>, res: Response) => {
    const modules = await catalogModuleService.listForCycle(req.params.cycleId);
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
      res.status(400).json({ message: 'name is required and course must be 1 or 2' });
      return;
    }

    const module = await catalogModuleService.create(req.params.cycleId, name, courseResult.data);
    if (module === null) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(201).json(module);
  });

  return router;
}

/** PATCH/DELETE /api/catalog/modules/:id. */
export function catalogModuleRouter(
  catalogModuleService: CatalogModuleService,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { name, course } = req.body as { name?: unknown; course?: unknown };

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
        res.status(400).json({ message: 'course must be 1 or 2' });
        return;
      }
      changes.course = courseResult.data;
    }

    const module = await catalogModuleService.update(req.params.id, changes);
    if (module === null) {
      res.status(404).json({ message: 'Module not found' });
      return;
    }
    res.status(200).json(module);
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await catalogModuleService.delete(req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Module not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
