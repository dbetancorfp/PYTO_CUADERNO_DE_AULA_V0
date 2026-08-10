// Shared in-process store backing InMemoryCalendarioEvaluationWorkingDaysRepository
// (repositories/in-memory/) — mirrors repositories/in-memory/calendario-modulo-store.ts's
// role, but for the per-módulo/per-evaluación `calendario_evaluation_working_days` table
// (see views/calendario/schema-changes.sql). One instance lives for the lifetime of the
// Express app (see app.ts's composition root).
import type { CalendarioEvaluationWorkingDaysEntry } from '../calendario-evaluation-working-days.repository';

export class CalendarioEvaluationWorkingDaysStore {
  readonly entries = new Map<string, CalendarioEvaluationWorkingDaysEntry>();
}
