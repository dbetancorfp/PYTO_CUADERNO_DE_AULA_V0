import type { SqlExecutor } from '../../db/sql-executor';
import type { AcademicYearModuleRepository } from '../academic-year-module.repository';

interface ModuleIdRow {
  module_id: string;
}

/** Real `AcademicYearModuleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgAcademicYearModuleRepository implements AcademicYearModuleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findModuleIdsForYear(academicYearId: string): Promise<string[]> {
    const rows = (await this.sql`
      SELECT module_id
      FROM academic_year_modules
      WHERE academic_year_id = ${academicYearId}
    `) as unknown as ModuleIdRow[];
    return rows.map((row) => row.module_id);
  }

  async replaceSelection(academicYearId: string, moduleIds: string[]): Promise<void> {
    await this.sql`
      DELETE FROM academic_year_modules
      WHERE academic_year_id = ${academicYearId}
    `;

    if (moduleIds.length === 0) return;

    for (const moduleId of moduleIds) {
      await this.sql`
        INSERT INTO academic_year_modules (academic_year_id, module_id)
        VALUES (${academicYearId}, ${moduleId})
      `;
    }
  }
}
