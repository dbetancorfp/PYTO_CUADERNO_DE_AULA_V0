import type { SqlExecutor } from '../../db/sql-executor';
import type {
  CalendarioModuloEntry,
  CalendarioModuloInsert,
  CalendarioModuloRepository,
} from '../calendario-modulo.repository';

interface CalendarioModuloRow {
  id: string;
  academic_year_module_id: string;
  category: string;
  name: string;
  // Bun.SQL returns a Postgres DATE column as a JS Date, not a string — normalized to
  // "YYYY-MM-DD" by toIsoDate below so the API always serializes the shape
  // api-contracts.md documents, regardless of what the driver hands back.
  start_date: string | Date;
  end_date: string | Date;
}

function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toEntry(row: CalendarioModuloRow): CalendarioModuloEntry {
  return {
    id: row.id,
    academicYearModuleId: row.academic_year_module_id,
    category: row.category,
    name: row.name,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
  };
}

/** Real `CalendarioModuloRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgCalendarioModuloRepository implements CalendarioModuloRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForAcademicYearModule(academicYearModuleId: string): Promise<CalendarioModuloEntry[]> {
    const rows = (await this.sql`
      SELECT id, academic_year_module_id, category, name, start_date, end_date
      FROM calendario_modulo
      WHERE academic_year_module_id = ${academicYearModuleId}
    `) as unknown as CalendarioModuloRow[];
    return rows.map(toEntry);
  }

  async createMany(entries: CalendarioModuloInsert[]): Promise<void> {
    // One INSERT per entry, ON CONFLICT DO NOTHING — see
    // pg-calendario-modulo.repository.test.ts's createMany test, which expects one call per
    // entry (not a single bulk statement), mirroring
    // pg-academic-year-module.repository.ts's own createMany.
    for (const entry of entries) {
      await this.sql`
        INSERT INTO calendario_modulo (academic_year_module_id, category, name, start_date, end_date)
        VALUES (${entry.academicYearModuleId}, ${entry.category}, ${entry.name}, ${entry.startDate}, ${entry.endDate})
        ON CONFLICT (academic_year_module_id, category, name, start_date) DO NOTHING
      `;
    }
  }
}
