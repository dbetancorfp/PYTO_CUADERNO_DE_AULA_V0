import type { SqlExecutor } from '../../db/sql-executor';
import type {
  AcademicYearModuleScheduleEntry,
  AcademicYearModuleScheduleRepository,
} from '../academic-year-module-schedule.repository';

interface AcademicYearModuleScheduleRow {
  weekday: number;
  hours: number;
}

function toEntry(row: AcademicYearModuleScheduleRow): AcademicYearModuleScheduleEntry {
  return { weekday: row.weekday, hours: row.hours };
}

/** Real `AcademicYearModuleScheduleRepository` implementation against Postgres via `Bun.SQL`
 * (see tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgAcademicYearModuleScheduleRepository implements AcademicYearModuleScheduleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByModuleId(academicYearModuleId: string): Promise<AcademicYearModuleScheduleEntry[]> {
    const rows = (await this.sql`
      SELECT weekday, hours
      FROM academic_year_module_schedules
      WHERE academic_year_module_id = ${academicYearModuleId}
    `) as unknown as AcademicYearModuleScheduleRow[];
    return rows.map(toEntry);
  }

  async replaceAll(
    academicYearModuleId: string,
    entries: AcademicYearModuleScheduleEntry[],
  ): Promise<AcademicYearModuleScheduleEntry[]> {
    // Full replace: one DELETE clearing every existing row for this módulo, followed by one
    // INSERT per entry — see pg-academic-year-module-schedule.repository.test.ts, which pins
    // this exact call sequence (not a single bulk statement), mirroring
    // pg-academic-year-module.repository.ts's own createMany.
    await this.sql`
      DELETE FROM academic_year_module_schedules
      WHERE academic_year_module_id = ${academicYearModuleId}
    `;

    const result: AcademicYearModuleScheduleEntry[] = [];
    for (const entry of entries) {
      const rows = (await this.sql`
        INSERT INTO academic_year_module_schedules (academic_year_module_id, weekday, hours)
        VALUES (${academicYearModuleId}, ${entry.weekday}, ${entry.hours})
        RETURNING weekday, hours
      `) as unknown as AcademicYearModuleScheduleRow[];
      const [row] = rows;
      if (row) result.push(toEntry(row));
    }
    return result;
  }
}
