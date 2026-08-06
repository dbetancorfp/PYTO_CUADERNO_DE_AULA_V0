import type { SqlExecutor } from '../../db/sql-executor';
import type {
  AcademicYearModuleDetail,
  AcademicYearModuleRef,
  AcademicYearModuleRepository,
} from '../academic-year-module.repository';

interface AcademicYearModuleDetailRow {
  id: string;
  catalog_module_id: string;
  catalog_training_cycle_id: string;
  catalog_training_cycle_name: string;
  course: number;
  name: string;
}

interface AcademicYearModuleRefRow {
  id: string;
  academic_year_id: string;
  catalog_module_id: string;
}

function toDetail(row: AcademicYearModuleDetailRow): AcademicYearModuleDetail {
  return {
    id: row.id,
    catalogModuleId: row.catalog_module_id,
    catalogTrainingCycleId: row.catalog_training_cycle_id,
    catalogTrainingCycleName: row.catalog_training_cycle_name,
    course: row.course,
    name: row.name,
  };
}

function toRef(row: AcademicYearModuleRefRow): AcademicYearModuleRef {
  return { id: row.id, academicYearId: row.academic_year_id, catalogModuleId: row.catalog_module_id };
}

/** Real `AcademicYearModuleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgAcademicYearModuleRepository implements AcademicYearModuleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForYear(academicYearId: string): Promise<AcademicYearModuleDetail[]> {
    const rows = (await this.sql`
      SELECT
        aym.id AS id,
        cm.id AS catalog_module_id,
        cc.id AS catalog_training_cycle_id,
        cc.name AS catalog_training_cycle_name,
        cm.course AS course,
        cm.name AS name
      FROM academic_year_modules aym
      JOIN catalog_modules cm ON cm.id = aym.catalog_module_id
      JOIN catalog_cycles cc ON cc.id = cm.catalog_training_cycle_id
      WHERE aym.academic_year_id = ${academicYearId}
    `) as unknown as AcademicYearModuleDetailRow[];
    return rows.map(toDetail);
  }

  async findById(id: string): Promise<AcademicYearModuleRef | null> {
    const rows = (await this.sql`
      SELECT id, academic_year_id, catalog_module_id
      FROM academic_year_modules
      WHERE id = ${id}
    `) as unknown as AcademicYearModuleRefRow[];
    const [row] = rows;
    return row ? toRef(row) : null;
  }

  async countForYear(academicYearId: string): Promise<number> {
    const rows = (await this.sql`
      SELECT COUNT(*) AS count
      FROM academic_year_modules
      WHERE academic_year_id = ${academicYearId}
    `) as unknown as { count: string }[];
    return Number(rows[0]?.count ?? 0);
  }

  async createMany(academicYearId: string, catalogModuleIds: string[]): Promise<number> {
    // One INSERT per moduleId, ON CONFLICT DO NOTHING — see
    // pg-academic-year-module.repository.test.ts's createMany test, which expects one call
    // per id (not a single bulk statement) and counts how many returned a row.
    let insertedCount = 0;
    for (const catalogModuleId of catalogModuleIds) {
      const rows = (await this.sql`
        INSERT INTO academic_year_modules (academic_year_id, catalog_module_id)
        VALUES (${academicYearId}, ${catalogModuleId})
        ON CONFLICT (academic_year_id, catalog_module_id) DO NOTHING
        RETURNING id
      `) as unknown as { id: string }[];
      if (rows.length > 0) insertedCount += 1;
    }
    return insertedCount;
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM academic_year_modules
      WHERE id = ${id}
    `;
  }
}
