// elementId: catalog-training-cycle-table, catalog-training-cycle-table-add-button (HTTP
// contract side of UC-04 — see views/configuracion/api-contracts.md GET/POST
// /api/catalog/training-cycles, PATCH/DELETE /api/catalog/training-cycles/:id). No
// HAS_DEPENDENTS case here — catalog_training_cycles has no FK relation to anything
// year-related, deletion is unconditional (unlike the old, now-dropped training_cycles
// table).
import { Router, type Request, type Response } from 'express';
import type { CatalogTrainingCycle } from '../repositories/catalog-training-cycle.repository';
import type { CatalogTrainingCycleService } from '../services/catalog-training-cycle.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

// api-contracts.md documents training-cycle responses as { id, name } — teacherId is an
// internal ownership detail, never serialized to the client.
function toPublicCycle(cycle: CatalogTrainingCycle): Omit<CatalogTrainingCycle, 'teacherId'> {
  const { teacherId: _teacherId, ...publicCycle } = cycle;
  return publicCycle;
}

export function catalogTrainingCycleRouter(
  catalogTrainingCycleService: CatalogTrainingCycleService,
  sessionService: SessionService,
): Router {
  const router = Router();
  router.use(requireAuth(sessionService));

  router.get('/', async (_req: Request, res: Response) => {
    const trainingCycles = await catalogTrainingCycleService.list(res.locals.teacherId as string);
    res.status(200).json({ trainingCycles: trainingCycles.map(toPublicCycle) });
  });

  router.post('/', async (req: Request, res: Response) => {
    const { name } = req.body as { name?: unknown };
    if (!isNonEmptyString(name)) {
      res.status(400).json({ message: 'name is required' });
      return;
    }

    const cycle = await catalogTrainingCycleService.create(res.locals.teacherId as string, name);
    res.status(201).json(toPublicCycle(cycle));
  });

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { name } = req.body as { name?: unknown };
    if (!isNonEmptyString(name)) {
      res.status(400).json({ message: 'name is required' });
      return;
    }

    const cycle = await catalogTrainingCycleService.rename(res.locals.teacherId as string, req.params.id, name);
    if (!cycle) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(200).json(toPublicCycle(cycle));
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await catalogTrainingCycleService.delete(res.locals.teacherId as string, req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Training cycle not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
