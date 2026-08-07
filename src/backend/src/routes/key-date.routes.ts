// elementId: academic-key-dates-table, holidays-table, public-holidays-table,
// free-disposal-days-table, evaluations-table, feoe-project-days-table (HTTP contract side
// of UC-02..UC-07 — see views/fechas-senaladas/api-contracts.md). One resource for all six
// categories: GET/POST /api/key-dates, PATCH/DELETE /api/key-dates/:id. `router.param('id',
// requireValidUuidParam)` is mandatory here — a malformed :id must 404 instead of ever
// reaching Postgres, which throws (22P02) for a non-UUID string in a `uuid` column (see
// require-valid-uuid.ts).
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { KeyDate } from '../repositories/key-date.repository';
import type { KeyDateService } from '../services/key-date.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { requireValidUuidParam } from './require-valid-uuid';

const VALID_CATEGORIES = [
  'academic_key_dates',
  'holidays',
  'public_holidays',
  'free_disposal_days',
  'evaluations',
  'feoe_project_days',
] as const;

const categorySchema = z.enum(VALID_CATEGORIES);

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** True when `day`/`month` form a real day-in-month. No year is stored, so February always
 * allows up to day 29 — a leap-year day 29 must be accepted (see
 * views/fechas-senaladas/description_fechas-senaladas.md). */
function isValidDayInMonth(day: number, month: number): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  return day <= DAYS_IN_MONTH[month - 1]!;
}

const createSchema = z.object({
  category: categorySchema,
  name: z.string().min(1),
  startDay: z.number().int().min(1).max(31),
  startMonth: z.number().int().min(1).max(12),
  endDay: z.number().int().min(1).max(31),
  endMonth: z.number().int().min(1).max(12),
  type: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startDay: z.number().int().min(1).max(31).optional(),
  startMonth: z.number().int().min(1).max(12).optional(),
  endDay: z.number().int().min(1).max(31).optional(),
  endMonth: z.number().int().min(1).max(12).optional(),
  type: z.string().optional(),
});

function toResponseBody(keyDate: KeyDate): KeyDate {
  return keyDate;
}

export function keyDateRouter(keyDateService: KeyDateService, sessionService: SessionService): Router {
  const router = Router();
  router.use(requireAuth(sessionService));
  router.param('id', requireValidUuidParam);

  router.get('/', async (req: Request, res: Response) => {
    const { category } = req.query as { category?: string };
    if (category !== undefined && !categorySchema.safeParse(category).success) {
      res.status(400).json({ message: 'category must be one of the six valid values' });
      return;
    }

    const keyDates = await keyDateService.list(category);
    res.status(200).json({ keyDates });
  });

  router.post('/', async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid key date payload' });
      return;
    }
    const { category, name, startDay, startMonth, endDay, endMonth, type } = parsed.data;
    if (!isValidDayInMonth(startDay, startMonth) || !isValidDayInMonth(endDay, endMonth)) {
      res.status(400).json({ message: 'startDay/startMonth and endDay/endMonth must be a real day-in-month' });
      return;
    }

    const created = await keyDateService.create({
      category,
      name,
      startDay,
      startMonth,
      endDay,
      endMonth,
      type: type ?? null,
    });
    res.status(201).json(toResponseBody(created));
  });

  router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid key date payload' });
      return;
    }
    const { startDay, startMonth, endDay, endMonth } = parsed.data;
    if ((startDay !== undefined) !== (startMonth !== undefined)) {
      res.status(400).json({ message: 'startDay and startMonth must be provided together' });
      return;
    }
    if ((endDay !== undefined) !== (endMonth !== undefined)) {
      res.status(400).json({ message: 'endDay and endMonth must be provided together' });
      return;
    }
    if (startDay !== undefined && startMonth !== undefined && !isValidDayInMonth(startDay, startMonth)) {
      res.status(400).json({ message: 'startDay/startMonth must be a real day-in-month' });
      return;
    }
    if (endDay !== undefined && endMonth !== undefined && !isValidDayInMonth(endDay, endMonth)) {
      res.status(400).json({ message: 'endDay/endMonth must be a real day-in-month' });
      return;
    }

    const updated = await keyDateService.update(req.params.id, parsed.data);
    if (updated === null) {
      res.status(404).json({ message: 'Key date not found' });
      return;
    }
    res.status(200).json(toResponseBody(updated));
  });

  router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const result = await keyDateService.delete(req.params.id);
    if (result === null) {
      res.status(404).json({ message: 'Key date not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}
