import type { SqlExecutor } from '../../db/sql-executor';
import type {
  CatalogTrainingCycle,
  CatalogTrainingCycleRepository,
} from '../catalog-training-cycle.repository';

interface CatalogTrainingCycleRow {
  id: string;
  teacher_id: string;
  name: string;
}

function toCatalogTrainingCycle(row: CatalogTrainingCycleRow): CatalogTrainingCycle {
  return { id: row.id, teacherId: row.teacher_id, name: row.name };
}

/** Real `CatalogTrainingCycleRepository` implementation against Postgres via `Bun.SQL` (see
 * tecnologias/tecnologia_bbdd.md "Client / driver"). */
export class PgCatalogTrainingCycleRepository implements CatalogTrainingCycleRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findAllForTeacher(teacherId: string): Promise<CatalogTrainingCycle[]> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name
      FROM catalog_training_cycles
      WHERE teacher_id = ${teacherId}
    `) as unknown as CatalogTrainingCycleRow[];
    return rows.map(toCatalogTrainingCycle);
  }

  async findById(teacherId: string, id: string): Promise<CatalogTrainingCycle | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name
      FROM catalog_training_cycles
      WHERE teacher_id = ${teacherId} AND id = ${id}
    `) as unknown as CatalogTrainingCycleRow[];
    const [row] = rows;
    return row ? toCatalogTrainingCycle(row) : null;
  }

  async findByName(teacherId: string, name: string): Promise<CatalogTrainingCycle | null> {
    const rows = (await this.sql`
      SELECT id, teacher_id, name
      FROM catalog_training_cycles
      WHERE teacher_id = ${teacherId} AND name = ${name}
    `) as unknown as CatalogTrainingCycleRow[];
    const [row] = rows;
    return row ? toCatalogTrainingCycle(row) : null;
  }

  async create(teacherId: string, name: string): Promise<CatalogTrainingCycle> {
    const rows = (await this.sql`
      INSERT INTO catalog_training_cycles (teacher_id, name)
      VALUES (${teacherId}, ${name})
      RETURNING id, teacher_id, name
    `) as unknown as CatalogTrainingCycleRow[];
    return toCatalogTrainingCycle(rows[0]!);
  }

  async rename(id: string, name: string): Promise<CatalogTrainingCycle> {
    const rows = (await this.sql`
      UPDATE catalog_training_cycles
      SET name = ${name}
      WHERE id = ${id}
      RETURNING id, teacher_id, name
    `) as unknown as CatalogTrainingCycleRow[];
    return toCatalogTrainingCycle(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.sql`
      DELETE FROM catalog_training_cycles
      WHERE id = ${id}
    `;
  }
}
