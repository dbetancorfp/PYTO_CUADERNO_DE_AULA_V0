// elementId: module-table (HTTP contract side of UC-09's row-level Quitar — see
// views/configuracion/api-contracts.md "DELETE /api/academic-year-modules/:id"),
// schedule-monday-select, schedule-tuesday-select, schedule-wednesday-select,
// schedule-thursday-select, schedule-friday-select, schedule-save-button,
// schedule-save-message (HTTP contract side of UC-11 — see api-contracts.md's "Horario"
// section). Mounted at /api/academic-year-modules by app.ts. The DELETE route deletes only
// the `academic_year_modules` row — never the underlying `catalog_modules` row. The
// schedule routes validate weekday/hours range and duplicate weekdays here, at the route
// layer — the service trusts its input (see academic-year-module-schedule.service.ts).
import { Router, type Request, type Response } from 'express';
import type { AcademicYearModuleScheduleEntry } from '../repositories/academic-year-module-schedule.repository';
import type { AcademicYearModuleScheduleService } from '../services/academic-year-module-schedule.service';
import type { AcademicYearService } from '../services/academic-year.service';
import type { SessionService } from '../services/session.service';
import { requireAuth } from './require-auth';
import { requireValidUuidParam } from './require-valid-uuid';

function isValidScheduleEntry(value: unknown): value is AcademicYearModuleScheduleEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { weekday, hours } = value as { weekday?: unknown; hours?: unknown };
  return (
    Number.isInteger(weekday) &&
    (weekday as number) >= 1 &&
    (weekday as number) <= 5 &&
    Number.isInteger(hours) &&
    (hours as number) >= 1 &&
    (hours as number) <= 3
  );
}

function hasDuplicateWeekday(entries: AcademicYearModuleScheduleEntry[]): boolean {
  const seenWeekdays = new Set<number>();
  for (const entry of entries) {
    if (seenWeekdays.has(entry.weekday)) return true;
    seenWeekdays.add(entry.weekday);
  }
  return false;
}

export function academicYearModuleRouter(
  academicYearService: AcademicYearService,
  academicYearModuleScheduleService: AcademicYearModuleScheduleService,
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

  router.get('/:id/schedule', async (req: Request<{ id: string }>, res: Response) => {
    const schedule = await academicYearModuleScheduleService.getSchedule(res.locals.teacherId as string, req.params.id);
    if (schedule === null) {
      res.status(404).json({ message: 'Academic year módulo assignment not found' });
      return;
    }
    res.status(200).json({ schedule });
  });

  router.put('/:id/schedule', async (req: Request<{ id: string }>, res: Response) => {
    const { schedule } = req.body as { schedule?: unknown };
    if (!Array.isArray(schedule) || !schedule.every(isValidScheduleEntry)) {
      res.status(400).json({ message: 'schedule must be an array of { weekday: 1-5, hours: 1-3 } entries' });
      return;
    }
    if (hasDuplicateWeekday(schedule)) {
      res.status(400).json({ message: 'schedule cannot contain the same weekday more than once' });
      return;
    }

    const result = await academicYearModuleScheduleService.saveSchedule(
      res.locals.teacherId as string,
      req.params.id,
      schedule,
    );
    if (result === null) {
      res.status(404).json({ message: 'Academic year módulo assignment not found' });
      return;
    }
    res.status(200).json({ schedule: result });
  });

  return router;
}
