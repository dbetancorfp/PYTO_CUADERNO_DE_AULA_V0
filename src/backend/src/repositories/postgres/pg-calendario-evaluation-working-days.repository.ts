import type { SqlExecutor } from '../../db/sql-executor';
import type {
  CalendarioEvaluationWorkingDaysEntry,
  CalendarioEvaluationWorkingDaysInsert,
  CalendarioEvaluationWorkingDaysRepository,
} from '../calendario-evaluation-working-days.repository';

interface CalendarioEvaluationWorkingDaysRow {
  id: string;
  academic_year_module_id: string;
  evaluation_number: number;
  working_days: number;
}

function toEntry(row: CalendarioEvaluationWorkingDaysRow): CalendarioEvaluationWorkingDaysEntry {
  return {
    id: row.id,
    academicYearModuleId: row.academic_year_module_id,
    evaluationNumber: row.evaluation_number,
    workingDays: row.working_days,
  };
}

/** Real `CalendarioEvaluationWorkingDaysRepository` implementation against Postgres via
 * `Bun.SQL` (see tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgCalendarioEvaluationWorkingDaysRepository implements CalendarioEvaluationWorkingDaysRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioEvaluationWorkingDaysEntry[]> {
    const rows = (await this.sql`
      SELECT id, academic_year_module_id, evaluation_number, working_days
      FROM calendario_evaluation_working_days
      WHERE academic_year_module_id = ${academicYearModuleId}
    `) as unknown as CalendarioEvaluationWorkingDaysRow[];
    return rows.map(toEntry);
  }

  async createMany(entries: CalendarioEvaluationWorkingDaysInsert[]): Promise<void> {
    // One INSERT per entry, ON CONFLICT DO NOTHING — same pattern as
    // pg-calendario-modulo.repository.ts's own createMany (see
    // pg-calendario-evaluation-working-days.repository.test.ts's createMany test).
    for (const entry of entries) {
      await this.sql`
        INSERT INTO calendario_evaluation_working_days (academic_year_module_id, evaluation_number, working_days)
        VALUES (${entry.academicYearModuleId}, ${entry.evaluationNumber}, ${entry.workingDays})
        ON CONFLICT (academic_year_module_id, evaluation_number) DO NOTHING
      `;
    }
  }

  async replaceForModule(academicYearModuleId: string, entries: CalendarioEvaluationWorkingDaysInsert[]): Promise<void> {
    await this.sql`
      DELETE FROM calendario_evaluation_working_days
      WHERE academic_year_module_id = ${academicYearModuleId}
    `;
    for (const entry of entries) {
      await this.sql`
        INSERT INTO calendario_evaluation_working_days (academic_year_module_id, evaluation_number, working_days)
        VALUES (${entry.academicYearModuleId}, ${entry.evaluationNumber}, ${entry.workingDays})
      `;
    }
  }
}
