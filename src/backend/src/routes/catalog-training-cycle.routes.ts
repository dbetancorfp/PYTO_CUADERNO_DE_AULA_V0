// elementId: catalog-training-cycle-table, catalog-training-cycle-table-add-button (HTTP
// contract side of UC-04 — see views/configuracion/api-contracts.md GET/POST
// /api/catalog/training-cycles, PATCH/DELETE /api/catalog/training-cycles/:id). Delete IS
// dependency-blocked (409 HAS_DEPENDENTS) as of the 2026-08-06 fix for #4 — see
// CatalogTrainingCycleService.delete.
import { Router, type Request, type Response } from 'express';
import type { CatalogTrainingCycleService } from '../services/catalog-training-cycle.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function catalogTrainingCycleRouter(
  catalogTrainingCycleService: CatalogTrainingCycleService,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (_req: Request, res: Response) => {
    const trainingCycles = await catalogTrainingCycleService.list();
    res.status(200).json({ trainingCycles });
  });

  router.post('/', async (req: Request, res: Response) => {
    const { name } = req.body as { name?: unknown };
    if (!isNonEmptyString(name)) {
      res.status(400).json({ message: 'name is required' });
      return;
    }

    const cycle = await catalogTrainingCycleService.create(name);
    res.status(201).json(cycle);
  });

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { name } = req.body as { name?: unknown };
    if (!isNonEmptyString(name)) {
      res.status(400).json({ message: 'name is required' });
      return;
    }

    const cycle = await catalogTrainingCycleService.rename(req.params.id, name);
    if (!cycle) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(200).json(cycle);
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await catalogTrainingCycleService.delete(req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
