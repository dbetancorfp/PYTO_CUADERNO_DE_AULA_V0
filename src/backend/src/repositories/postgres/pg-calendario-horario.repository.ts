import type { SqlExecutor } from '../../db/sql-executor';
import type { CalendarioHorarioEntry, CalendarioHorarioRepository } from '../calendario-horario.repository';

interface CalendarioHorarioRow {
  // Bun.SQL returns a Postgres DATE column as a JS Date, not a string — normalized to
  // "YYYY-MM-DD" by toIsoDate below so the API always serializes the shape
  // api-contracts.md documents, regardless of what the driver hands back (see
  // pg-calendario-modulo.repository.ts's identical convention).
  date: string | Date;
  hours: number;
}

function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toEntry(row: CalendarioHorarioRow): CalendarioHorarioEntry {
  return { date: toIsoDate(row.date), hours: row.hours };
}

/** Real `CalendarioHorarioRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgCalendarioHorarioRepository implements CalendarioHorarioRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioHorarioEntry[]> {
    const rows = (await this.sql`
      SELECT date, hours
      FROM calendario_horario
      WHERE academic_year_module_id = ${academicYearModuleId}
      ORDER BY date ASC
    `) as unknown as CalendarioHorarioRow[];
    return rows.map(toEntry);
  }

  async replaceAll(academicYearModuleId: string, entries: CalendarioHorarioEntry[]): Promise<void> {
    // Full replace: one DELETE clearing every existing row for this módulo, followed by one
    // INSERT per entry — see pg-calendario-horario.repository.test.ts, which pins this exact
    // call sequence (not a single bulk statement), mirroring
    // pg-academic-year-module-schedule.repository.ts's own replaceAll.
    await this.sql`
      DELETE FROM calendario_horario
      WHERE academic_year_module_id = ${academicYearModuleId}
    `;

    for (const entry of entries) {
      await this.sql`
        INSERT INTO calendario_horario (academic_year_module_id, date, hours)
        VALUES (${academicYearModuleId}, ${entry.date}, ${entry.hours})
      `;
    }
  }
}
