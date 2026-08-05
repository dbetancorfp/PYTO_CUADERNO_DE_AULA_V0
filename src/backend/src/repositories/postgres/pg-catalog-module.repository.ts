import type { SqlExecutor } from '../../db/sql-executor';
import type { CatalogModule, CatalogModuleRepository } from '../catalog-module.repository';

interface CatalogModuleRow {
  id: string;
  catalog_training_cycle_id: string;
  course: number;
  name: string;
}

function toCatalogModule(row: CatalogModuleRow): CatalogModule {
  return { id: row.id, catalogTrainingCycleId: row.catalog_training_cycle_id, course: row.course, name: row.name };
}

/** Real `CatalogModuleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgCatalogModuleRepository implements CatalogModuleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForCycle(catalogTrainingCycleId: string): Promise<CatalogModule[]> {
    const rows = (await this.sql`
      SELECT id, catalog_training_cycle_id, course, name
      FROM catalog_modules
      WHERE catalog_training_cycle_id = ${catalogTrainingCycleId}
    `) as unknown as CatalogModuleRow[];
    return rows.map(toCatalogModule);
  }

  async findById(id: string): Promise<CatalogModule | null> {
    const rows = (await this.sql`
      SELECT id, catalog_training_cycle_id, course, name
      FROM catalog_modules
      WHERE id = ${id}
    `) as unknown as CatalogModuleRow[];
    const [row] = rows;
    return row ? toCatalogModule(row) : null;
  }

  async findByNameAndCourse(catalogTrainingCycleId: string, course: number, name: string): Promise<CatalogModule | null> {
    const rows = (await this.sql`
      SELECT id, catalog_training_cycle_id, course, name
      FROM catalog_modules
      WHERE catalog_training_cycle_id = ${catalogTrainingCycleId} AND course = ${course} AND name = ${name}
    `) as unknown as CatalogModuleRow[];
    const [row] = rows;
    return row ? toCatalogModule(row) : null;
  }

  async create(catalogTrainingCycleId: string, course: number, name: string): Promise<CatalogModule> {
    const rows = (await this.sql`
      INSERT INTO catalog_modules (catalog_training_cycle_id, course, name)
      VALUES (${catalogTrainingCycleId}, ${course}, ${name})
      RETURNING id, catalog_training_cycle_id, course, name
    `) as unknown as CatalogModuleRow[];
    return toCatalogModule(rows[0]!);
  }

  async update(id: string, changes: Partial<Pick<CatalogModule, 'name' | 'course'>>): Promise<CatalogModule> {
    // A single UPDATE, COALESCE-ing each column against its own current value so only the
    // fields actually present in `changes` are overwritten — no preceding SELECT needed.
    const name = changes.name ?? null;
    const course = changes.course ?? null;
    const rows = (await this.sql`
      UPDATE catalog_modules
      SET name = COALESCE(${name}, name), course = COALESCE(${course}, course)
      WHERE id = ${id}
      RETURNING id, catalog_training_cycle_id, course, name
    `) as unknown as CatalogModuleRow[];
    return toCatalogModule(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM catalog_modules
      WHERE id = ${id}
    `;
  }
}
