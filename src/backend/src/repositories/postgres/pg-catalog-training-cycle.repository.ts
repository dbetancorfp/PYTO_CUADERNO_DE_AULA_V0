import type { SqlExecutor } from '../../db/sql-executor';
import type {
  CatalogTrainingCycle,
  CatalogTrainingCycleRepository,
} from '../catalog-training-cycle.repository';

interface CatalogTrainingCycleRow {
  id: string;
  name: string;
}

function toCatalogTrainingCycle(row: CatalogTrainingCycleRow): CatalogTrainingCycle {
  return { id: row.id, name: row.name };
}

/** Real `CatalogTrainingCycleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgCatalogTrainingCycleRepository implements CatalogTrainingCycleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAll(): Promise<CatalogTrainingCycle[]> {
    const rows = (await this.sql`
      SELECT id, name
      FROM catalog_cycles
    `) as unknown as CatalogTrainingCycleRow[];
    return rows.map(toCatalogTrainingCycle);
  }

  async findById(id: string): Promise<CatalogTrainingCycle | null> {
    const rows = (await this.sql`
      SELECT id, name
      FROM catalog_cycles
      WHERE id = ${id}
    `) as unknown as CatalogTrainingCycleRow[];
    const [row] = rows;
    return row ? toCatalogTrainingCycle(row) : null;
  }

  async findByName(name: string): Promise<CatalogTrainingCycle | null> {
    const rows = (await this.sql`
      SELECT id, name
      FROM catalog_cycles
      WHERE name = ${name}
    `) as unknown as CatalogTrainingCycleRow[];
    const [row] = rows;
    return row ? toCatalogTrainingCycle(row) : null;
  }

  async create(name: string): Promise<CatalogTrainingCycle> {
    const rows = (await this.sql`
      INSERT INTO catalog_cycles (name)
      VALUES (${name})
      RETURNING id, name
    `) as unknown as CatalogTrainingCycleRow[];
    return toCatalogTrainingCycle(rows[0]!);
  }

  async rename(id: string, name: string): Promise<CatalogTrainingCycle> {
    const rows = (await this.sql`
      UPDATE catalog_cycles
      SET name = ${name}
      WHERE id = ${id}
      RETURNING id, name
    `) as unknown as CatalogTrainingCycleRow[];
    return toCatalogTrainingCycle(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM catalog_cycles
      WHERE id = ${id}
    `;
  }
}
